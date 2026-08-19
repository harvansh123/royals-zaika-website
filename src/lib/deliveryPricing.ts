/**
 * Delivery Pricing Table
 *
 * Distance  | Customer Fee | Rider Payout
 * 0–1 km   | ₹25          | ₹35
 * 1–2 km   | ₹30          | ₹40
 * 2–3 km   | ₹35          | ₹45
 * 3–4 km   | ₹40          | ₹50
 *
 * FREE DELIVERY: If order subtotal >= FREE_DELIVERY_THRESHOLD (₹499),
 * customer pays ₹0 delivery fee.
 * Rider still receives full distance-based payout.
 * Owner Contribution = Rider Payout − Customer Delivery Charge paid by customer.
 * For free delivery orders: Owner Contribution = full Rider Payout.
 */

export const FREE_DELIVERY_THRESHOLD = 499; // subtotal >= this → customer pays ₹0

export interface DeliveryPricingTier {
  minKm:             number;
  maxKm:             number;
  customerFee:       number; // what the customer pays (0 for free delivery)
  riderPayout:       number; // always distance-based, never changes
  ownerContribution: number; // dynamic = riderPayout - customerFee
  rangeLabel:        string; // e.g. "0–1 km"
  isFreeDelivery:    boolean;
}

const BASE_TIERS = [
  { minKm: 0, maxKm: 1, customerFee: 25, riderPayout: 35, rangeLabel: "0\u20131 km"  },
  { minKm: 1, maxKm: 2, customerFee: 30, riderPayout: 40, rangeLabel: "1\u20132 km"  },
  { minKm: 2, maxKm: 3, customerFee: 35, riderPayout: 45, rangeLabel: "2\u20133 km"  },
  { minKm: 3, maxKm: 4, customerFee: 40, riderPayout: 50, rangeLabel: "3\u20134 km"  },
];

/** Maximum delivery distance supported (km). */
export const MAX_DELIVERY_KM = 4;

/**
 * Given a distance in km and (optionally) the order subtotal, returns the
 * applicable pricing tier with customerFee, riderPayout, ownerContribution.
 *
 * If subtotal >= FREE_DELIVERY_THRESHOLD, customerFee is set to 0 and
 * ownerContribution equals the full riderPayout.
 *
 * Returns null if distance is 0, negative, or > MAX_DELIVERY_KM.
 *
 * Range logic (exclusive lower, inclusive upper):
 *   0  <  d  <= 1 km  -> Tier 0
 *   1  <  d  <= 2 km  -> Tier 1
 *   2  <  d  <= 3 km  -> Tier 2
 *   3  <  d  <= 4 km  -> Tier 3
 */
export function getDeliveryPricing(
  distanceKm: number | null | undefined,
  subtotal: number = 0
): DeliveryPricingTier | null {
  if (distanceKm == null || distanceKm <= 0 || distanceKm > MAX_DELIVERY_KM) return null;

  for (const base of BASE_TIERS) {
    if (distanceKm > base.minKm && distanceKm <= base.maxKm) {
      const isFreeDelivery = subtotal >= FREE_DELIVERY_THRESHOLD;
      const effectiveCustomerFee = isFreeDelivery ? 0 : base.customerFee;
      return {
        ...base,
        customerFee:       effectiveCustomerFee,
        ownerContribution: base.riderPayout - effectiveCustomerFee,
        isFreeDelivery,
      };
    }
  }

  return null;
}

// ─── Dynamic per-km rates (Owner-configurable) ────────────────────────────────

/**
 * Owner-configured per-km delivery rates stored in restaurant_settings.
 * Fetched via GET /api/restaurant-settings and passed to getDeliveryPricingFromRates().
 */
export interface DeliveryRates {
  delivery_charge_per_km:    number;  // Customer pays this × distanceKm
  owner_contribution_per_km: number;  // Owner subsidises this × distanceKm
  rider_payout_per_km:       number;  // Rider earns this × distanceKm
  free_delivery_min_order:   number;  // Customer pays ₹0 if subtotal >= this
}

/** Default rates matching the hardcoded tier averages — used as fallback. */
export const DEFAULT_DELIVERY_RATES: DeliveryRates = {
  delivery_charge_per_km:    10,
  owner_contribution_per_km: 5,
  rider_payout_per_km:       15,
  free_delivery_min_order:   499,
};

/**
 * Calculates delivery pricing from owner-configured per-km rates.
 * Formula:
 *   customerFee       = distanceKm × rates.delivery_charge_per_km  (0 if free delivery)
 *   riderPayout       = distanceKm × rates.rider_payout_per_km
 *   ownerContribution = distanceKm × rates.owner_contribution_per_km
 *                       + customerFee waived (for free delivery orders)
 *
 * Returns null if distanceKm is null/0/negative or > MAX_DELIVERY_KM.
 */
export function getDeliveryPricingFromRates(
  distanceKm: number | null | undefined,
  subtotal: number = 0,
  rates: DeliveryRates = DEFAULT_DELIVERY_RATES
): DeliveryPricingTier | null {
  if (distanceKm == null || distanceKm <= 0 || distanceKm > MAX_DELIVERY_KM) return null;

  const isFreeDelivery      = subtotal >= rates.free_delivery_min_order;
  const baseCustomerFee     = Math.round(distanceKm * rates.delivery_charge_per_km);
  const effectiveCustomerFee = isFreeDelivery ? 0 : baseCustomerFee;
  const riderPayout         = Math.round(distanceKm * rates.rider_payout_per_km);
  // Owner covers: their per-km contribution + any customer fee waived for free delivery
  const ownerContribution   = Math.round(distanceKm * rates.owner_contribution_per_km)
                              + (isFreeDelivery ? baseCustomerFee : 0);

  return {
    minKm:            0,
    maxKm:            MAX_DELIVERY_KM,
    customerFee:      effectiveCustomerFee,
    riderPayout,
    ownerContribution,
    rangeLabel:       `${distanceKm.toFixed(1)} km`,
    isFreeDelivery,
  };
}
