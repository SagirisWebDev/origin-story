import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the `qrcode` library so we can:
 *   1. Capture the URL string the module asks the library to encode.
 *   2. Return predictable output that satisfies the format-prefix assertions
 *      without needing to actually render a QR.
 */
vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(),
    toString: vi.fn(),
  },
}));

import qrcode from "qrcode";
import { generate } from "./QRCodeGenerator.server.js";

const HANDLE = "ethiopia-yirgacheffe-abc123";
const SHOP = "test-shop.myshopify.com";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SHOPIFY_APP_URL = "https://example.com";

  // Default happy-path returns so the prefix assertions pass.
  qrcode.toDataURL.mockResolvedValue("data:image/png;base64,FAKEPNG");
  qrcode.toString.mockResolvedValue("<svg>fake</svg>");
});

describe("generate (PNG format)", () => {
  it("returns a string that starts with the PNG data URL prefix", async () => {
    const result = await generate(HANDLE, SHOP, { format: "png" });

    expect(typeof result).toBe("string");
    expect(result.startsWith("data:image/png;base64,")).toBe(true);
  });

  it("delegates to qrcode.toDataURL exactly once", async () => {
    await generate(HANDLE, SHOP, { format: "png" });

    expect(qrcode.toDataURL).toHaveBeenCalledTimes(1);
    expect(qrcode.toString).not.toHaveBeenCalled();
  });
});

describe("generate (SVG format)", () => {
  it("returns a string that starts with <svg", async () => {
    const result = await generate(HANDLE, SHOP, { format: "svg" });

    expect(typeof result).toBe("string");
    expect(result.startsWith("<svg")).toBe(true);
  });

  it("delegates to qrcode.toString with SVG type exactly once", async () => {
    await generate(HANDLE, SHOP, { format: "svg" });

    expect(qrcode.toString).toHaveBeenCalledTimes(1);
    expect(qrcode.toDataURL).not.toHaveBeenCalled();

    const [, options] = qrcode.toString.mock.calls[0];
    expect(options).toMatchObject({ type: "svg" });
  });
});

describe("generate (encoded URL contents)", () => {
  it("encodes a URL that contains the /story/{handle}/scan path (PNG)", async () => {
    await generate(HANDLE, SHOP, { format: "png" });

    const [encodedUrl] = qrcode.toDataURL.mock.calls[0];
    expect(encodedUrl).toEqual(expect.stringContaining(`/story/${HANDLE}/scan`));
  });

  it("encodes a URL that contains the /story/{handle}/scan path (SVG)", async () => {
    await generate(HANDLE, SHOP, { format: "svg" });

    const [encodedUrl] = qrcode.toString.mock.calls[0];
    expect(encodedUrl).toEqual(expect.stringContaining(`/story/${HANDLE}/scan`));
  });

  it("encodes a URL that contains the shop query param (PNG)", async () => {
    await generate(HANDLE, SHOP, { format: "png" });

    const [encodedUrl] = qrcode.toDataURL.mock.calls[0];
    expect(encodedUrl).toEqual(expect.stringContaining(`shop=${SHOP}`));
  });

  it("encodes a URL that contains the shop query param (SVG)", async () => {
    await generate(HANDLE, SHOP, { format: "svg" });

    const [encodedUrl] = qrcode.toString.mock.calls[0];
    expect(encodedUrl).toEqual(expect.stringContaining(`shop=${SHOP}`));
  });

  it("uses SHOPIFY_APP_URL as the host of the encoded URL", async () => {
    process.env.SHOPIFY_APP_URL = "https://example.com";

    await generate(HANDLE, SHOP, { format: "png" });

    const [encodedUrl] = qrcode.toDataURL.mock.calls[0];
    expect(
      encodedUrl.startsWith("https://example.com/"),
    ).toBe(true);
  });

  it("respects a changed SHOPIFY_APP_URL value", async () => {
    process.env.SHOPIFY_APP_URL = "https://other-host.example.org";

    await generate(HANDLE, SHOP, { format: "png" });

    const [encodedUrl] = qrcode.toDataURL.mock.calls[0];
    expect(
      encodedUrl.startsWith("https://other-host.example.org/"),
    ).toBe(true);
  });

  it("produces a fully formed URL of the form {appUrl}/story/{handle}/scan?shop={shop}", async () => {
    process.env.SHOPIFY_APP_URL = "https://example.com";

    await generate(HANDLE, SHOP, { format: "png" });

    const [encodedUrl] = qrcode.toDataURL.mock.calls[0];
    expect(encodedUrl).toBe(
      `https://example.com/story/${HANDLE}/scan?shop=${SHOP}`,
    );
  });
});

describe("generate (invalid format)", () => {
  it("throws when format is an unsupported value like 'jpeg'", async () => {
    await expect(
      generate(HANDLE, SHOP, { format: "jpeg" }),
    ).rejects.toThrow();
  });
});
