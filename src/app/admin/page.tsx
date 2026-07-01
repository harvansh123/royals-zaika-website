"use client";
import { useEffect, useState, useRef } from "react";
import { useAuthStore } from "@/stores/authStore";
import { supabase } from "@/lib/supabase/client";
import { Order } from "@/lib/database.types";
import { formatPrice, formatRelativeTime, ORDER_STATUS_CONFIG, playAlarmSound } from "@/lib/utils";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Users, Tag,
  TrendingUp, Bell, ChevronRight, Loader2, Check, X, Clock,
  AlertCircle, Package
} from "lucide-react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

type Stats = { todayOrders: number; todayRevenue: number; pendingOrders: number; totalUsers: number };

export default function AdminDashboard() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [stats, setStats]       = useState<Stats>({ todayOrders: 0, todayRevenue: 0, pendingOrders: 0, totalUsers: 0 });
  const [orders, setOrders]     = useState<Order[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  const prevOrderCount = useRef(0);

  useEffect(() => {
    if (!user) { router.push("/auth/login"); return; }
    if (user.role !== "admin") { router.push("/"); return; }
    loadDashboard();

    // Realtime subscription for new orders
    const channel = supabase.channel("admin-orders")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "orders"
      }, (payload) => {
        const newOrder = payload.new as Order;
        setOrders((prev) => [newOrder, ...prev]);
        setNewOrderAlert(newOrder);
        playAlarmSound();
        toast.custom((t) => (
          <div className={cn("glass border border-brand/40 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-glow", t.visible ? "animate-slide-right" : "opacity-0")}>
            <span className="text-3xl animate-bounce">🔔</span>
            <div>
              <p className="font-bold text-white">New Order!</p>
              <p className="text-sm text-gray-400">#{newOrder.order_number} · {formatPrice(newOrder.total_amount)}</p>
            </div>
            <Link href="/admin/orders" className="btn-primary py-2 px-4 text-xs ml-2">View</Link>
          </div>
        ), { duration: 8000, position: "top-right" });
        setStats((prev) => ({ ...prev, todayOrders: prev.todayOrders + 1, todayRevenue: prev.todayRevenue + newOrder.total_amount, pendingOrders: prev.pendingOrders + 1 }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function loadDashboard() {
    setLoading(true);
    const today = new Date(); today.setHours(0,0,0,0);

    const [{ data: todayOrders }, { data: allUsers }, { data: recentOrders }, { data: weekOrders }] = await Promise.all([
      supabase.from("orders").select("total_amount, status").gte("created_at", today.toISOString()),
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("orders").select("created_at, total_amount").gte("created_at", new Date(Date.now() - 7*86400000).toISOString()),
    ]);

    // Chart data - group by day
    const dayMap: Record<string, number> = {};
    weekOrders?.forEach((o) => {
      const day = new Date(o.created_at).toLocaleDateString("en-IN", { weekday: "short" });
      dayMap[day] = (dayMap[day] ?? 0) + o.total_amount;
    });
    setChartData(Object.entries(dayMap).map(([day, revenue]) => ({ day, revenue })));

    setStats({
      todayOrders:   todayOrders?.length ?? 0,
      todayRevenue:  todayOrders?.reduce((s, o) => s + o.total_amount, 0) ?? 0,
      pendingOrders: todayOrders?.filter((o) => o.status === "pending").length ?? 0,
      totalUsers:    (allUsers as any)?.length ?? 0,
    });
    setOrders(recentOrders ?? []);
    setLoading(false);
  }

  async function updateOrderStatus(orderId: string, status: string) {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error("Failed to update status"); return; }
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: status as any } : o));
    toast.success(`Order ${status}`);
  }

  const sideLinks = [
    { href: "/admin",          icon: LayoutDashboard, label: "Dashboard",  active: true },
    { href: "/admin/orders",   icon: ShoppingBag,      label: "Orders" },
    { href: "/admin/menu",     icon: UtensilsCrossed,  label: "Menu" },
    { href: "/admin/coupons",  icon: Tag,              label: "Coupons" },
    { href: "/admin/users",    icon: Users,            label: "Users" },
  ];

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={40} className="animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden lg:flex flex-col w-60 bg-[#0f0f0f] border-r border-white/5 pt-4 px-3 fixed top-16 bottom-0">
        <p className="text-xs text-gray-600 uppercase tracking-widest px-3 mb-3">Admin Panel</p>
        <nav className="flex flex-col gap-1">
          {sideLinks.map(({ href, icon: Icon, label, active }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                active ? "gradient-brand text-white shadow-brand" : "text-gray-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon size={17} />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto pb-4">
          <div className="glass-brand rounded-xl p-3">
            <p className="text-xs text-orange-300 font-medium">Logged in as</p>
            <p className="text-sm text-white font-semibold truncate">{user?.name}</p>
            <p className="text-xs text-gray-500">{user?.email}</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-60 p-5 md:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display font-bold text-2xl md:text-3xl text-white">Dashboard</h1>
            <p className="text-gray-500 text-sm mt-1">Welcome back, {user?.name?.split(" ")[0]} 👋</p>
          </div>
          <Link href="/admin/orders" className="flex items-center gap-2 glass-brand rounded-xl px-4 py-2 text-sm text-brand font-medium hover:shadow-brand transition-all">
            <Bell size={15} />
            {stats.pendingOrders > 0 && <span className="font-bold">{stats.pendingOrders} pending</span>}
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Today's Orders",  value: stats.todayOrders,              icon: "📦", color: "text-blue-400",  sub: "orders today" },
            { label: "Today's Revenue", value: formatPrice(stats.todayRevenue), icon: "💰", color: "text-green-400", sub: "earned today" },
            { label: "Pending Orders",  value: stats.pendingOrders,             icon: "⏳", color: "text-yellow-400",sub: "need action" },
            { label: "Total Users",     value: stats.totalUsers,                icon: "👥", color: "text-purple-400",sub: "registered" },
          ].map(({ label, value, icon, color, sub }) => (
            <div key={label} className="glass rounded-2xl p-5">
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{icon}</span>
                <TrendingUp size={14} className="text-gray-600 mt-1" />
              </div>
              <p className={cn("font-display font-bold text-2xl", color)}>{value}</p>
              <p className="text-xs text-gray-500 mt-1">{label}</p>
            </div>
          ))}
        </div>

        {/* Revenue Chart */}
        {chartData.length > 0 && (
          <div className="glass rounded-2xl p-5 mb-8">
            <h2 className="font-semibold text-white mb-4">Revenue (Last 7 Days)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#374151" tick={{ fill: "#6b7280", fontSize: 12 }} />
                <YAxis stroke="#374151" tick={{ fill: "#6b7280", fontSize: 12 }} tickFormatter={(v) => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: "#1a1a2e", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12 }}
                  labelStyle={{ color: "#fff" }}
                  formatter={(v: any) => [formatPrice(v), "Revenue"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} fill="url(#revGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent Orders */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">Recent Orders</h2>
            <Link href="/admin/orders" className="text-brand text-sm flex items-center gap-1 hover:underline">
              View all <ChevronRight size={14} />
            </Link>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-10 text-gray-500">
              <Package size={40} className="mx-auto mb-3 opacity-30" />
              <p>No orders yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.slice(0, 8).map((order) => {
                const cfg = ORDER_STATUS_CONFIG[order.status];
                return (
                  <div key={order.id} className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/3 transition-colors">
                    <span className="text-xl w-8 text-center">{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-white">#{order.order_number}</p>
                        <span className={cn("badge text-[10px]", cfg.color)}>{cfg.label}</span>
                      </div>
                      <p className="text-xs text-gray-500">{formatRelativeTime(order.created_at)}</p>
                    </div>
                    <p className="text-sm font-bold text-brand">{formatPrice(order.total_amount)}</p>

                    {order.status === "pending" && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => updateOrderStatus(order.id, "confirmed")}
                          className="w-7 h-7 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg flex items-center justify-center transition-colors"
                          title="Accept"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => updateOrderStatus(order.id, "cancelled")}
                          className="w-7 h-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg flex items-center justify-center transition-colors"
                          title="Reject"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}

                    {order.status === "confirmed" && (
                      <button
                        onClick={() => updateOrderStatus(order.id, "preparing")}
                        className="text-xs text-orange-400 border border-orange-400/30 px-2.5 py-1 rounded-lg hover:bg-orange-400/10 transition-colors whitespace-nowrap"
                      >
                        Start Prep
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Mobile Nav Links */}
        <div className="lg:hidden mt-6 grid grid-cols-2 gap-3">
          {sideLinks.slice(1).map(({ href, icon: Icon, label }) => (
            <Link key={href} href={href} className="glass rounded-xl p-4 flex items-center gap-3 hover:border-brand/20">
              <Icon size={20} className="text-brand" />
              <span className="text-sm font-medium text-white">{label}</span>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
