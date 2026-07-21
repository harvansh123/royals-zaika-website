import type { Metadata } from "next";
import Link from "next/link";
import { Shield, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy Policy — Royal Zaika",
  description:
    "Read Royal Zaika's Privacy Policy to understand how we collect, use, and protect your personal information when you use our food ordering platform.",
};

const sections = [
  { id: "introduction",         title: "1. Introduction"                         },
  { id: "information-collect",  title: "2. Information We Collect"               },
  { id: "how-we-use",           title: "3. How We Use Your Information"           },
  { id: "cookies",              title: "4. Cookies & Tracking Technologies"       },
  { id: "data-security",        title: "5. Data Security"                         },
  { id: "data-sharing",         title: "6. Data Sharing Policy"                   },
  { id: "third-party",          title: "7. Third-Party Services"                  },
  { id: "user-rights",          title: "8. Your Rights"                           },
  { id: "data-retention",       title: "9. Data Retention"                        },
  { id: "account-deletion",     title: "10. Account Deletion Policy"              },
  { id: "childrens-privacy",    title: "11. Children's Privacy"                   },
  { id: "policy-changes",       title: "12. Changes to This Policy"               },
  { id: "contact",              title: "13. Contact Information"                  },
];

export default function PrivacyPolicyPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-primary, #0d0d0d)", color: "var(--text-primary, #f1f5f9)" }}
    >
      {/* ── Hero Banner ──────────────────────────────────────────────── */}
      <div
        className="relative py-16 px-5 sm:px-8 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, #1a0800 0%, #0d0d0d 60%)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="absolute top-0 right-0 w-80 h-80 rounded-full blur-[120px] pointer-events-none"
          style={{ background: "rgba(249,115,22,0.07)" }} />
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}
            >
              <Shield size={20} className="text-orange-400" />
            </div>
            <span
              className="text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full"
              style={{ background: "rgba(249,115,22,0.12)", color: "#fb923c" }}
            >
              Legal
            </span>
          </div>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-black mb-3"
            style={{ fontFamily: "'Outfit', sans-serif" }}
          >
            Privacy Policy
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl">
            We are committed to protecting your personal information. This policy
            explains what data we collect, why we collect it, and how we keep it safe.
          </p>
          <div className="flex flex-wrap gap-4 mt-6 text-xs text-gray-500">
            <span>📅 Effective Date: 1 January 2024</span>
            <span>🔄 Last Updated: 20 July 2026</span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-12">
        <div className="lg:flex lg:gap-12">

          {/* ── Sticky Table of Contents (desktop) ───────────────────── */}
          <aside className="hidden lg:block w-64 shrink-0">
            <div
              className="sticky top-20 rounded-2xl p-5"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}
            >
              <p className="text-xs font-bold uppercase tracking-widest text-orange-400 mb-4">
                Table of Contents
              </p>
              <nav className="space-y-1">
                {sections.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 text-xs py-1.5 px-2 rounded-lg transition-colors text-gray-400 hover:text-orange-400 hover:bg-orange-500/5"
                  >
                    <ChevronRight size={12} className="shrink-0 text-gray-600" />
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* ── Main Content ──────────────────────────────────────────── */}
          <main className="flex-1 space-y-12 text-sm leading-relaxed" style={{ color: "var(--text-secondary, #94a3b8)" }}>

            {/* 1. Introduction */}
            <section id="introduction">
              <SectionHeading number="1" title="Introduction" />
              <p className="mb-3">
                Welcome to <strong className="text-white">Royal Zaika</strong> (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
                &ldquo;our&rdquo;). We operate an online food ordering platform that connects customers
                with our restaurant for convenient doorstep delivery and takeaway services.
              </p>
              <p className="mb-3">
                This Privacy Policy explains how Royal Zaika collects, uses, discloses, and
                protects your personal information when you use our website, mobile-optimised
                web application, or any related services (collectively, the &ldquo;Platform&rdquo;). By
                accessing or using our Platform, you agree to the practices described in this
                policy.
              </p>
              <p>
                We are dedicated to maintaining your trust by being transparent about our data
                practices. If you have any questions or concerns, please contact us using the
                details at the end of this document.
              </p>
            </section>

            {/* 2. Information We Collect */}
            <section id="information-collect">
              <SectionHeading number="2" title="Information We Collect" />
              <p className="mb-6">
                We collect various types of information depending on how you interact with our
                Platform. This includes information you provide directly, information collected
                automatically, and information received from third-party services.
              </p>

              <SubHeading>2.1 Personal Information</SubHeading>
              <p className="mb-3">
                When you register or place an order, we collect information such as:
              </p>
              <InfoList items={[
                "Full name",
                "Email address (used for account creation and order notifications)",
                "Mobile phone number (required for OTP-based verification and delivery coordination)",
                "Date of birth (optional, for personalised offers)",
                "Profile photograph (optional, via Google Sign-In)",
              ]} />

              <SubHeading>2.2 Contact Information</SubHeading>
              <p className="mb-3">
                To facilitate communication and support, we collect:
              </p>
              <InfoList items={[
                "Email address linked to your account",
                "Phone number for OTP verification and delivery coordination",
                "Customer support messages and tickets raised through the Platform",
              ]} />

              <SubHeading>2.3 Delivery Address</SubHeading>
              <p className="mb-3">
                To deliver your orders accurately, we collect and store:
              </p>
              <InfoList items={[
                "Saved delivery addresses (including flat number, street, city, state, PIN code)",
                "GPS coordinates or approximate location (when you permit location access in your browser)",
                "Delivery landmark or instructions provided by you",
                "Distance from restaurant for delivery fee calculation",
              ]} />

              <SubHeading>2.4 Order History</SubHeading>
              <p className="mb-3">
                We maintain records of your orders to provide order tracking and customer
                support:
              </p>
              <InfoList items={[
                "Items ordered, quantities, and customisations",
                "Order timestamps and delivery status",
                "Order amounts, discounts applied, and payment method used",
                "Ratings and reviews submitted for menu items",
                "Previous order addresses for quick reorder convenience",
              ]} />

              <SubHeading>2.5 Payment Information</SubHeading>
              <p className="mb-3">
                We do not store your full payment card details on our servers. Payments are
                processed by Razorpay, a PCI-DSS compliant payment gateway. We only store:
              </p>
              <InfoList items={[
                "Transaction reference ID generated by Razorpay",
                "Payment method used (UPI, card, or Cash on Delivery)",
                "Payment status (pending, paid, failed, refunded)",
                "Order amount processed",
              ]} />

              <SubHeading>2.6 Device Information</SubHeading>
              <p className="mb-3">
                When you use our Platform, we automatically collect certain technical information:
              </p>
              <InfoList items={[
                "IP address and approximate geographic location",
                "Browser type and version",
                "Device operating system",
                "Referring URLs and exit pages",
                "Session duration and pages visited",
              ]} />
            </section>

            {/* 3. How We Use Your Information */}
            <section id="how-we-use">
              <SectionHeading number="3" title="How We Use Your Information" />

              <SubHeading>3.1 Order Processing</SubHeading>
              <p className="mb-3">
                Your information is primarily used to fulfil your food orders:
              </p>
              <InfoList items={[
                "Verifying your identity via OTP before placing an order",
                "Processing and confirming your order in real time",
                "Assigning a delivery rider and tracking delivery progress",
                "Sending order status notifications via the Platform",
                "Calculating delivery distance and applicable delivery charges",
                "Processing payments securely via Razorpay",
              ]} />

              <SubHeading>3.2 Customer Support</SubHeading>
              <InfoList items={[
                "Responding to support tickets and queries",
                "Resolving delivery disputes or incorrect-order claims",
                "Sending email notifications for support ticket updates",
                "Enabling in-app review and rating for your orders",
              ]} />

              <SubHeading>3.3 Service Improvement</SubHeading>
              <InfoList items={[
                "Analysing usage patterns to improve the Platform experience",
                "Debugging technical issues and monitoring Platform performance",
                "Conducting internal research to improve menu offerings",
                "Training and improving delivery efficiency metrics",
              ]} />

              <SubHeading>3.4 Marketing & Notifications</SubHeading>
              <p className="mb-3">
                With your consent, we may use your contact information to send:
              </p>
              <InfoList items={[
                "Promotional offers, discounts, and limited-time deals",
                "New menu item announcements",
                "Re-engagement messages if you haven't ordered in a while",
                "Festive greetings and occasion-specific promotions",
              ]} />
              <p className="mt-3">
                You may opt out of marketing communications at any time by contacting us or
                updating your notification preferences in your account settings.
              </p>
            </section>

            {/* 4. Cookies */}
            <section id="cookies">
              <SectionHeading number="4" title="Cookies & Tracking Technologies" />
              <p className="mb-3">
                We use cookies and similar tracking technologies to enhance your experience on
                the Platform. Cookies are small text files stored on your device that help us
                recognise returning visitors and maintain session state.
              </p>

              <SubHeading>Types of Cookies We Use</SubHeading>
              <div className="overflow-x-auto rounded-xl mb-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "rgba(249,115,22,0.08)", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
                      <th className="text-left px-4 py-3 text-orange-400 font-semibold">Type</th>
                      <th className="text-left px-4 py-3 text-orange-400 font-semibold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["Essential", "Required for the Platform to function — session management, authentication tokens, cart state."],
                      ["Functional", "Remember your preferences such as language, theme, and saved addresses."],
                      ["Analytics", "Understand how visitors interact with the Platform (anonymised data only)."],
                      ["Security", "Detect fraud, prevent CSRF attacks, and protect your account."],
                    ].map(([type, purpose], i) => (
                      <tr key={type} style={{ background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                        <td className="px-4 py-3 font-medium text-white whitespace-nowrap">{type}</td>
                        <td className="px-4 py-3 text-gray-400">{purpose}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p>
                You can control cookies through your browser settings. Please note that disabling
                essential cookies may affect the functionality of the Platform, including your
                ability to log in or place orders.
              </p>
            </section>

            {/* 5. Data Security */}
            <section id="data-security">
              <SectionHeading number="5" title="Data Security" />
              <p className="mb-3">
                We take the security of your personal information seriously and implement
                appropriate technical and organisational measures to protect it against
                unauthorised access, loss, or alteration.
              </p>
              <InfoList items={[
                "All data is transmitted over HTTPS (TLS/SSL encryption)",
                "Authentication tokens are stored securely via Supabase Auth with automatic refresh",
                "Passwords are never stored in plain text — we use secure password hashing",
                "OTP-based verification is required before placing any order",
                "Sensitive payment information is handled exclusively by Razorpay (PCI-DSS Level 1 compliant)",
                "Database access is restricted by Row-Level Security (RLS) policies",
                "Regular security audits and dependency updates are performed",
              ]} />
              <p className="mt-3">
                While we take every reasonable precaution, no method of electronic transmission
                or storage is 100% secure. We encourage you to use a strong, unique password and
                to never share your OTP with anyone — including our staff.
              </p>
            </section>

            {/* 6. Data Sharing */}
            <section id="data-sharing">
              <SectionHeading number="6" title="Data Sharing Policy" />
              <p className="mb-3">
                We do <strong className="text-white">not</strong> sell, rent, or trade your
                personal information to third parties. We only share your data in the following
                limited circumstances:
              </p>
              <InfoList items={[
                "Delivery Riders — your name, phone number, and delivery address are shared with the assigned rider to fulfil your order.",
                "Payment Processors — transaction data is shared with Razorpay to process your payment securely.",
                "Cloud Infrastructure — your data is stored on Supabase (hosted on AWS), which is bound by strict data processing agreements.",
                "Legal Requirements — we may disclose your information if required by Indian law, court order, or government authority.",
                "Business Transfer — in the unlikely event of a merger or acquisition, your data may be transferred as part of business assets, and you will be notified.",
              ]} />
            </section>

            {/* 7. Third-Party */}
            <section id="third-party">
              <SectionHeading number="7" title="Third-Party Services" />
              <p className="mb-4">
                Our Platform integrates with several third-party services that have their own
                privacy policies. We encourage you to review their policies:
              </p>

              <SubHeading>7.1 Google Sign-In</SubHeading>
              <p className="mb-3">
                When you sign in with Google, we receive limited profile information including your
                name, email address, and profile photo from Google. We do not receive your Google
                password. The information shared by Google is governed by the{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer"
                  className="text-orange-400 hover:underline">
                  Google Privacy Policy
                </a>
                . You may revoke our access to your Google account at any time through your Google
                account settings.
              </p>

              <SubHeading>7.2 Razorpay (Payment Gateway)</SubHeading>
              <p className="mb-3">
                All payment transactions are processed by Razorpay. When you make a payment, you
                are subject to{" "}
                <a href="https://razorpay.com/privacy/" target="_blank" rel="noreferrer"
                  className="text-orange-400 hover:underline">
                  Razorpay&apos;s Privacy Policy
                </a>
                . We never have access to your full card or bank account numbers.
              </p>

              <SubHeading>7.3 Supabase (Database & Authentication)</SubHeading>
              <p>
                We use Supabase as our backend infrastructure for database storage, authentication,
                and real-time features. Supabase operates under strict data-processing agreements
                and GDPR-compliant practices.
              </p>
            </section>

            {/* 8. User Rights */}
            <section id="user-rights">
              <SectionHeading number="8" title="Your Rights" />
              <p className="mb-3">
                As a user of our Platform, you have the following rights regarding your personal
                information:
              </p>
              <InfoList items={[
                "Right to Access — you may request a copy of the personal data we hold about you.",
                "Right to Correction — you may update inaccurate or incomplete information via your profile settings.",
                "Right to Deletion — you may request deletion of your account and personal data (see Account Deletion Policy below).",
                "Right to Portability — you may request your order history and profile data in a structured, commonly used format.",
                "Right to Restriction — you may request that we limit how we process your data in certain circumstances.",
                "Right to Object — you may opt out of marketing communications at any time.",
              ]} />
              <p className="mt-3">
                To exercise any of these rights, please contact us at the email address listed in
                the Contact Information section. We will respond within 30 days.
              </p>
            </section>

            {/* 9. Data Retention */}
            <section id="data-retention">
              <SectionHeading number="9" title="Data Retention" />
              <p className="mb-3">
                We retain your personal data for as long as your account is active or as needed to
                provide our services. Specific retention periods are as follows:
              </p>
              <InfoList items={[
                "Account data — retained for the lifetime of your account plus 90 days after deletion.",
                "Order records — retained for 7 years for statutory compliance under Indian tax law.",
                "Payment transaction records — retained for 7 years as required by financial regulations.",
                "Support ticket data — retained for 2 years from ticket closure.",
                "Session & authentication logs — retained for 90 days for security monitoring.",
                "Marketing preferences — retained until you withdraw consent.",
              ]} />
            </section>

            {/* 10. Account Deletion */}
            <section id="account-deletion">
              <SectionHeading number="10" title="Account Deletion Policy" />
              <p className="mb-3">
                You have the right to request deletion of your Royal Zaika account. Upon deletion:
              </p>
              <InfoList items={[
                "Your profile information (name, email, phone number) will be permanently removed.",
                "Your saved delivery addresses will be deleted.",
                "Your active sessions will be immediately invalidated.",
                "Order history may be anonymised and retained for legal/financial compliance purposes.",
                "Reviews and ratings submitted by you may remain on the Platform in anonymised form.",
              ]} />
              <p className="mt-3">
                To request account deletion, contact us at{" "}
                <a href="mailto:privacy@royalzaika.in" className="text-orange-400 hover:underline">
                  privacy@royalzaika.in
                </a>
                . Please allow up to 30 days for complete deletion. This action is irreversible.
              </p>
            </section>

            {/* 11. Children's Privacy */}
            <section id="childrens-privacy">
              <SectionHeading number="11" title="Children's Privacy" />
              <p className="mb-3">
                Our Platform is not intended for use by children under the age of 13. We do not
                knowingly collect personal information from children under 13 years of age.
              </p>
              <p>
                If you believe that we have inadvertently collected information from a child under
                13, please contact us immediately at{" "}
                <a href="mailto:privacy@royalzaika.in" className="text-orange-400 hover:underline">
                  privacy@royalzaika.in
                </a>{" "}
                and we will promptly delete such information.
              </p>
            </section>

            {/* 12. Policy Changes */}
            <section id="policy-changes">
              <SectionHeading number="12" title="Changes to This Policy" />
              <p className="mb-3">
                We may update this Privacy Policy from time to time to reflect changes in our
                practices, technology, legal requirements, or other factors. When we make
                significant changes, we will:
              </p>
              <InfoList items={[
                "Update the \"Last Updated\" date at the top of this page.",
                "Display a notice on the Platform informing users of the change.",
                "Where required by law, seek your consent for material changes.",
              ]} />
              <p className="mt-3">
                We encourage you to review this Privacy Policy periodically. Your continued use of
                the Platform after any changes constitutes your acceptance of the updated policy.
              </p>
            </section>

            {/* 13. Contact */}
            <section id="contact">
              <SectionHeading number="13" title="Contact Information" />
              <p className="mb-4">
                If you have any questions, concerns, or requests regarding this Privacy Policy or
                your personal data, please contact our Privacy team:
              </p>
              <div
                className="rounded-2xl p-6 space-y-3 text-sm"
                style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}
              >
                <p><span className="text-orange-400 font-semibold">Restaurant:</span> <span className="text-white">Royal Zaika</span></p>
                <p><span className="text-orange-400 font-semibold">Address:</span> <span className="text-white">123 Food Street, Lanka, Varanasi, Uttar Pradesh – 221001</span></p>
                <p><span className="text-orange-400 font-semibold">Privacy Email:</span>{" "}
                  <a href="mailto:privacy@royalzaika.in" className="text-orange-400 hover:underline">privacy@royalzaika.in</a>
                </p>
                <p><span className="text-orange-400 font-semibold">Phone:</span>{" "}
                  <a href="tel:+919876543210" className="text-orange-400 hover:underline">+91 98765 43210</a>
                </p>
                <p><span className="text-orange-400 font-semibold">Support Hours:</span> <span className="text-white">Monday – Sunday, 10:00 AM – 10:30 PM IST</span></p>
              </div>
            </section>

            {/* Effective Date */}
            <div
              className="rounded-2xl p-5 text-center text-xs text-gray-500"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="mb-1">📅 <strong className="text-gray-400">Effective Date:</strong> 1 January 2024</p>
              <p>🔄 <strong className="text-gray-400">Last Updated:</strong> 20 July 2026</p>
            </div>

            {/* Bottom Links */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link href="/terms"
                className="flex-1 text-center py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
                Read Terms & Conditions →
              </Link>
              <Link href="/"
                className="flex-1 text-center py-3 rounded-xl text-sm font-semibold transition-all text-gray-400 hover:text-white"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                ← Back to Home
              </Link>
            </div>

          </main>
        </div>
      </div>
    </div>
  );
}

/* ── Helper Components ───────────────────────────────────────────────── */
function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm font-black text-white"
        style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}>
        {number}
      </div>
      <h2 className="text-xl font-bold text-white" style={{ fontFamily: "'Outfit', sans-serif" }}>
        {title}
      </h2>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-semibold text-white mt-5 mb-2 text-sm">
      {children}
    </h3>
  );
}

function InfoList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 mb-3">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}


