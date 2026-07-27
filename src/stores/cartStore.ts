"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MenuItem, CartItem, Coupon } from "@/lib/database.types";
import { getDeliveryPricing } from "@/lib/deliveryPricing";

interface CartStore {
  items: CartItem[];
  coupon: Coupon | null;
  discountAmount: number;
  deliveryDistanceKm: number | null;

  addItem:             (item: MenuItem) => void;
  removeItem:          (id: string) => void;
  updateQty:           (id: string, qty: number) => void;
  clearCart:           () => void;
  applyCoupon:         (coupon: Coupon) => void;
  removeCoupon:        () => void;
  setDeliveryDistance: (km: number | null) => void;

  // Computed
  totalItems:  () => number;
  subtotal:    () => number;
  deliveryFee: () => number;
  total:       () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      coupon: null,
      discountAmount: 0,
      deliveryDistanceKm: null,

      addItem: (menuItem) => {
        const items = get().items;
        const existing = items.find((i) => i.id === menuItem.id);
        if (existing) {
          set({ items: items.map((i) => i.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i) });
        } else {
          set({ items: [...items, { id: menuItem.id, menu_item: menuItem, quantity: 1 }] });
        }
      },

      removeItem: (id) =>
        set({ items: get().items.filter((i) => i.id !== id) }),

      updateQty: (id, qty) => {
        if (qty <= 0) {
          get().removeItem(id);
          return;
        }
        set({ items: get().items.map((i) => i.id === id ? { ...i, quantity: qty } : i) });
      },

      clearCart: () => set({ items: [], coupon: null, discountAmount: 0, deliveryDistanceKm: null }),

      setDeliveryDistance: (km) => set({ deliveryDistanceKm: km }),

      applyCoupon: (coupon) => {
        const subtotal = get().subtotal();
        let discount = 0;
        if (coupon.discount_type === "percentage") {
          discount = (subtotal * coupon.discount_value) / 100;
          if (coupon.max_discount) discount = Math.min(discount, coupon.max_discount);
        } else {
          discount = coupon.discount_value;
        }
        set({ coupon, discountAmount: discount });
      },

      removeCoupon: () => set({ coupon: null, discountAmount: 0 }),

      totalItems: () => get().items.reduce((sum, i) => sum + i.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, i) => {
          const price = i.menu_item.discounted_price ?? i.menu_item.price;
          return sum + price * i.quantity;
        }, 0),

      deliveryFee: () => {
        if (get().items.length === 0) return 0;
        const distKm  = get().deliveryDistanceKm;
        const sub     = get().subtotal();
        const pricing = getDeliveryPricing(distKm, sub);
        // If distance is set and within range, use distance-based (or free) fee
        if (pricing) return pricing.customerFee;
        // Fallback: if no distance yet, use ₹30 as default display
        // (will be confirmed when address is selected)
        return 30;
      },

      total: () => {
        const { subtotal, deliveryFee, discountAmount } = get();
        return Math.max(0, subtotal() + deliveryFee() - discountAmount);
      },
    }),
    { name: "chaurasia-cart" }
  )
);

