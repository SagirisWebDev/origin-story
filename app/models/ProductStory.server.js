const METAOBJECT_TYPE = "$app:product_story";

const METAOBJECT_FIELDS_FRAGMENT = `
  id
  handle
  updatedAt
  product: field(key: "product") {
    jsonValue
    reference {
      ... on Product {
        handle
        title
        media(first: 1) {
          nodes {
            preview {
              image { url altText }
            }
          }
        }
      }
    }
  }
  origin: field(key: "origin") { jsonValue }
  maker: field(key: "maker") { jsonValue }
  process: field(key: "process") { jsonValue }
  story: field(key: "story") { jsonValue }
  heroImage: field(key: "hero_image") {
    jsonValue
    reference {
      ... on MediaImage {
        image { url altText }
      }
    }
  }
  customFields: field(key: "custom_fields") { jsonValue }
`;

function normalizeMetaobject(metaobject) {
  if (!metaobject) return null;

  const product = metaobject.product?.reference;
  const heroImage = metaobject.heroImage?.reference?.image;

  return {
    id: metaobject.id,
    handle: metaobject.handle,
    updatedAt: metaobject.updatedAt,
    productId: metaobject.product?.jsonValue ?? null,
    productHandle: product?.handle ?? null,
    productTitle: product?.title ?? null,
    productImage: product?.media?.nodes?.[0]?.preview?.image?.url ?? null,
    productImageAlt: product?.media?.nodes?.[0]?.preview?.image?.altText ?? null,
    origin: metaobject.origin?.jsonValue ?? "",
    maker: metaobject.maker?.jsonValue ?? "",
    process: metaobject.process?.jsonValue ?? "",
    story: metaobject.story?.jsonValue ?? "",
    heroImageId: metaobject.heroImage?.jsonValue ?? null,
    heroImageUrl: heroImage?.url ?? null,
    heroImageAlt: heroImage?.altText ?? null,
    customFields: metaobject.customFields?.jsonValue ?? [],
  };
}

export async function getStory(handle, graphql) {
  const response = await graphql(
    `
      query GetProductStory($handle: MetaobjectHandleInput!) {
        metaobjectByHandle(handle: $handle) {
          ${METAOBJECT_FIELDS_FRAGMENT}
        }
      }
    `,
    {
      variables: {
        handle: { type: METAOBJECT_TYPE, handle },
      },
    },
  );

  const { data } = await response.json();
  return normalizeMetaobject(data?.metaobjectByHandle);
}

export async function getStoryByProductId(productId, graphql) {
  const stories = await listStories(graphql);
  return stories.find((s) => s.productId === productId) ?? null;
}

export async function listStories(graphql) {
  const response = await graphql(
    `
      query ListProductStories($type: String!) {
        metaobjects(type: $type, first: 100, sortKey: "updated_at", reverse: true) {
          nodes {
            ${METAOBJECT_FIELDS_FRAGMENT}
          }
        }
      }
    `,
    {
      variables: { type: METAOBJECT_TYPE },
    },
  );

  const { data } = await response.json();
  const nodes = data?.metaobjects?.nodes ?? [];
  return nodes.map(normalizeMetaobject);
}

export async function saveStory(handle, data, graphql) {
  const fields = [
    { key: "product", value: data.productId },
    { key: "origin", value: data.origin },
    { key: "maker", value: data.maker },
    { key: "process", value: data.process },
    { key: "story", value: data.story },
  ];

  if (data.heroImageId) {
    fields.push({ key: "hero_image", value: data.heroImageId });
  }

  if (data.customFields !== undefined) {
    fields.push({
      key: "custom_fields",
      value: JSON.stringify(data.customFields),
    });
  }

  const response = await graphql(
    `
      mutation UpsertProductStory(
        $handle: MetaobjectHandleInput!
        $metaobject: MetaobjectUpsertInput!
      ) {
        metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
          metaobject { id handle }
          userErrors { field message }
        }
      }
    `,
    {
      variables: {
        handle: { type: METAOBJECT_TYPE, handle },
        metaobject: { fields },
      },
    },
  );

  const body = await response.json();
  const result = body.data.metaobjectUpsert;

  if (result.userErrors?.length) {
    throw new Error(result.userErrors[0].message);
  }

  return result.metaobject;
}

export async function deleteStory(id, graphql) {
  const response = await graphql(
    `
      mutation DeleteProductStory($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `,
    {
      variables: { id },
    },
  );

  const body = await response.json();
  const result = body.data.metaobjectDelete;

  if (result.userErrors?.length) {
    throw new Error(result.userErrors[0].message);
  }
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function generateHandle(productTitle) {
  const slug = slugify(productTitle);
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  return `${slug}-${suffix}`;
}

export function validateStory(data = {}) {
  const errors = {};

  if (!data.productId) errors.productId = "Product is required";
  if (!data.origin) errors.origin = "Origin is required";
  if (!data.maker) errors.maker = "Maker is required";
  if (!data.process) errors.process = "Process is required";
  if (!data.story) errors.story = "Story is required";

  return Object.keys(errors).length ? errors : undefined;
}
