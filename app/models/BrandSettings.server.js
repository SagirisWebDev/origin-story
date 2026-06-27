import prisma from "../db.server";

export const DEFAULTS = {
  logoUrl: null,
  accentColor: "#1f5e3a",
  fontFamily: "Inter, system-ui, sans-serif",

  backgroundColor: "#ffffff",
  textColor: "#1a1a1a",
  headingColor: "#1a1a1a",
  buttonBgColor: "#1f5e3a",
  buttonTextColor: "#ffffff",
  headingFontFamily: "Inter, system-ui, sans-serif",
  borderRadiusScale: "medium",
  buttonStyle: "solid",

  linkColor: "#1f5e3a",
  borderColor: "#e1e3e5",
  headingFontWeight: "600",
  bodyFontWeight: "400",
  typeScale: "medium",
  pageMaxWidth: "640px",
  sectionSpacing: "comfortable",
  customFontUrl: null,
  customCss: null,
};

const STYLING_KEYS = Object.keys(DEFAULTS);

/**
 * @typedef {object} Brand
 * @property {string} shop
 * @property {string | null} logoUrl
 * @property {string} accentColor
 * @property {string} fontFamily
 * @property {string} backgroundColor
 * @property {string} textColor
 * @property {string} headingColor
 * @property {string} buttonBgColor
 * @property {string} buttonTextColor
 * @property {string} headingFontFamily
 * @property {string} borderRadiusScale
 * @property {string} buttonStyle
 * @property {string} linkColor
 * @property {string} borderColor
 * @property {string} headingFontWeight
 * @property {string} bodyFontWeight
 * @property {string} typeScale
 * @property {string} pageMaxWidth
 * @property {string} sectionSpacing
 * @property {string | null} customFontUrl
 * @property {string | null} customCss
 */

/**
 * @param {Record<string, unknown> | null} row
 * @param {string} shop
 * @returns {Brand}
 */
function withDefaults(row, shop) {
  const out = /** @type {Brand} */ ({ shop });
  for (const key of STYLING_KEYS) {
    out[key] = row?.[key] ?? DEFAULTS[key];
  }
  return out;
}

/**
 * @param {string} shop
 * @returns {Promise<Brand>}
 */
export async function getBrand(shop) {
  const row = await prisma.brandSettings.findUnique({ where: { shop } });
  return withDefaults(row, shop);
}

export async function saveBrand(shop, data) {
  const fields = {};
  for (const key of STYLING_KEYS) {
    fields[key] = data[key] ?? null;
  }

  return prisma.brandSettings.upsert({
    where: { shop },
    update: fields,
    create: { shop, ...fields },
  });
}
