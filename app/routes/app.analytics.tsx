import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { getFeatureFlags } from "../lib/featureFlags.server.js";
import { scansPerDay } from "../models/ScanTracker.server.js";

type Bucket = { date: string; count: number };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const flags = await getFeatureFlags(billing);

  if (!flags.paid) {
    return { flags, data: [] as Bucket[] };
  }

  const data = await scansPerDay(session.shop, 30);
  return { flags, data };
};

function ScanChart({ data }: { data: Bucket[] }) {
  const width = 720;
  const height = 240;
  const padding = { top: 16, right: 16, bottom: 32, left: 32 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...data.map((d) => d.count));
  const barWidth = innerW / data.length;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height: "auto", background: "#fafafa" }}
      role="img"
      aria-label={`Scans per day for the last ${data.length} days`}
    >
      <line
        x1={padding.left}
        y1={padding.top + innerH}
        x2={padding.left + innerW}
        y2={padding.top + innerH}
        stroke="#d0d0d0"
      />
      {data.map((d, i) => {
        const barH = (d.count / max) * innerH;
        const x = padding.left + i * barWidth + 2;
        const y = padding.top + innerH - barH;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={Math.max(1, barWidth - 4)}
              height={barH}
              fill="#1f5e3a"
              rx={2}
            >
              <title>{`${d.date}: ${d.count} scan${d.count === 1 ? "" : "s"}`}</title>
            </rect>
          </g>
        );
      })}
      <text
        x={padding.left}
        y={padding.top + innerH + 20}
        fontSize="10"
        fill="#666"
      >
        {data[0]?.date ?? ""}
      </text>
      <text
        x={padding.left + innerW}
        y={padding.top + innerH + 20}
        fontSize="10"
        fill="#666"
        textAnchor="end"
      >
        {data[data.length - 1]?.date ?? ""}
      </text>
      <text x={padding.left - 4} y={padding.top + 8} fontSize="10" fill="#666" textAnchor="end">
        {max}
      </text>
    </svg>
  );
}

export default function Analytics() {
  const { flags, data } = useLoaderData<typeof loader>();
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (!flags.paid) {
    return (
      <s-page heading="Analytics">
        <s-section heading="Upgrade to unlock analytics">
          <s-stack gap="base">
            <s-paragraph>
              Track every QR scan, see daily trends, and identify which stories
              drive the most engagement.
            </s-paragraph>
            <s-button href="/app/billing" variant="primary">
              Upgrade
            </s-button>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Analytics">
      <s-section heading="Scans (last 30 days)">
        <s-stack gap="base">
          <s-text>
            {total} total scan{total === 1 ? "" : "s"}, bots excluded.
          </s-text>
          <ScanChart data={data} />
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
