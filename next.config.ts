import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Image Optimization ─────────────────────────────────────────────
  images: {
    formats: ["image/avif", "image/webp"],   // Auto-convert to WebP/AVIF (30-50% smaller)
    minimumCacheTTL: 2592000,                // Cache images for 30 days
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [64, 128, 256],
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
    ],
  },

  // ── Compiler Optimizations ─────────────────────────────────────────
  compiler: {
    removeConsole: process.env.NODE_ENV === "production",  // Remove console.log in prod
  },

  // ── Bundle Optimization: Tree-shake heavy packages ─────────────────
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "framer-motion",
      "recharts",
      "@supabase/supabase-js",
    ],
  },

  // ── HTTP Response Headers (production only — dev mode skips caching) ──
  async headers() {
    if (process.env.NODE_ENV !== "production") return [];
    return [
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/_next/image/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" },
        ],
      },
      {
        source: "/icons/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=604800" },
        ],
      },
      {
        source: "/api/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
    ];
  },
};

export default nextConfig;
