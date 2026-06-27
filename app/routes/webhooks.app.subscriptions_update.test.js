import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the `app_subscriptions/update` webhook handler — slice 12, issue #15.
 *
 * Shopify fires this webhook whenever a merchant's subscription state changes
 * (start, cancel, expire, etc.). We don't need to persist anything — the next
 * call to `billing.check` is authoritative — but we do need to ack the
 * webhook so Shopify stops retrying, and we log the event for observability.
 *
 * Handler contract (pinned by these tests — written before implementation):
 *   1. Calls `authenticate.webhook(request)` exactly once.
 *   2. Logs the topic via `console.log` (one line per firing — diagnostic).
 *   3. Returns a Response with status 200 (or 204 / no-body — accepted).
 *   4. Does NOT throw.
 */

// -----------------------------------------------------------------------------
// Module mocks (hoisted above the route import below)
// -----------------------------------------------------------------------------

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: vi.fn() },
}));

import { authenticate } from "../shopify.server";
import { action } from "./webhooks.app.subscriptions_update.tsx";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SHOP = "test-shop.myshopify.com";
const TOPIC = "APP_SUBSCRIPTIONS_UPDATE";

function buildRequest() {
  return new Request(
    "https://example.myshopify.com/webhooks/app/subscriptions_update",
    {
      method: "POST",
      body: JSON.stringify({
        app_subscription: { name: "OriginStory Plus", status: "ACTIVE" },
      }),
      headers: { "Content-Type": "application/json" },
    },
  );
}

function mockAuth({ shop = SHOP, topic = TOPIC } = {}) {
  authenticate.webhook.mockResolvedValue({
    shop,
    topic,
    session: { id: "offline_session" },
    payload: {
      app_subscription: { name: "OriginStory Plus", status: "ACTIVE" },
    },
  });
}

let logSpy;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

// -----------------------------------------------------------------------------
// Tests
// -----------------------------------------------------------------------------

describe("webhooks.app.subscriptions_update action", () => {
  it("calls authenticate.webhook exactly once with the request", async () => {
    mockAuth();
    const request = buildRequest();

    await action({ request, params: {}, context: {} });

    expect(authenticate.webhook).toHaveBeenCalledTimes(1);
    expect(authenticate.webhook).toHaveBeenCalledWith(request);
  });

  it("returns a 200 Response (or empty Response) and does not throw", async () => {
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
    // 200 is the conventional default for an empty `new Response()`; 204 is
    // also acceptable for "no content". Anything else means the handler is
    // signalling a failure that Shopify will retry.
    expect([200, 204]).toContain(result.status);
  });

  it("logs the topic via console.log", async () => {
    mockAuth();

    await action({
      request: buildRequest(),
      params: {},
      context: {},
    });

    expect(logSpy).toHaveBeenCalled();
    const loggedSomethingWithTopic = logSpy.mock.calls.some((args) =>
      args.some(
        (a) => typeof a === "string" && a.includes(TOPIC),
      ),
    );
    expect(loggedSomethingWithTopic).toBe(true);
  });
});
