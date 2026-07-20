import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone, MapPin, Clock, Award, Heart, Leaf, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us | Chaurasia Ji — Authentic Indian Cuisine",
  description:
    "Learn the story of Chaurasia Ji — a family restaurant rooted in Varanasi's rich culinary tradition. Serving authentic North Indian food since 2010 with love, heritage, and quality.",
};

const MILESTONES = [
  { year: "2010", title: "The Beginning",         desc: "Founded by Shri Ram Prasad Chaurasia with a humble kitchen and a dream to share his family's recipes with Varanasi." },
  { year: "2013", title: "First Expansion",        desc: "Expanded the dining hall to accommodate the growing flood of loyal customers. Added the famous Dum Biryani to our menu." },
  { year: "2016", title: "FSSAI Certification",   desc: "Achieved FSSAI certification, reaffirming our commitment to the highest standards of food safety and hygiene." },
  { year: "2019", title: "50,000 Customers",       desc: "Celebrated serving our 50,000th customer — a milestone made possible by our dedicated team and your continued trust." },
  { year: "2022", title: "Best Restaurant Award",  desc: "Honoured with the 'Best North Indian Restaurant' award at the Varanasi Food Excellence Awards." },
  { year: "2024", title: "Continuing the Legacy",  desc: "Still serving the same authentic recipes, the same love, and the same commitment — now joined by the next generation." },
];

const VALUES = [
  {
    icon: Leaf,
    title: "Freshness First",
    desc: "We source vegetables, spices, and dairy directly from trusted local farms every single morning. If it's not fresh, it doesn't enter our kitchen.",
  },
  {
    icon: Heart,
    title: "Cooked with Love",
    desc: "Our chefs don't just cook — they craft. Every dish carries the warmth and passion of a family kitchen, served with genuine care.",
  },
  {
    icon: Shield,
    title: "Uncompromising Hygiene",
    desc: "Our kitchen follows strict FSSAI guidelines. Clean surfaces, proper storage, and transparent food preparation are non-negotiable.",
  },
  {
    icon: Award,
    title: "Consistent Excellence",
    desc: "The dal makhani you loved in 2015 tastes exactly the same today. We protect our recipes like family heirlooms.",
  },
];

const TEAM = [
  { emoji: "👨‍🍳", name: "Ram Prasad Chaurasia", role: "Founder & Head Chef",     desc: "35+ years of expertise in North Indian cuisine. His recipes are the soul of every dish." },
  { emoji: "👩‍🍳", name: "Savitri Chaurasia",      role: "Co-Founder & Kitchen Head", desc: "Masters traditional sweets and desserts. Her rabri is legendary in Varanasi." },
  { emoji: "🧑‍🍳", name: "Rohan Chaurasia",        role: "Executive Chef",             desc: "Second generation, trained in Lucknow. Brings innovation while honouring tradition." },
];

export default function AboutPage() {
  return (
    <div className="overflow-x-hidden">

      {/* ══════════════════ HERO — Deep Charcoal ══════════════════ */}
      <section className="relative py-24 md:py-32">
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(135deg, #1F2937 0%, #111827 55%, #1a0e04 100%)" }} />
        {/* Warm golden glow */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[130px] pointer-events-none"
          style={{ background: "rgba(251,191,36,0.07)" }} />
        {/* Subtle dot grid */}
        <div className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: "radial-gradient(circle, #fbbf24 1px, transparent 1px)", backgroundSize: "40px 40px" }} />

        <div className="relative max-w-6xl mx-auto px-5 sm:px-8 text-center">
          <p className="text-sm font-semibold tracking-widest uppercase mb-4" style={{ color: "#FBBF24" }}>Our Story</p>
          <h1 className="font-black text-4xl sm:text-5xl md:text-6xl mb-6 leading-tight"
            style={{ fontFamily: "'Outfit', sans-serif", color: "#FFF8F0" }}>
            Rooted in Tradition,<br />
            <span style={{
              WebkitTextFillColor: "transparent", WebkitBackgroundClip: "text",
              backgroundClip: "text", backgroundImage: "linear-gradient(135deg, #FBBF24 0%, #F97316 60%, #dc2626 100%)"
            }}>
              Driven by Passion
            </span>
          </h1>
          <p className="text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed" style={{ color: "#d1bfa8" }}>
            Chaurasia Ji was born from a simple belief — that real Indian food tells a story.
            For over 14 years, we've been sharing that story, one plate at a time.
          </p>
        </div>
      </section>

      {/* ══════════════════ OUR STORY — Warm Cream light section ══════════════════ */}
      <section style={{ background: "#FFF8F0", borderTop: "1px solid #F5E6D3" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Story text */}
            <div>
              <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#F97316" }}>Est. 2010</p>
              <h2 className="font-black text-3xl mb-6" style={{ fontFamily: "'Outfit', sans-serif", color: "#1F2937" }}>
                Where It All Began
              </h2>
              <div className="space-y-4 leading-relaxed" style={{ color: "#4B5563" }}>
                <p>
                  In the heart of Varanasi — a city that breathes history, spirituality, and culture —
                  Shri Ram Prasad Chaurasia opened a modest kitchen in 2010 with nothing but his
                  mother's recipes, a tandoor, and an unshakeable belief in the power of honest food.
                </p>
                <p>
                  What began as a small eatery serving neighbourhood families grew, purely on the
                  strength of flavour and trust, into one of Varanasi's most beloved dining destinations.
                  No marketing gimmicks. No compromises. Just food made exactly the way it should be.
                </p>
                <p>
                  Today, Chaurasia Ji serves thousands of guests every month — from local families
                  celebrating milestones to travellers from across India and the world seeking a taste
                  of authentic North Indian culture. But our ethos remains unchanged: every meal
                  deserves the same love and attention as the very first one we ever cooked.
                </p>
              </div>
            </div>

            {/* Story card */}
            <div className="relative">
              <div className="rounded-3xl p-8 space-y-6"
                style={{ background: "#FFFFFF", border: "1px solid #F5E6D3", boxShadow: "0 4px 24px rgba(31,41,55,0.08)" }}>
                {[
                  { emoji: "🏺", stat: "Est. 2010",  label: "Founded in Varanasi"       },
                  { emoji: "👨‍👩‍👧‍👦", stat: "3rd Gen",    label: "Family-run tradition"      },
                  { emoji: "🌶️",  stat: "100+",      label: "Unique dishes on our menu"  },
                  { emoji: "📍",  stat: "1 Location", label: "Pure, focused excellence"  },
                ].map(({ emoji, stat, label }) => (
                  <div key={label} className="flex items-center gap-5 pb-5 last:pb-0"
                    style={{ borderBottom: "1px solid #F5E6D3" }}>
                    <span className="text-3xl">{emoji}</span>
                    <div>
                      <p className="font-black text-xl" style={{ fontFamily: "'Outfit', sans-serif", color: "#1F2937" }}>{stat}</p>
                      <p className="text-sm" style={{ color: "#6B7280" }}>{label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ MISSION & VISION — Deep Charcoal ══════════════════ */}
      <section style={{ background: "#1F2937", borderTop: "1px solid rgba(255,255,255,0.06)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Mission */}
            <div className="p-8 rounded-2xl"
              style={{ background: "linear-gradient(135deg, rgba(249,115,22,0.12), rgba(251,191,36,0.06))", border: "1px solid rgba(249,115,22,0.25)" }}>
              <p className="text-3xl mb-4">🎯</p>
              <h3 className="font-bold text-2xl mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: "#FFF8F0" }}>Our Mission</h3>
              <p className="leading-relaxed" style={{ color: "#d1bfa8" }}>
                To preserve and celebrate the rich culinary heritage of North India by serving
                food that is authentic in taste, honest in ingredients, and generous in spirit.
                We exist to give every guest an experience that feels like home.
              </p>
            </div>

            {/* Vision */}
            <div className="p-8 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
              <p className="text-3xl mb-4">🌟</p>
              <h3 className="font-bold text-2xl mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: "#FFF8F0" }}>Our Vision</h3>
              <p className="leading-relaxed" style={{ color: "#d1bfa8" }}>
                To be recognized as Varanasi's most trusted family restaurant — a place where
                generations of customers return, memories are made, and the timeless art of
                Indian cooking is kept alive for future generations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ VALUES — Soft White light section ══════════════════ */}
      <section style={{ background: "#F9FAFB", borderTop: "1px solid #E5E7EB" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#F97316" }}>What We Stand For</p>
            <h2 className="font-black text-3xl sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif", color: "#1F2937" }}>
              Our Core Values
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {VALUES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-5 p-6 rounded-2xl transition-all hover:-translate-y-0.5"
                style={{ background: "#FFFFFF", border: "1px solid #E5E7EB", boxShadow: "0 2px 12px rgba(31,41,55,0.06)" }}>
                <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center"
                  style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.2)" }}>
                  <Icon size={22} style={{ color: "#F97316" }} />
                </div>
                <div>
                  <h3 className="font-bold mb-2" style={{ color: "#1F2937" }}>{title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ TIMELINE — Deep Charcoal dark section ══════════════════ */}
      <section style={{ background: "#1F2937", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-4xl mx-auto px-5 sm:px-8 py-16">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#FBBF24" }}>Our Journey</p>
            <h2 className="font-black text-3xl sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif", color: "#FFF8F0" }}>
              14 Years of Growth
            </h2>
          </div>

          <div className="relative">
            {/* Vertical timeline line */}
            <div className="absolute left-4 sm:left-1/2 top-0 bottom-0 w-px"
              style={{ background: "linear-gradient(to bottom, rgba(251,191,36,0.5), rgba(249,115,22,0.2), transparent)", transform: "translateX(-50%)" }} />

            <div className="space-y-10">
              {MILESTONES.map(({ year, title, desc }, i) => (
                <div key={year}
                  className={`relative flex gap-8 sm:gap-0 ${i % 2 === 0 ? "sm:flex-row" : "sm:flex-row-reverse"} items-center`}>
                  {/* Content */}
                  <div className={`flex-1 pl-12 sm:pl-0 ${i % 2 === 0 ? "sm:pr-12 sm:text-right" : "sm:pl-12"}`}>
                    <div className="p-5 rounded-2xl inline-block w-full sm:w-auto sm:max-w-sm"
                      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
                      <p className="font-bold text-sm mb-1" style={{ color: "#FBBF24" }}>{year}</p>
                      <h3 className="font-bold mb-2" style={{ color: "#FFF8F0" }}>{title}</h3>
                      <p className="text-sm leading-relaxed" style={{ color: "#9ca3af" }}>{desc}</p>
                    </div>
                  </div>

                  {/* Center dot */}
                  <div className="absolute left-4 sm:left-1/2 w-4 h-4 rounded-full shrink-0 z-10"
                    style={{ transform: "translate(-50%, 0)", background: "#F97316", boxShadow: "0 0 14px rgba(249,115,22,0.65)" }} />

                  {/* Empty side */}
                  <div className="hidden sm:block flex-1" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════ TEAM — Warm Cream light section ══════════════════ */}
      <section style={{ background: "#FFF8F0", borderTop: "1px solid #F5E6D3" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold tracking-widest uppercase mb-3" style={{ color: "#F97316" }}>The People Behind the Flavour</p>
            <h2 className="font-black text-3xl sm:text-4xl" style={{ fontFamily: "'Outfit', sans-serif", color: "#1F2937" }}>
              Meet Our Family
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TEAM.map(({ emoji, name, role, desc }) => (
              <div key={name} className="text-center p-8 rounded-2xl transition-all hover:-translate-y-1"
                style={{ background: "#FFFFFF", border: "1px solid #F5E6D3", boxShadow: "0 4px 20px rgba(31,41,55,0.07)" }}>
                <div className="text-6xl mb-5">{emoji}</div>
                <h3 className="font-bold text-lg mb-1" style={{ color: "#1F2937" }}>{name}</h3>
                <p className="text-sm font-medium mb-4" style={{ color: "#F97316" }}>{role}</p>
                <p className="text-sm leading-relaxed" style={{ color: "#6B7280" }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════ CONTACT / VISIT — Deep Charcoal ══════════════════ */}
      <section style={{ background: "#1F2937", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="max-w-6xl mx-auto px-5 sm:px-8 py-16">
          <div className="text-center mb-12">
            <h2 className="font-black text-3xl sm:text-4xl mb-3" style={{ fontFamily: "'Outfit', sans-serif", color: "#FFF8F0" }}>
              Come, Be Our Guest
            </h2>
            <p className="max-w-lg mx-auto" style={{ color: "#9ca3af" }}>
              We'd love to welcome you. Find us in the heart of Lanka, Varanasi.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto mb-12">
            {[
              { icon: MapPin, label: "Address",      value: "123 Food Street, Lanka, Varanasi, UP 221001" },
              { icon: Phone,  label: "Phone",         value: "+91 98765 43210"                             },
              { icon: Clock,  label: "Opening Hours", value: "Daily: 10:00 AM – 10:30 PM"                 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center text-center p-6 rounded-2xl gap-3"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(251,191,36,0.15)" }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)" }}>
                  <Icon size={18} style={{ color: "#FBBF24" }} />
                </div>
                <p className="text-xs uppercase tracking-wider" style={{ color: "#9ca3af" }}>{label}</p>
                <p className="text-sm font-medium" style={{ color: "#FFF8F0" }}>{value}</p>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/" className="inline-flex items-center justify-center gap-2 text-sm font-medium py-3 px-8 rounded-xl transition-all hover:bg-white/10"
              style={{ border: "1px solid rgba(255,255,255,0.18)", color: "#FFF8F0", background: "rgba(255,255,255,0.05)" }}>
              ← Back to Home
            </Link>
            <Link href="/auth/signup"
              className="btn-primary inline-flex items-center justify-center gap-2 text-sm py-3 px-8">
              Create an Account
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
