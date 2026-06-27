import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the billing route (`/app/billing`) — slice 12, issue #15.
 *
 * The placeholder "coming soon" page is replaced with a real two-state
 * billing surface backed by Shopify's Billing API.
 *
 * Loader contract (pinned by these tests — written before implementation):
 *   1. Authenticates via `authenticate.admin(request)`.
 *   2. Calls `billing.check({ plans: [PLUS_PLAN], isTest })`.
 *   3. Returns `{ paid }` where `paid === hasActivePayment`.
 *   4. Lets a Response thrown by `authenticate.admin` bubble (auth-redirect
 *      pattern shared by every Shopify-authenticated loader).
 *
 * Action contract:
 *   - intent=subscribe → `billing.request({ plan: PLUS_PLAN, isTest, returnUrl, trialDays: 14 })`.
 *   - intent=cancel    → `billing.check` to find the active subscription id,
 *                        then `billing.cancel({ subscriptionId, isTest, prorate: true })`,
 *                        then redirect to `/app/billing`.
 */

// -----------------------------------------------------------------------------
// Module mocks (hoisted above the route import below)
// -----------------------------------------------------------------------------

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
  PLUS_PLAN: "OriginStory Plus",
}));

vi.mock("@shopify/shopify-app-react-router/server", () => ({
  boundary: {
    headers: vi.fn(() => ({})),
  },
}));

import { authenticate } from "../shopify.server";
import { PLUS_PLAN } from "../lib/featureFlags.server.js";

import { loader, action } from "./app.billing.tsx";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SHOP = "test-shop.myshopify.com";
const SUB_ID = "gid://shopify/AppSubscription/123456789";

function makeAdmin() {
  return { graphql: vi.fn() };
}

function makeBilling({
  hasActivePayment = false,
  appSubscriptions = [],
} = {}) {
  return {
    check: vi.fn().mockResolvedValue({ hasActivePayment, appSubscriptions }),
    request: vi.fn().mockResolvedValue({ confirmationUrl: "https://example/c" }),
    cancel: vi.fn().mockResolvedValue({}),
  };
}

function makeAuthResult({ admin = makeAdmin(), billing } = {}) {
  return { admin, billing, session: { shop: SHOP } };
}

function buildLoaderRequest() {
  return new Request("https://example.myshopify.com/app/billing");
}

function buildActionRequest(intent) {
  const body = new URLSearchParams();
  if (intent) body.set("intent", intent);
  return new Request("https://example.myshopify.com/app/billing", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// -----------------------------------------------------------------------------
// Loader
// -----------------------------------------------------------------------------

describe("app.billing loader", () => {
  it("returns { paid: true } when billing.check reports hasActivePayment: true", async () => {
    const billing = makeBilling({ hasActivePayment: true });
    authenticate.admin.mockResolvedValue(makeAuthResult({ billing }));

    const result = await loader({
      request: buildLoaderRequest(),
      params: {},
      context: {},
    });
    const payload = result instanceof Response ? await result.json() : result;

    expect(payload.paid).toBe(true);
    expect(billing.check).toHaveBeenCalledTimes(1);
    expect(billing.check).toHaveBeenCalledWith(
      expect.objectContaining({ plans: [PLUS_PLAN] }),
    );
  });

  it("returns { paid: false } when billing.check reports hasActivePayment: false", async () => {
    const billing = makeBilling({ hasActivePayment: false });
    authenticate.admin.mockResolvedValue(makeAuthResult({ billing }));

    const result = await loader({
      request: buildLoaderRequest(),
      params: {},
      context: {},
    });
    const payload = result instanceof Response ? await result.json() : result;

    expect(payload.paid).toBe(false);
  });

  it("propagates the Response thrown by authenticate.admin (auth failure)", async () => {
    // Shopify's authenticate.admin throws a Response (e.g. 302 redirect) when
    // the request is not authenticated. The loader must let that bubble.
    const authResponse = new Response(null, {
      status: 302,
      headers: { Location: "/auth/login" },
    });
    authenticate.admin.mockRejectedValue(authResponse);

    await expect(
      loader({
        request: buildLoaderRequest(),
        params: {},
        context: {},
      }),
    ).rejects.toBe(authResponse);
  });
});

// -----------------------------------------------------------------------------
// Action — intent=subscribe
// -----------------------------------------------------------------------------

describe("app.billing action — intent=subscribe", () => {
  it("calls billing.request with plan: OriginStory Plus, trialDays: 14, returnUrl /app/billing", async () => {
    const billing = makeBilling({ hasActivePayment: false });
    authenticate.admin.mockResolvedValue(makeAuthResult({ billing }));

    // billing.request typically throws a Response (302 to Shopify's
    // confirmation page) but the call itself is what we're asserting.
    try {
      await action({
        request: buildActionRequest("subscribe"),
        params: {},
        context: {},
      });
    } catch (_err) {
      // Swallow — a redirect Response thrown by billing.request is fine.
    }

    expect(billing.request).toHaveBeenCalledTimes(1);
    const [arg] = billing.request.mock.calls[0];
    expect(arg).toMatchObject({
      plan: PLUS_PLAN,
      trialDays: 14,
    });
    expect(typeof arg.isTest).toBe("boolean");
    expect(typeof arg.returnUrl).toBe("string");
    expect(arg.returnUrl).toContain("/app/billing");
  });

  it("returns { billingError } instead of crashing when billing.request rejects with a BillingError", async () => {
    const billing = makeBilling({ hasActivePayment: false });
    // Simulate Shopify's "Apps without a public distribution cannot use the
    // Billing API" rejection — billing.request throws a regular Error, not a
    // Response, so the action must catch and surface a friendly hint.
    billing.request.mockRejectedValue(
      new Error("Apps without a public distribution cannot use the Billing API"),
    );
    authenticate.admin.mockResolvedValue(makeAuthResult({ billing }));

    const result = await action({
      request: buildActionRequest("subscribe"),
      params: {},
      context: {},
    });

    expect(result).toEqual({
      billingError: expect.stringContaining("public distribution"),
    });
  });
});

// -----------------------------------------------------------------------------
// Action — intent=cancel
// -----------------------------------------------------------------------------

describe("app.billing action — intent=cancel", () => {
  it("looks up the active subscription id via billing.check then calls billing.cancel", async () => {
    const billing = makeBilling({
      hasActivePayment: true,
      appSubscriptions: [{ id: SUB_ID, name: PLUS_PLAN }],
    });
    authenticate.admin.mockResolvedValue(makeAuthResult({ billing }));

    let result;
    try {
      result = await action({
        request: buildActionRequest("cancel"),
        params: {},
        context: {},
      });
    } catch (err) {
      // Some implementations `throw redirect(...)` instead of returning it;
      // accept either. We capture for the assertion below.
      result = err;
    }

    expect(billing.check).toHaveBeenCalled();
    expect(billing.cancel).toHaveBeenCalledTimes(1);
    const [arg] = billing.cancel.mock.calls[0];
    expect(arg).toMatchObject({
      subscriptionId: SUB_ID,
      prorate: true,
    });
    expect(typeof arg.isTest).toBe("boolean");

    // Final disposition is a redirect back to /app/billing.
    expect(result).toBeInstanceOf(Response);
    const status = result.status;
    expect([301, 302, 303, 307, 308]).toContain(status);
    expect(result.headers.get("Location")).toContain("/app/billing");
  });
});
