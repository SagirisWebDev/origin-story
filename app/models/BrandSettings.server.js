import prisma from "../db.server";

const DEFAULTS = {
  logoUrl: null,
  accentColor: "#1f5e3a",
  fontFamily: "Inter, system-ui, sans-serif",
};

export async function getBrand(shop) {
  const row = await prisma.brandSettings.findUnique({ where: { shop } });

  if (!row) {
    return { shop, ...DEFAULTS };
  }

  return {
    shop,
    logoUrl: row.logoUrl ?? DEFAULTS.logoUrl,
    accentColor: row.accentColor ?? DEFAULTS.accentColor,
    fontFamily: row.fontFamily ?? DEFAULTS.fontFamily,
  };
}

export async function saveBrand(shop, data) {
  const fields = {
    logoUrl: data.logoUrl ?? null,
    accentColor: data.accentColor ?? null,
    fontFamily: data.fontFamily ?? null,
  };

  return prisma.brandSettings.upsert({
    where: { shop },
    update: fields,
    create: { shop, ...fields },
  });
}
