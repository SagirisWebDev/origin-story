import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// GDPR mandatory webhook (per Shopify App Store requirements).
//
// Fires when a merchant's customer (a shopper) exercises their data-request
// right. OriginStory does NOT store any customer personal data: the only thing
// recorded on the customer side is anonymous scan events (handle + shop +
// coarse user-agent class — no IP, no raw UA, no identifier). So there is no
// per-customer data to return. We still must ack 200 OK or Shopify will retry
// and flag the app as non-compliant.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(
    `Received ${topic} webhook for ${shop} — no customer data stored, nothing to return.`,
  );
  return new Response();
};
