"use client";
import Link from "next/link";
import { ShoppingCart, ArrowRight } from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

export function MobileCartButton({ className }: { className?: string }) {
  const totalItems = useCartStore((s) => s.totalItems());
  const total      = useCartStore((s) => s.total());
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Don't render anything until client has mounted (prevents hydration mismatch)
  if (!mounted || totalItems === 0) return null;

  return (
    <div className={cn(
      "fixed bottom-4 left-4 right-4 z-40 md:hidden animate-slide-bottom pb-safe",
      className
    )}>
      <Link href="/cart"
        className="flex items-center justify-between gradient-brand text-white px-5 py-4 rounded-2xl shadow-glow-lg"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart size={22} />
            <span className="absolute -top-2 -right-2 w-4 h-4 bg-white text-orange-600 text-[9px] font-black rounded-full flex items-center justify-center">
              {totalItems > 9 ? "9+" : totalItems}
            </span>
          </div>
          <span className="font-semibold text-sm">View Cart</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-bold">{formatPrice(total)}</span>
          <ArrowRight size={18} />
        </div>
      </Link>
    </div>
  );
}
