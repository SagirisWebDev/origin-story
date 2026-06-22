/**
 * Pure transform logic + story-seed dictionary for the Common Roast demo
 * migration (issue #6). The executable script under scripts/ wraps this with
 * the Admin GraphQL adapter.
 *
 * Brand-voice rationale lives in new-store/CONTEXT.md and the About-hero copy
 * ("Good coffee shouldn't require a decoder ring"). Seeds are intentionally
 * specific (people, places, processes) rather than poetic.
 */

export const STORY_SEEDS = {
  "ethiopia-yirgacheffe-natural":
    "Coffee was born here. Wild coffee trees still grow on the steep slopes of Yirgacheffe, and the cherries from those smallholder plots — picked by hand, dried whole on raised beds under the equatorial sun — carry a complexity that washed coffees can't touch. The natural process is older and harder: the cherry stays on the bean for weeks, fermenting in the sun, demanding constant turning to prevent rot. When it works, you taste fruit you didn't know coffee could taste like. This is one of those.",

  "colombia-huila-washed":
    "The valleys of Huila run deep between the Andes, and the farms here are small — half a hectare, a hectare, two if you're lucky. Each farmer washes their own coffee on their own patio. There's no consolidation, no anonymizing blend. What ends up in your cup came from someone's family land, processed the way their parents processed it. The washed method keeps the cup clean and bright, which is exactly what Huila is known for: approachable on the first sip, rewarding on the tenth.",

  "guatemala-antigua-honey":
    "Finca La Hermosa sits on the slopes of an active volcano. Pacaya last erupted in 2021, dusting the farm in fresh ash — which, counterintuitively, is great news. Volcanic soil holds water and minerals like nothing else, and Antigua's coffee has been benefiting from it for over a century. The honey process means the cherry pulp is removed but the sticky fruit layer stays on the bean while it dries. The result is the clarity of a washed cup with the sweetness of a natural. La Hermosa has been doing this for four generations.",

  "kenya-nyeri-aa-washed":
    "The Gaturiri Cooperative is small — fewer than 500 members, all farming the slopes around Mount Kenya. What sets Nyeri AA apart isn't a secret; it's altitude, volcanic soil, and a stubborn commitment to a punishing double-wash process. Twice fermented. Twice rinsed. The result is the coffee that other coffees aspire to: assertive, almost wine-like, the kind of cup that makes you set down what you're doing. \"AA\" is the size grade — the largest beans, hand-sorted. That part you can taste. The rest is the place.",

  "brazil-cerrado-natural":
    "Brazil grows more coffee than any country on Earth, and most of it gets dismissed by specialty roasters as \"commercial-grade.\" The Cerrado Mineiro plateau is where the country's most committed farms refuse that label. Fazenda Santa Helena uses mechanical drying patios and weather forecasting to time their natural process exactly — letting the cherry dry on the bean until it's raisin-dark, no longer. The result is the bean specialty Brazil should be famous for: heavy, sweet, low-acid, and (we won't pretend otherwise) the best espresso base we've found.",

  "peru-cajamarca-washed":
    "CENFROCAFÉ is a cooperative of around 2,000 indigenous farming families in the Cajamarca highlands, all certified organic. Their coffee grows in the shade of native trees — no monoculture, no defoliants. The trade-off for the farmer is lower yield; the trade-off for the drinker is a cup with character. Peru has spent the last decade earning its specialty reputation, and Cajamarca is the region doing the most to earn it. This is gentle, sweet, easy coffee — a great place to start if single-origins have intimidated you before.",

  "swiss-water-decaf-colombia":
    "Decaf has a reputation problem and it's mostly the chemicals' fault. Most decaf is processed with methylene chloride or ethyl acetate — solvents that strip caffeine but also rough up the flavor compounds along the way. The Swiss Water Process uses none of that: just water, a charcoal filter, and time. The unroasted beans sit in caffeine-saturated water that pulls out only the caffeine, leaving everything else. It's slow, expensive, and quietly the only way to make a decaf that drinks like coffee. Try it side-by-side with your normal cup. We dare you to pick which is which.",
};

const PROCESS_MAP = {
  natural: "Natural process",
  washed: "Washed process",
  honey: "Honey process",
  "swiss-water": "Swiss Water Process decaffeination",
};

export function formatOrigin(region, country) {
  const cleanCountry = (country ?? "").trim();
  if (!cleanCountry) return "";

  const cleanRegion = (region ?? "").trim();
  if (!cleanRegion) return cleanCountry;

  return `${cleanRegion}, ${cleanCountry}`;
}

export function formatProcess(process) {
  const value = (process ?? "").trim();
  if (!value) return "";

  if (PROCESS_MAP[value]) return PROCESS_MAP[value];

  const capitalized = value.charAt(0).toUpperCase() + value.slice(1);
  return `${capitalized} process`;
}

export function isMigratable(product, seeds = STORY_SEEDS) {
  const hasOriginCountry = Boolean(product?.metafields?.origin_country);
  const hasSeed =
    typeof seeds?.[product?.handle] === "string" &&
    seeds[product.handle].length > 0;
  return hasOriginCountry && hasSeed;
}

export function buildStoryPayload(product, seeds = STORY_SEEDS) {
  if (!isMigratable(product, seeds)) return null;

  const metafields = product.metafields ?? {};
  return {
    handle: product.handle,
    productId: product.id,
    productTitle: product.title,
    productHandle: product.handle,
    origin: formatOrigin(metafields.origin_region, metafields.origin_country),
    maker: (metafields.producer_farm_name ?? "").trim(),
    process: formatProcess(metafields.process),
    story: seeds[product.handle],
  };
}
