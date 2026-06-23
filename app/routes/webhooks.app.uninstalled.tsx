import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import db from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, session, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  // App-owned shop data is wiped on every firing — `deleteMany` is idempotent
  // and the webhook can refire after the session is already gone.
  await db.brandSettings.deleteMany({ where: { shop } });
  await db.scanEvent.deleteMany({ where: { shop } });

  // Sessions are gated on `session` because Shopify's webhook helper returns
  // a null session once it has already been deleted on a prior firing.
  if (session) {
    await db.session.deleteMany({ where: { shop } });
  }

  return new Response();
};
