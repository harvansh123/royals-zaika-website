"use client";
import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Star, SlidersHorizontal } from "lucide-react";
import ReviewCard from "@/components/reviews/ReviewCard";
import RatingBar from "@/components/reviews/RatingBar";
import { cn } from "@/lib/utils";

const SORT_OPTIONS = [
  { id: "latest",  label: "Latest"         },
  { id: "highest", label: "Highest Rating"  },
  { id: "lowest",  label: "Lowest Rating"   },
  { id: "helpful", label: "Most Helpful"    },
];

export default function MenuItemReviewsPage({ params }: { params: Promise<{ menuItemId: string }> }) {
  const { menuItemId } = use(params);
  const router = useRouter();

  const [reviews,  setReviews]  = useState<any[]>([]);
  const [stats,    setStats]    = useState<{ avg: number; count: number; distribution: Record<number, number> } | null>(null);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [sort,     setSort]     = useState("latest");
  const [loading,  setLoading]  = useState(true);
  const [itemName, setItemName] = useState("");
  const [itemImg,  setItemImg]  = useState<string | null>(null);
  const [hasMore,  setHasMore]  = useState(false);

  useEffect(() => { loadReviews(1, sort, true); }, [sort, menuItemId]);

  async function loadReviews(p: number, s: string, reset = false) {
    setLoading(true);
    try {
      const res  = await fetch(`/api/reviews?menuItemId=${menuItemId}&page=${p}&sort=${s}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      setStats(json.stats);
      setTotal(json.total);
      setHasMore(p * 10 < json.total);
      setReviews(reset ? (json.reviews ?? []) : (prev) => [...prev, ...(json.reviews ?? [])]);

      // Extract item name from first review's item_ratings
      if (json.reviews?.[0]?.review_item_ratings) {
        const ir = json.reviews[0].review_item_ratings.find((r: any) => r.menu_item_id === menuItemId);
        if (ir?.menu_items) {
          setItemName(ir.menu_items.name);
          setItemImg(ir.menu_items.image_url);
        }
      }
    } catch (e: any) {
      console.error(e);
    }
    setLoading(false);
  }

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    loadReviews(next, sort);
  }

  function handleSortChange(s: string) {
    setSort(s);
    setPage(1);
  }

  function handleDelete(id: string) {
    setReviews((p) => p.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  function handleEdited(updated: any) {
    setReviews((p) => p.map((r) => r.id === updated.id ? updated : r));
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 pb-24">

      {/* Back */}
      <button onClick={() => router.back()}
        className="flex items-center gap-2 mb-5 text-sm transition-colors hover:opacity-70"
        style={{ color: "var(--text-secondary)" }}>
        <ChevronLeft size={18} /> Back to Menu
      </button>

      {/* Item header */}
      <div className="rounded-2xl p-5 mb-5 flex items-center gap-4"
        style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
        {itemImg ? (
          <img src={itemImg} alt={itemName} className="w-16 h-16 rounded-xl object-cover shrink-0" />
        ) : (
          <div className="w-16 h-16 rounded-xl flex items-center justify-center text-3xl shrink-0"
            style={{ background: "var(--bg-secondary)" }}>🍽️</div>
        )}
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg sm:text-xl truncate"
            style={{ fontFamily: "'Outfit',sans-serif", color: "var(--text-primary)" }}>
            {itemName || "Menu Item"}
          </h1>
          {stats && stats.count > 0 && (
            <div className="flex items-center gap-2 mt-1">
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
              <span className="font-bold text-yellow-400">{stats.avg.toFixed(1)}</span>
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                ({total} review{total !== 1 ? "s" : ""})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Rating stats */}
      {stats && stats.count > 0 && (
        <div className="rounded-2xl p-5 mb-5 flex gap-6 flex-wrap"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <div className="text-center">
            <p className="text-5xl font-black text-yellow-400">{stats.avg.toFixed(1)}</p>
            <div className="flex justify-center gap-0.5 my-1">
              {[1,2,3,4,5].map((s) => (
                <Star key={s} size={14}
                  className={cn(s <= Math.round(stats.avg) ? "text-yellow-400 fill-yellow-400" : "text-gray-300")} />
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              {stats.count} rating{stats.count !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex-1 min-w-[160px]">
            <RatingBar distribution={stats.distribution} total={stats.count} />
          </div>
        </div>
      )}

      {/* Sort + Count */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <p className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {total} Review{total !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <SlidersHorizontal size={14} style={{ color: "var(--text-muted)" }} />
          {SORT_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => handleSortChange(opt.id)}
              className="flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all"
              style={sort === opt.id
                ? { background: "linear-gradient(135deg,#f97316,#dc2626)", color: "#fff" }
                : { background: "var(--bg-glass)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      {loading && reviews.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-orange-500" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 rounded-2xl"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <Star size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No reviews yet</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Be the first to review this dish!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              showItemRatings={false}
              onDeleted={handleDelete}
              onEdited={handleEdited}
            />
          ))}
          {hasMore && (
            <button onClick={handleLoadMore} disabled={loading}
              className="w-full py-3 rounded-2xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Load More Reviews"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
