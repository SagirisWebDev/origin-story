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
  const [form, setForm] = useState({
    origin: "",
    maker: "",
    process: "",
    story: "",
    heroImageId: null,
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
        if (data.story) {
          setForm({
            origin: data.story.origin ?? "",
            maker: data.story.maker ?? "",
            process: data.story.process ?? "",
            story: data.story.story ?? "",
            heroImageId: data.story.heroImageId ?? null,
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
      const res = await fetch(`/api/product-story/${encodedProductId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          productTitle,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        const msg = data.errors
          ? Object.values(data.errors).join("; ")
          : `Save failed: ${res.status}`;
        throw new Error(msg);
      }

      setStoryHandle(data.story.handle);
      shopify.toast?.show?.("Story saved");

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
      <s-stack direction="block" gap="small">
        {error ? <s-text tone="critical">{error}</s-text> : null}

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
        <s-text-area
          label="Process"
          rows="2"
          value={form.process}
          onInput={(e) => setForm({ ...form, process: e.target.value })}
        />
        <s-text-area
          label="Story"
          rows="3"
          value={form.story}
          onInput={(e) => setForm({ ...form, story: e.target.value })}
        />
        <s-text-field
          label="Hero image GID"
          value={form.heroImageId ?? ""}
          onInput={(e) =>
            setForm({ ...form, heroImageId: e.target.value || null })
          }
        />

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
