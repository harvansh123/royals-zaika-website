-- ============================================================
-- MIGRATION 012: Add cancellation reason to orders
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add cancellation_reason and cancelled_at columns to orders table
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- No RLS changes needed — existing "Owners can manage orders" policy
-- already covers UPDATE for restaurant_owner role.
