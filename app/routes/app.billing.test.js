import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the billing stub route (`/app/billing`) — slice 7, issue #9.
 *
 * Loader contract (pinned by these tests — written before implementation):
 *   1. Authenticates via `authenticate.admin(request)`.
 *   2. Returns an object (the empty `{}` placeholder is acceptable for now).
 *
 * The page itself is just an upgrade-CTA stub — the loader does no work yet
 * because real Shopify billing integration is out of scope for MVP per the
 * PRD. These tests pin the contract so when billing arrives, additions
 * (e.g. `{ subscription }`) are extensions of the same shape.
 */

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("@shopify/shopify-app-react-router/server", () => ({
  boundary: {
    headers: vi.fn(() => ({})),
  },
}));

import { authenticate } from "../shopify.server";

import { loader } from "./app.billing.tsx";

const SHOP = "test-shop.myshopify.com";

function makeAdmin() {
  return { graphql: vi.fn() };
}

function makeAuthResult(admin) {
  return { admin, session: { shop: SHOP } };
}

function buildRequest() {
  return new Request(`https://example.myshopify.com/app/billing`);
}

describe("app.billing loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates the request as an admin", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));

    const request = buildRequest();
    await loader({ request, params: {}, context: {} });

    expect(authenticate.admin).toHaveBeenCalledTimes(1);
    expect(authenticate.admin).toHaveBeenCalledWith(request);
  });

  it("returns an object (allow empty {}) for the page to consume", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));

    const result = await loader({
      request: buildRequest(),
      params: {},
      context: {},
    });
    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload).toBeTypeOf("object");
    expect(payload).not.toBeNull();
  });
});
