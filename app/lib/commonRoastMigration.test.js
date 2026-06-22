import { describe, it, expect } from "vitest";

import {
  STORY_SEEDS,
  buildStoryPayload,
  formatOrigin,
  formatProcess,
  isMigratable,
} from "./commonRoastMigration.js";

/**
 * The 7 product handles the migration script must cover. These mirror the
 * bean products in the Common Roast dev store (see issue #6). Blends and the
 * gift card are intentionally excluded — only single-origin / decaf beans
 * carry a story seed.
 */
// Real product handles in the Common Roast catalog (see
// new-store/data/common-roast-products-with-metafields-full.csv). Suffixes
// matter — the script keys seeds by the exact product handle returned by the
// Admin API, so these must match the catalog 1:1.
const EXPECTED_HANDLES = [
  "ethiopia-yirgacheffe-natural",
  "colombia-huila-washed",
  "guatemala-antigua-honey",
  "kenya-nyeri-aa-washed",
  "brazil-cerrado-natural",
  "peru-cajamarca-washed",
  "swiss-water-decaf-colombia",
];

/**
 * Canonical adapted-product shape the implementer will pass into
 * buildStoryPayload after flattening Admin GraphQL metafields.
 */
const sampleProduct = {
  id: "gid://shopify/Product/1234",
  handle: "ethiopia-yirgacheffe-natural",
  title: "Ethiopia Yirgacheffe Natural",
  metafields: {
    origin_country: "Ethiopia",
    origin_region: "Yirgacheffe",
    producer_farm_name: "Various smallholder farms",
    process: "natural",
  },
};

describe("formatOrigin", () => {
  it("concatenates region and country as 'Region, Country'", () => {
    expect(formatOrigin("Yirgacheffe", "Ethiopia")).toBe(
      "Yirgacheffe, Ethiopia",
    );
  });

  it("returns just the country when region is empty", () => {
    expect(formatOrigin("", "Ethiopia")).toBe("Ethiopia");
  });

  it("returns just the country when region is null/undefined", () => {
    expect(formatOrigin(null, "Ethiopia")).toBe("Ethiopia");
    expect(formatOrigin(undefined, "Ethiopia")).toBe("Ethiopia");
  });

  it("returns an empty string when country is empty", () => {
    expect(formatOrigin("Yirgacheffe", "")).toBe("");
    expect(formatOrigin("Yirgacheffe", null)).toBe("");
    expect(formatOrigin("Yirgacheffe", undefined)).toBe("");
  });

  it("trims whitespace from both region and country", () => {
    expect(formatOrigin("  Yirgacheffe  ", "  Ethiopia  ")).toBe(
      "Yirgacheffe, Ethiopia",
    );
  });
});

describe("formatProcess", () => {
  it("expands 'natural' to 'Natural process'", () => {
    expect(formatProcess("natural")).toBe("Natural process");
  });

  it("expands 'washed' to 'Washed process'", () => {
    expect(formatProcess("washed")).toBe("Washed process");
  });

  it("expands 'honey' to 'Honey process'", () => {
    expect(formatProcess("honey")).toBe("Honey process");
  });

  it("expands 'swiss-water' to a phrase containing 'Swiss Water' and 'decaf' (any casing)", () => {
    const result = formatProcess("swiss-water");
    expect(result).toMatch(/Swiss Water/);
    expect(result.toLowerCase()).toContain("decaf");
  });

  it("capitalizes unknown values rather than dropping them", () => {
    const result = formatProcess("experimental");
    // First letter must be uppercase — exact suffix is intentionally not pinned.
    expect(result[0]).toBe("E");
    expect(result.toLowerCase()).toContain("experimental");
  });
});

describe("STORY_SEEDS", () => {
  it("contains an entry for every expected bean handle", () => {
    for (const handle of EXPECTED_HANDLES) {
      expect(STORY_SEEDS).toHaveProperty(handle);
    }
  });

  it("has exactly the 7 expected keys (no extras, no blends)", () => {
    expect(Object.keys(STORY_SEEDS).sort()).toEqual(
      [...EXPECTED_HANDLES].sort(),
    );
  });

  it("every seed value is a non-empty string of at least 200 characters", () => {
    for (const [handle, seed] of Object.entries(STORY_SEEDS)) {
      expect(typeof seed, `seed for ${handle} must be a string`).toBe("string");
      expect(
        seed.length,
        `seed for ${handle} is too short (${seed.length} chars)`,
      ).toBeGreaterThanOrEqual(200);
    }
  });
});

describe("isMigratable", () => {
  it("returns true when the product has origin_country AND a seed for its handle", () => {
    expect(isMigratable(sampleProduct)).toBe(true);
  });

  it("returns false when the product has no origin_country (e.g. a blend)", () => {
    const blend = {
      ...sampleProduct,
      handle: "house-blend",
      metafields: { process: "washed" },
    };
    expect(isMigratable(blend)).toBe(false);
  });

  it("returns false when no seed exists for the product handle", () => {
    const unknown = { ...sampleProduct, handle: "mystery-bean-not-in-seeds" };
    expect(isMigratable(unknown)).toBe(false);
  });

  it("returns false when origin_country is an empty string", () => {
    const empty = {
      ...sampleProduct,
      metafields: { ...sampleProduct.metafields, origin_country: "" },
    };
    expect(isMigratable(empty)).toBe(false);
  });

  it("accepts an injected seeds dictionary for testability", () => {
    const customSeeds = {
      "test-handle": "x".repeat(250),
    };
    const product = {
      ...sampleProduct,
      handle: "test-handle",
    };
    expect(isMigratable(product, customSeeds)).toBe(true);
    // And the same product is NOT migratable under real STORY_SEEDS.
    expect(isMigratable(product)).toBe(false);
  });
});

describe("buildStoryPayload", () => {
  it("returns null when the product is not migratable", () => {
    const blend = {
      ...sampleProduct,
      handle: "house-blend",
      metafields: { process: "washed" },
    };
    expect(buildStoryPayload(blend)).toBeNull();
  });

  it("returns a fully populated payload for a migratable product", () => {
    const payload = buildStoryPayload(sampleProduct);

    expect(payload).not.toBeNull();
    expect(payload).toMatchObject({
      handle: "ethiopia-yirgacheffe-natural",
      productId: "gid://shopify/Product/1234",
      productTitle: "Ethiopia Yirgacheffe Natural",
      productHandle: "ethiopia-yirgacheffe-natural",
      maker: "Various smallholder farms",
    });
    expect(typeof payload.origin).toBe("string");
    expect(typeof payload.process).toBe("string");
    expect(typeof payload.story).toBe("string");
  });

  it("formats the origin field using formatOrigin (region, country)", () => {
    const payload = buildStoryPayload(sampleProduct);
    expect(payload.origin).toBe("Yirgacheffe, Ethiopia");
  });

  it("formats the process field using formatProcess", () => {
    const payload = buildStoryPayload(sampleProduct);
    expect(payload.process).toBe("Natural process");
  });

  it("uses STORY_SEEDS[handle] as the story text", () => {
    const payload = buildStoryPayload(sampleProduct);
    expect(payload.story).toBe(
      STORY_SEEDS["ethiopia-yirgacheffe-natural"],
    );
  });

  it("sets the payload handle equal to the product handle (1:1 product → story)", () => {
    const payload = buildStoryPayload(sampleProduct);
    expect(payload.handle).toBe(sampleProduct.handle);
    expect(payload.productHandle).toBe(sampleProduct.handle);
  });

  it("accepts an injected seeds dictionary so the helper is unit-testable in isolation", () => {
    const customSeeds = {
      "ethiopia-yirgacheffe-natural": "x".repeat(250),
    };
    const payload = buildStoryPayload(sampleProduct, customSeeds);
    expect(payload).not.toBeNull();
    expect(payload.story).toBe(customSeeds["ethiopia-yirgacheffe-natural"]);
  });
});
