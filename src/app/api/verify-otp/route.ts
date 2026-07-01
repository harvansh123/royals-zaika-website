import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses all RLS
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { orderId, enteredOtp } = await req.json();

    if (!orderId || !enteredOtp) {
      return NextResponse.json({ error: "orderId and enteredOtp are required" }, { status: 400 });
    }

    if (enteredOtp.length !== 6) {
      return NextResponse.json({ error: "OTP must be exactly 6 digits" }, { status: 400 });
    }

    // Fetch ALL delivery_otp notifications (service role ignores RLS)
    const { data: notifs, error: fetchErr } = await supabaseAdmin
      .from("notifications")
      .select("id, data")
      .eq("type", "delivery_otp")
      .order("created_at", { ascending: false });

    if (fetchErr) {
      console.error("OTP fetch error:", fetchErr);
      return NextResponse.json({ error: "Failed to fetch OTP" }, { status: 500 });
    }

    // Find the notification matching this specific order (in-memory — avoids unreliable JSONB .contains())
    const notif = (notifs ?? []).find((n: any) => n.data?.order_id === orderId);

    if (!notif) {
      return NextResponse.json({ error: "OTP not found for this order. Please contact support." }, { status: 404 });
    }

    const storedOtp = notif.data?.otp;
    const isUsed    = notif.data?.used === true;

    if (isUsed) {
      return NextResponse.json({ error: "This OTP has already been used." }, { status: 409 });
    }

    if (String(enteredOtp).trim() !== String(storedOtp).trim()) {
      return NextResponse.json({ error: "Incorrect OTP. Please ask customer for the correct OTP." }, { status: 401 });
    }

    // OTP correct — mark as used (service role bypasses UPDATE RLS)
    const { error: updateErr } = await supabaseAdmin
      .from("notifications")
      .update({
        data: { ...notif.data, used: true, delivered_at: new Date().toISOString() },
      })
      .eq("id", notif.id);

    if (updateErr) {
      console.error("OTP mark-used error:", updateErr);
      return NextResponse.json({ error: "OTP verified but failed to mark as used" }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: "OTP verified successfully" });
  } catch (err: any) {
    console.error("Verify OTP API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
