import { supabase } from "@/lib/supabase/client";

/**
 * performSignOut()
 *
 * Shared logout utility used by Customer, Owner, and Rider.
 *
 * What it does:
 * 1. Signs out of Supabase (invalidates the server-side session + clears auth cookies)
 * 2. Clears ALL Supabase auth tokens from localStorage and sessionStorage
 * 3. Redirects to /auth/login using window.location.replace() — NOT router.push()
 *
 * Why window.location.replace() instead of router.push/replace:
 * ─ Next.js router.push/replace does client-side navigation, which keeps the
 *   previous page in the browser's Back-Forward Cache (bfcache). When the user
 *   presses the Back button, the cached page is shown without re-running React
 *   effects, so they see the protected dashboard even though they've logged out.
 *
 * ─ window.location.replace() triggers a full page load:
 *     • The browser evicts the previous page from bfcache.
 *     • replace() (not href=) rewrites the current history entry so the Back
 *       button cannot navigate back to the protected page at all.
 *     • All in-memory React state is destroyed automatically.
 */
export async function performSignOut(onBeforeRedirect?: () => void): Promise<void> {
  try {
    // 1. Invalidate the Supabase session (clears httpOnly auth cookie server-side)
    await supabase.auth.signOut();
  } catch {
    // Non-fatal — proceed with redirect regardless
  }

  // 2. Wipe all Supabase auth tokens from browser storage
  if (typeof window !== "undefined") {
    // Supabase stores tokens with "sb-" prefix in localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith("sb-") || key.toLowerCase().includes("supabase")) {
        localStorage.removeItem(key);
      }
    });
    // Clear any session-scoped data
    sessionStorage.clear();
  }

  // 3. Run any caller-specific cleanup (e.g., stop alarms, clear cart)
  try { onBeforeRedirect?.(); } catch { /* non-fatal */ }

  // 4. Hard navigation using replace() — prevents back-button from returning
  //    to protected pages. Full page reload ensures all React state is gone.
  if (typeof window !== "undefined") {
    window.location.replace("/auth/login");
  }
}
