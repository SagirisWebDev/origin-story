import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the embedded-app action route used by the Admin UI extension on
 * the product detail page: `/api/product-story/$productId`.
 *
 * Behavior contract (pinned by these tests — written before implementation):
 *
 *   GET  /api/product-story/<encoded-product-gid>
 *     - Authenticates via `authenticate.admin(request)`
 *     - Resolves the product GID by URL-decoding `params.productId`
 *     - If a story exists for that productId: returns
 *         { story, productTitle, productId }
 *       where `story` is the full normalized story object and `productTitle`
 *       is taken from the story.
 *     - If no story exists: `story` is null and `productTitle` is fetched from
 *       the Product itself via a `product(id: ...)` graphql query and returned
 *       under `productTitle`. `productId` is the decoded GID.
 *
 *   POST /api/product-story/<encoded-product-gid>
 *     - Authenticates
 *     - Reads JSON body: { origin, maker, process, story, productTitle, heroImageId? }
 *     - Validates via `validateStory(...)`. On errors returns
 *         { ok: false, errors }  with HTTP 422.
 *     - If a story already exists for this productId (via `getStoryByProductId`):
 *         updates by its existing handle (calls `saveStory(handle, ...)`).
 *     - Else: generates a new handle via `generateHandle(productTitle)` and
 *         calls `saveStory(newHandle, ...)`.
 *     - On success returns { ok: true, story: { handle, id } }.
 *
 * Route-param shape decision: I pinned the URL-encoded full GID (e.g.
 * `gid%3A%2F%2Fshopify%2FProduct%2F123`). The Admin UI extension already has
 * the full GID via `data.selected[0].id` and `encodeURIComponent` /
 * `decodeURIComponent` is a symmetric one-step round-trip — no string
 * concatenation of a hardcoded prefix in the route, which would leak schema
 * knowledge into the URL handler.
 */

// -----------------------------------------------------------------------------
// Module mocks (hoisted above the route import below)
// -----------------------------------------------------------------------------

vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../models/ProductStory.server.js", () => ({
  getStoryByProductId: vi.fn(),
  saveStory: vi.fn(),
  generateHandle: vi.fn(),
  validateStory: vi.fn(),
}));

// Pull the mocked references for per-test wiring.
import { authenticate } from "../shopify.server";
import {
  getStoryByProductId,
  saveStory,
  generateHandle,
  validateStory,
} from "../models/ProductStory.server.js";

// Import the route module under test AFTER mocks are declared. Vitest hoists
// `vi.mock`, so this resolves to the mocked dependencies.
import {
  loader,
  action,
} from "./api.product-story.$productId.tsx";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const PRODUCT_GID = "gid://shopify/Product/123";
const ENCODED_PRODUCT_GID = encodeURIComponent(PRODUCT_GID);

function makeAdmin(graphqlImpl) {
  return {
    graphql: vi.fn(graphqlImpl ?? (() => ({ json: async () => ({ data: {} }) }))),
  };
}

function buildRequest(method = "GET", body) {
  const init = { method };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(
    `https://example.myshopify.com/api/product-story/${ENCODED_PRODUCT_GID}`,
    init,
  );
}

const NORMALIZED_STORY = {
  id: "gid://shopify/Metaobject/42",
  handle: "ethiopia-yirgacheffe-abc123",
  updatedAt: "2026-06-21T12:00:00Z",
  productId: PRODUCT_GID,
  productHandle: "ethiopia-yirgacheffe",
  productTitle: "Ethiopia Yirgacheffe",
  productImage: null,
  productImageAlt: null,
  origin: "Ethiopia",
  maker: "Yirgacheffe Cooperative",
  process: "Washed and sun-dried.",
  story: "A century of farming heritage.",
  heroImageId: null,
  heroImageUrl: null,
  heroImageAlt: null,
};

const VALID_BODY = {
  origin: "Ethiopia",
  maker: "Yirgacheffe Cooperative",
  process: "Washed and sun-dried.",
  story: "A century of farming heritage.",
  productTitle: "Ethiopia Yirgacheffe",
};

// -----------------------------------------------------------------------------
// Loader (GET) tests
// -----------------------------------------------------------------------------

describe("api.product-story.$productId loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates the request as an admin", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    getStoryByProductId.mockResolvedValue(NORMALIZED_STORY);

    const request = buildRequest("GET");
    await loader({
      request,
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    expect(authenticate.admin).toHaveBeenCalledTimes(1);
    expect(authenticate.admin).toHaveBeenCalledWith(request);
  });

  it("propagates the Response thrown by authenticate (auth failure)", async () => {
    // Shopify's authenticate.admin throws a Response (e.g. 302 redirect) when
    // the request is not authenticated. The loader must let that bubble.
    const authResponse = new Response(null, {
      status: 302,
      headers: { Location: "/auth/login" },
    });
    authenticate.admin.mockRejectedValue(authResponse);

    await expect(
      loader({
        request: buildRequest("GET"),
        params: { productId: ENCODED_PRODUCT_GID },
        context: {},
      }),
    ).rejects.toBe(authResponse);
  });

  it("decodes the URL-encoded GID before calling getStoryByProductId", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    getStoryByProductId.mockResolvedValue(NORMALIZED_STORY);

    await loader({
      request: buildRequest("GET"),
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    expect(getStoryByProductId).toHaveBeenCalledTimes(1);
    expect(getStoryByProductId).toHaveBeenCalledWith(PRODUCT_GID, admin.graphql);
  });

  it("returns { story, productTitle, productId } when a story exists", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    getStoryByProductId.mockResolvedValue(NORMALIZED_STORY);

    const result = await loader({
      request: buildRequest("GET"),
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload).toMatchObject({
      story: NORMALIZED_STORY,
      productTitle: NORMALIZED_STORY.productTitle,
      productId: PRODUCT_GID,
    });
  });

  it("fetches the productTitle from the Product when no story exists", async () => {
    const admin = makeAdmin(async () => ({
      json: async () => ({
        data: { product: { title: "Brand New Product" } },
      }),
    }));
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    getStoryByProductId.mockResolvedValue(null);

    const result = await loader({
      request: buildRequest("GET"),
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload).toMatchObject({
      story: null,
      productTitle: "Brand New Product",
      productId: PRODUCT_GID,
    });

    // It must have queried the Product via the admin graphql client.
    expect(admin.graphql).toHaveBeenCalledTimes(1);
    const [, options] = admin.graphql.mock.calls[0];
    // The product GID must be passed through (don't pin variable name —
    // just confirm the decoded GID appears in the variables payload).
    const variablesJson = JSON.stringify(options?.variables ?? {});
    expect(variablesJson).toContain(PRODUCT_GID);
  });
});

// -----------------------------------------------------------------------------
// Action (POST) tests
// -----------------------------------------------------------------------------

describe("api.product-story.$productId action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: validation passes. Individual tests override as needed.
    validateStory.mockReturnValue(undefined);
  });

  it("authenticates the request as an admin", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    getStoryByProductId.mockResolvedValue(null);
    generateHandle.mockReturnValue("ethiopia-yirgacheffe-newgen");
    saveStory.mockResolvedValue({
      id: "gid://shopify/Metaobject/99",
      handle: "ethiopia-yirgacheffe-newgen",
    });

    const request = buildRequest("POST", VALID_BODY);
    await action({
      request,
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    expect(authenticate.admin).toHaveBeenCalledTimes(1);
    expect(authenticate.admin).toHaveBeenCalledWith(request);
  });

  it("returns { ok: false, errors } with status 422 when validation fails", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    const errors = { origin: "Origin is required" };
    validateStory.mockReturnValue(errors);

    const result = await action({
      request: buildRequest("POST", { ...VALID_BODY, origin: "" }),
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    // Allow either a Response or a data-with-init return; both are valid in
    // react-router. Normalize to {status, payload} either way.
    let status;
    let payload;
    if (result instanceof Response) {
      status = result.status;
      payload = await result.json();
    } else if (result && typeof result === "object" && "init" in result) {
      // react-router's `data(payload, init)` helper.
      status = result.init?.status ?? 200;
      payload = result.data;
    } else {
      status = 200;
      payload = result;
    }

    expect(status).toBe(422);
    expect(payload).toEqual({ ok: false, errors });

    // Must not have persisted anything when validation fails.
    expect(saveStory).not.toHaveBeenCalled();
  });

  it("updates an existing story by its handle when one exists for the productId", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    getStoryByProductId.mockResolvedValue(NORMALIZED_STORY);
    saveStory.mockResolvedValue({
      id: NORMALIZED_STORY.id,
      handle: NORMALIZED_STORY.handle,
    });

    const result = await action({
      request: buildRequest("POST", VALID_BODY),
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    // Decoded GID was looked up.
    expect(getStoryByProductId).toHaveBeenCalledWith(
      PRODUCT_GID,
      admin.graphql,
    );

    // Update path: reuses the existing handle, never generates a new one.
    expect(generateHandle).not.toHaveBeenCalled();
    expect(saveStory).toHaveBeenCalledTimes(1);

    const [handleArg, dataArg, graphqlArg] = saveStory.mock.calls[0];
    expect(handleArg).toBe(NORMALIZED_STORY.handle);
    expect(graphqlArg).toBe(admin.graphql);

    // The saved payload must carry the decoded product GID and the body fields.
    expect(dataArg).toMatchObject({
      productId: PRODUCT_GID,
      origin: VALID_BODY.origin,
      maker: VALID_BODY.maker,
      process: VALID_BODY.process,
      story: VALID_BODY.story,
    });

    const payload =
      result instanceof Response ? await result.json() : result;
    expect(payload).toEqual({
      ok: true,
      story: {
        id: NORMALIZED_STORY.id,
        handle: NORMALIZED_STORY.handle,
      },
    });
  });

  it("creates a new story with a generated handle when none exists for the productId", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    getStoryByProductId.mockResolvedValue(null);
    generateHandle.mockReturnValue("ethiopia-yirgacheffe-newgen");
    saveStory.mockResolvedValue({
      id: "gid://shopify/Metaobject/99",
      handle: "ethiopia-yirgacheffe-newgen",
    });

    const result = await action({
      request: buildRequest("POST", VALID_BODY),
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    // Handle was generated from the productTitle in the body.
    expect(generateHandle).toHaveBeenCalledTimes(1);
    expect(generateHandle).toHaveBeenCalledWith(VALID_BODY.productTitle);

    // Save was called with the newly generated handle.
    expect(saveStory).toHaveBeenCalledTimes(1);
    const [handleArg, dataArg, graphqlArg] = saveStory.mock.calls[0];
    expect(handleArg).toBe("ethiopia-yirgacheffe-newgen");
    expect(graphqlArg).toBe(admin.graphql);
    expect(dataArg).toMatchObject({
      productId: PRODUCT_GID,
      origin: VALID_BODY.origin,
      maker: VALID_BODY.maker,
      process: VALID_BODY.process,
      story: VALID_BODY.story,
    });

    const payload =
      result instanceof Response ? await result.json() : result;
    expect(payload).toEqual({
      ok: true,
      story: {
        id: "gid://shopify/Metaobject/99",
        handle: "ethiopia-yirgacheffe-newgen",
      },
    });
  });

  it("forwards heroImageId to saveStory when present in the body", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin, cors: (r) => r });
    getStoryByProductId.mockResolvedValue(null);
    generateHandle.mockReturnValue("ethiopia-yirgacheffe-newgen");
    saveStory.mockResolvedValue({
      id: "gid://shopify/Metaobject/99",
      handle: "ethiopia-yirgacheffe-newgen",
    });

    await action({
      request: buildRequest("POST", {
        ...VALID_BODY,
        heroImageId: "gid://shopify/MediaImage/42",
      }),
      params: { productId: ENCODED_PRODUCT_GID },
      context: {},
    });

    const [, dataArg] = saveStory.mock.calls[0];
    expect(dataArg.heroImageId).toBe("gid://shopify/MediaImage/42");
  });
});
