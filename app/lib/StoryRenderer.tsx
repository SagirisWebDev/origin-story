export type CustomField = {
  label: string;
  value: string;
};

export type StoryForRender = {
  id?: string;
  handle?: string;
  productTitle: string | null;
  productHandle?: string | null;
  origin: string;
  maker: string;
  process: string;
  story: string;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
  customFields?: CustomField[];
};

export type BrandForRender = {
  shop: string;
  logoUrl: string | null;
  accentColor: string;
  fontFamily: string;

  // Slice 14 styling fields. All optional so older callers passing only the
  // original 3 fields still render — sensible defaults applied below.
  backgroundColor?: string;
  textColor?: string;
  headingColor?: string;
  buttonBgColor?: string;
  buttonTextColor?: string;
  headingFontFamily?: string;
  borderRadiusScale?: string;
  buttonStyle?: string;

  linkColor?: string;
  borderColor?: string;
  headingFontWeight?: string;
  bodyFontWeight?: string;
  typeScale?: string;
  pageMaxWidth?: string;
  sectionSpacing?: string;
  customFontUrl?: string | null;
  customCss?: string | null;
};

type Props = {
  story: StoryForRender;
  brand: BrandForRender;
};

const RADIUS_PX: Record<string, string> = {
  none: "0",
  small: "4px",
  medium: "8px",
  large: "16px",
};

const TYPE_SCALE: Record<string, { h1: string; h2: string; body: string }> = {
  small: { h1: "1.5rem", h2: "0.75rem", body: "0.9rem" },
  medium: { h1: "2rem", h2: "0.85rem", body: "1rem" },
  large: { h1: "2.5rem", h2: "0.95rem", body: "1.1rem" },
};

const SPACING: Record<string, string> = {
  compact: "1rem",
  comfortable: "1.5rem",
  spacious: "2.5rem",
};

export function StoryRenderer({ story, brand }: Props) {
  const accent = brand.accentColor;
  const bg = brand.backgroundColor ?? "#ffffff";
  const text = brand.textColor ?? "#1a1a1a";
  const heading = brand.headingColor ?? text;
  const buttonBg = brand.buttonBgColor ?? accent;
  const buttonText = brand.buttonTextColor ?? "#ffffff";
  const border = brand.borderColor ?? "#e1e3e5";
  const headingFont = brand.headingFontFamily ?? brand.fontFamily;
  const radius = RADIUS_PX[brand.borderRadiusScale ?? "medium"] ?? "8px";
  const buttonStyle = brand.buttonStyle ?? "solid";
  const headingWeight = brand.headingFontWeight ?? "600";
  const bodyWeight = brand.bodyFontWeight ?? "400";
  const scale = TYPE_SCALE[brand.typeScale ?? "medium"] ?? TYPE_SCALE.medium;
  const maxWidth = brand.pageMaxWidth ?? "640px";
  const sectionGap = SPACING[brand.sectionSpacing ?? "comfortable"] ?? "1.5rem";

  const rootStyle: React.CSSProperties = {
    maxWidth,
    margin: "0 auto",
    padding: "2rem 1.5rem 4rem",
    fontFamily: brand.fontFamily,
    fontWeight: Number(bodyWeight),
    fontSize: scale.body,
    lineHeight: 1.5,
    color: text,
    background: bg,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: scale.h2,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: accent,
    marginBottom: "0.25rem",
    fontFamily: headingFont,
    fontWeight: Number(headingWeight),
  };

  const buttonAsLink: React.CSSProperties =
    buttonStyle === "outline"
      ? {
          background: "transparent",
          color: buttonBg,
          border: `2px solid ${buttonBg}`,
          padding: "0.65rem 1.25rem",
          borderRadius: radius,
          textDecoration: "none",
          fontWeight: 600,
          display: "inline-block",
        }
      : {
          background: buttonBg,
          color: buttonText,
          border: "none",
          padding: "0.65rem 1.25rem",
          borderRadius: radius,
          textDecoration: "none",
          fontWeight: 600,
          display: "inline-block",
        };

  return (
    <>
      {brand.customFontUrl ? (
        <link rel="stylesheet" href={brand.customFontUrl} />
      ) : null}
      {brand.customCss ? <style>{brand.customCss}</style> : null}
      <main style={rootStyle}>
        {brand.logoUrl ? (
          <img
            src={brand.logoUrl}
            alt="Brand logo"
            style={{
              display: "block",
              maxHeight: "48px",
              width: "auto",
              marginBottom: "1.5rem",
            }}
          />
        ) : null}

        {story.heroImageUrl ? (
          <img
            src={story.heroImageUrl}
            alt={story.heroImageAlt ?? story.productTitle ?? "Product hero"}
            style={{
              width: "100%",
              height: "auto",
              borderRadius: radius,
              marginBottom: "1.5rem",
              border: `1px solid ${border}`,
            }}
          />
        ) : null}

        <h1
          style={{
            marginTop: 0,
            marginBottom: sectionGap,
            color: heading,
            fontFamily: headingFont,
            fontWeight: Number(headingWeight),
            fontSize: scale.h1,
          }}
        >
          {story.productTitle ?? "Product story"}
        </h1>

        <section style={{ marginTop: sectionGap }}>
          <h2 style={labelStyle}>Origin</h2>
          <p style={{ margin: 0 }}>{story.origin}</p>
        </section>

        <section style={{ marginTop: sectionGap }}>
          <h2 style={labelStyle}>Maker</h2>
          <p style={{ margin: 0 }}>{story.maker}</p>
        </section>

        <section style={{ marginTop: sectionGap }}>
          <h2 style={labelStyle}>Process</h2>
          <p style={{ margin: 0, whiteSpace: "pre-line" }}>{story.process}</p>
        </section>

        <section style={{ marginTop: sectionGap }}>
          <h2 style={labelStyle}>Story</h2>
          <p style={{ margin: 0, whiteSpace: "pre-line" }}>{story.story}</p>
        </section>

        {story.customFields && story.customFields.length > 0 ? (
          <section style={{ marginTop: sectionGap }}>
            {story.customFields.map((field, i) => (
              <div key={i} style={{ marginTop: i === 0 ? 0 : "1rem" }}>
                <h2 style={labelStyle}>{field.label}</h2>
                <p style={{ margin: 0 }}>{field.value}</p>
              </div>
            ))}
          </section>
        ) : null}

        <p style={{ marginTop: "2.5rem", marginBottom: 0 }}>
          <a
            href={
              story.productHandle
                ? `https://${brand.shop}/products/${story.productHandle}`
                : `https://${brand.shop}`
            }
            style={buttonAsLink}
          >
            {story.productHandle ? "Buy now →" : "Visit store →"}
          </a>
        </p>
      </main>
    </>
  );
}
