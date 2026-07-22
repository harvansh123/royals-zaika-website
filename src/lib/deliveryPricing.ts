/**
 * Delivery Pricing Table
 *
 * Distance  | Customer Fee | Rider Payout | Owner Contribution
 * 0–1 km   | ₹25          | ₹35          | ₹10
 * 1–2 km   | ₹30          | ₹40          | ₹10
 * 2–3 km   | ₹35          | ₹45          | ₹10
 * 3–4 km   | ₹40          | ₹50          | ₹10
 *
 * Owner Contribution = Rider Payout − Customer Fee = ₹10 in all tiers.
 */

export interface DeliveryPricingTier {
  minKm:             number;
  maxKm:             number;
  customerFee:       number;
  riderPayout:       number;
  ownerContribution: number;
  rangeLabel:        string; // e.g. "0–1 km"
}

export const DELIVERY_TIERS: DeliveryPricingTier[] = [
  { minKm: 0, maxKm: 1, customerFee: 25, riderPayout: 35, ownerContribution: 10, rangeLabel: "0–1 km"  },
  { minKm: 1, maxKm: 2, customerFee: 30, riderPayout: 40, ownerContribution: 10, rangeLabel: "1–2 km"  },
  { minKm: 2, maxKm: 3, customerFee: 35, riderPayout: 45, ownerContribution: 10, rangeLabel: "2–3 km"  },
  { minKm: 3, maxKm: 4, customerFee: 40, riderPayout: 50, ownerContribution: 10, rangeLabel: "3–4 km"  },
];

/** Maximum delivery distance supported (km). */
export const MAX_DELIVERY_KM = 4;

/**
 * Given a distance in km, returns the applicable pricing tier.
 * Returns null if distance is 0, negative, or > MAX_DELIVERY_KM.
 *
 * Range logic (exclusive lower, inclusive upper):
 *   0  <  d  ≤ 1 km  → Tier 0
 *   1  <  d  ≤ 2 km  → Tier 1
 *   2  <  d  ≤ 3 km  → Tier 2
 *   3  <  d  ≤ 4 km  → Tier 3
 *
 * Special case: d === 0 is treated as invalid (no movement).
 */
export function getDeliveryPricing(distanceKm: number | null | undefined): DeliveryPricingTier | null {
  if (distanceKm == null || distanceKm <= 0 || distanceKm > MAX_DELIVERY_KM) return null;

  for (const tier of DELIVERY_TIERS) {
    // Use exclusive lower bound, inclusive upper bound
    if (distanceKm > tier.minKm && distanceKm <= tier.maxKm) return tier;
    // Edge case: exactly 0 is already handled above; but if minKm===0 and dist===0.001 etc, the > check handles it.
  }

  return null;
}
