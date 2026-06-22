export type StoryForRender = {
  id?: string;
  handle?: string;
  productTitle: string | null;
  origin: string;
  maker: string;
  process: string;
  story: string;
  heroImageUrl: string | null;
  heroImageAlt: string | null;
};

export type BrandForRender = {
  shop: string;
  logoUrl: string | null;
  accentColor: string;
  fontFamily: string;
};

type Props = {
  story: StoryForRender;
  brand: BrandForRender;
};

const labelStyle = (accentColor: string): React.CSSProperties => ({
  fontSize: "0.85rem",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  color: accentColor,
  marginBottom: "0.25rem",
});

export function StoryRenderer({ story, brand }: Props) {
  const rootStyle: React.CSSProperties = {
    maxWidth: "640px",
    margin: "0 auto",
    padding: "2rem 1.5rem 4rem",
    fontFamily: brand.fontFamily,
    lineHeight: 1.5,
    color: "#1a1a1a",
  };

  return (
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
            borderRadius: "8px",
            marginBottom: "1.5rem",
          }}
        />
      ) : null}

      <h1
        style={{
          marginTop: 0,
          marginBottom: "1.5rem",
          color: brand.accentColor,
          fontFamily: brand.fontFamily,
        }}
      >
        {story.productTitle ?? "Product story"}
      </h1>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={labelStyle(brand.accentColor)}>Origin</h2>
        <p style={{ margin: 0 }}>{story.origin}</p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={labelStyle(brand.accentColor)}>Maker</h2>
        <p style={{ margin: 0 }}>{story.maker}</p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={labelStyle(brand.accentColor)}>Process</h2>
        <p style={{ margin: 0, whiteSpace: "pre-line" }}>{story.process}</p>
      </section>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={labelStyle(brand.accentColor)}>Story</h2>
        <p style={{ margin: 0, whiteSpace: "pre-line" }}>{story.story}</p>
      </section>
    </main>
  );
}
