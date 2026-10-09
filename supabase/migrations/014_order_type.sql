-- ============================================================
-- 014_order_type.sql
-- Add order_type, table_number, guest_count to orders table
-- Supports: dine_in | takeaway | home_delivery
-- Historical orders default safely to 'home_delivery'
-- ============================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS order_type   TEXT    NOT NULL DEFAULT 'home_delivery',
  ADD COLUMN IF NOT EXISTS table_number TEXT,
  ADD COLUMN IF NOT EXISTS guest_count  INTEGER;

-- Done. Run this in the Supabase SQL Editor.
-- After running, new orders will include order_type.
-- Existing orders remain unaffected (default = home_delivery).
