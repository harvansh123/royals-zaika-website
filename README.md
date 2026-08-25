📋 Summary of README.md Structure & Contents
Title & Badges: Clean tech stack badges (Next.js 16.2.6, React 19, TypeScript, Supabase, Tailwind CSS, Vercel, PWA).
📌 Overview: Explains the real-world business context of digitizing restaurant operations across Customers, Owners, and Delivery Riders.
🌐 Live Demo: Verified links to Live Website and GitHub Repository.
✨ Key Features (by Role):
Customer: Menu search & veg/non-veg filter, Nominatim GPS geocoding, Google Maps Routes API v2 / Haversine distance validation & fee calculation, COD & Razorpay payments, real-time order tracking, referral program, reviews, and 4-digit PIN / OTP email account recovery.
Restaurant Owner: Live order queue with audio notifications, rider dispatching, menu CRUD, per-km delivery fee configuration, Recharts analytics, promo codes, and store timing controls.
Delivery Partner (Rider): Active delivery acceptance, online/offline status, shift scheduling, and rider earnings breakdown.
🧭 Complete Order Flow: A clean Mermaid sequence diagram representing the end-to-end flow from customer menu browse to rider delivery and review submission.
🏗️ System Architecture: A Mermaid architecture diagram connecting Frontend Clients, Next.js API Routes, Supabase (Auth, PostgreSQL DB, Realtime Channels), and External APIs (Google Routes, Razorpay, Gmail SMTP, Web Push).
🛠️ Technology Stack: Categorized table matching dependencies in package.json.
🗄️ Database Schema & Architecture: Visual diagram and breakdown of tables (users, orders, order_items, menu_items, delivery_tracking, order_reviews, referrals, etc.) based on src/lib/database.types.ts.
🔐 Authentication & Security: Details RBAC, phone login, 4-digit bcrypt-hashed Recovery PIN, and Gmail SMTP OTP verification.
📍 Delivery Radius & Distance Calculation: Explains the Google Maps Routes API v2 routing, in-memory caching layer, and Haversine straight-line fallback logic.
💰 Payment System: Documents Razorpay online payment integration and Cash on Delivery (COD).
📂 Project Structure: Accurate directory tree mapping of src/app, src/components, src/lib, src/stores, and public.
🖼️ Screenshots: Added instructions and created a placeholder directory screenshots/README.md for real application screenshots.
⚙️ Local Development Setup & 🔑 Environment Variables: Setup steps (npm run dev) and exact environment variable list derived from .env.local.example without exposing sensitive keys.
🚀 Deployment: Documents Vercel continuous deployment.
🧠 Technical Challenges & 📚 What I Learned: Detailed real-world engineering accomplishments (RLS recursion prevention, hybrid distance calculator, multi-dashboard realtime sync).
🔮 Future Improvements: Realistic roadmap items (Live GPS driver map, smart auto-dispatch, multi-branch support).
👨‍💻 Developer Information: Harvansh Chaurasia's developer bio, GitHub CTA, and Security note.
