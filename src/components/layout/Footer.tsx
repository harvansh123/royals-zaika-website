"use client";
import Link from "next/link";
import { Phone, MapPin, Clock, Instagram, Facebook, MessageCircle } from "lucide-react";

export function Footer() {
  return (
    <footer style={{ background: "#0a0a0a", borderTop: "1px solid rgba(255,255,255,0.05)" }} className="mt-0">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-10">

          {/* ── Brand ── */}
          <div className="sm:col-span-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 gradient-brand rounded-xl flex items-center justify-center text-xl shadow-brand">
                🍱
              </div>
              <div className="leading-none">
                <p className="font-bold text-white text-lg" style={{ fontFamily: "'Outfit', sans-serif" }}>
                  Chaurasia Ji
                </p>
                <p className="text-xs text-orange-400 mt-0.5">Authentic Indian Cuisine</p>
              </div>
            </div>
            <p className="text-gray-500 text-sm leading-relaxed">
              Serving authentic North Indian flavours since 2010. Every dish crafted
              with love and traditional spices from the heart of Varanasi.
            </p>
            {/* Social Links */}
            <div className="flex gap-3 pt-1">
              {[
                { icon: Instagram,      href: "#",                          label: "Instagram" },
                { icon: Facebook,       href: "#",                          label: "Facebook"  },
                { icon: MessageCircle,  href: "https://wa.me/919876543210", label: "WhatsApp"  },
              ].map(({ icon: Icon, href, label }) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" aria-label={label}
                  className="w-9 h-9 glass rounded-lg flex items-center justify-center text-gray-400 hover:text-orange-400 hover:border-orange-500/30 transition-all">
                  <Icon size={16} />
                </a>
              ))}
            </div>
          </div>

          {/* ── Navigation ── */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-sm tracking-wide">Navigation</h4>
            <ul className="space-y-3">
              {[
                { href: "/",            label: "Home"      },
                { href: "/about",       label: "About Us"  },
                { href: "/auth/login",  label: "Sign In"   },
                { href: "/auth/signup", label: "Sign Up"   },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link href={href}
                    className="text-gray-500 hover:text-orange-400 text-sm transition-colors">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* ── Contact ── */}
          <div>
            <h4 className="font-semibold text-white mb-5 text-sm tracking-wide">Contact Us</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3 text-sm text-gray-500">
                <MapPin size={15} className="text-orange-400 mt-0.5 shrink-0" />
                <span>123 Food Street, Lanka,<br />Varanasi, UP 221001</span>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-500">
                <Phone size={15} className="text-orange-400 shrink-0" />
                <a href="tel:+919876543210" className="hover:text-orange-400 transition-colors">
                  +91 98765 43210
                </a>
              </li>
              <li className="flex items-center gap-3 text-sm text-gray-500">
                <Clock size={15} className="text-orange-400 shrink-0" />
                <span>Daily: 10:00 AM – 10:30 PM</span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── Bottom bar ── */}
        <div className="mt-10 pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-600"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <p>© {new Date().getFullYear()} Chaurasia Ji. All rights reserved.</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</Link>
            <Link href="/terms"   className="hover:text-gray-400 transition-colors">Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
