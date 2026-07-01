-- ============================================================
-- 008_delivery_radius.sql
-- Delivery Radius Management System
-- ============================================================

-- Restaurant settings (singleton row with id=1)
CREATE TABLE IF NOT EXISTS restaurant_settings (
  id                  INT PRIMARY KEY DEFAULT 1,
  restaurant_name     TEXT NOT NULL DEFAULT 'Chaurasia Ji',
  restaurant_lat      DOUBLE PRECISION NOT NULL DEFAULT 25.3176,
  restaurant_lng      DOUBLE PRECISION NOT NULL DEFAULT 82.9739,
  delivery_radius_km  DOUBLE PRECISION NOT NULL DEFAULT 5.0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default settings if not exists
INSERT INTO restaurant_settings (id, restaurant_name, restaurant_lat, restaurant_lng, delivery_radius_km)
VALUES (1, 'Chaurasia Ji', 25.3176, 82.9739, 5.0)
ON CONFLICT (id) DO NOTHING;

-- Add distance tracking to orders table
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_distance_km DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS radius_validated      BOOLEAN DEFAULT true;

-- RLS: Allow public read for restaurant_settings (needed for customer validation)
ALTER TABLE restaurant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "restaurant_settings_read_all"
  ON restaurant_settings FOR SELECT USING (true);

DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'restaurant_settings_owner_write') THEN
        CREATE POLICY "restaurant_settings_owner_write" ON restaurant_settings FOR ALL USING (
            EXISTS (
                SELECT 1 FROM users
                WHERE users.id = auth.uid()
                AND role IN ('restaurant_owner', 'admin')
            )
        );
    END IF;
END $$;
