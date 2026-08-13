"use client";
import { useEffect, useState, useCallback } from "react";
import { Gift, Users, CheckCircle, Clock, XCircle, AlertTriangle, TrendingUp, RefreshCw, ToggleLeft, ToggleRight, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";

type OwnerReferralData = {
  settings: any;
  stats: {
    totalReferrals: number;
    completedReferrals: number;
    pendingReferrals: number;
    rejectedReferrals: number;
    totalRewardsIssued: number;
    totalRewardsRedeemed: number;
  };
  referrals: any[];
  rewards: any[];
};

export default function OwnerReferralsPage() {
  const [data, setData]       = useState<OwnerReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [tab, setTab]         = useState<"overview" | "referrals" | "rewards">("overview");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [localSettings, setLocalSettings] = useState<any>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/owner/referrals");
      const json = await res.json();
      setData(json);
      setLocalSettings(json.settings);
    } catch { toast.error("Failed to load referral data"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleEnabled = async () => {
    if (!localSettings) return;
    const newVal = !localSettings.is_enabled;
    setLocalSettings((p: any) => ({ ...p, is_enabled: newVal }));
    const res = await fetch("/api/owner/referrals", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_settings", settings: { is_enabled: newVal } }),
    });
    if (!res.ok) { toast.error("Failed to update"); loadData(); }
    else toast.success(newVal ? "Referral program enabled" : "Referral program paused");
  };

  const saveSettings = async () => {
    if (!localSettings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/owner/referrals", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_settings", settings: localSettings }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Settings saved!");
      loadData();
    } catch { toast.error("Could not save settings"); }
    finally { setSaving(false); }
  };

  const revokeReward = async (rewardId: string) => {
    if (!confirm("Revoke this reward? The customer won't be able to use it.")) return;
    const res = await fetch("/api/owner/referrals", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "revoke_reward", rewardId }),
    });
    if (res.ok) { toast.success("Reward revoked"); loadData(); }
    else toast.error("Failed to revoke");
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const { stats, referrals, rewards, settings } = data!;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-10">

      {/* Header */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Gift className="text-orange-400" size={24} /> Referral Program
          </h1>
          <p className="text-sm text-gray-400 mt-0.5">Track referrals, rewards and program settings</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData}
            className="px-3 py-2 rounded-xl text-sm flex items-center gap-1.5 text-gray-300 hover:text-white transition-all"
            style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
            <RefreshCw size={14} /> Refresh
          </button>
          {/* Enable/Disable toggle */}
          <button onClick={toggleEnabled}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: localSettings?.is_enabled ? "rgba(249,115,22,0.15)" : "rgba(100,100,120,0.2)",
              border: `1px solid ${localSettings?.is_enabled ? "rgba(249,115,22,0.4)" : "var(--border)"}`,
              color: localSettings?.is_enabled ? "#f97316" : "var(--text-secondary)",
            }}>
            {localSettings?.is_enabled
              ? <><ToggleRight size={16} /> Program Active</>
              : <><ToggleLeft size={16} /> Program Paused</>}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total Referrals",    value: stats.totalReferrals,     color: "text-white"       },
          { label: "Completed",          value: stats.completedReferrals,  color: "text-green-400"   },
          { label: "Pending",            value: stats.pendingReferrals,    color: "text-yellow-400"  },
          { label: "Rewards Issued",     value: `₹${stats.totalRewardsIssued.toFixed(0)}`, color: "text-orange-400" },
          { label: "Rewards Redeemed",   value: `₹${stats.totalRewardsRedeemed.toFixed(0)}`, color: "text-purple-400" },
          { label: "Outstanding",        value: `₹${(stats.totalRewardsIssued - stats.totalRewardsRedeemed).toFixed(0)}`, color: "text-red-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Settings panel */}
      <div className="rounded-2xl mb-6 overflow-hidden" style={{ border: "1px solid var(--border)" }}>
        <button onClick={() => setSettingsOpen(!settingsOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-left transition-all"
          style={{ background: "var(--bg-glass)" }}>
          <span className="font-semibold text-white text-sm">⚙️ Program Settings</span>
          {settingsOpen ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
        </button>
        {settingsOpen && localSettings && (
          <div className="px-5 py-4 space-y-4" style={{ background: "var(--bg-secondary)" }}>
            <div className="grid grid-cols-2 gap-4">
              {[
                { key: "max_referrals",    label: "Max Referrals Per User", type: "number" },
                { key: "min_order_amount", label: "Min Order Amount (₹)",   type: "number" },
                { key: "reward_expiry_days", label: "Reward Expiry (days)", type: "number" },
              ].map((f) => (
                <div key={f.key}>
                  <label className="text-xs text-gray-400 block mb-1">{f.label}</label>
                  <input type={f.type} value={localSettings[f.key] ?? ""}
                    onChange={(e) => setLocalSettings((p: any) => ({ ...p, [f.key]: Number(e.target.value) }))}
                    className="input-field w-full text-sm" />
                </div>
              ))}
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-2 font-semibold">Milestone Rewards</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { numKey: "reward_milestone_1",  amtKey: "reward_amount_1",  label: "Milestone 1" },
                  { numKey: "reward_milestone_3",  amtKey: "reward_amount_3",  label: "Milestone 2" },
                  { numKey: "reward_milestone_5",  amtKey: "reward_amount_5",  label: "Milestone 3" },
                  { numKey: "reward_milestone_10", amtKey: "reward_amount_10", label: "Milestone 4" },
                ].map((m) => (
                  <div key={m.numKey} className="rounded-xl p-3" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
                    <p className="text-xs text-gray-400 mb-2">{m.label}</p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">At # referrals</label>
                        <input type="number" value={localSettings[m.numKey] ?? ""}
                          onChange={(e) => setLocalSettings((p: any) => ({ ...p, [m.numKey]: Number(e.target.value) }))}
                          className="input-field w-full text-xs mt-0.5" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500">Reward (₹)</label>
                        <input type="number" value={localSettings[m.amtKey] ?? ""}
                          onChange={(e) => setLocalSettings((p: any) => ({ ...p, [m.amtKey]: Number(e.target.value) }))}
                          className="input-field w-full text-xs mt-0.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <button onClick={saveSettings} disabled={saving}
              className="btn-primary px-6 py-2 rounded-xl text-sm font-semibold">
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        )}
      </div>

      {/* Tab navigation */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(["overview", "referrals", "rewards"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all ${
              tab === t ? "bg-orange-500 text-white" : ""
            }`}
            style={tab !== t ? { background: "var(--bg-glass)", border: "1px solid var(--border)", color: "var(--text-secondary)" } : {}}>
            {t}
          </button>
        ))}
      </div>

      {/* Referrals Tab */}
      {tab === "referrals" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {referrals.length === 0
            ? <div className="p-8 text-center text-gray-400">No referrals yet</div>
            : (
            <div className="divide-y divide-white/5">
              <div className="grid grid-cols-4 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500"
                style={{ background: "var(--bg-glass)" }}>
                <span>Referrer</span><span>Referred</span><span>Date</span><span>Status</span>
              </div>
              {referrals.map((r: any) => (
                <div key={r.id} className="grid grid-cols-4 items-center px-4 py-3 text-sm"
                  style={{ background: "var(--bg-secondary)" }}>
                  <div>
                    <p className="text-white font-medium truncate">{r.referrer?.name ?? "—"}</p>
                    <p className="text-xs text-gray-400 truncate">{r.referrer?.email ?? ""}</p>
                  </div>
                  <div>
                    <p className="text-white truncate">{r.referred?.name ?? "—"}</p>
                    <p className="text-xs text-gray-400 truncate">{r.referred?.email ?? ""}</p>
                  </div>
                  <p className="text-gray-400 text-xs">{new Date(r.created_at).toLocaleDateString("en-IN")}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full border w-fit capitalize ${
                    r.status === "completed" ? "bg-green-500/10 text-green-400 border-green-500/20"
                    : r.status === "revoked"  ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                  }`}>{r.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Rewards Tab */}
      {tab === "rewards" && (
        <div className="rounded-2xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
          {rewards.length === 0
            ? <div className="p-8 text-center text-gray-400">No rewards issued yet</div>
            : (
            <div className="divide-y divide-white/5">
              <div className="grid grid-cols-5 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-gray-500"
                style={{ background: "var(--bg-glass)" }}>
                <span>Customer</span><span>Milestone</span><span>Amount</span><span>Expires</span><span>Action</span>
              </div>
              {rewards.map((r: any) => (
                <div key={r.id} className="grid grid-cols-5 items-center px-4 py-3 text-sm"
                  style={{ background: "var(--bg-secondary)" }}>
                  <div>
                    <p className="text-white font-medium truncate">{r.referrer?.name ?? "—"}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full border capitalize ${
                      r.status === "used"    ? "bg-green-500/10 text-green-400 border-green-500/20"
                      : r.status === "unused" ? "bg-orange-500/10 text-orange-400 border-orange-500/20"
                      : r.status === "expired"? "bg-gray-500/10 text-gray-400 border-gray-500/20"
                      : "bg-red-500/10 text-red-400 border-red-500/20"
                    }`}>{r.status}</span>
                  </div>
                  <p className="text-gray-300">Milestone {r.milestone}</p>
                  <p className="font-bold text-orange-400">₹{r.reward_amount}</p>
                  <p className="text-gray-400 text-xs">
                    {r.expires_at ? new Date(r.expires_at).toLocaleDateString("en-IN") : "—"}
                  </p>
                  {r.status === "unused" ? (
                    <button onClick={() => revokeReward(r.id)}
                      className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded-lg border border-red-500/20 transition-all"
                      style={{ background: "rgba(220,38,38,0.08)" }}>
                      Revoke
                    </button>
                  ) : <span />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-3">
          <div className="rounded-2xl p-5" style={{ background: "var(--bg-glass)", border: "1px solid var(--border)" }}>
            <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-4">Current Milestone Config</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { n: settings?.reward_milestone_1,  a: settings?.reward_amount_1  },
                { n: settings?.reward_milestone_3,  a: settings?.reward_amount_3  },
                { n: settings?.reward_milestone_5,  a: settings?.reward_amount_5  },
                { n: settings?.reward_milestone_10, a: settings?.reward_amount_10 },
              ].map((m, i) => (
                <div key={i} className="rounded-xl p-3 text-center"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <p className="text-xs text-gray-400">{m.n} referral{m.n > 1 ? "s" : ""}</p>
                  <p className="font-black text-lg text-orange-400">₹{m.a} OFF</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 mt-3">
              {[
                { label: "Max Referrals",  value: settings?.max_referrals     },
                { label: "Min Order (₹)",  value: settings?.min_order_amount  },
                { label: "Expiry (days)",  value: settings?.reward_expiry_days },
              ].map((f) => (
                <div key={f.label} className="rounded-xl p-3 text-center"
                  style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                  <p className="text-lg font-bold text-white">{f.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{f.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl p-4" style={{ background: "var(--bg-glass)", border: "1px solid rgba(249,115,22,0.2)" }}>
            <p className="text-xs text-orange-400 font-semibold mb-2">ℹ️ How Rewards Work</p>
            <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
              <li>Reward issued when referred user's first order is marked <strong className="text-white">Delivered</strong></li>
              <li>Max {settings?.max_referrals ?? 10} successful referrals per customer</li>
              <li>Rewards expire {settings?.reward_expiry_days ?? 90} days after issue</li>
              <li>Offer OR referral reward applies — whichever is bigger</li>
              <li>Self-referral and duplicate referrals are blocked by the system</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
