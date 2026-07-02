import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Phone, Star, Award, Leaf, Users } from "lucide-react";
import { createClient } from "@supabase/supabase-js";

export const metadata: Metadata = {
  title: "Chaurasia's Restaurant — Authentic Indian Cuisine, Prayagraj",
  description:
    "Fresh Pizza, Burger, Aloo Paratha & Delicious Fast Food. Tasty food, quality ingredients, and quick service at affordable prices.",
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

const STATS = [
  { icon: Star,  value: "4.3★",   label: "Customer Rating"     },
  { icon: Users, value: "5,000+", label: "Happy Customers"     },
  { icon: Award, value: "43+",    label: "Years of Excellence" },
  { icon: Leaf,  value: "100%",   label: "Fresh Ingredients"   },
];

export default async function HomePage() {
  const topRatedItems = await getTopRatedItems();

  return (
    <div className="overflow-x-hidden">

      {/* ══ HERO ══ */}
      <section className="relative min-h-[92vh] flex items-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0800] via-[#0d0d0d] to-[#0d0d0d]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-800/8 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, #f97316 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-20 w-full">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Open Now · 11:00 AM – 11:30 PM
            </div>

            <h1 className="font-black text-5xl sm:text-6xl md:text-7xl text-white leading-[1.05] mb-6"
              style={{ fontFamily: "'Outfit', sans-serif" }}>
              A Taste of{" "}
              <span className="block" style={{
                WebkitTextFillColor: "transparent",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                backgroundImage: "linear-gradient(135deg,#f97316,#dc2626)",
              }}>
                Tradition
              </span>
            </h1>

            <p className="text-gray-400 text-lg sm:text-xl leading-relaxed mb-8 max-w-xl">
              Authentic North Indian flavours crafted with love and generations of culinary wisdom.
              Freshly made, every single day.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/menu" className="btn-primary inline-flex items-center justify-center gap-2 text-base py-3.5 px-8">
                Order Now <ArrowRight size={18} />
              </Link>
              <Link href="/about"
                className="inline-flex items-center justify-center gap-2 text-base py-3.5 px-8 rounded-xl font-semibold transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.15)", color: "#e5e7eb", background: "rgba(255,255,255,0.05)" }}>
                Our Story
              </Link>
            </div>

            <div className="flex flex-wrap gap-6 mt-12">
              {STATS.map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon size={16} className="text-orange-400" />
                  <span className="font-bold text-white">{value}</span>
                  <span className="text-gray-500 text-sm">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ STATS BAR ══ */}
      <section style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center text-white">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl sm:text-3xl font-black">{value}</p>
                <p className="text-sm opacity-80">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ TOP RATED DISHES ══ */}
      {topRatedItems.length > 0 && (
        <section style={{ background: "#0d0d0d", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
            <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
              <div>
                <p className="text-orange-500 text-sm font-semibold tracking-widest uppercase mb-1">Based on Real Reviews</p>
                <h2 className="font-black text-3xl sm:text-4xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  ⭐ Customer Favorites
                </h2>
              </div>
              <Link href="/menu"
                className="flex items-center gap-2 text-sm font-semibold text-orange-400 hover:text-orange-300 transition-colors">
                View Full Menu <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {topRatedItems.map((item: any) => (
                <Link key={item.id} href={`/reviews/${item.id}`}
                  className="group rounded-2xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-xl"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div className="relative h-28 w-full">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl"
                        style={{ background: "rgba(249,115,22,0.1)" }}>🍽️</div>
                    )}
                    <div className={`absolute top-2 left-2 w-4 h-4 rounded-sm border-2 flex items-center justify-center ${item.is_veg ? "border-green-500" : "border-red-500"}`}>
                      <div className={`w-2 h-2 rounded-full ${item.is_veg ? "bg-green-500" : "bg-red-500"}`} />
                    </div>
                  </div>
                  <div className="p-3">
                    <p className="font-semibold text-white text-xs leading-snug line-clamp-2 mb-2">{item.name}</p>
                    <div className="flex items-center gap-1 mb-1">
                      <Star size={11} className="text-yellow-400 fill-yellow-400" />
                      <span className="text-yellow-400 text-xs font-bold">{item.rating.toFixed(1)}</span>
                      <span className="text-gray-500 text-[10px]">({item.review_count})</span>
                    </div>
                    <p className="text-[10px] text-gray-500 group-hover:text-orange-400 transition-colors">
                      Tap to view reviews →
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ══ WHY US ══ */}
      <section style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-orange-500 text-sm font-semibold tracking-widest uppercase mb-3">Our Promise</p>
              <h2 className="font-black text-3xl sm:text-4xl text-white mb-6 leading-tight" style={{ fontFamily: "'Outfit', sans-serif" }}>
                Why Families Choose<br />Chaurasia Ji
              </h2>
              <p className="text-gray-500 leading-relaxed mb-8">
                For over a decade, we've remained committed to one simple belief: great food
                starts with great ingredients and genuine care. No shortcuts, no compromises.
              </p>
              <ul className="space-y-4">
                {[
                  { emoji: "🌿", title: "Farm-Fresh Ingredients",   desc: "Sourced fresh every morning from local farms and markets." },
                  { emoji: "👨‍🍳", title: "Master Chefs",              desc: "20+ years of expertise in authentic North Indian cooking." },
                  { emoji: "🏺", title: "Traditional Recipes",      desc: "Original recipes unchanged since our founding in 2010." },
                  { emoji: "✨", title: "Hygienic Kitchen",          desc: "FSSAI certified. Clean, safe, and transparent food preparation." },
                  { emoji: "🥔", title: "Famous Aloo Paratha",      desc: "Our signature Aloo Paratha is freshly prepared every day with authentic flavors and quality ingredients, making it a favorite among students and families." },
                ].map(({ emoji, title, desc }) => (
                  <li key={title} className="flex items-start gap-4">
                    <span className="text-2xl shrink-0 mt-0.5">{emoji}</span>
                    <div>
                      <p className="font-semibold text-white text-sm">{title}</p>
                      <p className="text-gray-500 text-sm mt-0.5">{desc}</p>
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
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  <p className="text-3xl mb-3">{emoji}</p>
                  <p className="font-bold text-white text-sm mb-1">{title}</p>
                  <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══ POPULAR CATEGORIES ══ */}
      <section style={{ background: "#0d0d0d", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16 text-center">
          <p className="text-orange-500 text-sm font-semibold tracking-widest uppercase mb-3">Explore</p>
          <h2 className="font-black text-3xl sm:text-4xl text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Something for Everyone
          </h2>
          <p className="text-gray-500 max-w-lg mx-auto mb-10">
            From sizzling tandoori mains to fresh rotis and indulgent desserts — discover your next favourite.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {["🍕 Pizza", "🍔 Burgers", "🥗 Salads", "🍛 Curries", "🫓 Parathas", "🍮 Desserts"].map((cat) => (
              <Link key={cat} href="/menu"
                className="px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)", color: "#fb923c" }}>
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

      {/* ══ VISIT US ══ */}
      <section className="text-center py-20 px-5"
        style={{ background: "linear-gradient(to bottom, #0a0a0a, #1a0800)" }}>
        <div className="max-w-2xl mx-auto">
          <p className="text-5xl mb-4">🏮</p>
          <h2 className="font-black text-3xl sm:text-4xl text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
            Visit Us Today
          </h2>
          <p className="text-gray-400 max-w-lg mx-auto mb-8">
            Come and experience the warmth of our kitchen. Whether it is a family gathering,
            a date, or a solo meal — Chaurasia Ji welcomes you with open arms.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="https://maps.google.com/?q=Mahewa,Prayagraj" target="_blank" rel="noreferrer"
              className="btn-primary inline-flex items-center justify-center gap-2 text-base py-3.5 px-8">
              <MapPin size={18} /> Get Directions
            </a>
            <a href="tel:+917268076747"
              className="inline-flex items-center justify-center gap-2 text-base py-3.5 px-8 rounded-xl font-semibold transition-all"
              style={{ border: "1px solid rgba(255,255,255,0.15)", color: "#e5e7eb", background: "rgba(255,255,255,0.05)" }}>
              <Phone size={18} /> +91 72680 76747
            </a>
          </div>
          <p className="text-gray-600 text-sm mt-8">
            📍 123 Food Street, Mahewa, Prayagraj, Uttar Pradesh 221007
          </p>
        </div>
      </section>

    </div>
  );
}
