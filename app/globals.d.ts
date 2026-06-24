declare module "*.css";

// @shopify/app-bridge-types maps `ui-save-bar` to `UISaveBarAttributes` in
// JSX.IntrinsicElements, but that shape omits the React `ref` prop. Re-declare
// the entry as a strict superset that adds ref, so useRef<UISaveBarElement>()
// flows through to JSX without a type error.
import type { UISaveBarAttributes } from "@shopify/app-bridge-types";

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "ui-save-bar": UISaveBarAttributes & {
        ref?: React.LegacyRef<UISaveBarElement | null>;
      };
    }
  }
}
