import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import {
  StoryRenderer,
  type StoryForRender,
  type BrandForRender,
} from "./StoryRenderer";

/**
 * Sample fixtures shared across the test cases. These match the shape that
 * `getStory` / `getBrand` return today, so a working `StoryRenderer` should
 * render them without massaging in either direction.
 */
const sampleStory = {
  id: "gid://shopify/Metaobject/1",
  handle: "ethiopia-yirgacheffe-abc",
  productTitle: "Ethiopia Yirgacheffe",
  productImage: null,
  productImageAlt: null,
  origin: "Yirgacheffe, Ethiopia",
  maker: "Yirgacheffe Cooperative",
  process: "Washed and sun-dried for 14 days.",
  story: "A century of farming heritage in the highlands.",
  heroImageUrl: "https://cdn.example.com/hero.jpg",
  heroImageAlt: "Coffee farm at sunrise",
  // Slice 8 (issue #11): the renderer must accept customFields. Default is
  // empty — the existing tests must continue to pass with no custom fields
  // section rendered.
  customFields: [],
};

const sampleBrand = {
  shop: "test-shop.myshopify.com",
  logoUrl: "https://cdn.example.com/logo.png",
  accentColor: "#1f5e3a",
  fontFamily: "Georgia, serif",
};

const DEFAULT_BRAND = {
  shop: "test-shop.myshopify.com",
  logoUrl: null,
  accentColor: "#1f5e3a",
  fontFamily: "Inter, system-ui, sans-serif",
};

function render(story: StoryForRender, brand: BrandForRender) {
  return renderToStaticMarkup(<StoryRenderer story={story} brand={brand} />);
}

describe("StoryRenderer", () => {
  it("renders the product title inside an <h1>", () => {
    const html = render(sampleStory, sampleBrand);

    // The h1 element must contain the product title; we match start tag,
    // optional attributes, then the literal title text.
    expect(html).toMatch(/<h1[^>]*>[^<]*Ethiopia Yirgacheffe[^<]*<\/h1>/);
  });

  it("renders every core story field somewhere in the output", () => {
    const html = render(sampleStory, sampleBrand);

    expect(html).toContain(sampleStory.origin);
    expect(html).toContain(sampleStory.maker);
    expect(html).toContain(sampleStory.process);
    expect(html).toContain(sampleStory.story);
  });

  it("renders the hero image when story.heroImageUrl is set", () => {
    const html = render(sampleStory, sampleBrand);

    // Look for an <img ... src="hero.jpg"> tag.
    expect(html).toMatch(
      /<img[^>]+src=["']https:\/\/cdn\.example\.com\/hero\.jpg["']/,
    );
  });

  it("includes the hero image alt text when one is provided", () => {
    const html = render(sampleStory, sampleBrand);

    expect(html).toContain(sampleStory.heroImageAlt);
  });

  it("skips the hero image when story.heroImageUrl is null", () => {
    const html = render(
      { ...sampleStory, heroImageUrl: null, heroImageAlt: null },
      sampleBrand,
    );

    // The cdn host appears in both hero and logo URLs in the rich fixture, so
    // match the hero filename specifically to be sure we are checking the hero
    // image and not, e.g., the brand logo.
    expect(html).not.toContain("hero.jpg");
  });

  it("renders the brand logo when brand.logoUrl is set", () => {
    const html = render(sampleStory, sampleBrand);

    expect(html).toMatch(
      /<img[^>]+src=["']https:\/\/cdn\.example\.com\/logo\.png["']/,
    );
  });

  it("omits the brand logo when brand.logoUrl is null", () => {
    const html = render(sampleStory, DEFAULT_BRAND);

    expect(html).not.toContain("logo.png");
  });

  it("applies the brand accent color as a CSS color value", () => {
    const html = render(sampleStory, sampleBrand);

    // React renders inline `style` props as semicolon-delimited CSS. We do not
    // assume a specific element — we just confirm the accent colour appears
    // alongside a `color` style somewhere in the output.
    expect(html).toEqual(expect.stringContaining(sampleBrand.accentColor));
    expect(html.toLowerCase()).toMatch(/color\s*:\s*#1f5e3a/);
  });

  it("applies the brand font family as a CSS font-family value", () => {
    const html = render(sampleStory, sampleBrand);

    // React serialises `fontFamily` as the kebab-case `font-family` in the
    // rendered HTML. The font-family value contains a comma and may be
    // HTML-encoded for the quote, so check the family name case-insensitively.
    expect(html.toLowerCase()).toMatch(/font-family\s*:\s*[^;"']*georgia/);
  });

  it("renders correctly with the default brand (null logo, default accent and font)", () => {
    const html = render(sampleStory, DEFAULT_BRAND);

    // Core story content still appears.
    expect(html).toContain(sampleStory.productTitle);
    expect(html).toContain(sampleStory.origin);
    // No logo image.
    expect(html).not.toContain("logo.png");
    // Default accent colour is applied.
    expect(html.toLowerCase()).toMatch(/color\s*:\s*#1f5e3a/);
    // Default font family is applied (case-insensitive substring match).
    expect(html.toLowerCase()).toMatch(/font-family\s*:\s*[^;"']*inter/);
  });

  // ---------------------------------------------------------------------------
  // Slice 8 (issue #11): custom fields section
  // ---------------------------------------------------------------------------
  //
  // Custom fields render below the core fields when present. When empty (or
  // omitted), no section, heading, or label markup for custom fields appears.
  //
  // We pin behavior, not exact markup: the rendered HTML must include both the
  // label and value text for each entry, and labels must share the brand's
  // accent-color treatment with the core field labels.

  describe("custom fields", () => {
    it("does not render any custom-field labels when customFields is an empty array", () => {
      const html = render(
        { ...sampleStory, customFields: [] },
        sampleBrand,
      );

      // "Altitude" is the canonical custom-field label used elsewhere in this
      // suite — its absence here proves the section is hidden.
      expect(html).not.toContain("Altitude");
      expect(html).not.toContain("1800 masl");
    });

    it("does not render custom-field labels when customFields is omitted", () => {
      // Construct a story without the customFields key at all. The renderer
      // must treat absent === empty and render no custom section.
      const { customFields: _ignored, ...storyWithoutCustomFields } = sampleStory;
      const html = render(
        storyWithoutCustomFields as typeof sampleStory,
        sampleBrand,
      );

      expect(html).not.toContain("Altitude");
      expect(html).not.toContain("1800 masl");
    });

    it("renders the label and value when customFields has one entry", () => {
      const html = render(
        {
          ...sampleStory,
          customFields: [{ label: "Altitude", value: "1800 masl" }],
        },
        sampleBrand,
      );

      expect(html).toContain("Altitude");
      expect(html).toContain("1800 masl");
    });

    it("renders every label and value in order when customFields has multiple entries", () => {
      const html = render(
        {
          ...sampleStory,
          customFields: [
            { label: "A", value: "1" },
            { label: "B", value: "2" },
          ],
        },
        sampleBrand,
      );

      // Both pairs render.
      expect(html).toContain("A");
      expect(html).toContain("B");
      expect(html).toContain("1");
      expect(html).toContain("2");

      // A appears before B (preserve order). Use the label text "A" / "B" but
      // anchored to a tag boundary to avoid colliding with the words used in
      // the core story fields (e.g. "Ethiopia", "Yirgacheffe").
      const indexA = html.indexOf(">A<");
      const indexB = html.indexOf(">B<");
      expect(indexA).toBeGreaterThan(-1);
      expect(indexB).toBeGreaterThan(-1);
      expect(indexA).toBeLessThan(indexB);
    });

    it("styles custom-field labels with the brand accent color (same treatment as core labels)", () => {
      const html = render(
        {
          ...sampleStory,
          customFields: [{ label: "Altitude", value: "1800 masl" }],
        },
        sampleBrand,
      );

      // The brand accent colour appears in the rendered HTML somewhere near
      // the custom label. Easiest assertion: count `color:#1f5e3a` (or its
      // hyphenated `color: #1f5e3a` form) occurrences. With four core labels
      // styled with the accent colour plus the <h1>, a custom-field label
      // pushes the count higher than it would be with no custom fields.
      const baselineHtml = render(
        { ...sampleStory, customFields: [] },
        sampleBrand,
      );
      const accent = sampleBrand.accentColor.toLowerCase();
      const countOccurrences = (haystack: string) =>
        haystack.toLowerCase().split(accent).length - 1;

      expect(countOccurrences(html)).toBeGreaterThan(
        countOccurrences(baselineHtml),
      );
    });
  });
});
