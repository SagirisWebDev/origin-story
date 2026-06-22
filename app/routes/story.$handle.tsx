import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { unauthenticated } from "../shopify.server";
import { getStory } from "../models/ProductStory.server.js";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const handle = params.handle;
  if (!handle) {
    throw new Response("Missing handle", { status: 400 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) {
    throw new Response("Missing shop query parameter", { status: 400 });
  }

  const { admin } = await unauthenticated.admin(shop);
  const story = await getStory(handle, admin.graphql);

  if (!story) {
    throw new Response("Story not found", { status: 404 });
  }

  return { story };
}

export default function PublicStoryPage() {
  const { story } = useLoaderData<typeof loader>();

  return (
    <main
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "2rem 1.5rem 4rem",
        fontFamily:
          'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        lineHeight: 1.5,
      }}
    >
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

      <h1 style={{ marginTop: 0 }}>{story.productTitle ?? "Product story"}</h1>

      <section aria-labelledby="origin-heading" style={{ marginTop: "1.5rem" }}>
        <h2 id="origin-heading" style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>
          Origin
        </h2>
        <p>{story.origin}</p>
      </section>

      <section aria-labelledby="maker-heading" style={{ marginTop: "1.5rem" }}>
        <h2 id="maker-heading" style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>
          Maker
        </h2>
        <p>{story.maker}</p>
      </section>

      <section aria-labelledby="process-heading" style={{ marginTop: "1.5rem" }}>
        <h2 id="process-heading" style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>
          Process
        </h2>
        <p style={{ whiteSpace: "pre-line" }}>{story.process}</p>
      </section>

      <section aria-labelledby="story-heading" style={{ marginTop: "1.5rem" }}>
        <h2 id="story-heading" style={{ fontSize: "1rem", textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>
          Story
        </h2>
        <p style={{ whiteSpace: "pre-line" }}>{story.story}</p>
      </section>
    </main>
  );
}
