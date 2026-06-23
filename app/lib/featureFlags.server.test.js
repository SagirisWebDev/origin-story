import { describe, it, expect } from "vitest";

/**
 * Tests for the feature-flag helper (issue #9).
 *
 * Module contract (pinned by these tests — written before implementation):
 *
 *   getFeatureFlags(shop) → { paid: boolean }
 *
 *   - Pure function. No I/O, no Prisma, no Shopify API.
 *   - Synchronous.
 *   - The placeholder implementation always returns `{ paid: true }`,
 *     regardless of the shop argument. This is the documented MVP behavior
 *     until Shopify billing integration lands post-MVP.
 *   - Must be tolerant of falsy shop inputs: empty string, null, undefined
 *     all return `{ paid: true }` without throwing.
 *
 * The shape `{ paid: boolean }` is the public contract — callers (route
 * loaders) destructure `.paid` directly. These tests pin that field name
 * and type explicitly so a future refactor cannot silently rename or
 * re-type it.
 */

import { getFeatureFlags } from "./featureFlags.server.js";

describe("getFeatureFlags", () => {
  it("returns an object with a `paid` boolean field", () => {
    const result = getFeatureFlags("test-shop.myshopify.com");

    expect(result).toBeTypeOf("object");
    expect(result).not.toBeNull();
    expect(typeof result.paid).toBe("boolean");
  });

  it("returns paid: true for a normal shop string (MVP placeholder)", () => {
    expect(getFeatureFlags("test-shop.myshopify.com")).toEqual({ paid: true });
  });

  it("returns paid: true for any shop string (placeholder ignores shop)", () => {
    // The placeholder must be uniform across shops — no shop is special-cased
    // until real billing arrives.
    expect(getFeatureFlags("another-shop.myshopify.com").paid).toBe(true);
    expect(getFeatureFlags("yet-another.myshopify.com").paid).toBe(true);
    expect(getFeatureFlags("dev-app1.myshopify.com").paid).toBe(true);
  });

  it("returns paid: true when shop is an empty string (no throw)", () => {
    expect(() => getFeatureFlags("")).not.toThrow();
    expect(getFeatureFlags("")).toEqual({ paid: true });
  });

  it("returns paid: true when shop is null (no throw)", () => {
    expect(() => getFeatureFlags(null)).not.toThrow();
    expect(getFeatureFlags(null)).toEqual({ paid: true });
  });

  it("returns paid: true when shop is undefined (no throw)", () => {
    expect(() => getFeatureFlags(undefined)).not.toThrow();
    expect(getFeatureFlags(undefined)).toEqual({ paid: true });
  });

  it("is synchronous — returns a plain value, not a Promise", () => {
    const result = getFeatureFlags("test-shop.myshopify.com");
    // A Promise would have a `then` function; a plain object should not.
    expect(typeof result?.then).not.toBe("function");
  });
});
