import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// This route verifies the current password and updates it.
// Using service-role to update password and a second admin client
// to verify current credentials safely without touching the main session.
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { email, currentPassword, newPassword } = await req.json();

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "New password must be at least 6 characters" }, { status: 400 });
    }

    // Step 1: Verify current password by attempting sign-in on a SEPARATE client
    // This does NOT affect the main user session (which uses the browser client)
    const verifyClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error: verifyErr } = await verifyClient.auth.signInWithPassword({
      email,
      password: currentPassword,
    });

    if (verifyErr) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
    }

    // Step 2: Find the user by email using admin
    const { data: usersData, error: lookupErr } = await supabaseAdmin.auth.admin.listUsers();
    if (lookupErr) {
      return NextResponse.json({ error: "Failed to look up user" }, { status: 500 });
    }

    const authUser = usersData.users.find((u) => u.email === email);
    if (!authUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Step 3: Update password via admin (doesn't touch main session)
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: newPassword,
    });

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
  }
}
