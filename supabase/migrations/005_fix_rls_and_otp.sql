-- Migration 005: Fix order_items RLS for owners + notifications INSERT + delivery_otp column
-- Run this in your Supabase SQL Editor

-- 1. Add delivery_otp column to orders table (stores OTP per order)
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_otp TEXT;

-- 2. Fix: Allow restaurant_owner to view order_items (was missing)
DROP POLICY IF EXISTS "Owners can view order items" ON public.order_items;
CREATE POLICY "Owners can view order items"
  ON public.order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'restaurant_owner')
    )
  );

-- 3. Fix: Allow authenticated users to insert their own notifications
DROP POLICY IF EXISTS "Users can insert own notifications" ON public.notifications;
CREATE POLICY "Users can insert own notifications"
  ON public.notifications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- 4. Allow restaurant_owner to update orders (for status changes etc.)
DROP POLICY IF EXISTS "Owners can update orders" ON public.orders;
CREATE POLICY "Owners can update orders"
  ON public.orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'restaurant_owner')
    )
  );

-- 5. Allow users to update their own order (needed to save delivery_otp)
DROP POLICY IF EXISTS "Users can update own order otp" ON public.orders;
CREATE POLICY "Users can update own order otp"
  ON public.orders
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
