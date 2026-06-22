import { redirect, type LoaderFunctionArgs } from "react-router";

export async function loader({ params, request }: LoaderFunctionArgs) {
  const handle = params.handle;
  if (!handle) {
    throw new Response("Missing handle", { status: 400 });
  }

  const url = new URL(request.url);
  const shop = url.searchParams.get("shop");
  if (!shop) {
    throw new Response("Missing shop query parameter", { status: 400 });
  }

  return redirect(`/story/${handle}?shop=${shop}`, 302);
}
