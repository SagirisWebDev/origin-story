import { useEffect, useRef, useState } from "react";
import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import { useActionData, useLoaderData, useSubmit } from "react-router";

import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";
import {
  getBrand,
  saveBrand,
} from "../models/BrandSettings.server.js";
import { StoryRenderer } from "../lib/StoryRenderer";

const FONT_OPTIONS = [
  { value: "Inter, system-ui, sans-serif", label: "Inter (default)" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: 'Helvetica, "Helvetica Neue", Arial, sans-serif', label: "Helvetica" },
  { value: '"Times New Roman", Times, serif', label: "Times New Roman" },
  { value: '"Courier New", Courier, monospace', label: "Courier" },
];

const SAMPLE_STORY = {
  id: "sample",
  handle: "sample",
  productTitle: "Ethiopia Yirgacheffe",
  origin: "Yirgacheffe, Ethiopia",
  maker: "Yirgacheffe Cooperative",
  process: "Washed and sun-dried for 14 days at the farm.",
  story:
    "A century of farming heritage in the Ethiopian highlands. Every bag traces back to a small cooperative of family farms.",
  heroImageUrl: null,
  heroImageAlt: null,
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const brand = await getBrand(session.shop);
  return { brand };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const data = Object.fromEntries(await request.formData());

  const payload = {
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl.trim() : "",
    accentColor:
      typeof data.accentColor === "string" ? data.accentColor : "",
    fontFamily:
      typeof data.fontFamily === "string" ? data.fontFamily : "",
  };

  await saveBrand(session.shop, {
    logoUrl: payload.logoUrl || null,
    accentColor: payload.accentColor || null,
    fontFamily: payload.fontFamily || null,
  });

  return { saved: true };
};

export default function BrandSettingsPage() {
  const { brand } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const saved = actionData?.saved === true;

  const [formState, setFormState] = useState({
    logoUrl: brand.logoUrl ?? "",
    accentColor: brand.accentColor,
    fontFamily: brand.fontFamily,
  });

  const initialRef = useRef(formState);
  const isDirty =
    JSON.stringify(formState) !== JSON.stringify(initialRef.current);

  useEffect(() => {
    if (saved) {
      initialRef.current = formState;
    }
  }, [saved, formState]);

  const submit = useSubmit();

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    submit(
      {
        logoUrl: formState.logoUrl,
        accentColor: formState.accentColor,
        fontFamily: formState.fontFamily,
      },
      { method: "post" },
    );
  }

  const saveBarRef = useRef<UISaveBarElement | null>(null);

  function handleReset() {
    setFormState(initialRef.current);
    saveBarRef.current?.hide?.();
  }

  useEffect(() => {
    const saveBar = saveBarRef.current;
    if (!saveBar) return;
    if (isDirty) saveBar.show?.();
    else saveBar.hide?.();
  }, [isDirty]);

  const previewBrand = {
    shop: brand.shop,
    logoUrl: formState.logoUrl.trim() || null,
    accentColor: formState.accentColor,
    fontFamily: formState.fontFamily,
  };

  return (
    <>
      <ui-save-bar ref={saveBarRef} id="brand-settings-form">
        <button variant="primary" onClick={handleSave}></button>
        <button onClick={handleReset}></button>
      </ui-save-bar>
      <s-page heading="Brand">
        <s-link href="/app" slot="breadcrumb-actions">
          Stories
        </s-link>

        <s-section heading="Brand settings">
          <s-stack gap="base">
            <s-text-field
              label="Logo URL"
              details="A square or horizontal logo image (PNG, JPG, or SVG)"
              name="logoUrl"
              value={formState.logoUrl}
              onInput={(e: any) =>
                setFormState({ ...formState, logoUrl: e.target.value })
              }
            ></s-text-field>

            <div>
              <label
                htmlFor="brand-accent-color"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  marginBottom: "0.25rem",
                }}
              >
                Accent color
              </label>
              <input
                id="brand-accent-color"
                type="color"
                name="accentColor"
                value={formState.accentColor}
                onChange={(e) =>
                  setFormState({ ...formState, accentColor: e.target.value })
                }
                style={{
                  width: "48px",
                  height: "32px",
                  padding: 0,
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                }}
              />
            </div>

            <s-select
              label="Font family"
              name="fontFamily"
              value={formState.fontFamily}
              onChange={(e: any) =>
                setFormState({ ...formState, fontFamily: e.target.value })
              }
            >
              {FONT_OPTIONS.map((option) => (
                <s-option
                  key={option.value}
                  value={option.value}
                  selected={formState.fontFamily === option.value}
                >
                  {option.label}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-section>

        <s-box slot="aside">
          <s-section heading="Preview">
            <s-text color="subdued">
              Sample story rendered with your current brand settings.
            </s-text>
            <div
              style={{
                border: "1px solid #e1e3e5",
                borderRadius: "8px",
                overflow: "hidden",
                marginTop: "0.5rem",
                background: "#ffffff",
              }}
            >
              <StoryRenderer story={SAMPLE_STORY} brand={previewBrand} />
            </div>
          </s-section>
        </s-box>
      </s-page>
    </>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
