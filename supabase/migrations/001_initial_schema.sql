-- ============================================================
-- CHAURASIA JI - Complete Database Schema
-- Run in Supabase SQL Editor
-- ============================================================

-- Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE order_status AS ENUM (
  'pending', 'confirmed', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled'
);
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed');
CREATE TYPE payment_method AS ENUM ('razorpay', 'cash_on_delivery');
CREATE TYPE delivery_status AS ENUM ('idle', 'assigned', 'picked_up', 'delivered');
CREATE TYPE user_role AS ENUM ('customer', 'admin', 'delivery');

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL DEFAULT '',
  email           TEXT,
  phone           TEXT,
  avatar_url      TEXT,
  role            user_role NOT NULL DEFAULT 'customer',
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ADDRESSES
-- ============================================================
CREATE TABLE public.addresses (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label           TEXT NOT NULL DEFAULT 'Home',
  address_line1   TEXT NOT NULL,
  address_line2   TEXT,
  city            TEXT NOT NULL,
  state           TEXT NOT NULL,
  pincode         TEXT NOT NULL,
  latitude        DECIMAL(10, 8),
  longitude       DECIMAL(11, 8),
  is_default      BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE public.categories (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  image_url       TEXT,
  icon            TEXT DEFAULT '🍽️',
  sort_order      INTEGER DEFAULT 0,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- MENU ITEMS
-- ============================================================
CREATE TABLE public.menu_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category_id     UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL UNIQUE,
  description     TEXT,
  price           DECIMAL(10, 2) NOT NULL,
  discounted_price DECIMAL(10, 2),
  image_url       TEXT,
  is_veg          BOOLEAN DEFAULT TRUE,
  is_available    BOOLEAN DEFAULT TRUE,
  is_featured     BOOLEAN DEFAULT FALSE,
  is_bestseller   BOOLEAN DEFAULT FALSE,
  spice_level     INTEGER DEFAULT 1 CHECK (spice_level BETWEEN 1 AND 5),
  preparation_time INTEGER DEFAULT 20,
  calories        INTEGER,
  tags            TEXT[] DEFAULT '{}',
  sort_order      INTEGER DEFAULT 0,
  rating          DECIMAL(3,2) DEFAULT 0,
  review_count    INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- COUPONS
-- ============================================================
CREATE TABLE public.coupons (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            TEXT NOT NULL UNIQUE,
  description     TEXT,
  discount_type   TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value  DECIMAL(10, 2) NOT NULL,
  min_order_amount DECIMAL(10, 2) DEFAULT 0,
  max_discount    DECIMAL(10, 2),
  usage_limit     INTEGER,
  used_count      INTEGER DEFAULT 0,
  valid_from      TIMESTAMPTZ DEFAULT NOW(),
  valid_until     TIMESTAMPTZ,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE public.orders (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number    TEXT NOT NULL UNIQUE DEFAULT 'CJ-' || UPPER(SUBSTRING(gen_random_uuid()::TEXT, 1, 8)),
  user_id         UUID NOT NULL REFERENCES public.users(id),
  status          order_status DEFAULT 'pending',
  payment_method  payment_method NOT NULL,
  payment_status  payment_status DEFAULT 'pending',
  subtotal        DECIMAL(10, 2) NOT NULL,
  delivery_fee    DECIMAL(10, 2) DEFAULT 40,
  discount_amount DECIMAL(10, 2) DEFAULT 0,
  total_amount    DECIMAL(10, 2) NOT NULL,
  coupon_id       UUID REFERENCES public.coupons(id),
  delivery_address JSONB NOT NULL,
  special_instructions TEXT,
  estimated_time  INTEGER DEFAULT 30,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  delivered_at    TIMESTAMPTZ
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE public.order_items (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id    UUID NOT NULL REFERENCES public.menu_items(id),
  name            TEXT NOT NULL,
  price           DECIMAL(10, 2) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  subtotal        DECIMAL(10, 2) NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE TABLE public.payments (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id            UUID NOT NULL REFERENCES public.orders(id),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  amount              DECIMAL(10, 2) NOT NULL,
  currency            TEXT DEFAULT 'INR',
  status              payment_status DEFAULT 'pending',
  method              payment_method NOT NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DELIVERY PARTNERS
-- ============================================================
CREATE TABLE public.delivery_partners (
  id              UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  phone           TEXT NOT NULL,
  vehicle_type    TEXT DEFAULT 'bike',
  vehicle_number  TEXT,
  is_available    BOOLEAN DEFAULT TRUE,
  current_lat     DECIMAL(10, 8),
  current_lng     DECIMAL(11, 8),
  total_deliveries INTEGER DEFAULT 0,
  rating          DECIMAL(3, 2) DEFAULT 5.0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DELIVERY TRACKING
-- ============================================================
CREATE TABLE public.delivery_tracking (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id        UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  partner_id      UUID REFERENCES public.delivery_partners(id),
  latitude        DECIMAL(10, 8),
  longitude       DECIMAL(11, 8),
  status          delivery_status DEFAULT 'assigned',
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE TABLE public.reviews (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id),
  menu_item_id    UUID NOT NULL REFERENCES public.menu_items(id),
  order_id        UUID REFERENCES public.orders(id),
  rating          INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, menu_item_id, order_id)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID REFERENCES public.users(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  message         TEXT NOT NULL,
  type            TEXT DEFAULT 'info',
  is_read         BOOLEAN DEFAULT FALSE,
  data            JSONB,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX idx_menu_items_category ON public.menu_items(category_id);
CREATE INDEX idx_menu_items_available ON public.menu_items(is_available);
CREATE INDEX idx_notifications_user ON public.notifications(user_id, is_read);
CREATE INDEX idx_delivery_tracking_order ON public.delivery_tracking(order_id);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at        BEFORE UPDATE ON public.users           FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_menu_items_updated_at   BEFORE UPDATE ON public.menu_items      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_orders_updated_at       BEFORE UPDATE ON public.orders          FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    NEW.raw_user_meta_data->>'avatar_url',
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'customer')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- UPDATE REVIEW RATING ON MENU ITEMS
-- ============================================================
CREATE OR REPLACE FUNCTION update_menu_item_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.menu_items
  SET
    rating = (SELECT AVG(rating) FROM public.reviews WHERE menu_item_id = NEW.menu_item_id),
    review_count = (SELECT COUNT(*) FROM public.reviews WHERE menu_item_id = NEW.menu_item_id)
  WHERE id = NEW.menu_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_rating_on_review
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION update_menu_item_rating();
