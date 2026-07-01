-- ============================================================
-- 010_menu_realtime.sql
-- Enable Realtime for menu_items and categories tables
-- so the customer menu page gets live updates when owner
-- adds, edits, or removes items.
-- ============================================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.menu_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
