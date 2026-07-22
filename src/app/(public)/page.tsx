import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Phone, Star, Award, Leaf, Users } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import HeroStatusWidget from "@/components/restaurant/HeroStatusWidget";
import { AuthRedirect } from "@/components/auth/AuthRedirect";
import type { RestaurantTimingSettings } from "@/hooks/useRestaurantStatus";

export const metadata: Metadata = {
  title: "Royal Zaika – The Taste of Kings, Prayagraj",
  description:
    "Fresh Pizza, Burger, Shahi Paneer & Delicious Fast Food. Tasty food, quality ingredients, and quick service at affordable prices.",
};

async function getTopRatedItems() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await supabase
      .from("menu_items")
      .select("id, name, image_url, rating, review_count, price, discounted_price, is_veg")
      .eq("is_available", true)
      .gt("review_count", 0)
      .order("rating", { ascending: false })
      .limit(6);
    return data ?? [];
  } catch {
    return [];
  }
}

async function getRestaurantSettings(): Promise<RestaurantTimingSettings> {
  const defaults: RestaurantTimingSettings = {
    opening_time: "11:00",
    closing_time: "24:00",
    status_mode: "auto",
    is_open: true,
    updated_at: new Date().toISOString(),
  };
  try {
    const sb = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data } = await sb
      .from("restaurant_settings")
      .select("opening_time, closing_time, status_mode, is_open, updated_at")
      .eq("id", 1)
      .single();
    if (data) return { ...defaults, ...data };
  } catch {}
  return defaults;
}

const STATS = [
  { icon: Star,  value: "4.3★",   label: "Customer Rating"     },
  { icon: Users, value: "5,000+", label: "Happy Customers"     },
  { icon: Award, value: "1+",    label: "Years of Excellence" },
  { icon: Leaf,  value: "100%",   label: "Fresh Ingredients"   },
];

export default async function HomePage() {
  const [topRatedItems, restaurantSettings] = await Promise.all([
    getTopRatedItems(),
    getRestaurantSettings(),
  ]);

  return (
    <div className="overflow-x-hidden">
      <AuthRedirect />

      {/* ══ HERO ══ */}
      <section className="relative min-h-[92vh] flex items-center">
        {/* Rich charcoal-to-dark-brown gradient — premium restaurant feel */}
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #1F2937 0%, #111827 50%, #1a0e04 100%)" }} />
        {/* Warm amber glow — top right */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[130px] pointer-events-none"
          style={{ background: "rgba(251,191,36,0.07)" }} />
        {/* Soft orange glow — bottom left */}
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[120px] pointer-events-none"
          style={{ background: "rgba(249,115,22,0.08)" }} />
        {/* Subtle dot grid overlay */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #fbbf24 1px, transparent 1px)", backgroundSize: "44px 44px" }} />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-20 w-full">
          <div className="max-w-3xl">
            {/* ── Dynamic restaurant status + CTA ── */}
            <HeroStatusWidget initialSettings={restaurantSettings} />

            <h1 className="font-black text-5xl sm:text-6xl md:text-7xl leading-[1.05] mb-6 mt-6"
              style={{ fontFamily: "'Outfit', sans-serif", color: "#FFF8F0" }}>
              A Taste of{" "}
              <span className="block" style={{
                WebkitTextFillColor: "transparent",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                backgroundImage: "linear-gradient(135deg, #FBBF24 0%, #F97316 60%, #dc2626 100%)",
              }}>
                Tradition
              </span>
            </h1>

            <p style={{ color: "#d1bfa8" }} className="text-lg sm:text-xl leading-relaxed mb-8 max-w-xl">
              Authentic North Indian flavours crafted with love and generations of culinary wisdom.
              Freshly made, every single day.
            </p>

            <div className="mt-4">
              <Link href="/about"
                className="inline-flex items-center justify-center gap-2 text-base py-3.5 px-8 rounded-xl font-semibold transition-all hover:bg-white/10"
                style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#FFF8F0", background: "rgba(255,255,255,0.06)" }}>
                Our Story
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 mt-12">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={16} style={{ color: "#FBBF24" }} />
                  <span className="font-bold" style={{ color: "#FFF8F0" }}>{value}</span>
                  <span className="text-sm" style={{ color: "#9ca3af" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ══ */}
      <section style={{ background: "linear-gradient(135deg, #F97316, #dc2626)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-white">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl sm:text-3xl font-black">{value}</p>
                <p className="text-sm" style={{ opacity: 0.88 }}>{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TOP RATED DISHES ══ — Warm Cream light section */}
      {topRatedItems.length > 0 && (
        <section style={{ background: "#FFF8F0", borderTop: "1px solid #F5E6D3" }}>
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <p className="text-sm font-semibold tracking-widest uppercase mb-1"
                  style={{ color: "#F97316" }}>Based on Real Reviews</p>
                <h2 className="font-black text-3xl sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif", color: "#1F2937" }}>
                  ⭐ Customer Favorites
                </h2>
              </div>
              <Link href="/menu"
                className="flex items-center gap-2 text-sm font-semibold transition-colors hover:opacity-80"
                style={{ color: "#F97316" }}>
                View Full Menu <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {topRatedItems.map((item: any) => (
                <Link key={item.id} href={`/reviews/${item.id}`}
                  className="group rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl"
                  style={{ background: "#FFFFFF", border: "1px solid #F5E6D3", boxShadow: "0 2px 8px rgba(31,41,55,0.06)" }}>
                  <div className="relative h-28 w-full">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl"
                        style={{ background: "rgba(249,115,22,0.08)" }}>🍽️</div>
                    )}
                    <div className={`absolute top-2 left-2 w-4 h-4 rounded-sm border-2 flex items-center justify-center ${item.is_veg ? "border-green-600" : "border-red-500"}`}>
                      <div className={`w-2 h-2 rounded-full ${item.is_veg ? "bg-green-600" : "bg-red-500"}`} />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-xs leading-snug line-clamp-2 mb-2" style={{ color: "#1F2937" }}>{item.name}</p>
                    <div className="flex items-center gap-1 mb-1">
                      <Star size={11} className="text-yellow-500 fill-yellow-500" />
                      <span className="text-xs font-bold text-yellow-600">{item.rating.toFixed(1)}</span>
                      <span className="text-[10px]" style={{ color: "#9ca3af" }}>({item.review_count})</span>
                    </div>
                    <p className="text-[10px] transition-colors group-hover:text-orange-500" style={{ color: "#9ca3af" }}>
                      Tap to view reviews →
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ WHY US ══ — Deep Charcoal dark section */}
      <section style={{ background: "#1F2937", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#FBBF24" }}>Our Promise</p>
              <h2 className="font-black text-3xl sm:text-4xl mb-6 leading-tight" style={{ fontFamily: "'Outfit', sans-serif", color: "#FFF8F0" }}>
                Why Families Choose<br />Royal Zaika
              </h2>
              <p className="leading-relaxed mb-8" style={{ color: "#9ca3af" }}>
                For over a decade, we've remained committed to one simple belief: great food
                starts with great ingredients and genuine care. No shortcuts, no compromises.
              </p>
              <ul className="space-y-4">
                {[
                  { emoji: "🌿", title: "Farm-Fresh Ingredients",   desc: "Sourced fresh every morning from local farms and markets." },
                  { emoji: "👨‍🍳", title: "Master Chefs",              desc: "2+ years of expertise in authentic North Indian cooking." },
                  { emoji: "🏺", title: "Traditional Recipes",      desc: "Original recipes unchanged since our founding in 2025." },
                  { emoji: "✨", title: "Hygienic Kitchen",          desc: "FSSAI certified. Clean, safe, and transparent food preparation." },
                  { emoji: "🥘", title: "Famous Shahi Paneer ",      desc: "Our signature Shahi Paneer is freshly prepared every day with authentic flavors and quality ingredients, making it a favorite among students and families." },
                ].map(({ emoji, title, desc }) => (
                  <li key={title} className="flex items-start gap-4">
                    <span className="text-2xl shrink-0 mt-0.5">{emoji}</span>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: "#FFF8F0" }}>{title}</p>
                      <p className="text-sm mt-0.5" style={{ color: "#9ca3af" }}>{desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { emoji: "🍽️", title: "50+ Menu Items",  desc: "Curated selection of the finest North Indian dishes." },
                { emoji: "⚡", title: "30-Min Delivery", desc: "Lightning-fast delivery to your doorstep." },
                { emoji: "💰", title: "Best Value",      desc: "Premium quality food at affordable prices." },
                { emoji: "⭐", title: "Real Reviews",    desc: "Transparent customer ratings on every dish." },
              ].map(({ emoji, title, desc }) => (
                <div key={title} className="rounded-2xl p-5 transition-all hover:scale-[1.02]"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
                  <p className="text-3xl mb-3">{emoji}</p>
                  <p className="font-bold text-sm mb-1" style={{ color: "#FFF8F0" }}>{title}</p>
                  <p className="text-xs leading-relaxed" style={{ color: "#9ca3af" }}>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ POPULAR CATEGORIES ══ — Soft warm white section */}
      <section style={{ background: "#F9FAFB", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 text-center">
          <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#F97316" }}>Explore</p>
          <h2 className="font-black text-3xl sm:text-4xl mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "#1F2937" }}>
            Something for Everyone
          </h2>
          <p className="max-w-lg mx-auto mb-10" style={{ color: "#6B7280" }}>
            From sizzling tandoori mains to fresh rotis and indulgent desserts — discover your next favourite.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["🍕 Pizza", "🍔 Burgers", "🥗 Salads", "🍛 Curries", "🫓 Parathas", "🍮 Desserts"].map((cat) => (
              <Link key={cat} href="/menu"
                className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105"
                style={{ background: "#FFF8F0", border: "1px solid #F97316", color: "#C2410C" }}>
                {cat}
              </Link>
            ))}
          </div>
          <div className="mt-8">
            <Link href="/menu" className="btn-primary inline-flex items-center gap-2 py-3.5 px-10 text-base">
              Browse Full Menu <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══ VISIT US ══ — Deep charcoal with warm golden CTA */}
      <section className="text-center py-20 px-5"
        style={{ background: "linear-gradient(135deg, #1F2937 0%, #111827 60%, #1a0e04 100%)" }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-5xl mb-4">🏮</p>
          <h2 className="font-black text-3xl sm:text-4xl mb-4" style={{ fontFamily: "'Outfit', sans-serif", color: "#FFF8F0" }}>
            Visit Us Today
          </h2>
          <p className="max-w-lg mx-auto mb-8" style={{ color: "#d1bfa8" }}>
            Come and experience the warmth of our kitchen. Whether it is a family gathering,
            a date, or a solo meal — Royal Zaika welcomes you with open arms.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://maps.google.com/?q=Naini Station,Prayagraj" target="_blank" rel="noreferrer"
              className="btn-primary inline-flex items-center justify-center gap-2 text-base py-3.5 px-8">
              <MapPin size={18} /> Get Directions
            </a>
            <a href="tel:+917379294659"
              className="inline-flex items-center justify-center gap-2 text-base py-3.5 px-8 rounded-xl font-semibold transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.2)", color: "#FFF8F0", background: "rgba(255,255,255,0.06)" }}>
              <Phone size={18} /> +91 73792 94659
            </a>
          </div>
          <p className="text-sm mt-8" style={{ color: "#6B7280" }}>
            📍 Chak Raghunath, Naini Station, Prayagraj, Uttar Pradesh 221008
          </p>
        </div>
      </section>

    </div>
  );
}
