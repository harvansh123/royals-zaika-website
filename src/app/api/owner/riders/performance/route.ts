import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * GET /api/owner/riders/performance?riderIds=id1,id2,id3
 *
 * Batch performance calculation for multiple riders.
 * Uses last 30 days of data from delivery_tracking + rider_audit_logs.
 *
 * Rating Formula (1.0–5.0):
 *   A. Completion Rate (50%): delivered30 / assigned30
 *   B. Speed Score     (30%): based on avg delivery_duration_minutes
 *   C. Rejection Score (20%): penalised per rejection in last 30 days
 *
 *   weighted = A×0.50 + B×0.30 + C×0.20
 *   rating   = round(1.0 + weighted × 4.0, 1)  → clamped 1.0–5.0
 */

function calcRating(
  assigned30: number,
  delivered30: number,
  avgMinutes: number | null,
  rejections30: number
): number {
  // A: Completion Rate (0–1)
  const completionScore = assigned30 > 0 ? delivered30 / assigned30 : 1.0;

  // B: Speed Score (0–1) — neutral 0.75 when no data
  let speedScore = 0.75;
  if (avgMinutes !== null) {
    if      (avgMinutes < 20) speedScore = 1.00;
    else if (avgMinutes < 30) speedScore = 0.90;
    else if (avgMinutes < 40) speedScore = 0.78;
    else if (avgMinutes < 50) speedScore = 0.63;
    else if (avgMinutes < 60) speedScore = 0.50;
    else                      speedScore = 0.32;
  }

  // C: Rejection Penalty (0–1) — each rejection deducts 0.25
  const rejectionScore = Math.max(0, 1 - rejections30 * 0.25);

  // Weighted composite (0–1)
  const weighted = completionScore * 0.50 + speedScore * 0.30 + rejectionScore * 0.20;

  // Map to 1.0–5.0
  const raw = 1.0 + weighted * 4.0;
  return Math.round(Math.min(5.0, Math.max(1.0, raw)) * 10) / 10;
}

function getRatingMeta(rating: number): { label: string; color: string; bg: string } {
  if (rating >= 4.5) return { label: "Excellent", color: "#16a34a", bg: "rgba(22,163,74,0.12)"  };
  if (rating >= 4.0) return { label: "Good",      color: "#65a30d", bg: "rgba(101,163,13,0.12)" };
  if (rating >= 3.0) return { label: "Average",   color: "#d97706", bg: "rgba(217,119,6,0.12)"  };
  if (rating >= 2.0) return { label: "Poor",      color: "#ea580c", bg: "rgba(234,88,12,0.12)"  };
  return               { label: "Very Poor",      color: "#dc2626", bg: "rgba(220,38,38,0.12)"  };
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const riderIdsParam = searchParams.get("riderIds");
    if (!riderIdsParam) return NextResponse.json({ error: "riderIds required" }, { status: 400 });

    const riderIds = riderIdsParam.split(",").map(s => s.trim()).filter(Boolean);
    if (riderIds.length === 0) return NextResponse.json({});

    // Last 30 days window
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();

    // ── Batch fetch delivery_tracking (all assigned statuses, last 30d) ──
    const { data: trackings } = await adminClient
      .from("delivery_tracking")
      .select("id, partner_id, status, delivery_duration_minutes, created_at")
      .in("partner_id", riderIds)
      .gte("created_at", thirtyDaysAgoStr);

    // ── Batch fetch rejections from audit logs (last 30d) ───────────────
    const { data: rejections } = await adminClient
      .from("rider_audit_logs")
      .select("rider_id")
      .in("rider_id", riderIds)
      .eq("action", "order_rejected_by_rider")
      .gte("created_at", thirtyDaysAgoStr);

    // ── Calculate per rider ──────────────────────────────────────────────
    const result: Record<string, any> = {};

    for (const riderId of riderIds) {
      const riderTrackings = (trackings ?? []).filter(t => t.partner_id === riderId);
      const assigned30  = riderTrackings.length;
      const delivered30 = riderTrackings.filter(t => t.status === "delivered").length;
      const rejections30 = (rejections ?? []).filter(r => r.rider_id === riderId).length;

      // Average delivery duration (delivered + has valid duration)
      const durations = riderTrackings
        .filter(t => t.status === "delivered"
          && t.delivery_duration_minutes != null
          && parseFloat(t.delivery_duration_minutes) > 0)
        .map(t => parseFloat(t.delivery_duration_minutes));

      const avgDeliveryMin = durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

      const completionRate = assigned30 > 0
        ? Math.round((delivered30 / assigned30) * 100)
        : null;

      const rating = calcRating(assigned30, delivered30, avgDeliveryMin, rejections30);
      const meta   = getRatingMeta(rating);

      result[riderId] = {
        rating,
        label:            meta.label,
        color:            meta.color,
        bg:               meta.bg,
        completionRate,                   // null if no data
        avgDeliveryMin,                   // null if no data
        rejectionCount30d: rejections30,
        totalAssigned30d:  assigned30,
        totalDelivered30d: delivered30,
      };
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[riders/performance] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
