import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the scan endpoint loader at `/story/:handle/scan` (issue #8).
 *
 * Behavior contract (pinned before implementation):
 *
 *   - Calls `recordScan(handle, request)` exactly once before returning.
 *   - Returns a 302 Response to `/story/<handle>?shop=<shop>` (existing
 *     behavior from slice 2 — pinned here so the new tracking call does not
 *     regress it).
 *   - If `recordScan` REJECTS, the loader STILL returns the 302. Tracker
 *     failure must never block the redirect — that's the whole point of the
 *     non-blocking contract in issue #8.
 *   - Missing `handle` still throws 400.
 *   - Missing `?shop=` query parameter still throws 400.
 */

// -----------------------------------------------------------------------------
// Module mocks (hoisted above the route import below)
// -----------------------------------------------------------------------------

vi.mock("../models/ScanTracker.server.js", () => ({
  recordScan: vi.fn(),
}));

import { recordScan } from "../models/ScanTracker.server.js";
import { loader } from "./story.$handle.scan.tsx";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const HANDLE = "ethiopia-yirgacheffe-abc123";
const SHOP = "test-shop.myshopify.com";

function buildRequest({ shop = SHOP } = {}) {
  const url = shop
    ? `https://example.com/story/${HANDLE}/scan?shop=${encodeURIComponent(shop)}`
    : `https://example.com/story/${HANDLE}/scan`;
  return new Request(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15",
    },
  });
}

function callLoader({ handle = HANDLE, request } = {}) {
  return loader({
    request: request ?? buildRequest(),
    params: { handle },
    context: {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: tracker succeeds. Individual tests override.
  recordScan.mockResolvedValue(undefined);
});

// -----------------------------------------------------------------------------
// Tracking integration
// -----------------------------------------------------------------------------

describe("story.$handle.scan loader — tracking", () => {
  it("calls recordScan exactly once with (handle, request)", async () => {
    const request = buildRequest();

    await callLoader({ request });

    expect(recordScan).toHaveBeenCalledTimes(1);
    expect(recordScan).toHaveBeenCalledWith(HANDLE, request);
  });

  it("returns a 302 Response to /story/<handle>?shop=<shop> (existing behavior pinned)", async () => {
    const result = await callLoader();

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe(
      `/story/${HANDLE}?shop=${SHOP}`,
    );
  });

  it("still returns the 302 even when recordScan REJECTS (non-blocking on tracker failure)", async () => {
    recordScan.mockRejectedValue(new Error("DB unavailable"));

    const result = await callLoader();

    expect(result).toBeInstanceOf(Response);
    expect(result.status).toBe(302);
    expect(result.headers.get("Location")).toBe(
      `/story/${HANDLE}?shop=${SHOP}`,
    );
  });
});

// -----------------------------------------------------------------------------
// Input validation (existing behavior pinned)
// -----------------------------------------------------------------------------

describe("story.$handle.scan loader — input validation", () => {
  it("throws a 400 Response when the handle param is missing", async () => {
    try {
      await loader({
        request: buildRequest(),
        params: {},
        context: {},
      });
      throw new Error("expected loader to throw a Response");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect(err.status).toBe(400);
    }
  });

  it("throws a 400 Response when the ?shop= query parameter is missing", async () => {
    try {
      await callLoader({ request: buildRequest({ shop: null }) });
      throw new Error("expected loader to throw a Response");
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect(err.status).toBe(400);
    }
  });
});
