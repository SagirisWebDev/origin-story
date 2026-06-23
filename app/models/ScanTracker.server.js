import { isbot } from "isbot";

import prisma from "../db.server";

export function classifyUserAgent(ua) {
  if (!ua || typeof ua !== "string") return "unknown";

  if (isbot(ua)) return "bot";

  if (/iPad/.test(ua)) return "tablet";

  // Android tablets typically omit "Mobile" from the UA.
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "tablet";

  if (/iPhone|Mobile|Android/.test(ua)) return "mobile";

  return "desktop";
}

export async function recordScan(storyHandle, request) {
  try {
    const ua = request.headers.get("User-Agent");
    const shop = new URL(request.url).searchParams.get("shop");
    const userAgentClass = classifyUserAgent(ua);

    await prisma.scanEvent.create({
      data: { storyHandle, shop, userAgentClass },
    });
  } catch (err) {
    console.error("[ScanTracker] recordScan failed:", err);
  }
}
