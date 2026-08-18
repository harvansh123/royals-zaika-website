/**
 * GA4 Event Helpers — Royal Zaika
 *
 * Central module for all Google Analytics 4 event tracking.
 * Reuses the existing GA4 tag loaded in layout.tsx (G-20M6RE1KGW).
 * Safe to call server-side — all functions check for window/gtag before firing.
 */

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

/** Fire any GA4 event safely (no-ops if gtag not loaded) */
function gtagEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", eventName, params ?? {});
}

// ─────────────────────────────────────────────
// 1. view_menu — customer visits menu/items page
// ─────────────────────────────────────────────
export function trackViewMenu() {
  gtagEvent("view_menu", {
    page_title: "Menu",
    page_location: typeof window !== "undefined" ? window.location.href : "",
  });
}

// ─────────────────────────────────────────────
// 2. add_to_cart — item successfully added
// ─────────────────────────────────────────────
export function trackAddToCart(item: {
  id: string;
  name: string;
  price: number;
  quantity?: number;
  category?: string;
}) {
  gtagEvent("add_to_cart", {
    currency: "INR",
    value: item.price * (item.quantity ?? 1),
    items: [
      {
        item_id:       item.id,
        item_name:     item.name,
        item_category: item.category ?? "Food",
        price:         item.price,
        quantity:      item.quantity ?? 1,
      },
    ],
  });
}

// ─────────────────────────────────────────────
// 3. begin_checkout — checkout process started
// ─────────────────────────────────────────────
export function trackBeginCheckout(params: {
  value: number;
  items: { id: string; name: string; price: number; quantity: number }[];
}) {
  gtagEvent("begin_checkout", {
    currency: "INR",
    value:    params.value,
    items: params.items.map((i) => ({
      item_id:   i.id,
      item_name: i.name,
      price:     i.price,
      quantity:  i.quantity,
    })),
  });
}

// ─────────────────────────────────────────────
// 4. purchase — order confirmed in Supabase
//    Call ONCE per successful order.
// ─────────────────────────────────────────────
export function trackPurchase(params: {
  orderId:     string;
  orderNumber: string;
  value:       number;
  deliveryFee: number;
  discount:    number;
  items: { id: string; name: string; price: number; quantity: number }[];
}) {
  gtagEvent("purchase", {
    transaction_id: params.orderId,
    affiliation:    "Royal Zaika",
    currency:       "INR",
    value:          params.value,
    shipping:       params.deliveryFee,
    coupon:         params.discount > 0 ? `DISCOUNT_${params.discount}` : undefined,
    items: params.items.map((i) => ({
      item_id:   i.id,
      item_name: i.name,
      price:     i.price,
      quantity:  i.quantity,
    })),
  });
}

// ─────────────────────────────────────────────
// 5. User Role — set GA4 user property after auth
//    Maps internal DB role → GA4 dimension.
//    No PII (name/email/phone) is sent.
// ─────────────────────────────────────────────
type AppRole = "customer" | "restaurant_owner" | "delivery" | "admin";

const ROLE_LABEL: Record<AppRole, string> = {
  customer:          "customer",
  restaurant_owner:  "owner",
  delivery:          "rider",
  admin:             "admin",
};

export function trackUserRole(role: AppRole) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const label = ROLE_LABEL[role] ?? "customer";
  window.gtag("set", "user_properties", { user_role: label });
}

// Call on logout / SIGNED_OUT to clear the property
export function clearUserRole() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("set", "user_properties", { user_role: null });
}
