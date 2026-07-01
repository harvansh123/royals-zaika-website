-- ============================================================
-- 011_fix_rls_recursion.sql
-- Fix: infinite recursion in RLS policies
-- ============================================================
--
-- ROOT CAUSE:
-- get_user_role() does: SELECT role FROM public.users WHERE id = uid
-- Even though it is SECURITY DEFINER, when PostgreSQL evaluates
-- RLS policies on the users table, it evaluates ALL policies
-- including "Admins can view all users" which calls get_user_role()
-- again → infinite recursion.
--
-- THE FIX:
-- Replace get_user_role() with a version that bypasses RLS entirely
-- by using SET search_path and querying via a security definer
-- context that does not re-evaluate user-table RLS policies.
--
-- Additionally, replace all policy EXISTS(SELECT 1 FROM public.users ...)
-- patterns with a direct auth.uid() + role check that avoids re-querying
-- the users table when we are already inside a users-table policy.
-- ============================================================

-- Step 1: Recreate get_user_role() to fully bypass RLS
-- NOTE: Do NOT use DROP FUNCTION — many policies depend on it.
-- CREATE OR REPLACE replaces just the body, keeping all dependents intact.
CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID)
-- Keep EXACT same signature as original (user_role ENUM return type, sql language)
-- Only add: SET search_path = public  +  SET row_security = off
-- These two additions stop the infinite recursion without any type changes.
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = uid;
$$ LANGUAGE sql
   SECURITY DEFINER
   SET search_path = public
   SET row_security = off;

-- Grant execute to authenticated and anon roles
GRANT EXECUTE ON FUNCTION public.get_user_role(UUID) TO authenticated, anon;


-- Step 2: Fix the "Owners can manage menu_items" policy.
-- The old policy: EXISTS(SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN (...))
-- This queries users → triggers users RLS → get_user_role() → recursion.
-- Fix: use get_user_role() directly (now safe because it has row_security=off).
DROP POLICY IF EXISTS "Owners can manage menu items" ON public.menu_items;
CREATE POLICY "Owners can manage menu items"
  ON public.menu_items
  FOR ALL
  USING (public.get_user_role(auth.uid()) IN ('admin', 'restaurant_owner'));


-- Step 3: Fix "Owners can manage orders" policy — same pattern.
DROP POLICY IF EXISTS "Owners can manage orders" ON public.orders;
CREATE POLICY "Owners can manage orders"
  ON public.orders
  FOR ALL
  USING (public.get_user_role(auth.uid()) IN ('admin', 'restaurant_owner'));


-- Step 4: Fix support_tickets policies — all have EXISTS(SELECT 1 FROM users ...).
DROP POLICY IF EXISTS "Admins can view all support tickets" ON public.support_tickets;
CREATE POLICY "Admins can view all support tickets"
  ON public.support_tickets
  FOR SELECT
  USING (public.get_user_role(auth.uid()) IN ('admin', 'restaurant_owner'));

DROP POLICY IF EXISTS "Admins can update support tickets" ON public.support_tickets;
CREATE POLICY "Admins can update support tickets"
  ON public.support_tickets
  FOR UPDATE
  USING (public.get_user_role(auth.uid()) IN ('admin', 'restaurant_owner'));


-- Step 5: Fix storage.objects policies that query public.users.
DROP POLICY IF EXISTS "Owners can delete support attachments" ON storage.objects;
CREATE POLICY "Owners can delete support attachments"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'support_attachments' AND
    public.get_user_role(auth.uid()) IN ('admin', 'restaurant_owner')
  );


-- Step 6: Add INSERT policy for support_tickets for authenticated riders/owners
-- (The existing INSERT policy already covers customers and anon, keep it.)
-- No change needed here.

-- Done. Run this migration in Supabase SQL Editor.
