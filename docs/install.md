# Install OriginStory

Give every product a scannable story. OriginStory lets you attach a QR code to physical packaging — when a shopper scans, they land on a hosted page that shows where the product comes from, who made it, how it was made, and the bigger brand story.

It takes about **5 minutes** to install and create your first story.

---

## 1. Install

<!-- TODO: replace with the Shopify App Store listing URL once Shopify approves the submission -->

Find OriginStory in the [Shopify App Store](https://apps.shopify.com/) (listing URL coming soon) and click **Add app**. After approving the install on your store, you'll land on the **Stories** tab inside Shopify admin.

---

## 2. Set up your brand

Click the **Brand** tab in the app's left sidebar. This is where you control how every story page looks — colors, fonts, logo, button style. Changes preview live on the right.

**Quick start (recommended):**

1. **Logo URL** — paste a link to your logo (PNG / JPG / SVG, ideally with a transparent background)
2. **Accent color** — your brand's primary color (used on labels and buttons)
3. **Background + text color** — defaults are white + dark gray; change if your brand calls for something different
4. **Heading font + body font** — pick from six built-in font presets

Click **Save** (top bar) when you like the preview.

> **Advanced styling** (link color, border color, font weights, page width, custom CSS, Google Fonts URL, etc.) is unlocked with **OriginStory Plus** — see step 6.

---

## 3. Create your first story

1. In Shopify admin, open **Products** and click any product
2. Scroll down to the **OriginStory** block in the right column (it's pinned by default after install)
3. Fill in the four core fields:
   - **Origin** — where the product was made (e.g. "Yirgacheffe, Ethiopia")
   - **Maker** — who made it (e.g. "Yirgacheffe Cooperative")
   - **Process** — how it was made (a few sentences)
   - **Story** — the bigger context behind this product (a paragraph or two)
4. Optionally, click **Use first product image** to set a hero image, or paste a hero image GID directly
5. Click **Create story**

The block will display a QR code as soon as the story is saved. Click **Download QR** to grab the PNG.

---

## 4. Test the scan

Open the downloaded QR PNG on your computer screen and scan it with your phone camera. Your phone should open a page showing the story you just created, styled with your brand.

If you'd rather test without a phone, click the **Full editor** link in the block and copy the public story URL from the next page.

---

## 5. Put the QR code on packaging

Print the downloaded PNG anywhere customers will see it after they buy:

- Inside the box, on a thank-you card or insert
- On a sticker on the product itself
- On the outside of retail packaging
- On a hangtag for apparel

Each scan is tracked — see the **Analytics** tab to view the last 30 days of scan counts per product (requires OriginStory Plus).

---

## 6. Upgrade to OriginStory Plus

Click the **Billing** tab to start your **14-day free trial** of OriginStory Plus ($19/month after the trial). Plus unlocks:

- **Custom fields** on stories — add things like "Altitude", "Roast date", "Materials", or any extra context you want shoppers to see
- **Scan analytics** — 30-day chart of how often each product's QR is being scanned
- **Advanced brand styling** — link color, border color, font weights, type scale, page width, section spacing, **custom font URL** (Google Fonts or your own CDN), and **custom CSS** for full design control

You can cancel from the same Billing tab any time during or after the trial. Stories and brand settings remain intact if you downgrade — only the Plus features become read-only.

---

## Common issues

### The OriginStory block isn't visible on a product page
Open the product, click **Add block** (or the **+** icon in the right sidebar), search for "OriginStory" and pin it. It'll then appear on every product page automatically.

### "Block too tall" warning at the top of the OriginStory block
Shopify shows this warning when a block exceeds their default height — it's expected for OriginStory once you've added a hero image and custom fields. Click Shopify's native **Show more** at the bottom of the block to expand it. The block works the same whether expanded or not.

### "Billing not yet enabled" when starting a trial
This means the app isn't yet set to public distribution in Shopify Partners. If you're using a beta install link from the developer, ask them to confirm distribution is enabled. (If you're using the App Store listing, this error shouldn't happen.)

### Scans aren't appearing in Analytics
- Confirm you've started the 14-day trial in **Billing** — analytics is Plus-only
- A scan is recorded when the QR is scanned (or the `/story/<handle>/scan?shop=<your-shop>` URL is visited) — visiting the story page directly without going through the scan URL won't be counted
- It may take a moment for the chart to refresh; reload the Analytics page

### I edited brand styling but the public story still shows the old look
The public story page is server-rendered each request, so changes take effect immediately on save. If you're not seeing them:
- Hard refresh the page (Cmd+Shift+R / Ctrl+Shift+R) to bypass the browser cache
- Check that you clicked **Save** in the Brand tab top bar — the live preview updates instantly but only persists once saved

---

## Need help?

Email **support@sagirisdev.com** or open a support ticket via the app listing.
