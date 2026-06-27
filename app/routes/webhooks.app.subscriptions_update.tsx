import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  // billing.check is authoritative on every paid-gated request, so we just
  // log the event for observability; no DB writes needed.
  console.log(`Received ${topic} webhook for ${shop}`);
  return new Response();
};
