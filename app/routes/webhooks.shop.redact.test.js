import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the GDPR `shop/redact` webhook handler.
 *
 * Handler contract (pinned by these tests):
 *   1. Calls `authenticate.webhook(request)` exactly once.
 *   2. Logs the topic via `console.log`.
 *   3. Defensively re-runs BrandSettings + ScanEvent + Session deleteMany for
 *      the shop (the `app/uninstalled` handler already wiped it 48h earlier;
 *      this is a safety net so we satisfy "delete all shop data" on the
 *      redact deadline).
 *   4. Returns a Response with status 200/204.
 *   5. Does NOT throw.
 */

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: vi.fn() },
}));

vi.mock("../db.server", () => ({
  default: {
    brandSettings: { deleteMany: vi.fn() },
    scanEvent: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
  },
}));

import { authenticate } from "../shopify.server";
import db from "../db.server";
import { action } from "./webhooks.shop.redact.tsx";

const SHOP = "test-shop.myshopify.com";
const TOPIC = "SHOP_REDACT";

function buildRequest() {
  return new Request("https://example.myshopify.com/webhooks/shop/redact", {
    method: "POST",
    body: JSON.stringify({ shop_id: 954889, shop_domain: SHOP }),
    headers: { "Content-Type": "application/json" },
  });
}

function mockAuth({ shop = SHOP, topic = TOPIC } = {}) {
  authenticate.webhook.mockResolvedValue({
    shop,
    topic,
    session: null,
    payload: {},
  });
}

let logSpy;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  // Each delete resolves with a count = 0 to mirror "nothing left to delete"
  // after the prior `app/uninstalled` cleanup.
  db.brandSettings.deleteMany.mockResolvedValue({ count: 0 });
  db.scanEvent.deleteMany.mockResolvedValue({ count: 0 });
  db.session.deleteMany.mockResolvedValue({ count: 0 });
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("webhooks.shop.redact action", () => {
  it("calls authenticate.webhook exactly once with the request", async () => {
    mockAuth();
    const request = buildRequest();

    await action({ request, params: {}, context: {} });

    expect(authenticate.webhook).toHaveBeenCalledTimes(1);
    expect(authenticate.webhook).toHaveBeenCalledWith(request);
  });

  it("returns a 200 (or 204) Response and does not throw", async () => {
    mockAuth();

    let result;
    await expect(
      (async () => {
        result = await action({
          request: buildRequest(),
          params: {},
          context: {},
        });
      })(),
    ).resolves.not.toThrow();

    expect(result).toBeInstanceOf(Response);
    expect([200, 204]).toContain(result.status);
  });

  it("logs the topic via console.log", async () => {
    mockAuth();

    await action({ request: buildRequest(), params: {}, context: {} });

    expect(logSpy).toHaveBeenCalled();
    const loggedTopic = logSpy.mock.calls.some((args) =>
      args.some((a) => typeof a === "string" && a.includes(TOPIC)),
    );
    expect(loggedTopic).toBe(true);
  });

  it("calls deleteMany on brandSettings, scanEvent, and session for the shop", async () => {
    mockAuth();

    await action({ request: buildRequest(), params: {}, context: {} });

    expect(db.brandSettings.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.brandSettings.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP },
    });
    expect(db.scanEvent.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.scanEvent.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP },
    });
    expect(db.session.deleteMany).toHaveBeenCalledTimes(1);
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { shop: SHOP },
    });
  });
});
