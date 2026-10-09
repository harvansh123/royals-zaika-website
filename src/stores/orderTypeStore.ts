"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OrderType = "dine_in" | "takeaway" | "home_delivery";

interface OrderTypeStore {
  orderType: OrderType | null;
  tableNumber: string;
  guestCount: string;
  setOrderType:   (t: OrderType) => void;
  setTableNumber: (n: string)    => void;
  setGuestCount:  (n: string)    => void;
  reset:          ()             => void;
}

export const useOrderTypeStore = create<OrderTypeStore>()(
  persist(
    (set) => ({
      orderType:   null,
      tableNumber: "",
      guestCount:  "",

      setOrderType:   (orderType)   => set({ orderType }),
      setTableNumber: (tableNumber) => set({ tableNumber }),
      setGuestCount:  (guestCount)  => set({ guestCount }),
      reset: () => set({ orderType: null, tableNumber: "", guestCount: "" }),
    }),
    { name: "rz-order-type" }   // persisted to localStorage
  )
);
