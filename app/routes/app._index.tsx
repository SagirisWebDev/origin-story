import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { listStories } from "../models/ProductStory.server.js";

type Story = {
  id: string;
  handle: string;
  productHandle: string | null;
  productTitle: string | null;
  productImage: string | null;
  productImageAlt: string | null;
  origin: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const stories = (await listStories(admin.graphql)) as Story[];
  return { stories };
};

export default function Index() {
  const { stories } = useLoaderData<typeof loader>();
  const isEmpty = stories.length === 0;

  return (
    <s-page heading="OriginStory">
      <s-button slot="primary-action" href="/app/stories/new" variant="primary">
        Create new story
      </s-button>

      {isEmpty ? (
        <s-section heading="No stories yet">
          <s-stack gap="base">
            <s-paragraph>
              OriginStory lets you attach a rich provenance page to any
              product — where it came from, who made it, how it was made —
              and generates a QR code that brings shoppers straight to it.
            </s-paragraph>
            <s-paragraph>
              Create your first story to get started.
            </s-paragraph>
            <s-stack direction="inline" gap="base">
              <s-button href="/app/stories/new" variant="primary">
                Create new story
              </s-button>
            </s-stack>
          </s-stack>
        </s-section>
      ) : (
        <s-section heading="Your stories">
          <s-stack gap="small-200">
            {stories.map((story) => (
              <s-clickable
                key={story.id}
                href={`/app/stories/${story.handle}`}
                borderRadius="base"
                accessibilityLabel={`Edit story for ${story.productTitle ?? "untitled product"}`}
              >
                <s-box
                  padding="small-300"
                  border="base"
                  borderRadius="base"
                >
                  <s-stack
                    direction="inline"
                    gap="base"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <s-stack direction="inline" gap="base" alignItems="center">
                      <s-box
                        inlineSize="48px"
                        blockSize="48px"
                        border="base"
                        borderRadius="base"
                        background="subdued"
                        overflow="hidden"
                      >
                        {story.productImage ? (
                          <s-image
                            src={story.productImage}
                            alt={story.productImageAlt ?? story.productTitle ?? ""}
                          />
                        ) : (
                          <s-icon type="product" size="base" />
                        )}
                      </s-box>
                      <s-stack gap="small-100">
                        <s-text>
                          {story.productTitle ?? "Untitled story"}
                        </s-text>
                        {story.origin ? (
                          <s-text color="subdued">{story.origin}</s-text>
                        ) : null}
                      </s-stack>
                    </s-stack>
                    <s-text color="subdued">Edit</s-text>
                  </s-stack>
                </s-box>
              </s-clickable>
            ))}
          </s-stack>
        </s-section>
      )}
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
