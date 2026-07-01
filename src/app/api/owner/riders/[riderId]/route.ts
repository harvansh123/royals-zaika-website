import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/owner/riders/[riderId] — single rider full detail
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ riderId: string }> }
) {
  try {
    const { riderId } = await params;

    const { data: partner, error } = await supabaseAdmin
      .from("delivery_partners")
      .select(`
        id, name, phone, vehicle_type, vehicle_number,
        is_available, total_deliveries, rating, created_at,
        account_status, suspension_end, suspension_reason, blocked_reason,
        users!inner(email, avatar_url, created_at, is_active)
      `)
      .eq("id", riderId)
      .single();

    if (error || !partner) return NextResponse.json({ error: "Rider not found" }, { status: 404 });

    // Stats from delivery_tracking
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today); weekStart.setDate(today.getDate() - 7);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const { data: allDeliveries } = await supabaseAdmin
      .from("delivery_tracking")
      .select("id, status, updated_at")
      .eq("partner_id", riderId)
      .order("updated_at", { ascending: false });

    const delivered = (allDeliveries ?? []).filter(d => d.status === "delivered");
    const todayDel = delivered.filter(d => new Date(d.updated_at) >= today).length;
    const weekDel  = delivered.filter(d => new Date(d.updated_at) >= weekStart).length;
    const monthDel = delivered.filter(d => new Date(d.updated_at) >= monthStart).length;

    // Audit log history
    const { data: auditLogs } = await supabaseAdmin
      .from("rider_audit_logs")
      .select("id, action, reason, owner_name, metadata, created_at")
      .eq("rider_id", riderId)
      .order("created_at", { ascending: false })
      .limit(50);

    return NextResponse.json({
      rider: {
        ...(partner as any),
        email: (partner.users as any)?.email ?? "",
        avatar_url: (partner.users as any)?.avatar_url ?? null,
        joined_at: (partner.users as any)?.created_at ?? partner.created_at,
      },
      stats: {
        today: todayDel,
        week: weekDel,
        month: monthDel,
        lifetime: delivered.length,
        total_assigned: (allDeliveries ?? []).length,
      },
      audit_logs: auditLogs ?? [],
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/owner/riders/[riderId] — update rider status/info
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ riderId: string }> }
) {
  try {
    const { riderId } = await params;
    const body = await req.json();
    const {
      account_status, reason, suspension_end, suspension_reason,
      name, phone, vehicle_type, vehicle_number,
      owner_id, owner_name, action,
    } = body;

    // Build update for delivery_partners
    const dpUpdate: Record<string, any> = {};

    if (account_status) {
      dpUpdate.account_status = account_status;
      // When blocking/disabling/suspending — force offline
      if (["blocked", "disabled", "suspended"].includes(account_status)) {
        dpUpdate.is_available = false;
      }
      if (account_status === "blocked")   dpUpdate.blocked_reason    = reason ?? null;
      if (account_status === "suspended") dpUpdate.suspension_reason  = suspension_reason ?? reason ?? null;
      if (account_status === "suspended") dpUpdate.suspension_end     = suspension_end ?? null;
      if (account_status === "active") {
        dpUpdate.blocked_reason    = null;
        dpUpdate.suspension_reason = null;
        dpUpdate.suspension_end    = null;
      }
    }

    if (name)           dpUpdate.name           = name;
    if (phone)          dpUpdate.phone          = phone;
    if (vehicle_type)   dpUpdate.vehicle_type   = vehicle_type;
    if (vehicle_number) dpUpdate.vehicle_number = vehicle_number;

    const { error: updateErr } = await supabaseAdmin
      .from("delivery_partners")
      .update(dpUpdate)
      .eq("id", riderId);

    if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

    // Write audit log
    if (action || account_status) {
      await supabaseAdmin.from("rider_audit_logs").insert({
        rider_id:   riderId,
        action:     action ?? `status_changed_to_${account_status}`,
        reason:     reason ?? suspension_reason ?? null,
        owner_id:   owner_id ?? null,
        owner_name: owner_name ?? "Owner",
        metadata:   { account_status, suspension_end },
      });
    }

    // Send notification to rider
    const actionLabels: Record<string, string> = {
      blocked:   "Your rider account has been blocked by the restaurant administrator. Please contact support.",
      unblocked: "Your rider account has been unblocked. You can now go online and receive orders.",
      disabled:  "Your rider account has been temporarily disabled. Please contact support.",
      active:    "Your rider account has been activated. You can now go online and receive orders.",
      suspended: `Your account is suspended until ${suspension_end ? new Date(suspension_end).toLocaleDateString("en-IN") : "further notice"}. Reason: ${suspension_reason ?? reason ?? "N/A"}`,
    };

    const msg = actionLabels[account_status] ?? `Your account status has been updated to: ${account_status}`;
    await supabaseAdmin.from("notifications").insert({
      user_id: riderId,
      title:   "Account Status Update",
      message: msg,
      type:    ["blocked", "disabled", "suspended"].includes(account_status) ? "warning" : "info",
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
