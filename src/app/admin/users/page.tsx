"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/authStore";
import { User } from "@/lib/database.types";
import { useRouter } from "next/navigation";
import { Loader2, Search, Shield, Truck, UserIcon } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export default function AdminUsersPage() {
  const { user } = useAuthStore();
  const router   = useRouter();
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!user || user.role !== "admin") { router.push("/"); return; }
    supabase.from("users").select("*").order("created_at", { ascending: false })
      .then(({ data }) => { setUsers(data ?? []); setLoading(false); });
  }, [user]);

  async function changeRole(userId: string, role: string) {
    const { error } = await supabase.from("users").update({ role }).eq("id", userId);
    if (error) { toast.error("Failed to change role"); return; }
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, role: role as any } : u));
    toast.success(`Role updated to ${role}`);
  }

  async function toggleActive(u: User) {
    await supabase.from("users").update({ is_active: !u.is_active }).eq("id", u.id);
    setUsers((prev) => prev.map((p) => p.id === u.id ? { ...p, is_active: !p.is_active } : p));
    toast.success(u.is_active ? "User deactivated" : "User activated");
  }

  const filtered = users.filter((u) =>
    !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  );

  const roleIcon = (role: string) => ({
    admin:    <Shield size={14} className="text-orange-400" />,
    delivery: <Truck size={14} className="text-blue-400" />,
    customer: <UserIcon size={14} className="text-gray-400" />,
  }[role] ?? null);

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 size={32} className="animate-spin text-brand" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl text-white">User Management</h1>
          <p className="text-gray-500 text-sm mt-1">{users.length} registered users</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: "Customers",  count: users.filter((u) => u.role === "customer").length,  color: "text-gray-400",   icon: "👥" },
          { label: "Admins",     count: users.filter((u) => u.role === "admin").length,     color: "text-orange-400", icon: "🛡️" },
          { label: "Delivery",   count: users.filter((u) => u.role === "delivery").length,  color: "text-blue-400",   icon: "🛵" },
        ].map(({ label, count, color, icon }) => (
          <div key={label} className="glass rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">{icon}</p>
            <p className={cn("font-bold text-2xl", color)}>{count}</p>
            <p className="text-xs text-gray-500">{label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email..." className="input-field pl-11" />
      </div>

      {/* Users Table */}
      <div className="glass rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="px-5 py-3 text-xs text-gray-500 font-medium">User</th>
                <th className="px-5 py-3 text-xs text-gray-500 font-medium">Contact</th>
                <th className="px-5 py-3 text-xs text-gray-500 font-medium">Role</th>
                <th className="px-5 py-3 text-xs text-gray-500 font-medium">Joined</th>
                <th className="px-5 py-3 text-xs text-gray-500 font-medium">Status</th>
                <th className="px-5 py-3 text-xs text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-white/2 transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 gradient-brand rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {u.name?.[0]?.toUpperCase() ?? "U"}
                      </div>
                      <p className="text-sm font-medium text-white">{u.name || "—"}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-gray-400">{u.email || "—"}</p>
                    <p className="text-xs text-gray-600">{u.phone || ""}</p>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value)}
                      className="bg-transparent border border-white/10 rounded-lg px-2 py-1 text-xs text-gray-300 focus:border-brand/50 focus:outline-none"
                    >
                      <option value="customer">Customer</option>
                      <option value="admin">Admin</option>
                      <option value="delivery">Delivery</option>
                    </select>
                  </td>
                  <td className="px-5 py-3 text-xs text-gray-500">{new Date(u.created_at).toLocaleDateString("en-IN")}</td>
                  <td className="px-5 py-3">
                    <span className={cn("badge text-[10px]", u.is_active ? "badge-brand" : "badge bg-red-500/10 text-red-400 border-red-500/20")}>
                      {u.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <button
                      onClick={() => toggleActive(u)}
                      className="text-xs px-3 py-1 rounded-lg border border-white/10 text-gray-400 hover:border-brand/30 hover:text-brand transition-all"
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-gray-500">No users found</div>
          )}
        </div>
      </div>
    </div>
  );
}
