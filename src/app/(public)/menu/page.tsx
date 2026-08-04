"use client";
import { useState, useEffect, useMemo, useCallback, Suspense, memo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X, ShoppingCart, Flame, Leaf, Star, Zap } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { MenuItem, Category } from "@/lib/database.types";
import { useCartStore } from "@/stores/cartStore";
import { useAuthStore } from "@/stores/authStore";
import { formatPrice } from "@/lib/utils";
import { cn } from "@/lib/utils";
import Image from "next/image";
import toast from "react-hot-toast";
import { useRestaurantStatus, formatTime } from "@/hooks/useRestaurantStatus";
import ClosedPopup from "@/components/restaurant/ClosedPopup";

type ActiveOffer = {
  id: string; title: string; description: string | null;
  discount_type: "percentage" | "flat"; discount_value: number;
  min_order_amount: number; max_discount_amount: number | null;
  start_date: string; end_date: string;
};

const CACHE_KEY   = "menu_v2";
const CACHE_TTL   = 30 * 1000;   // 30 s — so newly added items appear quickly

function getCache() {
  try {
    const r = sessionStorage.getItem(CACHE_KEY);
    if (!r) return null;
    const { ts, d } = JSON.parse(r);
    if (Date.now() - ts > CACHE_TTL) { sessionStorage.removeItem(CACHE_KEY); return null; }
    return d as { items: MenuItem[]; categories: Category[] };
  } catch { return null; }
}
function setCache(d: { items: MenuItem[]; categories: Category[] }) {
  try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), d })); } catch {}
}

// ── Zomato-style food card ───────────────────────────────────────────
const FoodCard = memo(function FoodCard({ item, isOpen }: { item: MenuItem; isOpen: boolean }) {
  const qty      = useCartStore((s) => s.items.find((i) => i.id === item.id)?.quantity ?? 0);
  const addItem  = useCartStore((s) => s.addItem);
  const updateQty = useCartStore((s) => s.updateQty);
  const { user } = useAuthStore();
  const router   = useRouter();
  const [imgErr, setImgErr]           = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  const price = item.discounted_price ?? item.price;
  const hasDiscount = item.discounted_price && item.discounted_price < item.price;

  const handleAdd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast.error("Please login to add items"); router.push("/auth/login"); return; }
    if (!isOpen) { toast.error("Restaurant is currently closed", { icon: "🔴" }); return; }
    addItem(item);
    toast.success(`Added to cart!`, { icon: "🛒", duration: 1200 });
  }, [addItem, item, user, router, isOpen]);

  return (
    <div className="flex gap-4 py-5 border-b last:border-0"
      style={{ borderColor: "rgba(255,255,255,0.06)" }}>

      {/* Left: Info */}
      <div className="flex-1 min-w-0">
        {/* Veg/Non-veg dot */}
        <div className="flex items-center gap-2 mb-1.5">
          <div className={cn("w-4 h-4 rounded-sm border-2 flex items-center justify-center shrink-0",
            item.is_veg ? "border-green-500" : "border-red-500")}>
            <div className={cn("w-2 h-2 rounded-full", item.is_veg ? "bg-green-500" : "bg-red-500")} />
          </div>
          {item.is_bestseller && (
            <span className="text-[10px] font-semibold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
              🏆 BESTSELLER
            </span>
          )}
        </div>

        <h3 className="font-semibold text-white text-base leading-snug mb-1">{item.name}</h3>

        {/* Price */}
        <div className="flex items-baseline gap-2 mb-2">
          <span className="font-bold text-white">₹{price}</span>
          {hasDiscount && (
            <span className="text-gray-500 text-sm line-through">₹{item.price}</span>
          )}
          {hasDiscount && (
            <span className="text-green-400 text-xs font-medium">
              {Math.round((1 - item.discounted_price! / item.price) * 100)}% off
            </span>
          )}
        </div>

        {/* Rating + time + reviews */}
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          {item.rating > 0 && (
            <span className="flex items-center gap-1 text-xs text-yellow-400">
              <Star size={11} fill="currentColor" />{item.rating.toFixed(1)}
            </span>
          )}
          <span className="text-xs text-gray-500">{item.preparation_time} mins</span>
          {item.review_count > 0 && (
            <Link
              href={`/reviews/${item.id}`}
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-orange-400 hover:text-orange-300 hover:underline transition-colors"
            >
              {item.review_count} review{item.review_count !== 1 ? "s" : ""}
            </Link>
          )}
        </div>

        {item.description && (() => {
          const TRIM_AT = 80;
          const isLong  = item.description!.length > TRIM_AT;
          return (
            <p className="text-gray-500 text-sm leading-relaxed">
              {!descExpanded && isLong
                ? item.description!.slice(0, TRIM_AT) + "..."
                : item.description}
              {isLong && (
                <button
                  onClick={(e) => { e.stopPropagation(); setDescExpanded(v => !v); }}
                  className="ml-1 text-orange-400 font-semibold hover:text-orange-300 transition-colors"
                >
                  {descExpanded ? "Less" : "More"}
                </button>
              )}
            </p>
          );
        })()}
      </div>

      {/* Right: Image + Add button */}
      <div className="flex-shrink-0 flex flex-col items-center gap-2">
        <div className="relative w-28 h-24 rounded-xl overflow-hidden bg-gray-800">
          {item.image_url && !imgErr ? (
            <Image src={item.image_url} alt={item.name} fill className="object-cover"
              sizes="112px" loading="lazy" onError={() => setImgErr(true)} />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl">🍽️</div>
          )}
          {hasDiscount && (
            <div className="absolute bottom-0 left-0 right-0 bg-green-500/90 text-white text-[9px] font-bold text-center py-0.5">
              {Math.round((1 - item.discounted_price! / item.price) * 100)}% OFF
            </div>
          )}
        </div>

        {/* ADD button Zomato-style — disabled when closed */}
        {!isOpen ? (
          <button
            disabled
            className="w-28 py-1.5 rounded-lg text-sm font-bold border-2 border-gray-600 text-gray-500 bg-transparent cursor-not-allowed"
            title="Restaurant is currently closed"
          >
            CLOSED
          </button>
        ) : qty === 0 ? (
          <button onClick={handleAdd}
            className="w-28 py-1.5 rounded-lg text-sm font-bold border-2 border-orange-500 text-orange-500 bg-transparent hover:bg-orange-500/10 transition-all active:scale-95">
            ADD
          </button>
        ) : (
          <div className="w-28 flex items-center justify-between px-2 py-1 rounded-lg border-2 border-orange-500 bg-orange-500/10">
            <button onClick={(e) => { e.stopPropagation(); updateQty(item.id, qty - 1); }}
              className="w-6 h-6 flex items-center justify-center text-orange-500 font-bold text-lg hover:bg-orange-500/20 rounded">−</button>
            <span className="text-orange-500 font-bold text-sm">{qty}</span>
            <button onClick={(e) => { e.stopPropagation(); updateQty(item.id, qty + 1); }}
              className="w-6 h-6 flex items-center justify-center text-orange-500 font-bold text-lg hover:bg-orange-500/20 rounded">+</button>
          </div>
        )}
      </div>
    </div>
  );
});

// ── Skeleton ─────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex gap-4 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
      <div className="flex-1 space-y-3">
        <div className="skeleton shimmer h-4 w-16 rounded" />
        <div className="skeleton shimmer h-5 w-48 rounded" />
        <div className="skeleton shimmer h-4 w-20 rounded" />
        <div className="skeleton shimmer h-4 w-full rounded" />
      </div>
      <div className="flex flex-col gap-2 items-center">
        <div className="skeleton shimmer w-28 h-24 rounded-xl" />
        <div className="skeleton shimmer w-28 h-8 rounded-lg" />
      </div>
    </div>
  );
}

// ── Main Content ──────────────────────────────────────────────────────
function MenuContent() {
  const searchParams   = useSearchParams();
  const router         = useRouter();
  const [items, setItems]             = useState<MenuItem[]>([]);
  const [categories, setCategories]   = useState<Category[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [activeCategory, setActiveCategory] = useState(searchParams.get("category") ?? "all");

  // ── Restaurant open/closed status ────────────────────────────────
  const { isOpen, isTemporarilyClosed, openingTimeFormatted, closingTimeFormatted, statusMode } = useRestaurantStatus();

  const totalItems  = useCartStore((s) => s.totalItems());
  const total       = useCartStore((s) => s.total());

  const load = useCallback(async (bustCache = false) => {
    if (!bustCache) {
      const cached = getCache();
      if (cached) { setItems(cached.items); setCategories(cached.categories); setLoading(false); return; }
    } else {
      try { sessionStorage.removeItem(CACHE_KEY); } catch {}
    }
    setLoading(true);
    try {
      // Use server-side API (service role) — direct supabase queries with the anon key
      // go through RLS policies. If get_user_role() recursion is present, the query
      // fails silently (menuItems=null → items=[]) and the customer sees nothing.
      const res  = await fetch("/api/menu", { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) {
        console.error("[menu] API error:", json.error);
        setLoading(false);
        return;
      }
      const result = { categories: json.categories ?? [], items: json.items ?? [] };
      setCache(result as any);
      setCategories(result.categories as any);
      setItems(result.items as any);
    } catch (err) {
      console.error("[menu] Fetch error:", err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();

    // Realtime: bust cache and reload whenever owner adds/updates/deletes a menu item
    const channel = supabase
      .channel("menu-items-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "menu_items" },
        () => { load(true); }   // bust cache on any change
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [load]);

  // ── Active Offer: fetch on mount ─────────────────────────────
  const [activeOffer, setActiveOffer] = useState<ActiveOffer | null>(null);
  useEffect(() => {
    fetch("/api/offers")
      .then(r => r.json())
      .then(d => setActiveOffer(d.offer ?? null))
      .catch(() => {});
  }, []);

  const categoryMap = useMemo(() => new Map(categories.map((c) => [c.slug, c.id])), [categories]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return items.filter((item) => {
      if (search && !item.name.toLowerCase().includes(q) && !item.description?.toLowerCase().includes(q)) return false;
      if (activeCategory !== "all" && categoryMap.get(activeCategory) !== item.category_id) return false;
      return true;
    });
  }, [items, search, activeCategory, categoryMap]);

  // Group by category for display
  const grouped = useMemo(() => {
    if (search || activeCategory !== "all") return [{ label: "Results", items: filtered }];
    const map = new Map<string, { label: string; items: MenuItem[] }>();
    for (const item of items) {
      const cat = categories.find((c) => c.id === item.category_id);
      const key = cat?.slug ?? "other";
      const label = cat ? `${cat.icon} ${cat.name}` : "Other";
      if (!map.has(key)) map.set(key, { label, items: [] });
      map.get(key)!.items.push(item);
    }
    return Array.from(map.values());
  }, [items, categories, search, activeCategory, filtered]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 pb-32">

      {/* ── Restaurant Status Banner ───────────────────────────── */}
      <div
        className="mb-5 rounded-2xl p-4 flex items-center gap-3 transition-all duration-500"
        style={{
          background: isOpen ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)",
          border: `1px solid ${isOpen ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
        }}
      >
        <div
          className={`w-3 h-3 rounded-full shrink-0 ${isOpen ? "bg-green-500" : "bg-red-500"}`}
          style={{ animation: isOpen ? "pulse 2s ease-in-out infinite" : "none" }}
        />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: isOpen ? "#4ade80" : "#f87171" }}>
            {statusMode === "temporarily_closed"
              ? "🔴 Temporarily Closed"
              : isOpen ? "🟢 Restaurant Open" : "🔴 Restaurant Closed"}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            Today&apos;s hours: {openingTimeFormatted} – {closingTimeFormatted}
            {!isOpen && " · Ordering is disabled until we reopen"}
          </p>
        </div>
      </div>

      {/* ── Temporarily Closed Popup ──────────────────────────── */}
      <ClosedPopup isTemporarilyClosed={isTemporarilyClosed} />

      {/* ── Active Offer Banner ───────────────────────────────── */}
      {activeOffer && (
        <div className="mb-5 rounded-2xl overflow-hidden relative"
          style={{ background: "linear-gradient(135deg,#f97316,#dc2626)", boxShadow: "0 4px 24px rgba(249,115,22,0.35)" }}>
          <div className="absolute inset-0 opacity-10"
            style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
          <div className="relative p-4 flex items-center gap-4">
            <div className="text-4xl shrink-0">🎉</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Zap size={14} className="text-yellow-200" />
                <p className="text-xs font-bold text-orange-100 uppercase tracking-wider">Today&apos;s Special Offer</p>
              </div>
              <p className="font-black text-white text-lg leading-tight">
                {activeOffer.discount_type === "percentage"
                  ? `${activeOffer.discount_value}% OFF`
                  : `₹${activeOffer.discount_value} OFF`} — {activeOffer.title}
              </p>
              {activeOffer.description && (
                <p className="text-orange-100 text-sm mt-0.5">{activeOffer.description}</p>
              )}
              {activeOffer.min_order_amount > 0 && (
                <p className="text-orange-200 text-xs mt-1">
                  Min. order: {formatPrice(activeOffer.min_order_amount)}
                  {activeOffer.max_discount_amount ? ` · Max discount: ${formatPrice(activeOffer.max_discount_amount)}` : ""}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right">
              <span className="inline-block px-3 py-1.5 rounded-xl bg-white/20 text-white text-xs font-bold">
                {activeOffer.discount_type === "percentage"
                  ? `${activeOffer.discount_value}% OFF`
                  : `₹${activeOffer.discount_value} OFF`}
              </span>
              <p className="text-orange-200 text-[10px] mt-1">Limited Time</p>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div className="relative mb-5">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search for dishes..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 text-sm transition-colors" />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
        {[{ slug: "all", name: "All", icon: "🍽️" }, ...categories.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }))].map((cat) => (
          <button key={cat.slug} onClick={() => setActiveCategory(cat.slug)}
            className={cn("flex-shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
              activeCategory === cat.slug
                ? "bg-orange-500 text-white"
                : "bg-white/5 text-gray-400 hover:text-white border border-white/8")}>
            <span>{cat.icon}</span>{cat.name}
          </button>
        ))}
      </div>

      {/* Items */}
      {loading ? (
        <div>{Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-5xl mb-4">🔍</div>
          <p className="text-white font-semibold mb-1">No dishes found</p>
          <p className="text-gray-500 text-sm">Try a different search or category</p>
          <button onClick={() => { setSearch(""); setActiveCategory("all"); }}
            className="mt-5 px-5 py-2 rounded-xl text-sm font-medium border border-white/10 text-gray-300 hover:bg-white/5">
            Clear filters
          </button>
        </div>
      ) : (
        grouped.map(({ label, items: gItems }) => (
          <div key={label} className="mb-2">
            {grouped.length > 1 && (
              <h2 className="font-bold text-white text-lg mt-6 mb-1 sticky top-16 py-2 z-10"
                style={{ background: "var(--bg-primary)" }}>
                {label}
                <span className="text-gray-500 text-sm font-normal ml-2">{gItems.length} items</span>
              </h2>
            )}
            <div className="rounded-2xl overflow-hidden px-1"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              {gItems.map((item) => <FoodCard key={item.id} item={item} isOpen={isOpen} />)}

            </div>
          </div>
        ))
      )}

      {/* Sticky Cart Bar */}
      {totalItems > 0 && (
        <div className="fixed bottom-4 left-4 right-4 z-40 max-w-3xl mx-auto">
          <button onClick={() => router.push("/cart")}
            className="w-full flex items-center justify-between px-5 py-4 rounded-2xl shadow-2xl text-white"
            style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
            <div className="flex items-center gap-3">
              <span className="w-7 h-7 bg-white/20 rounded-lg flex items-center justify-center text-sm font-bold">{totalItems}</span>
              <span className="font-semibold">View Cart</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold">{formatPrice(total)}</span>
              <ShoppingCart size={18} />
            </div>
          </button>
        </div>
      )}
    </div>
  );
}

export default function MenuPage() {
  return (
    <Suspense fallback={
      <div className="max-w-3xl mx-auto px-4 py-6">
        {Array.from({ length: 6 }, (_, i) => <SkeletonRow key={i} />)}
      </div>
    }>
      <MenuContent />
    </Suspense>
  );
}
