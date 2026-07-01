import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Service-role client — bypasses RLS entirely
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();

    if (!orderId) {
      return NextResponse.json({ error: "orderId is required" }, { status: 400 });
    }

    // Verify order exists and get user_id and order_number
    const { data: order, error: fetchErr } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, user_id")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    // Check if OTP already exists for this order in notifications
    const { data: existing } = await supabaseAdmin
      .from("notifications")
      .select("id, data")
      .eq("type", "delivery_otp")
      .eq("user_id", order.user_id)
      .order("created_at", { ascending: false });

    const existingForOrder = (existing ?? []).find(
      (n: any) => n.data?.order_id === orderId
    );

    if (existingForOrder?.data?.otp) {
      // OTP already exists — return it
      return NextResponse.json({
        otp: existingForOrder.data.otp,
        orderId,
        orderNumber: order.order_number,
      });
    }

    // Generate a unique 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Insert into notifications using service role (bypasses RLS INSERT restriction)
    const { error: insertErr } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: order.user_id,
        title:   "Delivery OTP",
        message: `Your delivery OTP for order #${order.order_number} is: ${otp}`,
        type:    "delivery_otp",
        data:    { otp, order_id: orderId, order_number: order.order_number, used: false },
      });

    if (insertErr) {
      console.error("OTP notification insert error:", insertErr);
      return NextResponse.json({ error: "Failed to save OTP" }, { status: 500 });
    }

    return NextResponse.json({ otp, orderId, orderNumber: order.order_number });
  } catch (err: any) {
    console.error("OTP API error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
