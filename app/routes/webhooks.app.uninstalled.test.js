import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the `app/uninstalled` webhook handler (Slice 9, issue #10).
 *
 * The PRD requires that when a merchant uninstalls the app we delete every
 * row of OriginStory data that lives in our own database for that shop —
 * specifically `BrandSettings` and `ScanEvent`. The existing `Session`
 * cleanup must keep working, and the handler must remain idempotent
 * because Shopify can fire the `app/uninstalled` webhook more than once
 * (and can fire it after the session row has already been swept).
 *
 * Story metaobjects (`app:product_story`) intentionally do NOT get deleted
 * here — they live in the merchant's own Shopify data, and Shopify handles
 * the lifecycle of app-owned metaobjects.
 *
 * Mocks mirror the patterns in:
 *   - `app/models/BrandSettings.server.test.js` (prisma client shape)
 *   - `app/routes/api.product-story.$productId.test.js` (authenticate)
 */

// -----------------------------------------------------------------------------
// Module mocks (hoisted above the route import below)
// -----------------------------------------------------------------------------

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: vi.fn() },
}));

vi.mock("../db.server", () => ({
  default: {
    session: { deleteMany: vi.fn() },
    brandSettings: { deleteMany: vi.fn() },
    scanEvent: { deleteMany: vi.fn() },
  },
}));

import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { action } from "./webhooks.app.uninstalled.tsx";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SHOP = "test-shop.myshopify.com";
const TOPIC = "APP_UNINSTALLED";

function buildRequest() {
  // The handler doesn't read the body itself — `authenticate.webhook` is
  // mocked to return shop/session/topic — but it does need a real Request
  // to pass through to the (mocked) authenticator.
  return new Request("https://example.myshopify.com/webhooks/app/uninstalled", {
    method: "POST",
    body: "{}",
    headers: { "Content-Type": "application/json" },
  });
}

function mockAuth({ shop = SHOP, session = { id: "offline_session" } } = {}) {
  authenticate.webhook.mockResolvedValue({
    shop,
    session,
    topic: TOPIC,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default resolutions so the handler can complete even when individual
  // tests don't wire delegates explicitly.
  prisma.session.deleteMany.mockResolvedValue({ count: 0 });
  prisma.brandSettings.deleteMany.mockResolvedValue({ count: 0 });
  prisma.scanEvent.deleteMany.mockResolvedValue({ count: 0 });
});

// -----------------------------------------------------------------------------
// Always-on data cleanup
//
// These run on every firing of the webhook — not gated on `session`. The
// webhook can arrive after a previous run has already deleted the session
// row, and merchant data still needs to be wiped in that case.
// -----------------------------------------------------------------------------

describe("webhooks.app.uninstalled — always-on data cleanup", () => {
  it("deletes BrandSettings for the shop even when session is null", async () => {
    mockAuth({ session: null });

    await action({
      request: buildRequest(),
      params: {},
      context: {},
    });

    expect(prisma.brandSettings.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.brandSettings.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP },
    });
  });

  it("deletes ScanEvent rows for the shop even when session is null", async () => {
    mockAuth({ session: null });

    await action({
      request: buildRequest(),
      params: {},
      context: {},
    });

    expect(prisma.scanEvent.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.scanEvent.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP },
    });
  });
});

// -----------------------------------------------------------------------------
// Existing behavior preserved
// -----------------------------------------------------------------------------

describe("webhooks.app.uninstalled — session cleanup (existing behavior)", () => {
  it("deletes the session row for the shop when session is non-null", async () => {
    mockAuth({ session: { id: "offline_session" } });

    await action({
      request: buildRequest(),
      params: {},
      context: {},
    });

    expect(prisma.session.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP },
    });
  });

  it("does NOT call prisma.session.deleteMany when session is null", async () => {
    mockAuth({ session: null });

    await action({
      request: buildRequest(),
      params: {},
      context: {},
    });

    expect(prisma.session.deleteMany).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// Return value
// -----------------------------------------------------------------------------

describe("webhooks.app.uninstalled — return value", () => {
  it("returns a Response", async () => {
    mockAuth();

    const result = await action({
      request: buildRequest(),
      params: {},
      context: {},
    });

    expect(result).toBeInstanceOf(Response);
  });
});

// -----------------------------------------------------------------------------
// Idempotency
//
// Re-firing the webhook on a shop with no remaining data must not throw.
// Prisma's `deleteMany` returns `{ count: 0 }` when nothing matched; the
// handler must complete successfully and still hand back a Response.
// -----------------------------------------------------------------------------

describe("webhooks.app.uninstalled — idempotency", () => {
  it("resolves and returns a Response when brandSettings.deleteMany returns { count: 0 }", async () => {
    mockAuth();
    prisma.brandSettings.deleteMany.mockResolvedValue({ count: 0 });
    prisma.scanEvent.deleteMany.mockResolvedValue({ count: 0 });
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });

    const result = await action({
      request: buildRequest(),
      params: {},
      context: {},
    });

    expect(result).toBeInstanceOf(Response);
  });
});

// -----------------------------------------------------------------------------
// Shop scoping
//
// Cross-shop deletion would be a Critical data-loss bug. Pin that every
// deleteMany receives exactly the shop returned by authenticate.webhook.
// -----------------------------------------------------------------------------

describe("webhooks.app.uninstalled — shop scoping", () => {
  it("scopes every deleteMany call to the shop returned by authenticate.webhook", async () => {
    const SHOP_A = "shop-a.myshopify.com";
    mockAuth({ shop: SHOP_A, session: { id: "offline_session" } });

    await action({
      request: buildRequest(),
      params: {},
      context: {},
    });

    expect(prisma.session.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP_A },
    });
    expect(prisma.brandSettings.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP_A },
    });
    expect(prisma.scanEvent.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP_A },
    });
  });
});
