-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addresses          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coupons            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_partners  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_tracking  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications      ENABLE ROW LEVEL SECURITY;

-- Helper function
CREATE OR REPLACE FUNCTION public.get_user_role(uid UUID)
RETURNS user_role AS $$
  SELECT role FROM public.users WHERE id = uid;
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- USERS
-- ============================================================
CREATE POLICY "Users can view own profile"
  ON public.users FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins can view all users"
  ON public.users FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- ADDRESSES
-- ============================================================
CREATE POLICY "Users manage own addresses"
  ON public.addresses FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Admins view all addresses"
  ON public.addresses FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- CATEGORIES (public read)
-- ============================================================
CREATE POLICY "Anyone can view active categories"
  ON public.categories FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins manage categories"
  ON public.categories FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- MENU ITEMS (public read)
-- ============================================================
CREATE POLICY "Anyone can view available menu items"
  ON public.menu_items FOR SELECT USING (is_available = TRUE);

CREATE POLICY "Admins manage menu items"
  ON public.menu_items FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- COUPONS
-- ============================================================
CREATE POLICY "Authenticated users can view active coupons"
  ON public.coupons FOR SELECT
  USING (auth.uid() IS NOT NULL AND is_active = TRUE);

CREATE POLICY "Admins manage coupons"
  ON public.coupons FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- ORDERS
-- ============================================================
CREATE POLICY "Users view own orders"
  ON public.orders FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users create own orders"
  ON public.orders FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins view all orders"
  ON public.orders FOR SELECT
  USING (public.get_user_role(auth.uid()) IN ('admin', 'delivery'));

CREATE POLICY "Admins update orders"
  ON public.orders FOR UPDATE
  USING (public.get_user_role(auth.uid()) IN ('admin', 'delivery'));

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE POLICY "Users view own order items"
  ON public.order_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));

CREATE POLICY "Users create order items"
  ON public.order_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));

CREATE POLICY "Admins view all order items"
  ON public.order_items FOR SELECT
  USING (public.get_user_role(auth.uid()) IN ('admin', 'delivery'));

-- ============================================================
-- PAYMENTS
-- ============================================================
CREATE POLICY "Users view own payments"
  ON public.payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));

CREATE POLICY "Users create payments"
  ON public.payments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));

CREATE POLICY "Admins view all payments"
  ON public.payments FOR SELECT
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- DELIVERY PARTNERS
-- ============================================================
CREATE POLICY "Delivery partners view own profile"
  ON public.delivery_partners FOR SELECT USING (id = auth.uid());

CREATE POLICY "Delivery partners update own profile"
  ON public.delivery_partners FOR UPDATE USING (id = auth.uid());

CREATE POLICY "Admins manage delivery partners"
  ON public.delivery_partners FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- DELIVERY TRACKING
-- ============================================================
CREATE POLICY "Users view tracking for own orders"
  ON public.delivery_tracking FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND user_id = auth.uid()));

CREATE POLICY "Delivery partners update tracking"
  ON public.delivery_tracking FOR ALL
  USING (partner_id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin');

-- ============================================================
-- REVIEWS
-- ============================================================
CREATE POLICY "Anyone can view reviews"
  ON public.reviews FOR SELECT USING (TRUE);

CREATE POLICY "Users manage own reviews"
  ON public.reviews FOR ALL USING (user_id = auth.uid());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE POLICY "Users view own notifications"
  ON public.notifications FOR SELECT USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users update own notifications"
  ON public.notifications FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Admins manage notifications"
  ON public.notifications FOR ALL
  USING (public.get_user_role(auth.uid()) = 'admin');
