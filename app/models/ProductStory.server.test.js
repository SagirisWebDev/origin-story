import { describe, it, expect, vi } from "vitest";

import {
  deleteStory,
  generateHandle,
  getStory,
  getStoryByProductId,
  listStories,
  saveStory,
  validateStory,
} from "./ProductStory.server.js";

/**
 * Build a vitest mock for the Shopify admin.graphql function.
 *
 * Shopify's admin.graphql returns a Response-shaped object whose `.json()`
 * resolves to `{ data: ... }`. We replicate that shape here.
 *
 * @param {object} data - The `data` payload to embed in the response.
 * @returns {ReturnType<typeof vi.fn>}
 */
function mockGraphql(data) {
  return vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ data }),
  });
}

const VALID_STORY = {
  productId: "gid://shopify/Product/1",
  origin: "Ethiopia",
  maker: "Yirgacheffe Cooperative",
  process: "Washed and sun-dried for 14 days.",
  story: "A century of farming heritage in the highlands.",
};

describe("generateHandle", () => {
  it("slugifies a product title into a lowercase URL-safe handle", () => {
    const handle = generateHandle("Ethiopia Yirgacheffe");

    // Slug portion appears at the start and is lowercase + dash separated.
    expect(handle).toMatch(/^ethiopia-yirgacheffe-/);
    // The full handle must remain URL-safe (lowercase, digits, dashes only).
    expect(handle).toMatch(/^[a-z0-9-]+$/);
  });

  it("produces a different handle on each call for the same input", () => {
    const a = generateHandle("Ethiopia Yirgacheffe");
    const b = generateHandle("Ethiopia Yirgacheffe");

    expect(a).not.toEqual(b);
  });

  it("strips punctuation and collapses whitespace", () => {
    const handle = generateHandle("  Hello, World!!  ");

    expect(handle).toMatch(/^hello-world-/);
    expect(handle).not.toMatch(/^-/);
    expect(handle).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("validateStory", () => {
  it("returns undefined when every required field is present", () => {
    expect(validateStory(VALID_STORY)).toBeUndefined();
  });

  it("returns undefined when heroImageId is omitted (it is optional)", () => {
    const { ...withoutHero } = VALID_STORY;
    expect(validateStory(withoutHero)).toBeUndefined();
  });

  it("returns an errors object when productId is missing", () => {
    const errors = validateStory({ ...VALID_STORY, productId: undefined });
    expect(errors).toBeDefined();
    expect(errors.productId).toBeTruthy();
  });

  it("returns an errors object when origin is missing", () => {
    const errors = validateStory({ ...VALID_STORY, origin: "" });
    expect(errors).toBeDefined();
    expect(errors.origin).toBeTruthy();
  });

  it("returns an errors object when maker is missing", () => {
    const errors = validateStory({ ...VALID_STORY, maker: "" });
    expect(errors).toBeDefined();
    expect(errors.maker).toBeTruthy();
  });

  it("returns an errors object when process is missing", () => {
    const errors = validateStory({ ...VALID_STORY, process: "" });
    expect(errors).toBeDefined();
    expect(errors.process).toBeTruthy();
  });

  it("returns an errors object when story is missing", () => {
    const errors = validateStory({ ...VALID_STORY, story: "" });
    expect(errors).toBeDefined();
    expect(errors.story).toBeTruthy();
  });

  it("reports every missing required field at once", () => {
    const errors = validateStory({});
    expect(errors).toBeDefined();
    expect(errors.productId).toBeTruthy();
    expect(errors.origin).toBeTruthy();
    expect(errors.maker).toBeTruthy();
    expect(errors.process).toBeTruthy();
    expect(errors.story).toBeTruthy();
  });
});

describe("getStory", () => {
  it("returns null when the metaobject is not found", async () => {
    const graphql = mockGraphql({ metaobjectByHandle: null });

    const result = await getStory("missing-handle", graphql);

    expect(result).toBeNull();
  });

  it("queries metaobjectByHandle with the $app:product_story type and handle", async () => {
    const graphql = mockGraphql({ metaobjectByHandle: null });

    await getStory("ethiopia-yirgacheffe-abc123", graphql);

    expect(graphql).toHaveBeenCalledTimes(1);
    const [query, options] = graphql.mock.calls[0];
    expect(query).toEqual(expect.stringContaining("metaobjectByHandle"));
    expect(options.variables.handle).toEqual({
      type: "$app:product_story",
      handle: "ethiopia-yirgacheffe-abc123",
    });
  });

  it("returns a normalized object with all six fields when the metaobject exists", async () => {
    const graphql = mockGraphql({
      metaobjectByHandle: {
        id: "gid://shopify/Metaobject/123",
        handle: "ethiopia-yirgacheffe-abc123",
        updatedAt: "2026-06-21T12:00:00Z",
        product: {
          jsonValue: "gid://shopify/Product/1",
          reference: {
            handle: "ethiopia-yirgacheffe",
            title: "Ethiopia Yirgacheffe",
          },
        },
        origin: { jsonValue: "Ethiopia" },
        maker: { jsonValue: "Yirgacheffe Cooperative" },
        process: { jsonValue: "Washed and sun-dried for 14 days." },
        story: { jsonValue: "A century of farming heritage." },
        heroImage: {
          jsonValue: "gid://shopify/MediaImage/42",
          reference: {
            image: { url: "https://cdn.example.com/hero.jpg", altText: "Hero" },
          },
        },
      },
    });

    const result = await getStory("ethiopia-yirgacheffe-abc123", graphql);

    expect(result).toMatchObject({
      id: "gid://shopify/Metaobject/123",
      handle: "ethiopia-yirgacheffe-abc123",
      productId: "gid://shopify/Product/1",
      origin: "Ethiopia",
      maker: "Yirgacheffe Cooperative",
      process: "Washed and sun-dried for 14 days.",
      story: "A century of farming heritage.",
    });
  });
});

describe("listStories", () => {
  it("queries metaobjects with the $app:product_story type", async () => {
    const graphql = mockGraphql({ metaobjects: { nodes: [] } });

    await listStories(graphql);

    expect(graphql).toHaveBeenCalledTimes(1);
    const [query, options] = graphql.mock.calls[0];
    expect(query).toEqual(expect.stringContaining("metaobjects"));
    expect(options.variables.type).toBe("$app:product_story");
  });

  it("returns an array of normalized stories", async () => {
    const graphql = mockGraphql({
      metaobjects: {
        nodes: [
          {
            id: "gid://shopify/Metaobject/1",
            handle: "first-story-aaa",
            updatedAt: "2026-06-21T12:00:00Z",
            product: {
              jsonValue: "gid://shopify/Product/1",
              reference: { handle: "first", title: "First" },
            },
            origin: { jsonValue: "Ethiopia" },
            maker: { jsonValue: "Maker A" },
            process: { jsonValue: "Process A" },
            story: { jsonValue: "Story A" },
            heroImage: null,
          },
          {
            id: "gid://shopify/Metaobject/2",
            handle: "second-story-bbb",
            updatedAt: "2026-06-20T12:00:00Z",
            product: {
              jsonValue: "gid://shopify/Product/2",
              reference: { handle: "second", title: "Second" },
            },
            origin: { jsonValue: "Kenya" },
            maker: { jsonValue: "Maker B" },
            process: { jsonValue: "Process B" },
            story: { jsonValue: "Story B" },
            heroImage: null,
          },
        ],
      },
    });

    const result = await listStories(graphql);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      id: "gid://shopify/Metaobject/1",
      handle: "first-story-aaa",
      productId: "gid://shopify/Product/1",
      origin: "Ethiopia",
    });
    expect(result[1]).toMatchObject({
      id: "gid://shopify/Metaobject/2",
      handle: "second-story-bbb",
      productId: "gid://shopify/Product/2",
      origin: "Kenya",
    });
  });

  it("returns an empty array when no metaobjects exist", async () => {
    const graphql = mockGraphql({ metaobjects: { nodes: [] } });

    const result = await listStories(graphql);

    expect(result).toEqual([]);
  });
});

describe("saveStory", () => {
  function successUpsertResponse() {
    return mockGraphql({
      metaobjectUpsert: {
        metaobject: {
          id: "gid://shopify/Metaobject/123",
          handle: "ethiopia-yirgacheffe-abc123",
        },
        userErrors: [],
      },
    });
  }

  it("calls graphql with the metaobjectUpsert mutation and correct handle input", async () => {
    const graphql = successUpsertResponse();

    await saveStory("ethiopia-yirgacheffe-abc123", VALID_STORY, graphql);

    expect(graphql).toHaveBeenCalledTimes(1);
    const [query, options] = graphql.mock.calls[0];
    expect(query).toEqual(expect.stringContaining("metaobjectUpsert"));
    expect(options.variables.handle).toEqual({
      type: "$app:product_story",
      handle: "ethiopia-yirgacheffe-abc123",
    });
  });

  it("includes all five required fields in the metaobject upsert variables", async () => {
    const graphql = successUpsertResponse();

    await saveStory("ethiopia-yirgacheffe-abc123", VALID_STORY, graphql);

    const [, options] = graphql.mock.calls[0];
    const fields = options.variables.metaobject.fields;
    const fieldMap = Object.fromEntries(fields.map((f) => [f.key, f.value]));

    expect(fieldMap.product).toBe(VALID_STORY.productId);
    expect(fieldMap.origin).toBe(VALID_STORY.origin);
    expect(fieldMap.maker).toBe(VALID_STORY.maker);
    expect(fieldMap.process).toBe(VALID_STORY.process);
    expect(fieldMap.story).toBe(VALID_STORY.story);
  });

  it("includes hero_image in the fields when heroImageId is provided", async () => {
    const graphql = successUpsertResponse();

    await saveStory(
      "ethiopia-yirgacheffe-abc123",
      { ...VALID_STORY, heroImageId: "gid://shopify/MediaImage/42" },
      graphql,
    );

    const [, options] = graphql.mock.calls[0];
    const fields = options.variables.metaobject.fields;
    const heroField = fields.find((f) => f.key === "hero_image");

    expect(heroField).toBeDefined();
    expect(heroField.value).toBe("gid://shopify/MediaImage/42");
  });

  it("returns the upserted metaobject", async () => {
    const graphql = successUpsertResponse();

    const result = await saveStory(
      "ethiopia-yirgacheffe-abc123",
      VALID_STORY,
      graphql,
    );

    expect(result).toEqual({
      id: "gid://shopify/Metaobject/123",
      handle: "ethiopia-yirgacheffe-abc123",
    });
  });

  it("throws when Shopify returns userErrors", async () => {
    const graphql = mockGraphql({
      metaobjectUpsert: {
        metaobject: null,
        userErrors: [{ field: ["fields"], message: "Product is invalid" }],
      },
    });

    await expect(
      saveStory("ethiopia-yirgacheffe-abc123", VALID_STORY, graphql),
    ).rejects.toThrow(/Product is invalid/);
  });
});

describe("getStoryByProductId", () => {
  // Helper: shape a single metaobject node the way the GraphQL response would.
  function metaobject({ id, handle, productId, origin = "" }) {
    return {
      id,
      handle,
      updatedAt: "2026-06-21T12:00:00Z",
      product: {
        jsonValue: productId,
        reference: { handle: "p", title: "Product Title" },
      },
      origin: { jsonValue: origin },
      maker: { jsonValue: "" },
      process: { jsonValue: "" },
      story: { jsonValue: "" },
      heroImage: null,
    };
  }

  it("returns null when no stories exist at all", async () => {
    const graphql = mockGraphql({ metaobjects: { nodes: [] } });

    const result = await getStoryByProductId(
      "gid://shopify/Product/1",
      graphql,
    );

    expect(result).toBeNull();
  });

  it("returns null when stories exist but none match the productId", async () => {
    const graphql = mockGraphql({
      metaobjects: {
        nodes: [
          metaobject({
            id: "gid://shopify/Metaobject/1",
            handle: "story-one",
            productId: "gid://shopify/Product/999",
          }),
          metaobject({
            id: "gid://shopify/Metaobject/2",
            handle: "story-two",
            productId: "gid://shopify/Product/888",
          }),
        ],
      },
    });

    const result = await getStoryByProductId(
      "gid://shopify/Product/1",
      graphql,
    );

    expect(result).toBeNull();
  });

  it("returns the normalized story whose productId matches", async () => {
    const graphql = mockGraphql({
      metaobjects: {
        nodes: [
          metaobject({
            id: "gid://shopify/Metaobject/1",
            handle: "other-story",
            productId: "gid://shopify/Product/999",
            origin: "Kenya",
          }),
          metaobject({
            id: "gid://shopify/Metaobject/42",
            handle: "ethiopia-yirgacheffe-abc123",
            productId: "gid://shopify/Product/1",
            origin: "Ethiopia",
          }),
        ],
      },
    });

    const result = await getStoryByProductId(
      "gid://shopify/Product/1",
      graphql,
    );

    expect(result).not.toBeNull();
    // Pin behavior: the returned object is the normalized story for the matching
    // product — not a raw metaobject node.
    expect(result).toMatchObject({
      id: "gid://shopify/Metaobject/42",
      handle: "ethiopia-yirgacheffe-abc123",
      productId: "gid://shopify/Product/1",
      origin: "Ethiopia",
    });
  });
});

describe("deleteStory", () => {
  it("calls graphql with the metaobjectDelete mutation and the given id", async () => {
    const graphql = mockGraphql({
      metaobjectDelete: {
        deletedId: "gid://shopify/Metaobject/123",
        userErrors: [],
      },
    });

    await deleteStory("gid://shopify/Metaobject/123", graphql);

    expect(graphql).toHaveBeenCalledTimes(1);
    const [query, options] = graphql.mock.calls[0];
    expect(query).toEqual(expect.stringContaining("metaobjectDelete"));
    expect(options.variables.id).toBe("gid://shopify/Metaobject/123");
  });

  it("throws when Shopify returns userErrors", async () => {
    const graphql = mockGraphql({
      metaobjectDelete: {
        deletedId: null,
        userErrors: [{ field: ["id"], message: "Metaobject not found" }],
      },
    });

    await expect(
      deleteStory("gid://shopify/Metaobject/123", graphql),
    ).rejects.toThrow(/Metaobject not found/);
  });
});
