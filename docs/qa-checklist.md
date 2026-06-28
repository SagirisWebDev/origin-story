# OriginStory — Pre-launch checklists

## Pre-launch milestones

- [ ] **1. App Store listing**
  - [ ] App name, tagline, full description
  - [ ] Pricing page copy (matches the in-app billing config)
  - [ ] 5 screenshots (admin Stories, admin Brand, admin Analytics, admin block on PDP, public story page on mobile)
  - [ ] App icon (1024×1024)
  - [ ] Support email + URL
  - [ ] Privacy policy URL (publicly hosted)
  - [ ] Submit for Shopify review

- [x] **2. Settle the real price** — completed 2026-06-27; landed on **$19/month** (matches direct competitor band: JourneyGlow Storyteller $19, PassoNext Pro $19, mid-band of Tracehub/Passtiq/Storyly). Deployed as `originstory-5`. Existing dev1 trial still bills at the old $1 placeholder — Shopify doesn't migrate live subscriptions to a new price.
  - [x] Decided: $19/month
  - [x] Updated `lineItems` amount in `app/shopify.server.ts`
  - [x] Updated copy in `app/routes/app.billing.tsx`
  - [x] `shopify app deploy` (originstory-5)
  - [ ] Verify trial flow on a fresh install (dev1 trial is locked to old $1 price)

- [x] **3. Final dev QA** (see checklist below) — completed 2026-06-27; install/uninstall lifecycle verified on a fresh dev store (`fresh-install-pio0ju3s.myshopify.com`), `APP_UNINSTALLED` webhook fires and cleans up `BrandSettings`, `ScanEvent`, and `Session` rows.

- [ ] **4. README + install docs** — drafted 2026-06-27; two-file split (`README.md` for devs, `docs/install.md` for merchants). Support email set to `support@sagirisdev.com`. Install URL placeholder remains — distribution is public (App Store only), so the URL won't exist until milestone 1 (App Store listing) is approved.
  - [x] What the app does (one paragraph) — in both files
  - [ ] Custom install URL for freelance clients — **blocked on milestone 1** (App Store review/approval); install.md points at apps.shopify.com with a TODO marker
  - [x] First-time setup walkthrough (Brand → create first story → test scan) — in `docs/install.md`
  - [x] Troubleshooting (admin block too tall, billing not enabled, etc.) — in `docs/install.md`

- [x] **5. GDPR / privacy** — completed 2026-06-27. Handlers shipped (`originstory-6`), privacy policy drafted at `docs/privacy-policy.md` (all placeholders resolved: Edmonton + Fly.io + Neon), and the policy is now hosted publicly at <https://www.sagirisdev.com/privacy-policy/> for the App Store listing.
  - [x] Privacy policy text that matches what the app actually stores — `docs/privacy-policy.md`; covers Session (merchant only), BrandSettings, ScanEvent. Explicit: no IP, no raw UA, no customer PII.
  - [x] GDPR webhook handlers exist and respond 200 OK — `webhooks.customers.data_request.tsx` (no-op, no customer data), `webhooks.customers.redact.tsx` (no-op), `webhooks.shop.redact.tsx` (defensive re-cleanup of BrandSettings + ScanEvent + Session). 9 new tests pass.
  - [x] Data retention statement — in `docs/privacy-policy.md`; "kept while installed, deleted on uninstall (immediate via `app/uninstalled`, safety-net pass 48h later via `shop/redact`)".
  - [x] Privacy policy hosted publicly at <https://www.sagirisdev.com/privacy-policy/> — use this URL in the App Store listing's "Privacy policy" field.

---

## Dev QA checklist — verify each slice end-to-end

### Admin app — Stories tab (slice 1, 3)

- [ ] `/app` loads and shows a list of stories (or empty state if none)
- [ ] Click "Create story" → form renders with all core fields
- [ ] Fill form + Save → returns to list, new story visible
- [ ] Click an existing story → edit form pre-populated with current values
- [ ] Edit + Save → list reflects updated values
- [ ] Delete a story → confirmation, then removed from list

### Admin app — Brand tab (slice 5, 14)

- [ ] `/app/brand` loads with current settings populated
- [ ] All 6 sections render: Identity, Colors, Typography, Shape, Layout (Pro), Advanced (Pro)
- [ ] As paid user: all 9 Pro fields are enabled, no upgrade banner shown
- [ ] Change a color → preview pane updates live
- [ ] Change a font / border radius / button style → preview updates
- [ ] Save bar appears on dirty; Save persists; Discard reverts
- [ ] Refresh page after save → values still there
- [ ] Set custom CSS → public story page reflects it (test by visiting `/story/<handle>?shop=...`)
- [ ] Set custom font URL → font loads on public story page

### Admin app — Analytics tab (slice 6, 7)

- [ ] `/app/analytics` renders chart with last 30 days of scan data
- [ ] Today's scan count matches actual scans recorded
- [ ] As paid: chart is visible
- [ ] As free: upgrade CTA shown instead of chart (test by ending the trial via `/app/billing` → cancel)

### Admin app — Billing tab (slice 12)

- [ ] `/app/billing` shows current state (paid vs unpaid)
- [ ] As paid: "You're on OriginStory Plus" + Cancel button works
- [ ] As free: "Start 14-day free trial" CTA → click → Shopify confirmation flow
- [ ] Cancel a subscription → returns to free state, Pro features re-gate

### Admin block — product detail page (slice 4, 13)

- [ ] Open any product → product-story-panel block visible in sidebar
- [ ] Fields fit without "Block too tall" warning
- [ ] "Show advanced" toggle reveals optional fields
- [ ] "Use first product image" button populates hero image GID
- [ ] Save → success indicator appears (toast or in-block banner)
- [ ] Block persists data — reload PDP → fields still populated
- [ ] As paid: custom fields editable
- [ ] As free: custom fields locked / upgrade hint

### Public story page (slice 1, 5, 8, 11, 14)

- [ ] `/story/<handle>?shop=<shop>` renders the full story
- [ ] Hero image displays when set
- [ ] Brand logo displays
- [ ] All brand styling applied (background, fonts, colors, radius)
- [ ] Custom fields render below core fields (paid)
- [ ] "Buy now →" button links to `/products/<productHandle>` (or storefront root if no handle), opens in same tab
- [ ] Custom font URL loads
- [ ] Custom CSS applies

### Scan + QR flow (slice 2, 6)

- [ ] Open a story in admin → QR code visible in admin UI
- [ ] Scan QR code with phone → opens public story page
- [ ] Each scan increments today's count on `/app/analytics`
- [ ] Hit `/story/<handle>/scan?shop=...` directly in browser → `recordScan` fires + redirect to `/story/<handle>?shop=...`

### Lifecycle — install / uninstall (slice 9, 12)

- [ ] Fresh install → defaults appear (no errors on first load of `/app` or `/app/brand`)
- [ ] Uninstall app from admin → `BrandSettings` + `ScanEvent` rows for the shop are deleted
  - Check directly: `sqlite3 prisma/dev.sqlite "SELECT * FROM BrandSettings WHERE shop=?"`
- [ ] Reinstall → starts fresh, no orphaned data leaking through

### Edge cases / error paths

- [ ] `/story/<bad-handle>?shop=...` → 404
- [ ] `/story/<handle>` (missing shop param) → 400
- [ ] Public page when `getStory` returns `null` → 404
- [ ] Billing page when distribution is not public → friendly banner (mostly historical now since the app is registered, but the error path is still in the code)

### Demo data (slice 10)

- [ ] Run the Common Roast demo migration script and confirm:
  - [ ] All demo products + stories created
  - [ ] Brand settings populated with the demo look
  - [ ] Public story pages render correctly for demo handles
