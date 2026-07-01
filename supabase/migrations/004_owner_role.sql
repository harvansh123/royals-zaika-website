-- Migration 004: Add restaurant_owner role support
-- Run this in your Supabase SQL Editor

-- 1. Add restaurant_owner to the user_role ENUM type
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'restaurant_owner';

-- 2. Add stock_count column to menu_items (optional — for future stock tracking)
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS stock_count INTEGER DEFAULT NULL;

-- 3. Create a function to auto-set role from user metadata (for new signups)
CREATE OR REPLACE FUNCTION public.handle_new_user_with_role()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name, role, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer'),
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = EXCLUDED.email,
    name       = COALESCE(EXCLUDED.name, public.users.name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.users.avatar_url);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Replace the old trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_with_role();

-- 5. RLS policy: Allow restaurant_owner to manage menu_items
DROP POLICY IF EXISTS "Owners can manage menu items" ON public.menu_items;
CREATE POLICY "Owners can manage menu items"
  ON public.menu_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'restaurant_owner')
    )
  );

-- 6. RLS policy: Allow restaurant_owner to read and update orders
DROP POLICY IF EXISTS "Owners can manage orders" ON public.orders;
CREATE POLICY "Owners can manage orders"
  ON public.orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('admin', 'restaurant_owner')
    )
  );

-- 7. Useful: set yourself as restaurant_owner
-- UPDATE public.users SET role = 'restaurant_owner' WHERE email = 'your@email.com';

-- 8. Useful: set yourself as admin
-- UPDATE public.users SET role = 'admin' WHERE email = 'your@email.com';
