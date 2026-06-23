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

export async function countScansByHandles(handles) {
  const result = new Map();
  if (!handles?.length) return result;

  for (const handle of handles) result.set(handle, 0);

  const rows = await prisma.scanEvent.groupBy({
    by: ["storyHandle"],
    where: { storyHandle: { in: handles } },
    _count: { storyHandle: true },
  });

  for (const row of rows) {
    result.set(row.storyHandle, row._count.storyHandle);
  }

  return result;
}

export async function scansPerDay(shop, days) {
  const now = new Date();
  const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const events = await prisma.scanEvent.findMany({
    where: {
      shop,
      timestamp: { gte: cutoff },
      userAgentClass: { not: "bot" },
    },
    select: { timestamp: true, userAgentClass: true },
  });

  const buckets = new Map();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    buckets.set(d.toISOString().slice(0, 10), 0);
  }

  for (const event of events) {
    if (event.userAgentClass === "bot") continue;
    const date = new Date(event.timestamp).toISOString().slice(0, 10);
    if (buckets.has(date)) buckets.set(date, buckets.get(date) + 1);
  }

  return Array.from(buckets, ([date, count]) => ({ date, count }));
}
