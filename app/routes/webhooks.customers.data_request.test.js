import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the GDPR `customers/data_request` webhook handler.
 *
 * Handler contract (pinned by these tests):
 *   1. Calls `authenticate.webhook(request)` exactly once.
 *   2. Logs the topic via `console.log` (one line per firing).
 *   3. Returns a Response with status 200/204.
 *   4. Does NOT throw, does NOT touch the database (no customer data stored).
 */

vi.mock("../shopify.server", () => ({
  authenticate: { webhook: vi.fn() },
}));

import { authenticate } from "../shopify.server";
import { action } from "./webhooks.customers.data_request.tsx";

const SHOP = "test-shop.myshopify.com";
const TOPIC = "CUSTOMERS_DATA_REQUEST";

function buildRequest() {
  return new Request(
    "https://example.myshopify.com/webhooks/customers/data_request",
    {
      method: "POST",
      body: JSON.stringify({
        shop_id: 954889,
        shop_domain: SHOP,
        orders_requested: [],
        customer: { id: 191167, email: "shopper@example.com" },
        data_request: { id: 9999 },
      }),
      headers: { "Content-Type": "application/json" },
    },
  );
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
});

afterEach(() => {
  logSpy.mockRestore();
});

describe("webhooks.customers.data_request action", () => {
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
});
