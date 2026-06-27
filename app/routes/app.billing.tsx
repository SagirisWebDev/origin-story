import type {
  ActionFunctionArgs,
  HeadersFunction,
  LoaderFunctionArgs,
} from "react-router";
import {
  Form,
  redirect,
  useActionData,
  useFetcher,
  useLoaderData,
  useNavigation,
} from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate, PLUS_PLAN } from "../shopify.server";

const isTest = () => process.env.NODE_ENV !== "production";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const { hasActivePayment } = await billing.check({
    plans: [PLUS_PLAN],
    isTest: isTest(),
  });
  return { paid: Boolean(hasActivePayment) };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "subscribe") {
    const url = new URL(request.url);
    const returnUrl = `${url.origin}/app/billing`;
    try {
      await billing.request({
        plan: PLUS_PLAN,
        isTest: isTest(),
        returnUrl,
        trialDays: 14,
      });
      // billing.request throws a redirect Response, so this line is unreachable.
      return null;
    } catch (err) {
      // billing.request escapes by throwing a Response — re-throw that path.
      if (err instanceof Response) throw err;
      const message =
        err instanceof Error ? err.message : "Unknown billing error";
      // Shopify gates billing.request to apps with public distribution set in
      // the Partners dashboard. Until that's enabled, surface a friendly hint
      // instead of crashing the route via ErrorBoundary.
      console.error("Billing request failed:", message);
      return { billingError: message };
    }
  }

  if (intent === "cancel") {
    const { appSubscriptions } = await billing.check({
      plans: [PLUS_PLAN],
      isTest: isTest(),
    });
    const sub = appSubscriptions?.[0];
    if (sub) {
      await billing.cancel({
        subscriptionId: sub.id,
        isTest: isTest(),
        prorate: true,
      });
    }
    return redirect("/app/billing");
  }

  return null;
};

export default function Billing() {
  const { paid } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>() as
    | { billingError?: string }
    | undefined;
  const navigation = useNavigation();
  const fetcher = useFetcher();
  const navSubmitting = navigation.state !== "idle";
  const fetcherSubmitting = fetcher.state !== "idle";
  const fetcherErr =
    (fetcher.data as { billingError?: string } | undefined)?.billingError;
  const billingError = fetcherErr ?? actionData?.billingError;

  if (paid) {
    return (
      <s-page heading="OriginStory Plus">
        <s-section heading="You're on OriginStory Plus">
          <s-stack gap="base">
            <s-paragraph>
              All paid features are unlocked: custom story fields, scan
              analytics, and priority support.
            </s-paragraph>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="cancel" />
              <s-button
                type="submit"
                variant="tertiary"
                disabled={fetcherSubmitting}
              >
                {fetcherSubmitting ? "Cancelling…" : "Cancel subscription"}
              </s-button>
            </fetcher.Form>
          </s-stack>
        </s-section>
      </s-page>
    );
  }

  return (
    <s-page heading="Upgrade">
      <s-section heading="OriginStory Plus">
        <s-stack gap="base">
          <s-paragraph>
            Unlock custom story fields, scan analytics, and priority support
            for $1/month while we're in early access.
          </s-paragraph>
          <s-paragraph>
            14-day free trial — cancel anytime from this page.
          </s-paragraph>
          {billingError ? (
            <s-banner tone="warning" heading="Billing not yet enabled">
              <s-paragraph>
                Shopify's Billing API requires the app to be set to{" "}
                <strong>Public distribution</strong> in the Partners
                dashboard. Until that's enabled, the trial flow can't be
                started.
              </s-paragraph>
              <s-paragraph>Detail: {billingError}</s-paragraph>
            </s-banner>
          ) : null}
          <Form method="post">
            <input type="hidden" name="intent" value="subscribe" />
            <s-button
              type="submit"
              variant="primary"
              disabled={navSubmitting}
            >
              {navSubmitting ? "Starting…" : "Start 14-day free trial"}
            </s-button>
          </Form>
        </s-stack>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
