import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MapPin, Clock, Phone, Star, Award, Leaf, Users } from "lucide-react";

export const metadata: Metadata = {
  title: "Chaurasia's Restaurant — Authentic Indian Cuisine, Prayagraj",
  description:
    "Fresh Pizza, Burger, Aloo Paratha & Delicious Fast Food. Tasty food, quality ingredients, and quick service at affordable prices.",
};



const STATS = [
  { icon: Star,  value: "4.3★",    label: "Customer Rating"     },
  { icon: Users, value: "5.000+", label: "Happy Customers"     },
  { icon: Award, value: "43+",     label: "Years of Excellence" },
  { icon: Leaf,  value: "100%",    label: "Fresh Ingredients"   },
];


export default function HomePage() {
  return (
    <div className="overflow-x-hidden">

      {/* ══════════════════ HERO ══════════════════ */}
      <section className="relative min-h-[92vh] flex items-center">
        {/* Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a0800] via-[#0d0d0d] to-[#0d0d0d]" />
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-red-800/8 rounded-full blur-[100px] pointer-events-none" />

        {/* Decorative pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "radial-gradient(circle, #f97316 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 py-20 w-full">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 mb-6 px-4 py-2 rounded-full text-sm font-medium"
              style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              Open Now · 11:00 AM – 11:30 PM
            </div>

            {/* Headline */}
            <h1 className="font-black text-5xl sm:text-6xl md:text-7xl text-white leading-[1.05] mb-6"
              style={{ fontFamily: "'Outfit', sans-serif" }}>
              A Taste of{" "}
              <span className="block" style={{ WebkitTextFillColor: "transparent",
                WebkitBackgroundClip: "text", backgroundClip: "text",
                backgroundImage: "linear-gradient(135deg, #f97316, #dc2626)" }}>
                Tasty Food, Student Budget
              </span>
            </h1>

            <p className="text-gray-400 text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl">
              Since 1980, Chaurasia's Restaurant is known for its famous Aloo Paratha, loved by students and food lovers alike. Along with our signature parathas, we serve fresh pizzas, juicy burgers, and delicious fast food at pocket-friendly prices. Great taste, fresh ingredients, and quick service in every order.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/about"
                className="btn-primary inline-flex items-center justify-center gap-2 text-base py-3.5 px-8">
                Discover Our Story
                <ArrowRight size={18} />
              </Link>
              <a href="tel:+917268076747"
                className="inline-flex items-center justify-center gap-2 text-base py-3.5 px-8 rounded-xl font-semibold transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.12)", color: "#e5e7eb",
                  background: "rgba(255,255,255,0.04)" }}>
                <Phone size={18} />
                Call Us
              </a>
            </div>

            {/* Quick Info */}
            <div className="flex flex-wrap gap-6 mt-12">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <MapPin size={15} className="text-orange-500 shrink-0" />
                Mahewa, Prayagraj, UP 211007
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={15} className="text-orange-500 shrink-0" />
                Daily: 11 AM – 11:30 PM
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Phone size={15} className="text-orange-500 shrink-0" />
                +91 72680 76747
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ STATS BAR ══════════════════ */}
      <section style={{ background: "#0f0f0f", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex flex-col items-center text-center gap-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                  style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <Icon size={18} className="text-orange-400" />
                </div>
                <p className="font-black text-2xl text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ WHY US ══════════════════ */}
      <section style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left text */}
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
                  { emoji: "🥔", title: "Famous Aloo Paratha", desc: "Our signature Aloo Paratha is freshly prepared every day with authentic flavors and quality ingredients, making it a favorite among students and families." },
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

              <Link href="/about"
                className="inline-flex items-center gap-2 mt-8 text-orange-400 font-semibold text-sm hover:text-orange-300 transition-colors">
                Read Our Full Story <ArrowRight size={16} />
              </Link>
            </div>

            {/* Right card */}
            <div className="relative">
              <div className="rounded-3xl p-8 text-center"
                style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(220,38,38,0.06))",
                  border: "1px solid rgba(249,115,22,0.2)" }}>
                <div className="text-7xl mb-6">🍱</div>
                <blockquote className="text-white text-xl font-semibold leading-relaxed mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  "Where every meal is a<br />celebration of India's<br />culinary heritage."
                </blockquote>
                <p className="text-orange-400 text-sm font-medium">— Chaurasia Ji, Founded 1980</p>

                {/* Stars */}
                <div className="flex justify-center gap-1 mt-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={16} className="text-yellow-400" fill="currentColor" />
                  ))}
                </div>
                <p className="text-gray-500 text-xs mt-2">Rated 4.3 on Google & Zomato</p>
              </div>

              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 w-20 h-20 rounded-2xl flex flex-col items-center justify-center text-center shadow-2xl"
                style={{ background: "linear-gradient(135deg, #f97316, #dc2626)" }}>
                <p className="text-white font-black text-lg leading-none">43+</p>
                <p className="text-white/80 text-[9px] font-medium leading-tight">Years of<br />Trust</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ CTA / VISIT US ══════════════════ */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-20">
        <div className="relative rounded-3xl p-10 md:p-16 text-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(220,38,38,0.08))",
            border: "1px solid rgba(249,115,22,0.2)" }}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px]" />
          <div className="relative">
            <p className="text-5xl mb-4">🏮</p>
            <h2 className="font-black text-3xl sm:text-4xl text-white mb-4" style={{ fontFamily: "'Outfit', sans-serif" }}>
              Visit Us Today
            </h2>
            <p className="text-gray-400 max-w-lg mx-auto mb-8">
              Come and experience the warmth of our kitchen. Whether it's a family gathering,
              a date, or a solo meal — Chaurasia Ji welcomes you with open arms.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a href="https://maps.google.com/?q=Mahewa,Prayagraj" target="_blank" rel="noreferrer"
                className="btn-primary inline-flex items-center justify-center gap-2 text-base py-3.5 px-8">
                <MapPin size={18} />
                Get Directions
              </a>
              <a href="tel:+917268076747"
                className="inline-flex items-center justify-center gap-2 text-base py-3.5 px-8 rounded-xl font-semibold transition-all"
                style={{ border: "1px solid rgba(255,255,255,0.15)", color: "#e5e7eb",
                  background: "rgba(255,255,255,0.05)" }}>
                <Phone size={18} />
                +91 72680 76747
              </a>
            </div>

            <p className="text-gray-600 text-sm mt-8">
              📍 123 Food Street, Mahewa, Prayagraj, Uttar Pradesh 221007
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}
