import { redirect } from "next/navigation";

/**
 * /owner — instantly redirect to Orders page.
 * Owner dashboard default landing = Orders (most important section).
 */
export default function OwnerRootPage() {
  redirect("/owner/orders");
}
