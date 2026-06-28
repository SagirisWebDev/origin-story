# OriginStory — Privacy Policy

**Last updated:** 2026-06-27

OriginStory ("we", "our", "the app") is a Shopify app published by **Sagiris Web Development** that lets merchants attach scannable QR codes to physical product packaging. Each scan opens a hosted product story page showing origin, maker, process, and brand story.

This privacy policy describes what data the app collects, why, how long we keep it, and the rights merchants and their customers have.

---

## What data the app collects

### From merchants (Shopify store owners and staff)

When a merchant installs the app, Shopify provides us with an **OAuth session** that includes:

- Shop domain (e.g. `your-store.myshopify.com`)
- Shop ID
- Access token (used to read and write product stories on the merchant's behalf)
- Granted scopes (currently: `write_products`, `write_metaobjects`, `write_metaobject_definitions`)
- Limited user metadata returned by Shopify's OAuth flow (user ID, name, email, locale, account-owner / collaborator status) — used only to identify the active session

We additionally store, per shop:

- **Brand styling settings** — logo URL, colors, fonts, spacing, custom CSS, custom font URL. These are merchant-authored values, not personal data.
- **Product story content** — origin, maker, process, story text, hero images, and (on the Plus plan) custom fields. This is product information authored by the merchant. It is stored in Shopify as `product_story` metaobjects on the merchant's own store, not in our database.

### From customers (shoppers who scan a QR code)

When a shopper scans an OriginStory QR code, we record an **anonymous scan event** containing:

- The story handle being viewed (a product identifier, not a person)
- The shop domain
- A timestamp
- A coarse user-agent category: one of `mobile`, `tablet`, `desktop`, `bot`, or `unknown`

We **do not** collect or store:

- IP addresses
- Raw user-agent strings
- Cookies or persistent identifiers
- Customer names, emails, or any contact information
- Geographic location data
- Cross-site tracking data of any kind

Because nothing in the scan event can be tied back to an individual, no scan data constitutes personal data under GDPR / CCPA.

---

## How we use the data

| Data | Purpose |
|---|---|
| OAuth session | Authenticate the merchant on each request to Shopify on their behalf |
| Brand styling | Render the merchant's hosted story pages with their brand |
| Product story content | Display the story when a shopper scans the QR code |
| Anonymous scan events | Aggregate "scans per day" analytics shown only to the merchant on the Plus plan |

We do **not** sell, share, or transfer any data to third parties for marketing or advertising purposes.

---

## Data retention

| Data | Retention |
|---|---|
| OAuth session | Kept while the app is installed. Deleted immediately when the merchant uninstalls (via the `app/uninstalled` webhook). |
| Brand styling | Kept while the app is installed. Deleted on uninstall. |
| Product story content | Stored in Shopify as metaobjects on the merchant's store — controlled by the merchant; deletion is governed by Shopify's own data lifecycle. |
| Anonymous scan events | Kept while the app is installed. Deleted on uninstall. |

On uninstall, all data we hold for the shop is deleted within seconds via the `app/uninstalled` webhook. A second cleanup pass runs 48 hours later via the `shop/redact` webhook (Shopify's GDPR compliance flow) as a safety net.

---

## GDPR mandatory webhooks

OriginStory implements the three GDPR-mandatory webhooks Shopify requires for App Store listing:

- **`customers/data_request`** — fires when a customer exercises their data-subject access right. Because we do not store customer personal data, our handler logs the request and returns 200 OK with no data to provide.
- **`customers/redact`** — fires 48 hours after a merchant requests deletion of a customer's data. Because we do not store customer personal data, our handler logs the request and returns 200 OK with nothing to delete.
- **`shop/redact`** — fires 48 hours after the merchant uninstalls. Our handler deletes any remaining `BrandSettings`, `ScanEvent`, and `Session` rows for the shop (idempotent — the `app/uninstalled` cleanup already ran).

---

## Sub-processors

We rely on the following third-party services to operate the app:

- **Shopify, Inc.** — hosts the merchant's store, provides the OAuth flow, hosts product story metaobjects, and brokers all customer requests through the app. Governed by [Shopify's Privacy Policy](https://www.shopify.com/legal/privacy).
- **Fly.io** — runs the OriginStory application server in production at [originstory.fly.dev](https://originstory.fly.dev). Governed by [Fly.io's Privacy Policy](https://fly.io/legal/privacy-policy).
- **Neon** — hosts the Postgres database that stores Session, BrandSettings, and ScanEvent records. Governed by [Neon's Privacy Policy](https://neon.com/privacy-policy).

We do not use any analytics, advertising, or tracking SDKs.

---

## Your rights

### Merchants
- You can uninstall the app at any time from your Shopify admin. All data we hold for your shop is deleted immediately on uninstall.
- You can request export of any data we hold for your shop by emailing the address below.

### Customers (shoppers)
- Since we do not collect personal data when you scan a QR code, there is nothing to access, correct, or delete on a per-customer basis.
- If you believe you have personal data with us (e.g. you contacted support and shared an email), email the address below.

---

## Contact

Privacy questions, data requests, or concerns: **support@sagirisdev.com**

Sagiris Web Development<br>
Edmonton, Canada

---

## Changes to this policy

When we update this policy, we'll change the **Last updated** date at the top. Material changes will be highlighted in our App Store listing or via in-app notice.
