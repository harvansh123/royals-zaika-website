"use client";
import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { Copy, Share2, CheckCircle, Clock, XCircle, Gift } from "lucide-react";
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
  const [data, setData]       = useState<ReferralData | null>(null);
  const [fetching, setFetching] = useState(true);
  const [copied, setCopied]   = useState(false);

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
      toast.success("Code copy ho gaya!");
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareLink = async () => {
    if (!data?.shareLink) return;
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Royal Zaika — Join karo aur discount pao!",
          text: `Mera referral code use karo: ${data.code} — Royal Zaika par signup karo aur tasty khana order karo! 🍱`,
          url: data.shareLink,
        });
      } catch { /* user cancelled */ }
    } else {
      navigator.clipboard.writeText(data.shareLink);
      toast.success("Link copy ho gaya!");
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
      <h1 className="text-xl font-bold text-white mb-2">Referral Program Band Hai</h1>
      <p className="text-gray-400 text-sm">Abhi yeh feature available nahi hai. Baad mein dobara check karo!</p>
      <Link href="/menu" className="mt-6 inline-block btn-primary px-6 py-2 rounded-xl text-sm">Menu Dekho</Link>
    </div>
  );

  const { code, shareLink: sLink, stats, referrals, rewards } = data!;
  const completedCount = stats.completedCount;
  const maxReached     = stats.maxReached;
  const unusedRewards  = rewards.filter((r: any) => r.status === "unused");
  const totalEarned    = rewards.filter((r: any) => r.status !== "revoked").reduce((s: number, r: any) => s + Number(r.reward_amount), 0);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 pb-24">

      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 gradient-brand rounded-2xl flex items-center justify-center text-3xl mx-auto mb-3 shadow-brand">
          🎁
        </div>
        <h1 className="text-2xl font-black text-white mb-1">Dosto ko Invite Karo</h1>
        <p className="text-gray-400 text-sm">Har dost ke pehle order par aapko discount milega!</p>
      </div>

      {/* How it works — simple 3 steps */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-3">Kaise Kaam Karta Hai?</p>
        <div className="space-y-3">
          {[
            { icon: "1️⃣", text: "Apna referral code copy karo ya link share karo" },
            { icon: "2️⃣", text: "Dost aapke code se signup kare" },
            { icon: "3️⃣", text: "Dost ka pehla order deliver ho — aapko discount mil gaya! 🎉" },
          ].map((s) => (
            <div key={s.icon} className="flex items-start gap-3">
              <span className="text-lg leading-none mt-0.5">{s.icon}</span>
              <p className="text-sm text-gray-300">{s.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Milestone Rewards */}
      <div className="rounded-2xl p-4 mb-4" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-3">Kitne Dost = Kitna Discount?</p>
        <div className="grid grid-cols-2 gap-2">
          {MILESTONES.map((m) => {
            const reached   = completedCount >= m.count;
            const rewarded  = rewards.some((r: any) => r.milestone === m.count && r.status !== "revoked");
            return (
              <div key={m.count}
                className="rounded-xl p-3 text-center"
                style={{
                  background: reached
                    ? "linear-gradient(135deg,rgba(249,115,22,0.18),rgba(220,38,38,0.1))"
                    : "var(--bg-secondary)",
                  border: reached ? "1px solid rgba(249,115,22,0.4)" : "1px solid var(--border)",
                }}>
                <p className="text-xs text-gray-400 mb-0.5">
                  {m.count} dost {m.count > 1 ? "" : ""}
                </p>
                <p className="font-black text-lg" style={{ color: reached ? "#f97316" : "var(--text-secondary)" }}>
                  ₹{m.amount} OFF
                </p>
                {rewarded
                  ? <p className="text-[10px] text-green-400 mt-0.5">✓ Mil gaya!</p>
                  : reached
                  ? <p className="text-[10px] text-orange-300 mt-0.5">Processing…</p>
                  : <p className="text-[10px] text-gray-500 mt-0.5">{m.count - completedCount} aur chahiye</p>
                }
              </div>
            );
          })}
        </div>
        <p className="text-xs text-gray-500 text-center mt-3">
          ⚠️ Max 10 dosto ke baad referral reward milna band ho jayega
        </p>
      </div>

      {/* Referral Code Card */}
      {maxReached ? (
        <div className="rounded-2xl p-5 mb-4 text-center"
          style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.1),rgba(220,38,38,0.08))", border: "1px solid rgba(249,115,22,0.3)" }}>
          <p className="text-2xl mb-2">🏆</p>
          <p className="font-bold text-white text-sm">Badhaai ho! Aapne 10 dosto ko invite kar diya</p>
          <p className="text-xs text-gray-400 mt-1">Referral reward limit complete — thank you! 🎉</p>
        </div>
      ) : (
        <div className="rounded-2xl p-5 mb-4" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
          <p className="text-xs text-gray-400 mb-2">Aapka referral code</p>
          <div className="flex items-center gap-3 mb-3">
            <div className="flex-1 rounded-xl px-4 py-3 text-center font-black text-2xl text-orange-400"
              style={{
                background: "var(--bg-secondary)",
                border: "1px solid rgba(249,115,22,0.3)",
                letterSpacing: "0.15em",
              }}>
              {code}
            </div>
            <button onClick={copyCode}
              className="w-12 h-12 rounded-xl flex items-center justify-center transition-all"
              style={{
                background: copied ? "rgba(34,197,94,0.15)" : "rgba(249,115,22,0.15)",
                border: "1px solid",
                borderColor: copied ? "rgba(34,197,94,0.4)" : "rgba(249,115,22,0.3)",
              }}>
              {copied
                ? <CheckCircle size={18} className="text-green-400" />
                : <Copy size={18} className="text-orange-400" />}
            </button>
          </div>
          <button onClick={shareLink}
            className="w-full btn-primary py-3 rounded-xl flex items-center justify-center gap-2 text-sm font-semibold">
            <Share2 size={16} /> Dost ko Share Karo
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            Link share karne par code auto-fill ho jayega 👆
          </p>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: "Successful",  value: stats.completedCount, color: "text-green-400"  },
          { label: "Pending",     value: stats.pendingCount,   color: "text-yellow-400" },
          { label: "Total Earned",value: `₹${totalEarned}`,   color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-3 text-center"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
            <p className={`font-black text-xl ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Available Rewards */}
      {unusedRewards.length > 0 && (
        <div className="rounded-2xl p-4 mb-4"
          style={{ background: "linear-gradient(135deg,rgba(249,115,22,0.12),rgba(220,38,38,0.08))", border: "1px solid rgba(249,115,22,0.35)" }}>
          <p className="text-xs font-semibold text-orange-400 uppercase tracking-wider mb-3">🎉 Aapke Available Rewards</p>
          <div className="space-y-2">
            {unusedRewards.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-white text-sm">₹{r.reward_amount} OFF aapke agle order par</p>
                  {r.expires_at && (
                    <p className="text-xs text-gray-400">
                      Expire: {new Date(r.expires_at).toLocaleDateString("en-IN")} tak
                    </p>
                  )}
                </div>
                <div className="text-xs bg-green-500/15 text-green-400 px-2 py-1 rounded-lg border border-green-500/25">
                  Active
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            ✓ Checkout par automatically apply ho jayega (jo bada discount hoga wahi lagega)
          </p>
        </div>
      )}

      {/* Referral History */}
      {referrals.length > 0 && (
        <div className="rounded-2xl overflow-hidden mb-4" style={{ border: "1px solid var(--border)" }}>
          <div className="px-4 py-3" style={{ background: "var(--bg-glass)", borderBottom: "1px solid var(--border)" }}>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Aapke Referrals</p>
          </div>
          <div className="divide-y divide-white/5">
            {referrals.slice(0, 10).map((r: any) => (
              <div key={r.id} className="px-4 py-3 flex items-center gap-3"
                style={{ background: "var(--bg-secondary)" }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{
                    background: r.status === "completed"
                      ? "rgba(34,197,94,0.15)"
                      : "rgba(249,115,22,0.1)",
                  }}>
                  {r.status === "completed"
                    ? <CheckCircle size={16} className="text-green-400" />
                    : r.status === "revoked"
                    ? <XCircle size={16} className="text-red-400" />
                    : <Clock size={16} className="text-yellow-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {r.referred?.name ?? "—"}
                  </p>
                  <p className="text-xs text-gray-400">
                    {new Date(r.created_at).toLocaleDateString("en-IN")}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full border capitalize ${
                  r.status === "completed"
                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : r.status === "revoked"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                }`}>
                  {r.status === "completed" ? "Complete ✓"
                    : r.status === "revoked"  ? "Cancelled"
                    : "Pending…"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rules - Simple */}
      <div className="rounded-2xl p-4" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Zaroori Baatein</p>
        <ul className="space-y-2">
          {[
            "Sirf naye account par hi referral count hoga",
            "Dost ka pehla order successfully deliver hone par reward milega",
            "Cancel ya fail order referral mein count nahi hoga",
            "Referral reward ya offer — dono mein se jo bada hoga wahi lagega",
            "Max 10 dosto tak reward milega — uske baad band ho jayega",
          ].map((rule, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-400">
              <span className="text-orange-500 mt-0.5 flex-shrink-0">•</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
