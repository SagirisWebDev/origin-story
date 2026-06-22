#!/usr/bin/env node
/**
 * Common Roast demo migration — one-off script for issue #6.
 *
 * Reads bean products from the Common Roast Shopify store, builds a
 * `app:product_story` metaobject payload per product using the pure transform
 * logic in `app/lib/commonRoastMigration.js`, and either prints the proposed
 * payloads (dry-run, default) or upserts them via the Admin GraphQL API
 * (with --commit).
 *
 * Usage:
 *   SHOPIFY_STORE_DOMAIN=common-roast.myshopify.com \
 *   SHOPIFY_ADMIN_TOKEN=shpat_xxxxxxxxxxxxxxxxxxxxxxxxxxxx \
 *   node scripts/migrate-common-roast-stories.mjs [--commit] [--help]
 *
 * The Admin token must be from a custom app installed on the Common Roast
 * store with at least these scopes: read_products, write_metaobjects,
 * write_metaobject_definitions.
 */

import {
  STORY_SEEDS,
  buildStoryPayload,
  isMigratable,
} from "../app/lib/commonRoastMigration.js";

const ADMIN_API_VERSION = "2026-07";

function usage() {
  console.log(
    [
      "",
      "Common Roast demo migration",
      "",
      "Env vars (required):",
      "  SHOPIFY_STORE_DOMAIN  e.g. common-roast.myshopify.com",
      "  SHOPIFY_ADMIN_TOKEN   custom-app Admin API token",
      "",
      "Flags:",
      "  --commit   actually upsert the metaobjects (default: dry-run)",
      "  --help     show this message",
      "",
    ].join("\n"),
  );
}

async function adminGraphql({ storeDomain, adminToken, query, variables }) {
  const url = `https://${storeDomain}/admin/api/${ADMIN_API_VERSION}/graphql.json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": adminToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Admin GraphQL request failed (${response.status}): ${text}`,
    );
  }

  const body = await response.json();
  if (body.errors) {
    throw new Error(
      `Admin GraphQL returned errors: ${JSON.stringify(body.errors)}`,
    );
  }

  return body.data;
}

const PRODUCTS_QUERY = `
  query MigrationProducts($cursor: String) {
    products(first: 50, after: $cursor) {
      pageInfo { hasNextPage endCursor }
      nodes {
        id
        handle
        title
        featuredImage { id url altText }
        originCountry: metafield(namespace: "coffee", key: "origin_country") { value }
        originRegion: metafield(namespace: "coffee", key: "origin_region") { value }
        producerFarmName: metafield(namespace: "coffee", key: "producer_farm_name") { value }
        process: metafield(namespace: "coffee", key: "process") { value }
      }
    }
  }
`;

const UPSERT_MUTATION = `
  mutation UpsertProductStory(
    $handle: MetaobjectHandleInput!
    $metaobject: MetaobjectUpsertInput!
  ) {
    metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
      metaobject { id handle }
      userErrors { field message }
    }
  }
`;

function adaptProduct(node) {
  return {
    id: node.id,
    handle: node.handle,
    title: node.title,
    featuredImage: node.featuredImage,
    metafields: {
      origin_country: node.originCountry?.value ?? "",
      origin_region: node.originRegion?.value ?? "",
      producer_farm_name: node.producerFarmName?.value ?? "",
      process: node.process?.value ?? "",
    },
  };
}

async function fetchAllProducts({ storeDomain, adminToken }) {
  const all = [];
  let cursor = null;
  do {
    const data = await adminGraphql({
      storeDomain,
      adminToken,
      query: PRODUCTS_QUERY,
      variables: { cursor },
    });
    const { nodes, pageInfo } = data.products;
    all.push(...nodes.map(adaptProduct));
    cursor = pageInfo.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);
  return all;
}

async function upsertStory({ storeDomain, adminToken, payload }) {
  const fields = [
    { key: "product", value: payload.productId },
    { key: "origin", value: payload.origin },
    { key: "maker", value: payload.maker },
    { key: "process", value: payload.process },
    { key: "story", value: payload.story },
  ];

  const data = await adminGraphql({
    storeDomain,
    adminToken,
    query: UPSERT_MUTATION,
    variables: {
      handle: { type: "$app:product_story", handle: payload.handle },
      metaobject: { fields },
    },
  });

  const result = data.metaobjectUpsert;
  if (result.userErrors?.length) {
    throw new Error(
      `Upsert failed for ${payload.handle}: ${result.userErrors
        .map((e) => `${e.field?.join(".")}: ${e.message}`)
        .join("; ")}`,
    );
  }

  return result.metaobject;
}

function formatPayloadForPrint(payload) {
  return [
    `  ${payload.productTitle} (${payload.handle})`,
    `    productId: ${payload.productId}`,
    `    origin:    ${payload.origin}`,
    `    maker:     ${payload.maker}`,
    `    process:   ${payload.process}`,
    `    story:     ${payload.story.slice(0, 80)}${payload.story.length > 80 ? "…" : ""}`,
  ].join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    usage();
    return;
  }

  const commit = args.includes("--commit");
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;
  const adminToken = process.env.SHOPIFY_ADMIN_TOKEN;

  if (!storeDomain || !adminToken) {
    console.error(
      "Missing required env vars: SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_TOKEN",
    );
    usage();
    process.exitCode = 1;
    return;
  }

  console.log(`Fetching products from ${storeDomain}…`);
  const products = await fetchAllProducts({ storeDomain, adminToken });
  console.log(`Found ${products.length} products.`);

  const migratable = products.filter((p) => isMigratable(p));
  const skipped = products.filter((p) => !isMigratable(p));

  console.log("");
  console.log(
    `${migratable.length} products eligible for migration (have coffee.origin_country + a seed):`,
  );
  console.log("");

  const payloads = migratable.map((p) => buildStoryPayload(p));
  for (const payload of payloads) {
    console.log(formatPayloadForPrint(payload));
    console.log("");
  }

  if (skipped.length) {
    console.log(`${skipped.length} products skipped:`);
    for (const p of skipped) {
      const reasons = [];
      if (!p.metafields?.origin_country) reasons.push("no origin_country");
      if (typeof STORY_SEEDS[p.handle] !== "string")
        reasons.push("no seed for handle");
      console.log(`  - ${p.title} (${p.handle}): ${reasons.join(", ")}`);
    }
    console.log("");
  }

  if (!commit) {
    console.log("Dry-run complete. Re-run with --commit to upsert metaobjects.");
    return;
  }

  console.log("Committing…");
  for (const payload of payloads) {
    try {
      const result = await upsertStory({ storeDomain, adminToken, payload });
      console.log(
        `  ✓ ${payload.handle} → metaobject ${result.id}`,
      );
    } catch (err) {
      console.error(`  ✗ ${payload.handle}: ${err.message}`);
      process.exitCode = 1;
    }
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err.stack ?? err);
  process.exitCode = 1;
});
