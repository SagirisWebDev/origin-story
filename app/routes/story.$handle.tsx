import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

import { unauthenticated } from "../shopify.server";
import { getStory } from "../models/ProductStory.server.js";
import { getBrand } from "../models/BrandSettings.server.js";
import { StoryRenderer } from "../lib/StoryRenderer";

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
  const [story, brand] = await Promise.all([
    getStory(handle, admin.graphql),
    getBrand(shop),
  ]);

  if (!story) {
    throw new Response("Story not found", { status: 404 });
  }

  return { story, brand };
}

export default function PublicStoryPage() {
  const { story, brand } = useLoaderData<typeof loader>();
  return <StoryRenderer story={story} brand={brand} />;
}
