"use client";
/**
 * AddressModalProvider
 * Previously showed after login — now disabled per updated flow.
 * Address selection now happens at /checkout/address before payment.
 * Kept as a no-op so the import in layout.tsx doesn't break.
 */
export function AddressModalProvider() {
  return null;
}
