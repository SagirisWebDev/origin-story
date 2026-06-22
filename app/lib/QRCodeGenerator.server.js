import qrcode from "qrcode";

function buildScanUrl(handle, shop) {
  const baseUrl = (process.env.SHOPIFY_APP_URL ?? "").replace(/\/$/, "");
  return `${baseUrl}/story/${handle}/scan?shop=${shop}`;
}

export async function generate(handle, shop, { format } = {}) {
  const url = buildScanUrl(handle, shop);

  if (format === "png") {
    return qrcode.toDataURL(url);
  }

  if (format === "svg") {
    return qrcode.toString(url, { type: "svg" });
  }

  throw new Error(
    `QRCodeGenerator.generate: unsupported format "${format}". Use "png" or "svg".`,
  );
}
