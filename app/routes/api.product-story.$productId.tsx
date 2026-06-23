import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";

import { authenticate } from "../shopify.server";
import {
  generateHandle,
  getStoryByProductId,
  saveStory,
  validateStory,
} from "../models/ProductStory.server.js";
import { generate as generateQRCode } from "../lib/QRCodeGenerator.server.js";
import { getFeatureFlags } from "../lib/featureFlags.server.js";

const PRODUCT_TITLE_QUERY = `
  query ProductTitle($id: ID!) {
    product(id: $id) {
      id
      title
    }
  }
`;

function decodeProductId(raw: string | undefined): string {
  if (!raw) throw new Response("Missing productId", { status: 400 });
  return decodeURIComponent(raw);
}

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session, cors } = await authenticate.admin(request);
  const productId = decodeProductId(params.productId);
  const shop = session?.shop;
  const flags = getFeatureFlags(shop);

  const story = await getStoryByProductId(productId, admin.graphql);

  if (story) {
    const qrPng = shop
      ? await generateQRCode(story.handle, shop, { format: "png" })
      : null;
    return cors(
      Response.json({
        story,
        productTitle: story.productTitle,
        productId,
        qrPng,
        flags,
      }),
    );
  }

  const response = await admin.graphql(PRODUCT_TITLE_QUERY, {
    variables: { id: productId },
  });
  const body = await response.json();
  const productTitle = body?.data?.product?.title ?? null;

  return cors(
    Response.json({
      story: null,
      productTitle,
      productId,
      qrPng: null,
      flags,
    }),
  );
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin, cors } = await authenticate.admin(request);
  const productId = decodeProductId(params.productId);

  const body = (await request.json()) as {
    origin?: string;
    maker?: string;
    process?: string;
    story?: string;
    productTitle?: string;
    heroImageId?: string | null;
    customFields?: Array<{ label: string; value: string }>;
  };

  const data = {
    productId,
    origin: body.origin ?? "",
    maker: body.maker ?? "",
    process: body.process ?? "",
    story: body.story ?? "",
    ...(body.heroImageId ? { heroImageId: body.heroImageId } : {}),
    ...(body.customFields !== undefined
      ? { customFields: body.customFields }
      : {}),
  };

  const errors = validateStory(data);
  if (errors) {
    return cors(Response.json({ ok: false, errors }, { status: 422 }));
  }

  const existing = await getStoryByProductId(productId, admin.graphql);
  const handle = existing
    ? existing.handle
    : generateHandle(body.productTitle ?? "story");

  const saved = await saveStory(handle, data, admin.graphql);

  return cors(
    Response.json({
      ok: true,
      story: { id: saved.id, handle: saved.handle },
    }),
  );
};
