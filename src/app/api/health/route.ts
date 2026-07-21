import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return NextResponse.json({ status: "ok", app: "Royal Zaika", timestamp: new Date().toISOString() });
}

