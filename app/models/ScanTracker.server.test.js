import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the ScanTracker module (issue #8).
 *
 * The module under test is responsible for:
 *   1. Coarse User-Agent classification (mobile / tablet / desktop / bot /
 *      unknown). Pure function — no I/O, deterministic.
 *   2. Recording a scan event to the database (via Prisma) while being
 *      non-blocking on failure. A DB outage must NEVER prevent the redirect
 *      that calls this module from completing.
 *
 * Privacy contract (issue #8 explicit AC): we store NO IP address and NO
 * fingerprint — only `userAgentClass`. A regression guard test below pins
 * this by asserting that none of the IP-shaped keys (`ip`, `ipAddress`,
 * `remoteAddress`) appear in the data argument handed to Prisma, even when
 * IP-bearing headers like `X-Forwarded-For` are present on the request.
 */

// -----------------------------------------------------------------------------
// Module mocks (hoisted above the route import below)
// -----------------------------------------------------------------------------

vi.mock("../db.server", () => ({
  default: { scanEvent: { create: vi.fn() } },
}));

import prisma from "../db.server";
import { classifyUserAgent, recordScan } from "./ScanTracker.server.js";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const SHOP = "test-shop.myshopify.com";
const HANDLE = "ethiopia-yirgacheffe-abc123";

// Representative User-Agent strings. Picked to be realistic — taken from
// the shapes of UAs Apple / Google / Microsoft ship in 2024-2026.
const UA = {
  IPHONE:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  ANDROID_PHONE:
    "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  IPAD:
    "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  DESKTOP_MAC_CHROME:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  GOOGLEBOT:
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  BINGBOT:
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  FACEBOOK_EXTERNAL_HIT:
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
};

function buildRequest({ ua, shop = SHOP, extraHeaders = {} } = {}) {
  const headers = { ...extraHeaders };
  if (ua !== undefined && ua !== null) {
    headers["User-Agent"] = ua;
  }
  const url = shop
    ? `https://example.com/story/${HANDLE}/scan?shop=${encodeURIComponent(shop)}`
    : `https://example.com/story/${HANDLE}/scan`;
  return new Request(url, { method: "GET", headers });
}

beforeEach(() => {
  prisma.scanEvent.create.mockReset();
});

// -----------------------------------------------------------------------------
// classifyUserAgent
// -----------------------------------------------------------------------------

describe("classifyUserAgent", () => {
  it("classifies a representative iPhone UA as 'mobile'", () => {
    expect(classifyUserAgent(UA.IPHONE)).toBe("mobile");
  });

  it("classifies a representative Android phone UA as 'mobile'", () => {
    expect(classifyUserAgent(UA.ANDROID_PHONE)).toBe("mobile");
  });

  it("classifies a representative iPad UA as 'tablet'", () => {
    expect(classifyUserAgent(UA.IPAD)).toBe("tablet");
  });

  it("classifies a typical Chrome-on-Mac UA as 'desktop'", () => {
    expect(classifyUserAgent(UA.DESKTOP_MAC_CHROME)).toBe("desktop");
  });

  it("classifies Googlebot as 'bot'", () => {
    expect(classifyUserAgent(UA.GOOGLEBOT)).toBe("bot");
  });

  it("classifies Bingbot as 'bot'", () => {
    expect(classifyUserAgent(UA.BINGBOT)).toBe("bot");
  });

  it("classifies facebookexternalhit as 'bot'", () => {
    expect(classifyUserAgent(UA.FACEBOOK_EXTERNAL_HIT)).toBe("bot");
  });

  it("returns 'unknown' for null", () => {
    expect(classifyUserAgent(null)).toBe("unknown");
  });

  it("returns 'unknown' for undefined", () => {
    expect(classifyUserAgent(undefined)).toBe("unknown");
  });

  it("returns 'unknown' for empty string", () => {
    expect(classifyUserAgent("")).toBe("unknown");
  });

  it("does NOT mis-classify an iPhone UA as 'tablet' (regression guard)", () => {
    // The iPhone UA contains the substring "Mobile" and "like Mac OS X" — a
    // naive iPad detector that checks "Mac" or that does not exclude iPhone
    // first will misfire here. Pin the desired behavior explicitly.
    const result = classifyUserAgent(UA.IPHONE);
    expect(result).not.toBe("tablet");
    expect(result).toBe("mobile");
  });
});

// -----------------------------------------------------------------------------
// recordScan
// -----------------------------------------------------------------------------

describe("recordScan", () => {
  let consoleErrorSpy;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("calls prisma.scanEvent.create exactly once", async () => {
    prisma.scanEvent.create.mockResolvedValue({});

    await recordScan(HANDLE, buildRequest({ ua: UA.IPHONE }));

    expect(prisma.scanEvent.create).toHaveBeenCalledTimes(1);
  });

  it("writes a row with storyHandle, shop, and userAgentClass derived from the request", async () => {
    prisma.scanEvent.create.mockResolvedValue({});

    await recordScan(HANDLE, buildRequest({ ua: UA.IPHONE }));

    const [args] = prisma.scanEvent.create.mock.calls[0];
    expect(args).toBeDefined();
    expect(args.data).toMatchObject({
      storyHandle: HANDLE,
      shop: SHOP,
      userAgentClass: "mobile",
    });
  });

  it("reads the User-Agent header from the request and classifies it", async () => {
    prisma.scanEvent.create.mockResolvedValue({});

    await recordScan(HANDLE, buildRequest({ ua: UA.DESKTOP_MAC_CHROME }));

    const [args] = prisma.scanEvent.create.mock.calls[0];
    expect(args.data.userAgentClass).toBe("desktop");
  });

  it("reads ?shop=... from the request URL for the shop field", async () => {
    prisma.scanEvent.create.mockResolvedValue({});

    await recordScan(
      HANDLE,
      buildRequest({ ua: UA.IPHONE, shop: "other-shop.myshopify.com" }),
    );

    const [args] = prisma.scanEvent.create.mock.calls[0];
    expect(args.data.shop).toBe("other-shop.myshopify.com");
  });

  it("records userAgentClass='unknown' when the request has no User-Agent header", async () => {
    prisma.scanEvent.create.mockResolvedValue({});

    await recordScan(HANDLE, buildRequest({ ua: null }));

    const [args] = prisma.scanEvent.create.mock.calls[0];
    expect(args.data.userAgentClass).toBe("unknown");
  });

  it("resolves without throwing when prisma.scanEvent.create rejects, and logs the error", async () => {
    const dbError = new Error("DB unavailable");
    prisma.scanEvent.create.mockRejectedValue(dbError);

    // Must not throw — the redirect at the call site depends on this.
    await expect(
      recordScan(HANDLE, buildRequest({ ua: UA.IPHONE })),
    ).resolves.not.toThrow();

    // And the error must be observable (logged) so the failure is not silent.
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("never stores an IP address (regression guard against accidental fingerprinting)", async () => {
    prisma.scanEvent.create.mockResolvedValue({});

    // Build a request carrying IP-bearing headers that an upstream proxy
    // might attach. The module must NOT propagate any of these into the
    // persisted row.
    await recordScan(
      HANDLE,
      buildRequest({
        ua: UA.IPHONE,
        extraHeaders: {
          "X-Forwarded-For": "203.0.113.42, 10.0.0.1",
          "X-Real-IP": "203.0.113.42",
          "CF-Connecting-IP": "203.0.113.42",
        },
      }),
    );

    const [args] = prisma.scanEvent.create.mock.calls[0];
    const data = args.data ?? {};

    expect(data).not.toHaveProperty("ip");
    expect(data).not.toHaveProperty("ipAddress");
    expect(data).not.toHaveProperty("remoteAddress");

    // Belt and braces: serialize the whole data object and confirm the
    // representative IP string never appears anywhere in it.
    const serialized = JSON.stringify(data);
    expect(serialized).not.toContain("203.0.113.42");
    expect(serialized).not.toContain("10.0.0.1");
  });
});
