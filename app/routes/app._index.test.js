import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for the stories list page route (`/app`).
 *
 * The loader is expected to:
 *   1. Authenticate the request via `authenticate.admin(request)`.
 *   2. Call `listStories(admin.graphql)` exactly once.
 *   3. Return `{ stories: [...] }` so the route's default export can read
 *      `useLoaderData()` directly.
 *
 * Shape decision: the loader returns `{ stories }` (an object with a single
 * `stories` array). This is the cleanest contract — it leaves room to add
 * sibling fields later (pagination cursors, shop info, etc.) without breaking
 * the call site, and it mirrors the convention used by the rest of the app.
 *
 * NB: `app._index.tsx` currently still returns `null` from its loader and
 * does not import `listStories`. These tests should FAIL until the implementer
 * wires the route up; that is the intended red phase.
 */

// -----------------------------------------------------------------------------
// Module mocks
// -----------------------------------------------------------------------------

// `vi.mock` calls are hoisted above the imports, so the route module under test
// will resolve to these mocked versions when we import it below.
vi.mock("../shopify.server", () => ({
  authenticate: {
    admin: vi.fn(),
  },
}));

vi.mock("../models/ProductStory.server.js", () => ({
  listStories: vi.fn(),
}));

// Slice 7 (issue #9): the loader now also calls the feature-flag helper and
// — when paid — aggregates scan counts per handle. Both are mocked here.
vi.mock("../lib/featureFlags.server.js", () => ({
  getFeatureFlags: vi.fn(),
}));

vi.mock("../models/ScanTracker.server.js", () => ({
  countScansByHandles: vi.fn(),
}));

// `boundary.headers` is invoked by the exported `headers` function. We don't
// assert on it in these tests but we still need the import to resolve.
vi.mock("@shopify/shopify-app-react-router/server", () => ({
  boundary: {
    headers: vi.fn(() => ({})),
  },
}));

// Pull in the mocked references so we can configure return values per-test.
import { authenticate } from "../shopify.server";
import { listStories } from "../models/ProductStory.server.js";
import { getFeatureFlags } from "../lib/featureFlags.server.js";
import { countScansByHandles } from "../models/ScanTracker.server.js";

// Import the loader AFTER mocks are declared. Vitest hoists `vi.mock`, so this
// resolves the mocked dependencies.
import { loader } from "./app._index.tsx";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function makeAdmin() {
  return {
    graphql: vi.fn(),
  };
}

function buildRequest() {
  // The loader only forwards the request to `authenticate.admin`; the contents
  // don't matter as long as it's a real Request instance.
  return new Request("https://example.myshopify.com/app");
}

const SAMPLE_STORIES = [
  {
    id: "gid://shopify/Metaobject/1",
    handle: "ethiopia-yirgacheffe-abc123",
    updatedAt: "2026-06-21T12:00:00Z",
    productId: "gid://shopify/Product/1",
    productHandle: "ethiopia-yirgacheffe",
    productTitle: "Ethiopia Yirgacheffe",
    productImage: "https://cdn.example.com/coffee.jpg",
    productImageAlt: "Bag of coffee beans",
    origin: "Ethiopia",
    maker: "Yirgacheffe Cooperative",
    process: "Washed and sun-dried.",
    story: "A century of farming heritage.",
    heroImageId: null,
    heroImageUrl: null,
    heroImageAlt: null,
  },
  {
    id: "gid://shopify/Metaobject/2",
    handle: "kenya-nyeri-def456",
    updatedAt: "2026-06-20T12:00:00Z",
    productId: "gid://shopify/Product/2",
    productHandle: "kenya-nyeri",
    productTitle: "Kenya Nyeri",
    productImage: "https://cdn.example.com/kenya.jpg",
    productImageAlt: "Kenya coffee",
    origin: "Kenya",
    maker: "Nyeri Cooperative",
    process: "Honey processed.",
    story: "Heritage farms in Nyeri.",
    heroImageId: null,
    heroImageUrl: null,
    heroImageAlt: null,
  },
];

// -----------------------------------------------------------------------------
// Loader tests
// -----------------------------------------------------------------------------

const SHOP = "test-shop.myshopify.com";

// Default session shape passed alongside `admin` from `authenticate.admin`.
// Slice 7 (issue #9): the loader reads `session.shop` to feed the feature-flag
// helper and the scan-count aggregator.
function makeAuthResult(admin) {
  return { admin, session: { shop: SHOP } };
}

describe("app._index loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Provide safe defaults so each test only has to override what it cares
    // about. By default: paid feature is on, but no scans recorded.
    getFeatureFlags.mockReturnValue({ paid: true });
    countScansByHandles.mockResolvedValue(new Map());
  });

  it("authenticates the request as an admin", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue([]);

    const request = buildRequest();
    await loader({ request, params: {}, context: {} });

    expect(authenticate.admin).toHaveBeenCalledTimes(1);
    expect(authenticate.admin).toHaveBeenCalledWith(request);
  });

  it("calls listStories exactly once with the admin graphql client", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue([]);

    await loader({ request: buildRequest(), params: {}, context: {} });

    expect(listStories).toHaveBeenCalledTimes(1);
    expect(listStories).toHaveBeenCalledWith(admin.graphql);
  });

  it("returns the stories under a `stories` key", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue(SAMPLE_STORIES);

    const result = await loader({
      request: buildRequest(),
      params: {},
      context: {},
    });

    // The loader may return a plain object OR a Response (react-router accepts
    // either). Normalize before asserting.
    const payload =
      result instanceof Response ? await result.json() : result;

    // Loose match: the loader now also returns `flags` and `scans` siblings
    // (see slice 7 tests below), so only pin the `stories` field here.
    expect(payload).toMatchObject({ stories: SAMPLE_STORIES });
  });

  it("returns an empty stories array when there are no stories", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue([]);

    const result = await loader({
      request: buildRequest(),
      params: {},
      context: {},
    });

    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload).toMatchObject({ stories: [] });
  });

  // ---------------------------------------------------------------------------
  // Slice 7 (issue #9): feature-flag gating + scan-count aggregation
  // ---------------------------------------------------------------------------

  it("calls getFeatureFlags exactly once with the session.shop", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue([]);

    await loader({ request: buildRequest(), params: {}, context: {} });

    expect(getFeatureFlags).toHaveBeenCalledTimes(1);
    expect(getFeatureFlags).toHaveBeenCalledWith(SHOP);
  });

  it("when paid: true, calls countScansByHandles with the array of story handles", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue(SAMPLE_STORIES);
    getFeatureFlags.mockReturnValue({ paid: true });
    countScansByHandles.mockResolvedValue(
      new Map([
        [SAMPLE_STORIES[0].handle, 5],
        [SAMPLE_STORIES[1].handle, 0],
      ]),
    );

    await loader({ request: buildRequest(), params: {}, context: {} });

    expect(countScansByHandles).toHaveBeenCalledTimes(1);
    const [handlesArg] = countScansByHandles.mock.calls[0];
    expect(handlesArg).toEqual(SAMPLE_STORIES.map((s) => s.handle));
  });

  it("when paid: false, does NOT call countScansByHandles", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue(SAMPLE_STORIES);
    getFeatureFlags.mockReturnValue({ paid: false });

    await loader({ request: buildRequest(), params: {}, context: {} });

    expect(countScansByHandles).not.toHaveBeenCalled();
  });

  it("returns { stories, flags, scans } shape when paid: true", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue(SAMPLE_STORIES);
    getFeatureFlags.mockReturnValue({ paid: true });
    countScansByHandles.mockResolvedValue(
      new Map([
        [SAMPLE_STORIES[0].handle, 5],
        [SAMPLE_STORIES[1].handle, 0],
      ]),
    );

    const result = await loader({
      request: buildRequest(),
      params: {},
      context: {},
    });
    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload).toMatchObject({ stories: SAMPLE_STORIES });
    expect(payload.flags).toEqual({ paid: true });

    // `scans` is a plain object (JSON-serializable), not a Map.
    expect(payload.scans).toBeTypeOf("object");
    expect(payload.scans).not.toBeNull();
    expect(payload.scans).not.toBeInstanceOf(Map);
    expect(payload.scans[SAMPLE_STORIES[0].handle]).toBe(5);
    expect(payload.scans[SAMPLE_STORIES[1].handle]).toBe(0);
  });

  it("returns an empty `scans` object when paid: false", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue(makeAuthResult(admin));
    listStories.mockResolvedValue(SAMPLE_STORIES);
    getFeatureFlags.mockReturnValue({ paid: false });

    const result = await loader({
      request: buildRequest(),
      params: {},
      context: {},
    });
    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload.flags).toEqual({ paid: false });
    expect(payload.scans).toEqual({});
  });
});
