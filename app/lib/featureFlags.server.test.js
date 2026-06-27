import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the feature-flag helper — slice 12, issue #15.
 *
 * The placeholder `{ paid: true }` shim is gone. `getFeatureFlags` now takes
 * the `billing` context returned by `authenticate.admin(request)` and asks
 * Shopify whether the shop has an active OriginStory Plus subscription.
 *
 * Module contract (pinned by these tests — written before implementation):
 *
 *   getFeatureFlags(billing) → Promise<{ paid: boolean }>
 *
 *   - Async. Returns a Promise so callers must `await` it.
 *   - Delegates to `billing.check({ plans: [PLUS_PLAN], isTest })`.
 *   - `paid` mirrors `hasActivePayment` from the billing response.
 *   - Defensive: null/undefined `billing` (e.g. unauthenticated public routes)
 *     resolves to `{ paid: false }` without throwing.
 *   - Defensive: an error thrown by `billing.check` is caught and surfaced as
 *     `{ paid: false }` — we never want a billing transient to crash a loader.
 *   - The plan name is exported as the `PLUS_PLAN` constant. Tests import it
 *     rather than hardcoding the string so a rename can't drift.
 */

import { getFeatureFlags, PLUS_PLAN } from "./featureFlags.server.js";

describe("PLUS_PLAN constant", () => {
  it("is the canonical OriginStory Plus plan name", () => {
    // Pin the exact wire value — Shopify matches on this string when
    // resolving subscriptions and any silent rename would invalidate every
    // live merchant's billing state.
    expect(PLUS_PLAN).toBe("OriginStory Plus");
  });
});

describe("getFeatureFlags", () => {
  let billing;

  beforeEach(() => {
    billing = { check: vi.fn() };
  });

  it("resolves to { paid: true } when billing.check reports hasActivePayment: true", async () => {
    billing.check.mockResolvedValue({ hasActivePayment: true });

    await expect(getFeatureFlags(billing)).resolves.toEqual({ paid: true });
  });

  it("resolves to { paid: false } when billing.check reports hasActivePayment: false", async () => {
    billing.check.mockResolvedValue({ hasActivePayment: false });

    await expect(getFeatureFlags(billing)).resolves.toEqual({ paid: false });
  });

  it("calls billing.check with { plans: [PLUS_PLAN], isTest: <boolean> }", async () => {
    billing.check.mockResolvedValue({ hasActivePayment: true });

    await getFeatureFlags(billing);

    expect(billing.check).toHaveBeenCalledTimes(1);
    const [arg] = billing.check.mock.calls[0];
    // Plan list must be exactly the named constant — no other plans, no rename.
    expect(arg).toMatchObject({ plans: [PLUS_PLAN] });
    // isTest's actual value depends on NODE_ENV at runtime; we only pin that
    // it's a boolean so the implementer can't forget to pass it.
    expect(typeof arg.isTest).toBe("boolean");
  });

  it("resolves to { paid: false } when billing is null (no throw)", async () => {
    await expect(getFeatureFlags(null)).resolves.toEqual({ paid: false });
  });

  it("resolves to { paid: false } when billing is undefined (no throw)", async () => {
    await expect(getFeatureFlags(undefined)).resolves.toEqual({ paid: false });
  });

  it("resolves to { paid: false } when billing.check throws", async () => {
    billing.check.mockRejectedValue(new Error("Shopify billing API down"));

    await expect(getFeatureFlags(billing)).resolves.toEqual({ paid: false });
  });
});
