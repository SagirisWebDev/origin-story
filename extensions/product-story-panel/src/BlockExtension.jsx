import "@shopify/ui-extensions/preact";
import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

export default async () => {
  render(<Extension />, document.body);
};

function Extension() {
  const productId = shopify.data?.selected?.[0]?.id;
  const encodedProductId = productId ? encodeURIComponent(productId) : null;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [productTitle, setProductTitle] = useState("");
  const [qrPng, setQrPng] = useState(null);
  const [storyHandle, setStoryHandle] = useState(null);
  const [paid, setPaid] = useState(false);
  const [firstMediaGid, setFirstMediaGid] = useState(null);
  const [successFlash, setSuccessFlash] = useState(false);
  // Optional fields (hero image GID, custom fields) live behind a toggle to
  // keep the block under Shopify's "Block too tall" threshold. We never
  // auto-open it: even when there are saved values, auto-opening would push
  // the block over the height limit on every revisit.
  const [showMore, setShowMore] = useState(false);
  const [form, setForm] = useState({
    origin: "",
    maker: "",
    process: "",
    story: "",
    heroImageId: null,
    customFields: [],
  });

  useEffect(() => {
    if (!encodedProductId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/product-story/${encodedProductId}`);
        if (!res.ok) throw new Error(`Load failed: ${res.status}`);
        const data = await res.json();
        if (cancelled) return;

        setProductTitle(data.productTitle ?? "");
        setQrPng(data.qrPng ?? null);
        setStoryHandle(data.story?.handle ?? null);
        setPaid(Boolean(data.flags?.paid));
        setFirstMediaGid(data.firstMediaGid ?? null);
        if (data.story) {
          setForm({
            origin: data.story.origin ?? "",
            maker: data.story.maker ?? "",
            process: data.story.process ?? "",
            story: data.story.story ?? "",
            heroImageId: data.story.heroImageId ?? null,
            customFields: data.story.customFields ?? [],
          });
        }
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [encodedProductId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // On the free tier, don't send customFields — the model treats absent as
      // "leave existing alone" rather than clearing.
      const { customFields: _maybe, ...rest } = form;
      const body = paid
        ? { ...rest, customFields: form.customFields ?? [], productTitle }
        : { ...rest, productTitle };
      const res = await fetch(`/api/product-story/${encodedProductId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.errors
          ? Object.values(data.errors).join("; ")
          : `Save failed: ${res.status}`;
        throw new Error(msg);
      }

      setStoryHandle(data.story.handle);

      // Toast API surface differs across admin extension targets — call it
      // defensively and also flash an in-block success banner so the
      // merchant always gets feedback even when toast isn't wired up.
      try {
        shopify?.toast?.show?.("Story saved", { duration: 3000 });
      } catch {}
      setSuccessFlash(true);
      setTimeout(() => setSuccessFlash(false), 3000);

      // Reload to refresh qrPng (now that we have a handle).
      const reload = await fetch(`/api/product-story/${encodedProductId}`);
      if (reload.ok) {
        const fresh = await reload.json();
        setQrPng(fresh.qrPng ?? null);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  if (!productId) {
    return (
      <s-admin-block heading="OriginStory">
        <s-text>No product selected.</s-text>
      </s-admin-block>
    );
  }

  if (loading) {
    return (
      <s-admin-block heading="OriginStory">
        <s-text>Loading…</s-text>
      </s-admin-block>
    );
  }

  return (
    <s-admin-block heading="OriginStory">
      <s-stack direction="block" gap="small-200">
        {error ? <s-text tone="critical">{error}</s-text> : null}
        {successFlash ? (
          <s-text tone="success">✓ Story saved</s-text>
        ) : null}

        <s-grid gridTemplateColumns="1fr 1fr" gap="small-200">
          <s-text-field
            label="Origin"
            value={form.origin}
            onInput={(e) => setForm({ ...form, origin: e.target.value })}
          />
          <s-text-field
            label="Maker"
            value={form.maker}
            onInput={(e) => setForm({ ...form, maker: e.target.value })}
          />
          <s-text-field
            label="Process"
            value={form.process}
            onInput={(e) => setForm({ ...form, process: e.target.value })}
          />
          <s-text-field
            label="Story"
            value={form.story}
            onInput={(e) => setForm({ ...form, story: e.target.value })}
          />
        </s-grid>

        <s-clickable onClick={() => setShowMore((v) => !v)}>
          <s-text type="strong">
            {showMore
              ? "Hide advanced ▴"
              : `Show advanced ▾${
                  form.heroImageId || (form.customFields ?? []).length > 0
                    ? " (has saved data)"
                    : ""
                }`}
          </s-text>
        </s-clickable>

        {showMore ? (
          <s-stack direction="block" gap="small-200">
            {form.heroImageId ? (
              <s-stack direction="inline" gap="small-200" alignItems="center">
                <s-text>✓ Hero image set</s-text>
                <s-clickable
                  onClick={() => setForm({ ...form, heroImageId: null })}
                >
                  <s-text type="strong">Remove</s-text>
                </s-clickable>
              </s-stack>
            ) : (
              <s-stack direction="inline" gap="small-200" alignItems="end">
                <s-text-field
                  label="Hero image GID"
                  value=""
                  onInput={(e) =>
                    setForm({ ...form, heroImageId: e.target.value || null })
                  }
                />
                {firstMediaGid ? (
                  <s-button
                    variant="tertiary"
                    onClick={() => setForm({ ...form, heroImageId: firstMediaGid })}
                  >
                    Use first product image
                  </s-button>
                ) : null}
              </s-stack>
            )}

            {paid ? (
              <s-stack direction="block" gap="small-200">
                {(form.customFields ?? []).map((field, i) => (
                  <s-grid
                    key={i}
                    gridTemplateColumns="1fr 1fr auto"
                    gap="small-200"
                    alignItems="end"
                  >
                    <s-text-field
                      label="Label"
                      value={field.label}
                      onInput={(e) => {
                        const next = [...form.customFields];
                        next[i] = { ...next[i], label: e.target.value };
                        setForm({ ...form, customFields: next });
                      }}
                    />
                    <s-text-field
                      label="Value"
                      value={field.value}
                      onInput={(e) => {
                        const next = [...form.customFields];
                        next[i] = { ...next[i], value: e.target.value };
                        setForm({ ...form, customFields: next });
                      }}
                    />
                    <s-button
                      variant="tertiary"
                      onClick={() => {
                        const next = [...form.customFields];
                        next.splice(i, 1);
                        setForm({ ...form, customFields: next });
                      }}
                    >
                      Remove
                    </s-button>
                  </s-grid>
                ))}
                <s-button
                  onClick={() =>
                    setForm({
                      ...form,
                      customFields: [
                        ...(form.customFields ?? []),
                        { label: "", value: "" },
                      ],
                    })
                  }
                >
                  Add field
                </s-button>
              </s-stack>
            ) : (
              <s-stack direction="block" gap="small">
                <s-text type="strong">Custom fields</s-text>
                <s-text color="subdued">
                  Upgrade to add extras like "Altitude" or "Key Ingredients".
                </s-text>
                <s-link
                  href={`shopify://admin/apps/dev-app1-7/app/billing`}
                >
                  Upgrade
                </s-link>
              </s-stack>
            )}
          </s-stack>
        ) : null}

        <s-stack direction="inline" gap="base" alignItems="center">
          <s-button
            variant="primary"
            disabled={saving}
            onClick={handleSave}
          >
            {saving ? "Saving…" : storyHandle ? "Update" : "Create story"}
          </s-button>
          {qrPng ? (
            <s-button
              href={qrPng}
              download={`origin-story-${storyHandle ?? "qr"}.png`}
            >
              Download QR
            </s-button>
          ) : null}
          {storyHandle ? (
            <s-link href={`shopify://admin/apps/dev-app1-7/app/stories/${storyHandle}`}>
              Full editor
            </s-link>
          ) : null}
        </s-stack>
      </s-stack>
    </s-admin-block>
  );
}
