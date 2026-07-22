"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuthStore } from "@/stores/authStore";
import { useRouter } from "next/navigation";
import { Loader2, DollarSign, Activity, TrendingUp, Search, Calendar, Bike, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface EarningLog {
  id: string;
  payout_amount: number;
  distance_km: number;
  distance_range: string;
  earned_at: string;
  order_id: string;
  orders: { order_number: string; total_amount: number };
  users: { name: string; phone: string };
}

export default function EarningsAnalyticsPage() {
  const { user, loading: authLoading } = useAuthStore();
  const router = useRouter();

  const [logs, setLogs] = useState<EarningLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"all" | "today" | "week" | "month">("month");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || (user.role !== "restaurant_owner" && user.role !== "admin"))) {
      router.push("/auth/login");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.role === "restaurant_owner" || user?.role === "admin") {
      fetchLogs();
    }
  }, [user, period]);

  async function fetchLogs() {
    setLoading(true);
    try {
      const res = await fetch(`/api/owner/rider-earnings?period=${period}`);
      const json = await res.json();
      if (res.ok) setLogs(json.data ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const filteredLogs = useMemo(() => {
    return logs.filter(l => 
      !searchQuery || 
      l.users?.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      l.orders?.order_number.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [logs, searchQuery]);

  const summary = useMemo(() => {
    let totalPayout = 0;
    let totalDeliveries = 0;
    let totalDistance = 0;

    for (const l of filteredLogs) {
      totalPayout += l.payout_amount || 0;
      totalDeliveries += 1;
      totalDistance += l.distance_km || 0;
    }
    return { totalPayout, totalDeliveries, totalDistance };
  }, [filteredLogs]);

  // Aggregate by rider
  const riderAggregations = useMemo(() => {
    const map = new Map<string, { name: string, phone: string, payout: number, count: number }>();
    for (const l of filteredLogs) {
      const p = l.users;
      if (!p) continue;
      const key = p.phone; // use phone as unique identifier
      const existing = map.get(key) || { name: p.name, phone: p.phone, payout: 0, count: 0 };
      existing.payout += l.payout_amount || 0;
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.payout - a.payout);
  }, [filteredLogs]);

  if (loading && logs.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center gap-3">
        <Loader2 className="animate-spin text-orange-500" size={24} /> Loading earnings...
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 pb-24">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight">Rider Earnings</h1>
          <p className="text-slate-500">Track payouts and owner contributions</p>
        </div>
        <div className="flex bg-white rounded-xl shadow-sm p-1 border">
          {(["today", "week", "month", "all"] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-semibold capitalize transition-all",
                period === p ? "bg-orange-500 text-white shadow-md" : "text-slate-600 hover:bg-slate-100"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg shadow-emerald-500/20">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <DollarSign size={20} />
            <h2 className="font-medium text-sm uppercase tracking-wider">Total Rider Payout</h2>
          </div>
          <p className="text-4xl font-black">₹{summary.totalPayout.toLocaleString()}</p>
          <p className="text-emerald-100 text-sm mt-2">Across {summary.totalDeliveries} deliveries</p>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center gap-2 mb-2 opacity-80">
            <Activity size={20} />
            <h2 className="font-medium text-sm uppercase tracking-wider">Owner Contribution</h2>
          </div>
          <p className="text-4xl font-black">₹{(summary.totalDeliveries * 10).toLocaleString()}</p>
          <p className="text-blue-100 text-sm mt-2">₹10 per completed delivery</p>
        </div>

        <div className="bg-white border rounded-2xl p-6 shadow-sm flex flex-col justify-center">
          <div className="flex items-center gap-2 mb-1 text-slate-500">
            <TrendingUp size={16} />
            <span className="font-semibold text-sm">Avg Payout / Order</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            ₹{summary.totalDeliveries ? Math.round(summary.totalPayout / summary.totalDeliveries) : 0}
          </p>
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4">
            <div className="bg-orange-500 h-1.5 rounded-full" style={{ width: '60%' }} />
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* Left Col: Rider Leaderboard */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><Bike size={18} /> Top Earners</h3>
          <div className="bg-white rounded-2xl border shadow-sm p-4 space-y-4 max-h-[600px] overflow-y-auto">
            {riderAggregations.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">No earnings in this period</p>
            ) : (
              riderAggregations.map((r, i) => (
                <div key={r.phone} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{r.name}</p>
                    <p className="text-xs text-slate-500">{r.count} deliveries</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-black text-emerald-600">₹{r.payout}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Col: Logs */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2"><CheckCircle size={18} /> Delivery Logs</h3>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search by rider or order..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-600 border-b">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date & Time</th>
                    <th className="px-4 py-3 font-semibold">Rider</th>
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold text-right">Distance</th>
                    <th className="px-4 py-3 font-semibold text-right">Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-slate-500">No logs found</td>
                    </tr>
                  ) : (
                    filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-slate-400" />
                            {new Date(log.earned_at).toLocaleString("en-IN", {
                              day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit"
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {log.users?.name || "Unknown"}
                        </td>
                        <td className="px-4 py-3 text-orange-600 font-mono text-xs">
                          #{log.orders?.order_number}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="inline-block bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full text-xs font-medium border">
                            {log.distance_range || `${log.distance_km} km`}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-emerald-600">
                          ₹{log.payout_amount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
