"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { ShoppingCart, LogOut, Menu, X, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { useCartStore } from "@/stores/cartStore";
import { performSignOut } from "@/lib/sign-out";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

export function Navbar() {
  const pathname   = usePathname();
  const { user }   = useAuthStore();
  const totalItems = useCartStore((s) => s.totalItems());
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [mounted,  setMounted]  = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  async function handleSignOut() {
    setMenuOpen(false);
    toast.success("Signed out");
    await performSignOut();
  }


  // Hide on staff panels
  if (pathname.startsWith("/owner") || pathname.startsWith("/admin") || pathname.startsWith("/delivery")) return null;

  // ── Links depend on auth state ────────────────────────────────────
  const isLoggedIn = mounted && !!user;

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-shadow duration-300"
      style={{
        background: "var(--nav-bg)",
        borderBottom: "1px solid var(--border)",
        backdropFilter: "blur(20px)",
        boxShadow: scrolled ? "0 4px 24px rgba(0,0,0,0.25)" : "none",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href={isLoggedIn ? "/menu" : "/"} className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 gradient-brand rounded-xl flex items-center justify-center text-lg shadow-brand group-hover:scale-105 transition-transform duration-200">
              🍱
            </div>
            <div className="leading-none">
              <p className="font-bold text-base" style={{ fontFamily: "'Outfit', sans-serif", color: "var(--text-primary)" }}>
                Chaurasia Ji
              </p>
              <p className="text-[10px] text-orange-500">Authentic Indian Cuisine</p>
            </div>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {isLoggedIn ? (
              /* ── Logged-in nav: Menu + Cart + Logout ── */
              <>
                <Link href="/menu"
                  className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    pathname === "/menu" || pathname.startsWith("/food")
                      ? "text-orange-500 bg-orange-500/8"
                      : "text-gray-400 hover:text-white hover:bg-white/5")}>
                  Menu
                </Link>

                <Link href="/cart"
                  className={cn("relative flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    pathname === "/cart"
                      ? "text-orange-500 bg-orange-500/8"
                      : "text-gray-400 hover:text-white hover:bg-white/5")}>
                  <ShoppingCart size={16} />
                  Cart
                  {totalItems > 0 && (
                    <span className="w-5 h-5 gradient-brand rounded-full text-[10px] font-bold flex items-center justify-center text-white">
                      {totalItems > 9 ? "9+" : totalItems}
                    </span>
                  )}
                </Link>

                {/* Profile link */}
                <Link href="/profile"
                  className={cn("flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                    pathname === "/profile"
                      ? "text-orange-500 bg-orange-500/8"
                      : "text-gray-400 hover:text-white hover:bg-white/5")}>
                  <div className="w-6 h-6 gradient-brand rounded-full flex items-center justify-center text-[10px] font-bold text-white">
                    {user?.name?.[0]?.toUpperCase() ?? <User size={12} />}
                  </div>
                  Profile
                </Link>

                <button onClick={handleSignOut}
                  className="flex items-center gap-1.5 ml-2 px-4 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/8 transition-colors">
                  <LogOut size={15} />
                  Logout
                </button>
              </>
            ) : (
              /* ── Guest nav: Home + About + Sign In + Sign Up ── */
              <>
                {[{ href: "/", label: "Home" }, { href: "/about", label: "About" }].map(({ href, label }) => (
                  <Link key={href} href={href}
                    className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      pathname === href
                        ? "text-orange-500 bg-orange-500/8"
                        : "text-gray-400 hover:text-white hover:bg-white/5")}>
                    {label}
                  </Link>
                ))}
                <Link href="/auth/login" className="px-4 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white transition-colors ml-1">
                  Sign In
                </Link>
                <Link href="/auth/signup" className="btn-primary py-2 px-5 text-sm ml-1">
                  Sign Up
                </Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile Menu */}
        {menuOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-white/5">
            {isLoggedIn ? (
              <div className="flex flex-col gap-1">
                <Link href="/menu" onClick={() => setMenuOpen(false)}
                  className={cn("px-4 py-3 rounded-xl text-sm font-medium",
                    pathname === "/menu" ? "text-orange-500 bg-orange-500/8" : "text-gray-400 hover:bg-white/5")}>
                  🍽️ Menu
                </Link>
                <Link href="/cart" onClick={() => setMenuOpen(false)}
                  className={cn("px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2",
                    pathname === "/cart" ? "text-orange-500 bg-orange-500/8" : "text-gray-400 hover:bg-white/5")}>
                  <ShoppingCart size={15} /> Cart
                  {totalItems > 0 && <span className="gradient-brand text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{totalItems}</span>}
                </Link>
                <Link href="/profile" onClick={() => setMenuOpen(false)}
                  className={cn("px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2",
                    pathname === "/profile" ? "text-orange-500 bg-orange-500/8" : "text-gray-400 hover:bg-white/5")}>
                  <User size={15} /> My Profile
                </Link>
                <Link href="/profile?tab=orders" onClick={() => setMenuOpen(false)}
                  className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/5">
                  📦 My Orders
                </Link>
                <button onClick={handleSignOut}
                  className="mx-0 flex items-center gap-2 px-4 py-3 rounded-xl text-sm text-red-400 hover:bg-red-500/8 transition-colors">
                  <LogOut size={15} /> Logout
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {[{ href: "/", label: "🏠 Home" }, { href: "/about", label: "ℹ️ About" }].map(({ href, label }) => (
                  <Link key={href} href={href} onClick={() => setMenuOpen(false)}
                    className="px-4 py-3 rounded-xl text-sm font-medium text-gray-400 hover:bg-white/5">
                    {label}
                  </Link>
                ))}
                <Link href="/auth/login" onClick={() => setMenuOpen(false)}
                  className="mx-2 mt-2 px-4 py-3 rounded-xl text-sm font-medium text-center text-gray-300 border border-white/10 hover:bg-white/5">
                  Sign In
                </Link>
                <Link href="/auth/signup" onClick={() => setMenuOpen(false)}
                  className="mx-2 btn-primary py-3 text-sm text-center">
                  Sign Up
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
