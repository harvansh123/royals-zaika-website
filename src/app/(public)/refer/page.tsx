"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { Gift, Copy, Share2, CheckCircle, Clock, XCircle, ChevronRight, Trophy, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

type ReferralData = {
  enabled: boolean;
  code: string;
  shareLink: string;
  settings: any;
  stats: { completedCount: number; pendingCount: number; maxReached: boolean; maxReferrals: number };
  referrals: any[];
  rewards: any[];
  bestReward: any | null;
};

const MILESTONES = [
  { count: 1,  amount: 25  },
  { count: 3,  amount: 40  },
  { count: 5,  amount: 65  },
  { count: 10, amount: 150 },
];

export default function ReferPage() {
  const { user, loading } = useAuthStore();
  const router = useRouter();
  const [data, setData]     = useState<ReferralData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [copied, setCopied] = useState(false);

  const loadData = useCallback(async () => {
    setFetching(true);
    try {
      const res = await fetch("/api/referral/my-referrals");
      const json = await res.json();
      setData(json);
    } catch { /* silent */ }
    finally { setFetching(false); }
  }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) { router.push("/auth/login"); return; }
    loadData();
  }, [user, loading, router, loadData]);

  const copyCode = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code).then(() => {
      setCopied(true);
      toast.success("Referral code copied!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareLink = async () => {
    if (!data?.shareLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Royal Zaika — Join & Get Discount!",
          text: `Use my referral code ${data.code} to sign up on Royal Zaika and get amazing food! 🍱`,
          url: data.shareLink,
        });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(data.shareLink);
      toast.success("Share link copied!");
    }
  };

  if (loading || fetching) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data?.enabled) return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="text-5xl mb-4">🚫</div>
      <h1 className="text-xl font-bold text-white mb-2">Referral Program Inactive</h1>
      <p className="text-gray-400 text-sm">The referral program is currently paused. Check back later!</p>
      <Link href="/menu" className="mt-6 inline-block btn-primary px-6 py-2 rounded-xl text-sm">Back to Menu</Link>
    </div>
  );

  const { code, shareLink: sLink, stats, referrals, rewards } = data!;
  const completedCount = stats.completedCount;
  const maxReached     = stats.maxReached;

  const unusedRewards  = rewards.filter((r: any) => r.status === "unused");
  const totalEarned    = rewards.filter((r: any) => r.status !== "revoked").reduce((s: number, r: any) => s + Number(r.reward_amount), 0);
  const totalUsed      = rewards.filter((r: any) => r.status === "used").reduce((s: number, r: any) => s + Number(r.reward_amount), 0);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24">

      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 shadow-brand">
          🎁
        </div>
        <h1 className="text-2xl font-black text-white mb-1">Refer & Earn</h1>
        <p className="text-gray-400 text-sm">Invite friends, earn rewards on every milestone!</p>
      </div>

      {/* Milestone Banner */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
        <p className="text-xs uppercase tracking-widest text-orange-400 font-semibold mb-3">🏆 Reward Milestones</p>
        <div className="grid grid-cols-2 gap-2">
          {MILESTONES.map((m) => {
            const reached = completedCount >= m.count;
            const rewarded = rewards.some((r: any) => r.milestone === m.count && r.status !== "revoked");
            return (
              <div key={m.count}
                className="rounded-xl p-3 text-center"
                style={{
                  background: reached ? "linear-gradient(135deg,rgba(249,115,22,0.15),rgba(220,38,38,0.1))" : "var(--bg-secondary)",
                  border: reached ? "1px solid rgba(249,115,22,0.4)" : "1px solid var(--border)",
                }}>
                <p className="text-xs text-gray-400 mb-0.5">{m.count} referral{m.count > 1 ? "s" : ""}</p>
                <p className="font-black text-lg" style={{ color: reached ? "#f97316" : "var(--text-secondary)" }}>
                  ₹{m.amount} OFF
                </p>
                {rewarded && <p className="text-xs text-green-400 mt-0.5">✓ Earned</p>}
                {reached && !rewarded && <p className="text-xs text-orange-300 mt-0.5">Pending…</p>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Referral Code Card */}
      {maxReached ? (
        <div className="rounded-2xl p-5 mb-4 text-center" style={{ background: "linear-gradient(135deg,rgba(220,38,38,0.1),rgba(249,115,22,0.08))", border: "1px solid rgba(220,38,38,0.3)" }}>
          <Trophy size={28} className="text-orange-400 mx-auto mb-2" />
          <p className="font-bold text-white text-sm">Referral Reward Limit Reached</p>
          <p className="text-xs text-gray-400 mt-1">You've referred {stats.maxReferrals} friends — no more referral rewards. Thank you! 🎉</p>
        </div>
      ) : (
        <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
          <p className="text-xs text-gray-400 mb-2">Your unique referral code</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 rounded-xl px-4 py-3 text-center font-black text-2xl tracking-widest text-orange-400"
              style={{ background: "var(--bg-secondary)", border: "1px solid rgba(249,115,22,0.3)", letterSpacing: "0.15em" }}>
              {code}
            </div>
            <button onClick={copyCode}
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all"
              style={{ background: copied ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)", border: "1px solid", borderColor: copied ? "rgba(34,197,94,0.4)" : "rgba(249,115,22,0.3)" }}>
              {copied ? <CheckCircle size={18} className="text-green-400" /> : <Copy size={18} className="text-orange-400" />}
            </button>
          </div>
          <button onClick={shareLink}
            className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold">
            <Share2 size={16} /> Share Invite Link
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Share link auto-fills code for new signups
          </p>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Completed", value: stats.completedCount, color: "text-green-400" },
          { label: "Pending",   value: stats.pendingCount,   color: "text-yellow-400" },
          { label: "Rewards",   value: `₹${totalEarned}`,   color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
            <p className={`font-black text-xl ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Available Rewards */}
      {unusedRewards.length > 0 && (
        <div className="rounded-2xl p-4 mb-4" style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(220,38,38,0.08))", border: "1px solid rgba(249,115,22,0.35)" }}>
          <p className="text-xs uppercase tracking-widest text-orange-400 font-semibold mb-3">🎉 Your Available Rewards</p>
          <div className="space-y-2">
            {unusedRewards.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-sm">₹{r.reward_amount} OFF your next order</p>
                  {r.expires_at && <p className="text-xs text-gray-400">Expires {new Date(r.expires_at).toLocaleDateString("en-IN")}</p>}
                </div>
                <div className="text-xs bg-green-500/15 text-green-400 px-2 py-1 rounded-lg border border-green-500/25">Active</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">✓ Auto-applied at checkout if bigger than any active offer</p>
        </div>
      )}

      {/* Referral History */}
      {referrals.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-3" style={{ background: "var(--bg-glass)", borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold">Referral History</p>
          </div>
          <div className="divide-y divide-white/5">
            {referrals.slice(0, 10).map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3" style={{ background: "var(--bg-secondary)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: r.status === "completed" ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.1)" }}>
                  {r.status === "completed"
                    ? <CheckCircle size={16} className="text-green-400" />
                    : r.status === "revoked"
                    ? <XCircle size={16} className="text-red-400" />
                    : <Clock size={16} className="text-yellow-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{r.referred?.name ?? "—"}</p>
                  <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString("en-IN")}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                  r.status === "completed" ? "bg-green-500/10 text-green-400 border-green-500/20"
                  : r.status === "revoked"  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                }`}>{r.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-2xl p-4" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
        <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">How It Works</p>
        {[
          { step: "1", text: "Share your unique referral code or link" },
          { step: "2", text: "Friend signs up using your code" },
          { step: "3", text: "Friend places and completes their first order" },
          { step: "4", text: "You earn reward based on milestone reached!" },
        ].map((s) => (
          <div key={s.step} className="flex items-start gap-3 mb-2 last:mb-0">
            <div className="w-6 h-6 rounded-full gradient-brand flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5">{s.step}</div>
            <p className="text-sm text-gray-300">{s.text}</p>
          </div>
        ))}
        <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <p className="text-xs text-gray-500">⚠️ Only first delivered order counts. Max {data?.settings?.max_referrals ?? 10} referrals per account. Rewards apply only on food orders (not delivery fee). Reward or offer — whichever is bigger applies.</p>
        </div>
      </div>
    </div>
  );
}
