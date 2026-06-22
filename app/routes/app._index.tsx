import type {
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export default function Index() {
  return (
    <s-page heading="OriginStory">
      <s-button slot="primary-action" href="/app/stories/new">
        Create new story
      </s-button>

      <s-section heading="Welcome to OriginStory">
        <s-paragraph>
          OriginStory lets you attach a rich provenance page to any product —
          where it came from, who made it, how it was made — and generate a QR
          code that brings shoppers straight to it.
        </s-paragraph>
        <s-paragraph>
          Start by creating your first story.
        </s-paragraph>
        <s-stack direction="inline" gap="base">
          <s-button href="/app/stories/new" variant="primary">
            Create new story
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
