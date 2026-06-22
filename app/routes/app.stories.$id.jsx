import { useState, useEffect, useRef } from "react";
import {
  useActionData,
  useLoaderData,
  useSubmit,
  useParams,
} from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

import {
  deleteStory,
  generateHandle,
  getStory,
  saveStory,
  validateStory,
} from "../models/ProductStory.server.js";
import { generate as generateQRCode } from "../lib/QRCodeGenerator.server.js";

async function buildQRCodes(handle, shop) {
  const [pngDataUrl, svgString] = await Promise.all([
    generateQRCode(handle, shop, { format: "png" }),
    generateQRCode(handle, shop, { format: "svg" }),
  ]);
  const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svgString).toString("base64")}`;
  return { pngDataUrl, svgDataUrl };
}

export async function loader({ request, params }) {
  const { admin, session } = await authenticate.admin(request);

  if (params.id === "new") {
    return {
      handle: null,
      productId: null,
      productTitle: null,
      productImage: null,
      origin: "",
      maker: "",
      process: "",
      story: "",
      shop: session.shop,
      qrPng: null,
      qrSvg: null,
    };
  }

  const storyRecord = await getStory(params.id, admin.graphql);
  if (!storyRecord) {
    throw new Response("Story not found", { status: 404 });
  }

  const { pngDataUrl, svgDataUrl } = await buildQRCodes(
    storyRecord.handle,
    session.shop,
  );

  return {
    ...storyRecord,
    shop: session.shop,
    qrPng: pngDataUrl,
    qrSvg: svgDataUrl,
  };
}

export async function action({ request, params }) {
  const { admin, redirect } = await authenticate.admin(request);

  const data = Object.fromEntries(await request.formData());

  if (data.intent === "delete") {
    await deleteStory(data.metaobjectId, admin.graphql);
    return redirect("/app");
  }

  const payload = {
    productId: data.productId || undefined,
    origin: data.origin || "",
    maker: data.maker || "",
    process: data.process || "",
    story: data.story || "",
  };

  const errors = validateStory(payload);
  if (errors) {
    return new Response(JSON.stringify({ errors }), {
      status: 422,
      headers: { "Content-Type": "application/json" },
    });
  }

  const handle =
    params.id === "new"
      ? generateHandle(data.productTitle || payload.productId)
      : params.id;

  const metaobject = await saveStory(handle, payload, admin.graphql);

  return redirect(`/app/stories/${metaobject.handle}`);
}

export default function StoryForm() {
  const { id } = useParams();
  const loaderData = useLoaderData();
  const [initial, setInitial] = useState(loaderData);
  const [formState, setFormState] = useState(loaderData);
  const errors = useActionData()?.errors || {};
  const isDirty = JSON.stringify(formState) !== JSON.stringify(initial);

  async function selectProduct() {
    const products = await window.shopify.resourcePicker({
      type: "product",
      action: "select",
      selectionIds: formState.productId
        ? [{ id: formState.productId }]
        : [],
    });

    if (products && products[0]) {
      const { id: productId, title, images } = products[0];
      setFormState({
        ...formState,
        productId,
        productTitle: title,
        productImage: images?.[0]?.originalSrc ?? null,
      });
    }
  }

  function removeProduct() {
    setFormState({
      ...formState,
      productId: null,
      productTitle: null,
      productImage: null,
    });
  }

  const submit = useSubmit();

  function handleSave(e) {
    e.preventDefault();
    submit(
      {
        productId: formState.productId || "",
        productTitle: formState.productTitle || "",
        origin: formState.origin || "",
        maker: formState.maker || "",
        process: formState.process || "",
        story: formState.story || "",
      },
      { method: "post" },
    );
  }

  function handleDelete(e) {
    e.preventDefault();
    submit(
      { intent: "delete", metaobjectId: initial.id },
      { method: "post" },
    );
  }

  const saveBarRef = useRef(null);

  function handleReset() {
    setFormState(initial);
    saveBarRef.current?.hide();
  }

  useEffect(() => {
    const saveBar = saveBarRef.current;
    if (!saveBar) return;
    if (isDirty) saveBar.show();
    else saveBar.hide();
  }, [isDirty]);

  useEffect(() => {
    setInitial(loaderData);
    setFormState(loaderData);
  }, [id, loaderData]);

  const heading = id === "new" ? "Create story" : formState.productTitle || "Edit story";
  const publicUrl = initial.handle
    ? `/story/${initial.handle}?shop=${loaderData.shop}`
    : null;

  return (
    <>
      <ui-save-bar ref={saveBarRef} id="product-story-form">
        <button variant="primary" onClick={handleSave}></button>
        <button onClick={handleReset}></button>
      </ui-save-bar>
      <form onSubmit={handleSave} onReset={handleReset}>
        <s-page heading={heading}>
          <s-link href="/app" slot="breadcrumb-actions">
            Stories
          </s-link>
          {initial.id ? (
            <s-button slot="secondary-actions" onClick={handleDelete}>
              Delete
            </s-button>
          ) : null}

          <s-section heading="Product">
            <s-stack gap="small-400">
              {formState.productId ? (
                <s-stack
                  direction="inline"
                  justifyContent="space-between"
                  alignItems="center"
                >
                  <s-stack direction="inline" gap="small-100" alignItems="center">
                    <s-box
                      padding="small-200"
                      border="base"
                      borderRadius="base"
                      background="subdued"
                      inlineSize="38px"
                      blockSize="38px"
                    >
                      {formState.productImage ? (
                        <s-image src={formState.productImage}></s-image>
                      ) : (
                        <s-icon size="large" type="product" />
                      )}
                    </s-box>
                    <s-text>{formState.productTitle}</s-text>
                  </s-stack>
                  <s-stack direction="inline" gap="small">
                    <s-button onClick={selectProduct}>Change</s-button>
                    <s-button onClick={removeProduct} variant="tertiary">
                      Remove
                    </s-button>
                  </s-stack>
                </s-stack>
              ) : (
                <s-button onClick={selectProduct}>Select product</s-button>
              )}
              {errors.productId ? (
                <s-text tone="critical" variant="bodySm">
                  {errors.productId}
                </s-text>
              ) : null}
            </s-stack>
          </s-section>

          <s-section heading="Story content">
            <s-stack gap="base">
              <s-text-field
                label="Origin"
                details="Where the product or its primary ingredients come from"
                error={errors.origin}
                name="origin"
                value={formState.origin}
                onInput={(e) =>
                  setFormState({ ...formState, origin: e.target.value })
                }
              ></s-text-field>
              <s-text-field
                label="Maker"
                details="The person, farm, or workshop that produced this"
                error={errors.maker}
                name="maker"
                value={formState.maker}
                onInput={(e) =>
                  setFormState({ ...formState, maker: e.target.value })
                }
              ></s-text-field>
              <s-text-area
                label="Process"
                details="How the product was made or grown"
                error={errors.process}
                name="process"
                rows="3"
                value={formState.process}
                onInput={(e) =>
                  setFormState({ ...formState, process: e.target.value })
                }
              ></s-text-area>
              <s-text-area
                label="Story"
                details="The brand story that gives this product meaning"
                error={errors.story}
                name="story"
                rows="5"
                value={formState.story}
                onInput={(e) =>
                  setFormState({ ...formState, story: e.target.value })
                }
              ></s-text-area>
            </s-stack>
          </s-section>

          {initial.handle ? (
            <s-box slot="aside">
              <s-section heading="QR code">
                <s-stack gap="base">
                  <s-box
                    padding="base"
                    border="none"
                    borderRadius="base"
                    background="subdued"
                  >
                    {loaderData.qrPng ? (
                      <s-image
                        aspectRatio="1/1"
                        src={loaderData.qrPng}
                        alt={`QR code for ${formState.productTitle ?? "this story"}`}
                      />
                    ) : null}
                  </s-box>
                  <s-stack direction="inline" gap="small">
                    <s-button
                      href={loaderData.qrPng ?? undefined}
                      download={`origin-story-${initial.handle}.png`}
                      variant="primary"
                    >
                      Download PNG
                    </s-button>
                    <s-button
                      href={loaderData.qrSvg ?? undefined}
                      download={`origin-story-${initial.handle}.svg`}
                    >
                      Download SVG
                    </s-button>
                  </s-stack>
                </s-stack>
              </s-section>
              <s-section heading="Public page">
                <s-stack gap="small">
                  <s-text color="subdued">
                    The QR code points to a scan endpoint that redirects to this URL.
                  </s-text>
                  <s-link href={publicUrl} target="_blank">
                    Open public page
                  </s-link>
                </s-stack>
              </s-section>
            </s-box>
          ) : null}
        </s-page>
      </form>
    </>
  );
}

export const headers = (headersArgs) => boundary.headers(headersArgs);
