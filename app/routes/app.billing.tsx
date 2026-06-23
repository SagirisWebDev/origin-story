import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return {};
};

export default function Billing() {
  return (
    <s-page heading="Upgrade">
      <s-section heading="Coming soon">
        <s-stack gap="base">
          <s-paragraph>
            OriginStory Pro unlocks scan analytics, custom story fields, and
            priority support.
          </s-paragraph>
          <s-paragraph>
            Billing integration is rolling out shortly. In the meantime every
            paid feature is enabled for early-access shops at no charge.
          </s-paragraph>
          <s-button href="/app" variant="primary">
            Back to stories
          </s-button>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
