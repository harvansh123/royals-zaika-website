"use client";
import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  Star, Search, Filter, TrendingUp, TrendingDown,
  MessageSquare, Award, ThumbsUp, Loader2, RefreshCw
} from "lucide-react";
import ReviewCard from "@/components/reviews/ReviewCard";
import RatingBar from "@/components/reviews/RatingBar";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/authStore";
import toast from "react-hot-toast";

const FILTER_OPTIONS = [
  { id: "all", label: "All Stars" },
  { id: "5",   label: "5 ★" },
  { id: "4",   label: "4 ★" },
  { id: "3",   label: "3 ★" },
  { id: "2",   label: "2 ★" },
  { id: "1",   label: "1 ★" },
];

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  return (
    <div className="owner-stat-card rounded-2xl p-4"
      style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
      <div className="flex items-center gap-2 mb-2">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon size={18} style={{ color }} />
        </div>
        <span className="text-xs font-medium" style={{ color: "var(--text-muted)" }}>{label}</span>
      </div>
      <p className="text-2xl font-black" style={{ color: "var(--text-primary)", fontFamily: "'Outfit',sans-serif" }}>
        {value}
      </p>
      {sub && <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>{sub}</p>}
    </div>
  );
}

export default function OwnerReviewsPage() {
  const { user } = useAuthStore();

  const [reviews,    setReviews]    = useState<any[]>([]);
  const [analytics,  setAnalytics]  = useState<any>(null);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(true);
  const [search,     setSearch]     = useState("");
  const [filter,     setFilter]     = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [hasMore,    setHasMore]    = useState(false);

  const fetchReviews = useCallback(async (p: number, s: string, f: string, reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), search: s, filter: f });
      const res  = await fetch(`/api/owner/reviews?${params}`, { credentials: "same-origin" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      if (reset) setReviews(json.reviews ?? []);
      else setReviews((prev) => [...prev, ...(json.reviews ?? [])]);

      setAnalytics(json.analytics);
      setTotal(json.total);
      setHasMore(p * 20 < json.total);
    } catch (e: any) {
      toast.error("Failed to load reviews");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReviews(1, search, filter, true);
    setPage(1);
  }, [search, filter, fetchReviews]);

  // Realtime: new review inserted
  useEffect(() => {
    const channel = supabase
      .channel("owner-reviews-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_reviews" },
        () => { fetchReviews(1, search, filter, true); setPage(1); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [search, filter, fetchReviews]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearch(searchInput.trim());
  }

  function handleDelete(id: string) {
    setReviews((p) => p.filter((r) => r.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  function handleEdited(updated: any) {
    setReviews((p) => p.map((r) => r.id === updated.id ? updated : r));
  }

  function handleLoadMore() {
    const next = page + 1;
    setPage(next);
    fetchReviews(next, search, filter);
  }

  const a = analytics;

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto pb-24">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-black"
            style={{ fontFamily: "'Outfit',sans-serif", color: "var(--text-primary)" }}>
            ⭐ Reviews & Ratings
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--text-muted)" }}>
            {total} total review{total !== 1 ? "s" : ""} — real-time updates
          </p>
        </div>
        <button onClick={() => fetchReviews(1, search, filter, true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all hover:opacity-80"
          style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* Analytics cards */}
      {a && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            <div className="col-span-2 sm:col-span-1 rounded-2xl p-5 flex flex-col items-center justify-center text-center"
              style={{ background: "linear-gradient(135deg,#f97316,#dc2626)", gridRow: "span 1" }}>
              <p className="text-5xl font-black text-white">{a.avgRating.toFixed(1)}</p>
              <div className="flex justify-center gap-0.5 my-1">
                {[1,2,3,4,5].map((s) => (
                  <Star key={s} size={12}
                    className={cn(s <= Math.round(a.avgRating) ? "text-white fill-white" : "text-white/30")} />
                ))}
              </div>
              <p className="text-xs text-white/80">{a.totalCount} reviews</p>
            </div>
            <StatCard icon={Star}       label="Today"      value={a.todayCount}   color="#f59e0b" />
            <StatCard icon={TrendingUp} label="This Week"  value={a.weekCount}    color="#22c55e" />
            <StatCard icon={MessageSquare} label="This Month" value={a.monthCount} color="#3b82f6" />
            <StatCard icon={ThumbsUp}   label="Satisfaction" value={`${a.satisfaction}%`} sub="4★ and above" color="#8b5cf6" />
          </div>

          {/* Rating distribution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
            <div className="rounded-2xl p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <p className="font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Rating Distribution</p>
              <RatingBar distribution={a.distribution} total={a.totalCount} />
            </div>

            <div className="rounded-2xl p-5"
              style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
              <div className="flex gap-4">
                {/* Top rated */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-500 text-sm mb-3 flex items-center gap-1">
                    <Award size={14} /> Top Rated
                  </p>
                  {(a.topItems ?? []).slice(0,4).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2 mb-2">
                      <Star size={11} className="text-yellow-400 fill-yellow-400 shrink-0" />
                      <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                      <span className="text-xs font-bold text-yellow-400 ml-auto shrink-0">{item.rating.toFixed(1)}</span>
                    </div>
                  ))}
                  {(a.topItems ?? []).length === 0 && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>No data yet</p>
                  )}
                </div>
                {/* Low rated */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-red-500 text-sm mb-3 flex items-center gap-1">
                    <TrendingDown size={14} /> Needs Work
                  </p>
                  {(a.bottomItems ?? []).filter((i: any) => i.rating < 4).slice(0,4).map((item: any) => (
                    <div key={item.id} className="flex items-center gap-2 mb-2">
                      <Star size={11} className="text-red-400 fill-red-400 shrink-0" />
                      <span className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>{item.name}</span>
                      <span className="text-xs font-bold text-red-400 ml-auto shrink-0">{item.rating.toFixed(1)}</span>
                    </div>
                  ))}
                  {(a.bottomItems ?? []).filter((i: any) => i.rating < 4).length === 0 && (
                    <p className="text-xs" style={{ color: "var(--text-muted)" }}>All items doing great!</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Search + Filter */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <form onSubmit={handleSearch} className="flex-1 min-w-[200px] relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: "var(--text-muted)" }} />
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search reviews…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none"
            style={{
              background: "var(--bg-glass)",
              border: "1px solid var(--border)",
              color: "var(--text-primary)",
            }}
          />
        </form>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {FILTER_OPTIONS.map((opt) => (
            <button key={opt.id} onClick={() => { setFilter(opt.id); setPage(1); }}
              className="flex-shrink-0 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
              style={filter === opt.id
                ? { background: "linear-gradient(135deg,#f97316,#dc2626)", color: "#fff" }
                : { background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews */}
      {loading && reviews.length === 0 ? (
        <div className="flex justify-center py-16">
          <Loader2 size={32} className="animate-spin text-orange-500" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-20 rounded-2xl"
          style={{ background: "var(--card-bg)", border: "1px solid var(--border)" }}>
          <Star size={48} className="mx-auto mb-4 text-gray-300" />
          <p className="text-lg font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No reviews found</p>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            {search ? "Try a different search term" : "Reviews from customers will appear here"}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              showItemRatings={true}
              isOwner={true}
              onDeleted={handleDelete}
              onEdited={handleEdited}
            />
          ))}
          {hasMore && (
            <button onClick={handleLoadMore} disabled={loading}
              className="w-full py-3 rounded-2xl text-sm font-medium transition-all hover:opacity-80 disabled:opacity-50"
              style={{ background: "var(--bg-secondary)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              {loading ? <Loader2 size={16} className="animate-spin mx-auto" /> : "Load More"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
