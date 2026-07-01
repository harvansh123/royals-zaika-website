-- ============================================================
-- 013_restaurant_online_offline.sql
-- Add is_open column to restaurant_settings for owner control
-- ============================================================

-- Add is_open: true means restaurant is open for orders,
-- false means it is temporarily closed and no new orders are allowed.
ALTER TABLE public.restaurant_settings
  ADD COLUMN IF NOT EXISTS is_open BOOLEAN NOT NULL DEFAULT TRUE;

-- Done. Run this in the Supabase SQL Editor.
-- After running, the GET /api/restaurant-settings response will
-- include is_open. Existing rows default to TRUE (open).
