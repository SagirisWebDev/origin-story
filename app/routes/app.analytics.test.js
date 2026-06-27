import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the analytics route (`/app/analytics`) — slice 7, issue #9.
 *
 * Loader contract (pinned by these tests — written before implementation):
 *   1. Authenticates the request via `authenticate.admin(request)`.
 *   2. Calls `getFeatureFlags(session.shop)` exactly once.
 *   3. When `flags.paid === true`:
 *        - calls `scansPerDay(session.shop, 30)`
 *        - returns `{ flags, data }` where `data` is the array of per-day
 *          buckets returned by `scansPerDay`.
 *   4. When `flags.paid === false`:
 *        - does NOT call `scansPerDay`
 *        - returns `{ flags, data: [] }` so the UI can render an upgrade CTA
 *          without runtime guards for `data`.
 *
 * The 30-day window is pinned (issue #9 AC: "scans per day for the last 30
 * days"). The route, not the model, owns that constant — `scansPerDay` is
 * parametric on `days`.
 */

// -----------------------------------------------------------------------------
// Module mocks (hoisted above the route import below)
// -----------------------------------------------------------------------------

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../lib/featureFlags.server.js", () => ({
  getFeatureFlags: vi.fn(),
}));

vi.mock("../models/ScanTracker.server.js", () => ({
  scansPerDay: vi.fn(),
}));

vi.mock("@shopify/shopify-app-react-router/server", () => ({
  boundary: {
    headers: vi.fn(() => ({})),
  },
}));

import { authenticate } from "../shopify.server";
import { getFeatureFlags } from "../lib/featureFlags.server.js";
import { scansPerDay } from "../models/ScanTracker.server.js";

import { loader } from "./app.analytics.tsx";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SHOP = "test-shop.myshopify.com";

function makeAdmin() {
  return { graphql: vi.fn() };
}

// Slice 12 (issue #15): the loader now passes the `billing` context to
// getFeatureFlags. The mock returns a sentinel — real billing.check is
// covered in featureFlags.server.test.js.
const MOCK_BILLING = { check: () => Promise.resolve({ hasActivePayment: true }) };
function makeAuthResult(admin) {
  return { admin, session: { shop: SHOP }, billing: MOCK_BILLING };
}

function buildRequest() {
  return new Request(`https://example.myshopify.com/app/analytics`);
}

const SAMPLE_BUCKETS = [
  { date: "2026-05-25", count: 0 },
  { date: "2026-05-26", count: 2 },
  { date: "2026-05-27", count: 5 },
];

// -----------------------------------------------------------------------------
// Loader tests
// -----------------------------------------------------------------------------

describe("app.analytics loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: paid is on, no data — tests override as needed.
    getFeatureFlags.mockReturnValue({ paid: true });
    scansPerDay.mockResolvedValue([]);
  });

  it("authenticates the request as an admin", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));

    const request = buildRequest();
    await loader({ request, params: {}, context: {} });

    expect(authenticate.admin).toHaveBeenCalledTimes(1);
    expect(authenticate.admin).toHaveBeenCalledWith(request);
  });

  it("calls getFeatureFlags exactly once with the billing context", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));

    await loader({ request: buildRequest(), params: {}, context: {} });

    expect(getFeatureFlags).toHaveBeenCalledTimes(1);
    expect(getFeatureFlags).toHaveBeenCalledWith(MOCK_BILLING);
  });

  it("when paid: true, calls scansPerDay(session.shop, 30)", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    getFeatureFlags.mockReturnValue({ paid: true });
    scansPerDay.mockResolvedValue(SAMPLE_BUCKETS);

    await loader({ request: buildRequest(), params: {}, context: {} });

    expect(scansPerDay).toHaveBeenCalledTimes(1);
    expect(scansPerDay).toHaveBeenCalledWith(SHOP, 30);
  });

  it("when paid: true, returns { flags, data } with the scansPerDay result", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    getFeatureFlags.mockReturnValue({ paid: true });
    scansPerDay.mockResolvedValue(SAMPLE_BUCKETS);

    const result = await loader({
      request: buildRequest(),
      params: {},
      context: {},
    });
    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload).toMatchObject({
      flags: { paid: true },
      data: SAMPLE_BUCKETS,
    });
  });

  it("when paid: false, does NOT call scansPerDay", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    getFeatureFlags.mockReturnValue({ paid: false });

    await loader({ request: buildRequest(), params: {}, context: {} });

    expect(scansPerDay).not.toHaveBeenCalled();
  });

  it("when paid: false, returns { flags, data: [] }", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    getFeatureFlags.mockReturnValue({ paid: false });

    const result = await loader({
      request: buildRequest(),
      params: {},
      context: {},
    });
    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload.flags).toEqual({ paid: false });
    expect(payload.data).toEqual([]);
  });
});
