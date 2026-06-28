# OriginStory

Shopify app that lets DTC brands attach a QR code to physical product packaging. Shoppers scan and land on a hosted product story page showing **origin, maker, process, and brand story** — built to give small-batch and craft brands a low-friction way to tell the story behind every product.

---

## For merchants

If you're a Shopify merchant looking to install or use OriginStory, see **[docs/install.md](docs/install.md)** — install link, first-time setup walkthrough, and troubleshooting.

---

## For developers

### What's in the box

- Admin app (React Router 7 + Polaris web components) — Stories, Analytics, Brand, Billing tabs at `/app/*`
- Admin block extension (Preact + `@shopify/ui-extensions/preact`) — product-story-panel rendered inside the product detail page
- Public story page at `/story/:handle?shop=<shop>` — server-rendered HTML, fully brand-styled
- Scan tracking + redirect at `/story/:handle/scan?shop=<shop>` — writes a `ScanEvent` row then 302s to the public story page
- Prisma + SQLite for `Session`, `BrandSettings`, `ScanEvent`; product stories live in Shopify as `$app:product_story` metaobjects

### Prerequisites

- Shopify CLI 3.x (`shopify version`)
- Node.js 20.19+ (`engines` in `package.json`)
- A Shopify Partners account with the OriginStory app registered

### Local development

```shell
npm install
npm run dev -- --store=<your-dev-store>.myshopify.com
```

The first run will prompt for OAuth approval on the chosen dev store. A Cloudflare tunnel URL is generated each session — Shopify Partners is auto-updated to point at it. Press `P` in the dev console to open the embedded app.

### Tests + typecheck

```shell
npm test         # Vitest, 194 tests
npm run typecheck   # React Router typegen + tsc --noEmit
```

### Deploy

```shell
npm run deploy
# Or non-interactively:
npx shopify app deploy --force --allow-updates
```

Deploy pushes `shopify.app.toml` config (webhooks, scopes, billing plan) and the extension bundles to Shopify. Server-side code (routes, models) is served from your hosting environment — see **Hosting** below.

### Project structure

```
app/
  routes/
    app._index.tsx              Stories list
    app.analytics.tsx           30-day scan chart (paid)
    app.brand.tsx               17-field brand styling editor
    app.billing.tsx             Subscribe / cancel
    app.stories.$id.jsx         Edit a single story
    api.product-story.$productId.tsx   Block extension's REST endpoint
    story.$handle.tsx           Public story page
    story.$handle.scan.tsx      Scan tracker + redirect
    webhooks.app.uninstalled.tsx       Wipes BrandSettings/ScanEvent/Session
    webhooks.app.scopes_update.tsx
    webhooks.app.subscriptions_update.tsx
  models/
    BrandSettings.server.js     20 fields, all defaulted (3 original + 17 styling)
    ProductStory.server.js      Metaobject CRUD
    ScanTracker.server.js       recordScan + scansPerDay + countScansByHandles
  lib/
    StoryRenderer.tsx           Server-rendered public story HTML
    featureFlags.server.js      billing.check → { paid }
    billing-plan.js             PLUS_PLAN constant
extensions/
  product-story-panel/          Admin block on product detail page
prisma/
  schema.prisma                 Session, BrandSettings, ScanEvent
docs/
  install.md                    Merchant-facing install + usage guide
  qa-checklist.md               Pre-launch milestones + per-slice QA checklist
```

### Hosting

Live at **[originstory.fly.dev](https://originstory.fly.dev)** — deployed to [Fly.io](https://fly.io) in the `ord` (Chicago) region. Postgres is hosted on **[Neon](https://neon.tech)** (free tier, `us-east-2` Ohio); connection wired via the `DATABASE_URL` + `DIRECT_URL` Fly secrets and the [Prisma session storage adapter](https://github.com/Shopify/shopify-api-js/blob/main/packages/shopify-api/docs/guides/session-storage.md). Deploy with `fly deploy --remote-only`; the release command runs `npx prisma migrate deploy` against Neon before each rollout. Auto-stop is on by default — machines sleep when idle (~2s cold start). The legacy `prisma/dev.sqlite` is unused; both dev and prod talk to Neon Postgres.

### Domain model

- **`ProductStory`** — a Shopify metaobject (`$app:product_story`) per product, with `origin`, `maker`, `process`, `story`, `hero_image`, and (paid) `custom_fields` JSON
- **`BrandSettings`** — one Prisma row per shop, holds 17 styling fields (8 free + 9 Pro) plus logo/accent/font. Read by `StoryRenderer` and the admin Brand tab preview
- **`ScanEvent`** — one Prisma row per QR scan, keyed by `(storyHandle, timestamp)` and `(shop, timestamp)`. Source for the analytics chart
- **`Session`** — Shopify OAuth session, managed by `@shopify/shopify-app-session-storage-prisma`

### Pricing model

`OriginStory Plus` is a single $19/mo recurring plan with a 14-day free trial, configured in `app/shopify.server.ts`. Pro-only features (custom fields, analytics, advanced brand styling, custom CSS/fonts) are gated via `flags.paid` derived from `billing.check`.

### Webhooks

Subscribed in `shopify.app.toml`:

- `app/uninstalled` — wipes `BrandSettings`, `ScanEvent`, `Session` rows for the shop (`app/routes/webhooks.app.uninstalled.tsx`)
- `app/scopes_update`
- `app_subscriptions/update` — currently logs only; could be extended to react to plan changes

GDPR webhooks (`customers/redact`, `customers/data_request`, `shop/redact`) are not yet wired — required before App Store submission.

### Contributing

This project follows a TDD workflow — each user-visible behavior change should land with a failing test first, then implementation, then refactor. See `docs/qa-checklist.md` for the per-slice manual QA checklist used before each release.

### Resources

- [React Router](https://reactrouter.com/)
- [Shopify App React Router](https://shopify.dev/docs/api/shopify-app-react-router)
- [Shopify CLI](https://shopify.dev/docs/apps/tools/cli)
- [Polaris Web Components](https://shopify.dev/docs/api/app-home/polaris-web-components)
- [Admin UI extensions (Preact)](https://shopify.dev/docs/api/admin-extensions)
- [Shopify Billing API](https://shopify.dev/docs/apps/launch/billing)
