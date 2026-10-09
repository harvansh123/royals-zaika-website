-- Migration 015: Make delivery_address nullable for dine-in and takeaway orders
-- Dine-in and takeaway orders do not have a delivery address.
-- The NOT NULL constraint was set when only home delivery existed.

ALTER TABLE public.orders
  ALTER COLUMN delivery_address DROP NOT NULL;
