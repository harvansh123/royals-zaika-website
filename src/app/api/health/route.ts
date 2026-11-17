import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "ok", app: "Chaurasia's Restaurant", timestamp: new Date().toISOString() });
}

