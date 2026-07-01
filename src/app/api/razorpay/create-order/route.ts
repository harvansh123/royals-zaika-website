import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const keyId     = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";

  // ── If keys are not configured, tell the client to fall back to COD ──
  if (
    !keyId || keyId.includes("xxxx") || keyId === "your_razorpay_key_id_here" ||
    !keySecret || keySecret.includes("your_") || keySecret === "your_razorpay_key_secret_here"
  ) {
    return NextResponse.json(
      { error: "RAZORPAY_NOT_CONFIGURED", message: "Razorpay keys are not set up yet. Please use Cash on Delivery." },
      { status: 503 }
    );
  }

  try {
    // Lazy-import so the module doesn't crash at startup with fake keys
    const Razorpay  = (await import("razorpay")).default;
    const razorpay  = new Razorpay({ key_id: keyId, key_secret: keySecret });

    const { amount, orderId } = await req.json();
    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt:  `receipt_${orderId}`,
      notes:    { orderId },
    });

    return NextResponse.json({ razorpayOrderId: order.id });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
