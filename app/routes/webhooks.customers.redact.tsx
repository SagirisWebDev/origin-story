import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// GDPR mandatory webhook (per Shopify App Store requirements).
//
// Fires 48 hours after a merchant requests deletion of a customer's data.
// OriginStory does NOT store any customer personal data — see the
// data_request handler comment for details — so there is nothing to delete.
// We still must ack 200 OK or Shopify will retry and flag the app as
// non-compliant.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(
    `Received ${topic} webhook for ${shop} — no customer data stored, nothing to delete.`,
  );
  return new Response();
};
