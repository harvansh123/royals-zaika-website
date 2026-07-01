"use client";
import Image from "next/image";
import Link from "next/link";
import { memo, useState, useCallback } from "react";
import { Plus, Minus, Star, Clock, Flame } from "lucide-react";
import { MenuItem } from "@/lib/database.types";
import { useCartStore } from "@/stores/cartStore";
import { cn, formatPrice, getSpiceLabel } from "@/lib/utils";
import toast from "react-hot-toast";

interface FoodCardProps {
  item: MenuItem;
  className?: string;
}

// ── Wrapped with React.memo so it only re-renders when its own props change ──
export const FoodCard = memo(function FoodCard({ item, className }: FoodCardProps) {
  const [imgErr, setImgErr] = useState(false);

  // ✅ Select ONLY this item's quantity — avoids re-render when other cart items change
  const qty      = useCartStore((s) => s.items.find((i) => i.id === item.id)?.quantity ?? 0);
  const addItem  = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);

  // ✅ useCallback prevents function recreation on re-render
  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    addItem(item);
    toast.success(`${item.name} added to cart!`, { icon: "🛒", duration: 1500 });
  }, [addItem, item]);

  const handleIncrease = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    updateQty(item.id, qty + 1);
  }, [updateQty, item.id, qty]);

  const handleDecrease = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    updateQty(item.id, qty - 1);
  }, [updateQty, item.id, qty]);

  const displayPrice = item.discounted_price ?? item.price;
  const hasDiscount  = item.discounted_price && item.discounted_price < item.price;

  return (
    <Link href={`/food/${item.slug}`} className={cn("food-card block", className)}>
      <div className="glass rounded-2xl overflow-hidden border border-white/5 hover:border-brand/20 group">
        {/* Image */}
        <div className="relative h-44 overflow-hidden bg-[#1a1a2e]">
          {item.image_url && !imgErr ? (
            <Image
              src={item.image_url}
              alt={item.name}
              fill
              loading="lazy"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
              onError={() => setImgErr(true)}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-5xl">🍽️</div>
          )}

          {/* Badges */}
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {item.is_bestseller && (
              <span className="badge-brand text-[10px]">🏆 Bestseller</span>
            )}
            {item.is_featured && !item.is_bestseller && (
              <span className="badge bg-purple-500/20 text-purple-300 border border-purple-500/20 text-[10px]">⭐ Featured</span>
            )}
            {hasDiscount && (
              <span className="badge bg-green-500/20 text-green-300 border border-green-500/20 text-[10px]">
                {Math.round((1 - item.discounted_price! / item.price) * 100)}% OFF
              </span>
            )}
          </div>

          {/* Veg indicator */}
          <div className="absolute top-2 right-2">
            <div className={cn(
              "w-5 h-5 rounded border-2 flex items-center justify-center",
              item.is_veg ? "border-green-500 bg-green-500/10" : "border-red-500 bg-red-500/10"
            )}>
              <div className={cn("w-2 h-2 rounded-full", item.is_veg ? "bg-green-500" : "bg-red-500")} />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <h3 className="font-semibold text-white text-sm leading-snug line-clamp-1 group-hover:text-orange-300 transition-colors">
            {item.name}
          </h3>

          {item.description && (
            <p className="text-gray-500 text-xs mt-1 line-clamp-2 leading-relaxed">
              {item.description}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-2">
            {item.rating > 0 && (
              <div className="flex items-center gap-1 text-xs text-yellow-400">
                <Star size={11} fill="currentColor" />
                <span>{item.rating.toFixed(1)}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock size={11} />
              <span>{item.preparation_time}m</span>
            </div>
            {item.spice_level > 2 && (
              <div className="flex items-center gap-1 text-xs text-red-400">
                <Flame size={11} />
                <span>{getSpiceLabel(item.spice_level)}</span>
              </div>
            )}
          </div>

          {/* Price + Cart */}
          <div className="flex items-center justify-between mt-3">
            <div>
              <span className="font-bold text-white text-base">{formatPrice(displayPrice)}</span>
              {hasDiscount && (
                <span className="text-gray-500 text-xs line-through ml-1">{formatPrice(item.price)}</span>
              )}
            </div>

            {qty === 0 ? (
              <button
                onClick={handleAdd}
                className="flex items-center gap-1.5 gradient-brand text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:shadow-brand transition-all hover:scale-105 active:scale-95"
              >
                <Plus size={13} />
                ADD
              </button>
            ) : (
              <div className="flex items-center gap-2 glass rounded-lg px-1 py-0.5 border border-brand/30">
                <button
                  onClick={handleDecrease}
                  className="w-6 h-6 flex items-center justify-center text-brand hover:bg-brand/10 rounded transition-colors"
                >
                  <Minus size={12} />
                </button>
                <span className="text-white font-bold text-sm w-4 text-center">{qty}</span>
                <button
                  onClick={handleIncrease}
                  className="w-6 h-6 flex items-center justify-center text-brand hover:bg-brand/10 rounded transition-colors"
                >
                  <Plus size={12} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
});
