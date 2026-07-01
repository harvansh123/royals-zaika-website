-- ============================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_tracking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- ============================================================
-- STORAGE BUCKETS (Run in Supabase Dashboard > Storage)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('food-images', 'food-images', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage Policies (run after creating buckets)
-- CREATE POLICY "Public food images" ON storage.objects FOR SELECT USING (bucket_id = 'food-images');
-- CREATE POLICY "Admins upload food images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'food-images' AND public.get_user_role(auth.uid()) = 'admin');
-- CREATE POLICY "Public avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
-- CREATE POLICY "Users upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- SEED: CATEGORIES
-- ============================================================
INSERT INTO public.categories (name, slug, icon, sort_order, is_active) VALUES
  ('Thali',        'thali',        '🍱', 1, TRUE),
  ('Sabzi',        'sabzi',        '🥘', 2, TRUE),
  ('Dal',          'dal',          '🫕', 3, TRUE),
  ('Rice & Biryani','rice-biryani','🍚', 4, TRUE),
  ('Roti & Paratha','roti-paratha','🫓', 5, TRUE),
  ('Snacks',       'snacks',       '🥪', 6, TRUE),
  ('Sweets',       'sweets',       '🍮', 7, TRUE),
  ('Drinks',       'drinks',       '🥤', 8, TRUE);

-- ============================================================
-- SEED: MENU ITEMS
-- ============================================================
INSERT INTO public.menu_items (category_id, name, slug, description, price, is_veg, is_featured, is_bestseller, spice_level, preparation_time)
SELECT c.id, items.name, items.slug, items.description, items.price, items.is_veg, items.is_featured, items.is_bestseller, items.spice_level, items.prep_time
FROM (VALUES
  ('thali',       'Special Thali',       'special-thali',       'Complete meal with 2 sabzi, dal, rice, roti, salad & sweet', 249, TRUE, TRUE,  TRUE,  2, 25),
  ('thali',       'Mini Thali',          'mini-thali',          'Light meal with 1 sabzi, dal, 2 roti & sweet',              149, TRUE, FALSE, FALSE, 1, 20),
  ('sabzi',       'Paneer Butter Masala','paneer-butter-masala','Creamy tomato-based paneer curry',                         199, TRUE, TRUE,  TRUE,  2, 20),
  ('sabzi',       'Aloo Gobi',           'aloo-gobi',           'Classic potato & cauliflower dry sabzi',                   129, TRUE, FALSE, FALSE, 2, 15),
  ('sabzi',       'Palak Paneer',        'palak-paneer',        'Spinach & cottage cheese curry',                           189, TRUE, TRUE,  FALSE, 1, 20),
  ('dal',         'Dal Makhani',         'dal-makhani',         'Slow-cooked black lentils in buttery tomato gravy',        159, TRUE, TRUE,  TRUE,  2, 30),
  ('dal',         'Dal Tadka',           'dal-tadka',           'Yellow lentils tempered with cumin & garlic',              109, TRUE, FALSE, FALSE, 2, 15),
  ('rice-biryani','Veg Biryani',         'veg-biryani',         'Fragrant basmati rice cooked with vegetables & spices',   229, TRUE, TRUE,  TRUE,  3, 35),
  ('rice-biryani','Jeera Rice',          'jeera-rice',          'Basmati rice tempered with cumin seeds',                   89, TRUE, FALSE, FALSE, 1, 15),
  ('roti-paratha','Tandoori Roti',       'tandoori-roti',       'Whole wheat bread baked in clay oven',                     20, TRUE, FALSE, FALSE, 1,  8),
  ('roti-paratha','Butter Naan',         'butter-naan',         'Soft leavened bread brushed with butter',                  30, TRUE, FALSE, TRUE,  1, 10),
  ('roti-paratha','Aloo Paratha',        'aloo-paratha',        'Stuffed flatbread with spiced potato filling',             70, TRUE, FALSE, TRUE,  2, 15),
  ('snacks',      'Samosa (2 pcs)',       'samosa',              'Crispy fried pastry with spiced potato filling',           40, TRUE, TRUE,  TRUE,  2, 10),
  ('snacks',      'Pav Bhaji',           'pav-bhaji',           'Spiced vegetable mash served with buttered pav',          120, TRUE, TRUE,  TRUE,  3, 15),
  ('snacks',      'Aloo Tikki',          'aloo-tikki',          'Crispy potato patties with chutneys',                      60, TRUE, FALSE, FALSE, 2, 10),
  ('sweets',      'Gulab Jamun (2 pcs)', 'gulab-jamun',         'Soft milk dumplings soaked in rose sugar syrup',           50, TRUE, TRUE,  TRUE,  1,  5),
  ('sweets',      'Kheer',               'kheer',               'Traditional rice pudding with cardamom & dry fruits',      69, TRUE, FALSE, FALSE, 1, 10),
  ('drinks',      'Lassi (Sweet)',        'lassi-sweet',         'Chilled yogurt-based drink',                               59, TRUE, FALSE, TRUE,  1,  5),
  ('drinks',      'Masala Chaas',        'masala-chaas',        'Spiced buttermilk with mint & cumin',                      39, TRUE, FALSE, FALSE, 1,  5),
  ('drinks',      'Fresh Lime Water',    'fresh-lime-water',    'Refreshing nimbu pani with black salt',                    29, TRUE, FALSE, FALSE, 1,  5)
) AS items(cat_slug, name, slug, description, price, is_veg, is_featured, is_bestseller, spice_level, prep_time)
JOIN public.categories c ON c.slug = items.cat_slug;

-- ============================================================
-- SEED: COUPONS
-- ============================================================
INSERT INTO public.coupons (code, description, discount_type, discount_value, min_order_amount, max_discount, usage_limit) VALUES
  ('WELCOME50',  'Welcome offer - 50% off on first order', 'percentage', 50,  100, 100, 1000),
  ('FLAT30',     'Flat ₹30 off on orders above ₹199',     'fixed',       30,  199, NULL, 5000),
  ('BIRYANI20',  '20% off on Biryani orders',              'percentage',  20,  149, 50,  2000),
  ('NEWUSER',    'New user special - ₹50 off',             'fixed',        50,  149, NULL, 500);
