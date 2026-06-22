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
});
