import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { AddressModalProvider } from "@/components/providers/AddressModalProvider";
import { GlobalAlarmProvider } from "@/components/providers/GlobalAlarmProvider";

export const metadata: Metadata = {
  title: {
    default: "Royal Zaika — Authentic Indian Cuisine",
    template: "%s | Royal Zaika",
  },
  description:
    "Order authentic North Indian food online. Fresh thalis, biryanis, dal makhani, and more. Fast delivery from Royal Zaika restaurant.",
  keywords: ["Indian food", "online food order", "thali", "biryani", "North Indian cuisine", "Royal Zaika"],
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Royal Zaika",
  },
  icons: {
    apple: "/icons/icon-192.png",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    siteName: "Royal Zaika",
    title: "Royal Zaika — Authentic Indian Cuisine",
    description: "Order authentic North Indian food online with fast delivery.",
  },
  robots: "index, follow",
};

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        {/* Google Fonts via browser <link> — avoids build-time fetch to Google servers */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Outfit:wght@100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AuthProvider>
          <GlobalAlarmProvider>
            {children}
            <AddressModalProvider />
            <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: "#FFFFFF",
                color: "#0F172A",
                border: "1px solid rgba(15,23,42,0.1)",
                borderRadius: "12px",
                fontFamily: "Inter, sans-serif",
                boxShadow: "0 4px 20px rgba(15,23,42,0.1)",
              },
              success: { iconTheme: { primary: "#16A34A", secondary: "#F0FDF4" } },
              error:   { iconTheme: { primary: "#DC2626", secondary: "#FEF2F2" } },
            }}
          />
          </GlobalAlarmProvider>
        </AuthProvider>
      </body>
    </html>
  );
}

