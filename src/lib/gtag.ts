/**
 * GA4 Event Helpers — Royals Zaika
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

/**
 * Fire any GA4 event safely.
 *
 * Primary path : window.gtag("event", ...) — uses the official gtag.js queue.
 * Fallback path: dataLayer.push() directly — handles the narrow window where
 *   the ga4-init inline script has run (so dataLayer exists) but gtag.js
 *   hasn't finished loading yet.  gtag.js processes queued dataLayer items
 *   on load, so no events are lost.
 */
function gtagEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window === "undefined") return;

  if (typeof window.gtag === "function") {
    // Normal path — gtag.js is loaded and ready
    window.gtag("event", eventName, params ?? {});
  } else {
    // Fallback — push raw arguments object so gtag.js can replay it once loaded
    window.dataLayer = window.dataLayer || [];
    // gtag() is shorthand for dataLayer.push(arguments); replicate that shape
    window.dataLayer.push(["event", eventName, params ?? {}]);
  }
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
  items: { id: string; name: string; price: number; quantity: number; category?: string }[];
}) {
  gtagEvent("begin_checkout", {
    currency: "INR",
    value:    params.value,
    items: params.items.map((i) => ({
      item_id:       i.id,
      item_name:     i.name,
      item_category: i.category ?? "Food",
      price:         i.price,
      quantity:      i.quantity,
    })),
  });
}

// ─────────────────────────────────────────────
// 4. purchase — order confirmed in Supabase
//    Call ONCE per successful order.
//    transaction_id = order_number (human-readable, GA4 reports mein readable)
//    order_id       = Supabase UUID (cross-reference ke liye custom param)
// ─────────────────────────────────────────────
export function trackPurchase(params: {
  orderId:     string;   // Supabase UUID  (custom param, not transaction_id)
  orderNumber: string;   // e.g. "1042"    ← used as transaction_id
  value:       number;
  deliveryFee: number;
  discount:    number;
  items: { id: string; name: string; price: number; quantity: number; category?: string }[];
}) {
  gtagEvent("purchase", {
    transaction_id: params.orderNumber,          // readable, e.g. "1042"
    order_id:       params.orderId,              // custom: Supabase UUID for cross-ref
    affiliation:    "Royals Zaika",
    currency:       "INR",
    value:          params.value,
    shipping:       params.deliveryFee,
    tax:            0,                           // included in value; explicitly 0
    coupon:         params.discount > 0 ? `DISCOUNT_${params.discount}` : undefined,
    items: params.items.map((i) => ({
      item_id:       i.id,
      item_name:     i.name,
      item_category: i.category ?? "Food",
      price:         i.price,
      quantity:      i.quantity,
    })),
  });
}


// ─────────────────────────────────────────────
// 5. User Role — set GA4 user property after auth
//    Maps internal DB role → GA4 custom dimension "user_role".
//    Uses gtag("set","user_properties") — does NOT fire page_view.
//    No PII (name/email/phone) is sent.
// ─────────────────────────────────────────────
type AppRole = "customer" | "restaurant_owner" | "delivery" | "admin";

const ROLE_LABEL: Record<AppRole, string> = {
  customer:         "customer",
  restaurant_owner: "owner",
  delivery:         "rider",
  admin:            "admin",
};

export function trackUserRole(role: AppRole) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  const label = ROLE_LABEL[role] ?? "customer";
  // Clear first to avoid stale previous session role bleeding through
  window.gtag("set", "user_properties", { user_role: null });
  // Then set the correct role for this session
  window.gtag("set", "user_properties", { user_role: label });
}

// Call on logout / SIGNED_OUT to clear the property
export function clearUserRole() {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("set", "user_properties", { user_role: null });
}
