import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Phone, MapPin, Clock, Award, Heart, Leaf, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us | Royal Zaika — Authentic Indian Cuisine",
  description:
    "Learn the story of Royal Zaika — a family restaurant rooted in Varanasi's rich culinary tradition. Serving authentic North Indian food since 2010 with love, heritage, and quality.",
};



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
    desc: "The Shahi Paneer you loved in 2025 tastes exactly the same today. We protect our recipes like family heirlooms.",
  },
];

const TEAM = [
  { emoji: "👨‍🍳", name: "Harvansh Chaurasia",  role: "Founder & Owner",    desc: "Passionate about serving fresh, delicious food and creating a great experience for every customer." },
  { emoji: "👩‍🍳", name: "Sarita Chaurasia",     role: "Kitchen Head",       desc: "The heart of our kitchen, preparing fresh and delicious food with love and care for every customer in Prayagraj." },
  { emoji: "👩‍💼", name: "Anisha Chaurasia",       role: "Team Member",        desc: "A valued part of our team, helping us serve fresh and delicious food with care and dedication in Prayagraj." },
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
            Royal Zaika was born from a simple belief — that real Indian food tells a story.
            For over 1+ year, we've been sharing that story, one plate at a time.
          </p>
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
              We'd love to welcome you. Find us in the heart of Naini, Prayagraj.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 max-w-3xl mx-auto mb-12">
            {[
              { icon: MapPin, label: "Address",      value: "474 Chak Raghunath, Naini, Prayagraj" },
              { icon: Phone,  label: "Phone",         value: "+91 73792 94659"                       },
              { icon: Clock,  label: "Opening Hours", value: "Daily: 11:00 AM – 12:00 AM"           },
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

