import { PLUS_PLAN } from "./billing-plan.js";

export { PLUS_PLAN };

export async function getFeatureFlags(billing) {
  if (!billing || typeof billing.check !== "function") {
    return { paid: false };
  }
  try {
    const { hasActivePayment } = await billing.check({
      plans: [PLUS_PLAN],
      isTest: process.env.NODE_ENV !== "production",
    });
    return { paid: Boolean(hasActivePayment) };
  } catch {
    return { paid: false };
  }
}
