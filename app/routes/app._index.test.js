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

describe("app._index loader", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("authenticates the request as an admin", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin });
    listStories.mockResolvedValue([]);

    const request = buildRequest();
    await loader({ request, params: {}, context: {} });

    expect(authenticate.admin).toHaveBeenCalledTimes(1);
    expect(authenticate.admin).toHaveBeenCalledWith(request);
  });

  it("calls listStories exactly once with the admin graphql client", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin });
    listStories.mockResolvedValue([]);

    await loader({ request: buildRequest(), params: {}, context: {} });

    expect(listStories).toHaveBeenCalledTimes(1);
    expect(listStories).toHaveBeenCalledWith(admin.graphql);
  });

  it("returns the stories under a `stories` key", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin });
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

    expect(payload).toEqual({ stories: SAMPLE_STORIES });
  });

  it("returns an empty stories array when there are no stories", async () => {
    const admin = makeAdmin();
    authenticate.admin.mockResolvedValue({ admin });
    listStories.mockResolvedValue([]);

    const result = await loader({
      request: buildRequest(),
      params: {},
      context: {},
    });

    const payload =
      result instanceof Response ? await result.json() : result;

    expect(payload).toEqual({ stories: [] });
  });
});
