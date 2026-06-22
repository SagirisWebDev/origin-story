import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mock the Prisma client so the module under test never touches a real
 * database. We expose `findUnique` and `upsert` on a `brandSettings`
 * delegate to mirror the shape Prisma generates from the schema.
 */
vi.mock("../db.server", () => ({
  default: {
    brandSettings: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import prisma from "../db.server";
import { getBrand, saveBrand } from "./BrandSettings.server.js";

const SHOP = "test-shop.myshopify.com";

const DEFAULT_BRAND = {
  shop: SHOP,
  logoUrl: null,
  accentColor: "#1f5e3a",
  fontFamily: "Inter, system-ui, sans-serif",
};

beforeEach(() => {
  prisma.brandSettings.findUnique.mockReset();
  prisma.brandSettings.upsert.mockReset();
});

describe("getBrand", () => {
  it("returns sensible defaults when no row exists for the shop", async () => {
    prisma.brandSettings.findUnique.mockResolvedValue(null);

    const result = await getBrand(SHOP);

    expect(result).toEqual(DEFAULT_BRAND);
  });

  it("queries prisma.brandSettings.findUnique with the shop as the where key", async () => {
    prisma.brandSettings.findUnique.mockResolvedValue(null);

    await getBrand(SHOP);

    expect(prisma.brandSettings.findUnique).toHaveBeenCalledTimes(1);
    const [args] = prisma.brandSettings.findUnique.mock.calls[0];
    expect(args.where).toEqual({ shop: SHOP });
  });

  it("returns the saved row when every field is non-null", async () => {
    const row = {
      shop: SHOP,
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
      updatedAt: new Date("2026-06-22T00:00:00Z"),
    };
    prisma.brandSettings.findUnique.mockResolvedValue(row);

    const result = await getBrand(SHOP);

    expect(result).toMatchObject({
      shop: SHOP,
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
    });
  });

  it("falls back to the default accentColor when the saved row has accentColor=null", async () => {
    prisma.brandSettings.findUnique.mockResolvedValue({
      shop: SHOP,
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: null,
      fontFamily: "Georgia, serif",
      updatedAt: new Date(),
    });

    const result = await getBrand(SHOP);

    expect(result.accentColor).toBe("#1f5e3a");
    // Other fields should still come from the saved row.
    expect(result.logoUrl).toBe("https://cdn.example.com/logo.png");
    expect(result.fontFamily).toBe("Georgia, serif");
  });

  it("falls back to the default fontFamily when the saved row has fontFamily=null", async () => {
    prisma.brandSettings.findUnique.mockResolvedValue({
      shop: SHOP,
      logoUrl: null,
      accentColor: "#bb2244",
      fontFamily: null,
      updatedAt: new Date(),
    });

    const result = await getBrand(SHOP);

    expect(result.fontFamily).toBe("Inter, system-ui, sans-serif");
    expect(result.accentColor).toBe("#bb2244");
    expect(result.logoUrl).toBeNull();
  });

  it("keeps logoUrl as null when the saved row has logoUrl=null (null is the documented default)", async () => {
    prisma.brandSettings.findUnique.mockResolvedValue({
      shop: SHOP,
      logoUrl: null,
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
      updatedAt: new Date(),
    });

    const result = await getBrand(SHOP);

    expect(result.logoUrl).toBeNull();
  });

  it("returns the exact default value shape merchants will see when nothing is saved", async () => {
    // These strings are user-visible on every brand-less render. Pinning the
    // exact values here prevents a refactor from silently shifting them.
    prisma.brandSettings.findUnique.mockResolvedValue(null);

    const result = await getBrand(SHOP);

    expect(result.shop).toBe(SHOP);
    expect(result.logoUrl).toBeNull();
    expect(result.accentColor).toBe("#1f5e3a");
    expect(result.fontFamily).toBe("Inter, system-ui, sans-serif");
  });
});

describe("saveBrand", () => {
  function successUpsertResponse(overrides = {}) {
    return {
      shop: SHOP,
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
      updatedAt: new Date("2026-06-22T00:00:00Z"),
      ...overrides,
    };
  }

  it("calls prisma.brandSettings.upsert with the shop as the where key", async () => {
    prisma.brandSettings.upsert.mockResolvedValue(successUpsertResponse());

    await saveBrand(SHOP, {
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
    });

    expect(prisma.brandSettings.upsert).toHaveBeenCalledTimes(1);
    const [args] = prisma.brandSettings.upsert.mock.calls[0];
    expect(args.where).toEqual({ shop: SHOP });
  });

  it("passes the three editable fields in both update and create branches of the upsert", async () => {
    prisma.brandSettings.upsert.mockResolvedValue(successUpsertResponse());

    const data = {
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
    };

    await saveBrand(SHOP, data);

    const [args] = prisma.brandSettings.upsert.mock.calls[0];

    // The update branch carries the new field values.
    expect(args.update).toMatchObject({
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
    });
    // The create branch needs the shop primary key plus the editable fields.
    expect(args.create).toMatchObject({
      shop: SHOP,
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
    });
  });

  it("returns the upserted row", async () => {
    const row = successUpsertResponse();
    prisma.brandSettings.upsert.mockResolvedValue(row);

    const result = await saveBrand(SHOP, {
      logoUrl: "https://cdn.example.com/logo.png",
      accentColor: "#bb2244",
      fontFamily: "Georgia, serif",
    });

    expect(result).toBe(row);
  });
});
