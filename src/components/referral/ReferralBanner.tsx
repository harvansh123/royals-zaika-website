"use client";
import Link from "next/link";
import { Gift } from "lucide-react";

/**
 * ReferralBanner — compact promo strip for menu/home pages.
 * Shows only when user is logged in.
 */
export default function ReferralBanner() {
  return (
    <Link href="/refer"
      className="flex items-center justify-between gap-3 px-4 py-3 rounded-2xl group transition-all hover:scale-[1.01]"
      style={{
        background: "linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(220,38,38,0.08) 100%)",
        border: "1px solid rgba(249,115,22,0.25)",
      }}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center shadow-brand flex-shrink-0">
          <Gift size={18} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">Refer friends, earn rewards! 🎁</p>
          <p className="text-xs text-gray-400 mt-0.5">Up to ₹150 OFF for every 10 successful referrals</p>
        </div>
      </div>
      <div className="text-xs font-semibold text-orange-400 flex items-center gap-1 shrink-0 group-hover:translate-x-0.5 transition-transform">
        Refer Now →
      </div>
    </Link>
  );
}
