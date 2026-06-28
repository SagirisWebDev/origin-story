import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

// GDPR mandatory webhook (per Shopify App Store requirements).
//
// Fires 48 hours after a merchant uninstalls the app. The `app/uninstalled`
// handler already wipes BrandSettings + ScanEvent + Session synchronously on
// uninstall, so by the time this fires there's typically nothing left. We
// defensively re-run the deletes — deleteMany is idempotent and the webhook
// can refire — to satisfy "delete all shop data" even if the prior cleanup
// somehow missed.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);
  console.log(`Received ${topic} webhook for ${shop}`);

  await db.brandSettings.deleteMany({ where: { shop } });
  await db.scanEvent.deleteMany({ where: { shop } });
  await db.session.deleteMany({ where: { shop } });

  return new Response();
};
