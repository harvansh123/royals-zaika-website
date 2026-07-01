import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const adminClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/support/ticket
 * Body: { name, phone, email, userType, category, description, attachments? }
 *
 * Inserts a support ticket using service-role client.
 *
 * Direct supabase.from("support_tickets").insert() with anon key fails because
 * the "Admins can view all support tickets" policy does:
 *   EXISTS(SELECT 1 FROM public.users WHERE role = 'restaurant_owner')
 * This queries the users table → "Admins can view all users" policy calls
 * get_user_role() → queries users again → infinite recursion.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, phone, email, userType, category, description, attachments = [] } = body;

    // Validate required fields
    if (!name?.trim() || !phone?.trim() || !email?.trim() || !category?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "All fields are required" }, { status: 400 });
    }
    if (!["customer", "rider", "owner"].includes(userType)) {
      return NextResponse.json({ error: "Invalid user type" }, { status: 400 });
    }

    // Get user_id from session (optional — guests allowed)
    let userId: string | null = null;
    try {
      const cookieStore = await cookies();
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() { return cookieStore.getAll(); },
            setAll() {},
          },
        }
      );
      const { data: { user } } = await supabase.auth.getUser();
      userId = user?.id ?? null;
    } catch {
      // Continue without user_id if session check fails
    }

    // Insert via service role — fully bypasses RLS recursion
    const { data: ticket, error } = await adminClient
      .from("support_tickets")
      .insert({
        user_id:     userId,
        name:        name.trim(),
        phone:       phone.trim(),
        email:       email.trim(),
        user_type:   userType,
        category:    category.trim(),
        description: description.trim(),
        attachments: Array.isArray(attachments) ? attachments : [],
      })
      .select()
      .single();

    if (error) {
      console.error("[/api/support/ticket] Insert error:", {
        message: error.message,
        code:    error.code,
        details: error.details,
        hint:    error.hint,
      });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ticket });
  } catch (err: any) {
    console.error("[/api/support/ticket] Unexpected error:", err.message);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
