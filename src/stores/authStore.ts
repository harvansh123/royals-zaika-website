"use client";
import { create } from "zustand";
import { User } from "@/lib/database.types";

interface AuthStore {
  user: User | null;
  loading: boolean;
  showAddressModal: boolean;
  setUser:             (user: User | null) => void;
  setLoading:          (loading: boolean) => void;
  setShowAddressModal: (v: boolean) => void;
  isAdmin:    () => boolean;
  isOwner:    () => boolean;
  isDelivery: () => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user:             null,
  loading:          true,
  showAddressModal: false,

  setUser:             (user)    => set({ user }),
  setLoading:          (loading) => set({ loading }),
  setShowAddressModal: (v)       => set({ showAddressModal: v }),
  isAdmin:    () => get().user?.role === "admin",
  isOwner:    () => get().user?.role === "restaurant_owner",
  isDelivery: () => get().user?.role === "delivery",
}));
