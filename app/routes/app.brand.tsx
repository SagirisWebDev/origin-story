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
import { getFeatureFlags } from "../lib/featureFlags.server.js";
import { StoryRenderer } from "../lib/StoryRenderer";

const FONT_OPTIONS = [
  { value: "Inter, system-ui, sans-serif", label: "Inter (default)" },
  { value: "Georgia, serif", label: "Georgia" },
  { value: 'Helvetica, "Helvetica Neue", Arial, sans-serif', label: "Helvetica" },
  { value: '"Times New Roman", Times, serif', label: "Times New Roman" },
  { value: '"Courier New", Courier, monospace', label: "Courier" },
  { value: '"Playfair Display", Georgia, serif', label: "Playfair Display" },
];

const RADIUS_OPTIONS = [
  { value: "none", label: "None (sharp corners)" },
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium (default)" },
  { value: "large", label: "Large" },
];

const BUTTON_STYLE_OPTIONS = [
  { value: "solid", label: "Solid (default)" },
  { value: "outline", label: "Outline" },
];

const WEIGHT_OPTIONS = [
  { value: "400", label: "Regular (400)" },
  { value: "500", label: "Medium (500)" },
  { value: "600", label: "Semi-bold (600)" },
  { value: "700", label: "Bold (700)" },
];

const TYPE_SCALE_OPTIONS = [
  { value: "small", label: "Small" },
  { value: "medium", label: "Medium (default)" },
  { value: "large", label: "Large" },
];

const PAGE_WIDTH_OPTIONS = [
  { value: "560px", label: "Narrow (560px)" },
  { value: "640px", label: "Default (640px)" },
  { value: "800px", label: "Wide (800px)" },
  { value: "1024px", label: "Extra wide (1024px)" },
];

const SECTION_SPACING_OPTIONS = [
  { value: "compact", label: "Compact" },
  { value: "comfortable", label: "Comfortable (default)" },
  { value: "spacious", label: "Spacious" },
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

// Form field keys — must mirror BrandSettings model + getBrand keys.
const FIELD_KEYS = [
  "logoUrl",
  "accentColor",
  "fontFamily",
  "backgroundColor",
  "textColor",
  "headingColor",
  "buttonBgColor",
  "buttonTextColor",
  "headingFontFamily",
  "borderRadiusScale",
  "buttonStyle",
  "linkColor",
  "borderColor",
  "headingFontWeight",
  "bodyFontWeight",
  "typeScale",
  "pageMaxWidth",
  "sectionSpacing",
  "customFontUrl",
  "customCss",
] as const;

type FieldKey = (typeof FIELD_KEYS)[number];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const [brand, flags] = await Promise.all([
    getBrand(session.shop),
    getFeatureFlags(billing),
  ]);
  return { brand, flags };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const flags = await getFeatureFlags(billing);
  const data = Object.fromEntries(await request.formData());

  // Free fields always accepted; Pro fields ignored when !flags.paid so an
  // unprivileged client can't smuggle Pro values past the UI gate.
  const FREE_KEYS: FieldKey[] = [
    "logoUrl",
    "accentColor",
    "fontFamily",
    "backgroundColor",
    "textColor",
    "headingColor",
    "buttonBgColor",
    "buttonTextColor",
    "headingFontFamily",
    "borderRadiusScale",
    "buttonStyle",
  ];
  const PRO_KEYS: FieldKey[] = [
    "linkColor",
    "borderColor",
    "headingFontWeight",
    "bodyFontWeight",
    "typeScale",
    "pageMaxWidth",
    "sectionSpacing",
    "customFontUrl",
    "customCss",
  ];

  const payload: Record<string, string | null> = {};

  function pick(key: FieldKey) {
    const raw = data[key];
    return typeof raw === "string" ? raw.trim() : "";
  }

  for (const key of FREE_KEYS) {
    const v = pick(key);
    payload[key] = v || null;
  }
  if (flags.paid) {
    for (const key of PRO_KEYS) {
      const v = pick(key);
      payload[key] = v || null;
    }
  }

  await saveBrand(session.shop, payload);

  return { saved: true };
};

type FormState = Record<FieldKey, string>;

function ColorInput({
  id,
  label,
  value,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        style={{
          display: "block",
          fontSize: "0.85rem",
          marginBottom: "0.25rem",
          color: disabled ? "#888" : undefined,
        }}
      >
        {label}
      </label>
      <input
        id={id}
        type="color"
        value={value || "#000000"}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: "48px",
          height: "32px",
          padding: 0,
          border: "1px solid #ccc",
          borderRadius: "4px",
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
    </div>
  );
}

function ProBanner() {
  return (
    <s-banner tone="info" heading="Pro features">
      <s-paragraph>
        These options unlock with OriginStory Plus. Visit{" "}
        <s-link href="/app/billing">Billing</s-link> to start a 14-day free
        trial.
      </s-paragraph>
    </s-banner>
  );
}

export default function BrandSettingsPage() {
  const { brand, flags } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const saved = actionData?.saved === true;
  const paid = flags.paid === true;

  const initialState = FIELD_KEYS.reduce((acc, key) => {
    acc[key] = (brand as Record<string, unknown>)[key]?.toString() ?? "";
    return acc;
  }, {} as FormState);

  const [formState, setFormState] = useState<FormState>(initialState);

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
    submit(formState as Record<string, string>, { method: "post" });
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

  function update<K extends FieldKey>(key: K, value: string) {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  const previewBrand = {
    shop: brand.shop,
    ...formState,
    logoUrl: formState.logoUrl.trim() || null,
    customFontUrl: formState.customFontUrl.trim() || null,
    customCss: formState.customCss.trim() || null,
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

        {/* IDENTITY ------------------------------------------------------- */}
        <s-section heading="Identity">
          <s-stack gap="base">
            <s-text-field
              label="Logo URL"
              details="A square or horizontal logo image (PNG, JPG, or SVG)"
              name="logoUrl"
              value={formState.logoUrl}
              onInput={(e: any) => update("logoUrl", e.target.value)}
            ></s-text-field>
          </s-stack>
        </s-section>

        {/* COLORS --------------------------------------------------------- */}
        <s-section heading="Colors">
          <s-stack gap="base">
            <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
              <ColorInput
                id="brand-accent-color"
                label="Accent"
                value={formState.accentColor}
                onChange={(v) => update("accentColor", v)}
              />
              <ColorInput
                id="brand-bg-color"
                label="Background"
                value={formState.backgroundColor}
                onChange={(v) => update("backgroundColor", v)}
              />
              <ColorInput
                id="brand-text-color"
                label="Text"
                value={formState.textColor}
                onChange={(v) => update("textColor", v)}
              />
              <ColorInput
                id="brand-heading-color"
                label="Heading"
                value={formState.headingColor}
                onChange={(v) => update("headingColor", v)}
              />
              <ColorInput
                id="brand-btn-bg-color"
                label="Button background"
                value={formState.buttonBgColor}
                onChange={(v) => update("buttonBgColor", v)}
              />
              <ColorInput
                id="brand-btn-text-color"
                label="Button text"
                value={formState.buttonTextColor}
                onChange={(v) => update("buttonTextColor", v)}
              />
            </s-grid>

            {!paid ? <ProBanner /> : null}

            <s-grid gridTemplateColumns="repeat(3, 1fr)" gap="base">
              <ColorInput
                id="brand-link-color"
                label="Link (Pro)"
                value={formState.linkColor}
                onChange={(v) => update("linkColor", v)}
                disabled={!paid}
              />
              <ColorInput
                id="brand-border-color"
                label="Border (Pro)"
                value={formState.borderColor}
                onChange={(v) => update("borderColor", v)}
                disabled={!paid}
              />
            </s-grid>
          </s-stack>
        </s-section>

        {/* TYPOGRAPHY ----------------------------------------------------- */}
        <s-section heading="Typography">
          <s-stack gap="base">
            <s-select
              label="Heading font"
              name="headingFontFamily"
              value={formState.headingFontFamily}
              onChange={(e: any) =>
                update("headingFontFamily", e.target.value)
              }
            >
              {FONT_OPTIONS.map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.headingFontFamily === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>

            <s-select
              label="Body font"
              name="fontFamily"
              value={formState.fontFamily}
              onChange={(e: any) => update("fontFamily", e.target.value)}
            >
              {FONT_OPTIONS.map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.fontFamily === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>

            {!paid ? <ProBanner /> : null}

            <s-select
              label="Heading weight (Pro)"
              name="headingFontWeight"
              value={formState.headingFontWeight}
              disabled={!paid}
              onChange={(e: any) =>
                update("headingFontWeight", e.target.value)
              }
            >
              {WEIGHT_OPTIONS.map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.headingFontWeight === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>

            <s-select
              label="Body weight (Pro)"
              name="bodyFontWeight"
              value={formState.bodyFontWeight}
              disabled={!paid}
              onChange={(e: any) => update("bodyFontWeight", e.target.value)}
            >
              {WEIGHT_OPTIONS.filter((o) => o.value !== "700").map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.bodyFontWeight === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>

            <s-select
              label="Type scale (Pro)"
              name="typeScale"
              value={formState.typeScale}
              disabled={!paid}
              onChange={(e: any) => update("typeScale", e.target.value)}
            >
              {TYPE_SCALE_OPTIONS.map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.typeScale === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-section>

        {/* SHAPE + COMPONENTS -------------------------------------------- */}
        <s-section heading="Shape & components">
          <s-stack gap="base">
            <s-select
              label="Border radius"
              name="borderRadiusScale"
              value={formState.borderRadiusScale}
              onChange={(e: any) =>
                update("borderRadiusScale", e.target.value)
              }
            >
              {RADIUS_OPTIONS.map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.borderRadiusScale === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>

            <s-select
              label="Button style"
              name="buttonStyle"
              value={formState.buttonStyle}
              onChange={(e: any) => update("buttonStyle", e.target.value)}
            >
              {BUTTON_STYLE_OPTIONS.map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.buttonStyle === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-section>

        {/* LAYOUT (Pro) -------------------------------------------------- */}
        <s-section heading="Layout (Pro)">
          <s-stack gap="base">
            {!paid ? <ProBanner /> : null}
            <s-select
              label="Page width"
              name="pageMaxWidth"
              value={formState.pageMaxWidth}
              disabled={!paid}
              onChange={(e: any) => update("pageMaxWidth", e.target.value)}
            >
              {PAGE_WIDTH_OPTIONS.map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.pageMaxWidth === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>

            <s-select
              label="Section spacing"
              name="sectionSpacing"
              value={formState.sectionSpacing}
              disabled={!paid}
              onChange={(e: any) => update("sectionSpacing", e.target.value)}
            >
              {SECTION_SPACING_OPTIONS.map((o) => (
                <s-option
                  key={o.value}
                  value={o.value}
                  selected={formState.sectionSpacing === o.value}
                >
                  {o.label}
                </s-option>
              ))}
            </s-select>
          </s-stack>
        </s-section>

        {/* ADVANCED (Pro) ----------------------------------------------- */}
        <s-section heading="Advanced (Pro)">
          <s-stack gap="base">
            {!paid ? <ProBanner /> : null}
            <s-text-field
              label="Custom font URL"
              details="A Google Fonts or CDN URL — applied site-wide for hosted stories"
              name="customFontUrl"
              value={formState.customFontUrl}
              disabled={!paid}
              onInput={(e: any) => update("customFontUrl", e.target.value)}
            ></s-text-field>

            <div>
              <label
                htmlFor="brand-custom-css"
                style={{
                  display: "block",
                  fontSize: "0.85rem",
                  marginBottom: "0.25rem",
                  color: !paid ? "#888" : undefined,
                }}
              >
                Custom CSS
              </label>
              <textarea
                id="brand-custom-css"
                name="customCss"
                value={formState.customCss}
                disabled={!paid}
                onChange={(e) => update("customCss", e.target.value)}
                rows={6}
                placeholder="/* Injected into the public story page */"
                style={{
                  width: "100%",
                  fontFamily: "monospace",
                  fontSize: "0.85rem",
                  padding: "0.5rem",
                  border: "1px solid #ccc",
                  borderRadius: "4px",
                  opacity: !paid ? 0.5 : 1,
                }}
              />
            </div>
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
                background: previewBrand.backgroundColor || "#ffffff",
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
