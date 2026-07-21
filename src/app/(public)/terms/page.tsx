import type { Metadata } from "next";
import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Terms & Conditions — Royal Zaika",
  description:
    "Read Royal Zaika's Terms & Conditions governing your use of our online food ordering platform, including ordering rules, payment terms, delivery policy, and cancellation policy.",
};

const sections = [
  { id: "acceptance",       title: "1. Acceptance of Terms"               },
  { id: "eligibility",      title: "2. Eligibility"                       },
  { id: "user-accounts",    title: "3. User Accounts"                     },
  { id: "ordering",         title: "4. Ordering Rules"                    },
  { id: "pricing",          title: "5. Pricing & Offers"                  },
  { id: "payment",          title: "6. Payment Terms"                     },
  { id: "cancellation",     title: "7. Cancellation Policy"               },
  { id: "refund",           title: "8. Refund Policy"                     },
  { id: "delivery",         title: "9. Delivery Policy"                   },
  { id: "opening-hours",    title: "10. Restaurant Hours Policy"          },
  { id: "responsibilities", title: "11. Customer Responsibilities"        },
  { id: "rider",            title: "12. Rider Responsibilities"           },
  { id: "prohibited",       title: "13. Prohibited Activities"            },
  { id: "ip",               title: "14. Intellectual Property"            },
  { id: "liability",        title: "15. Limitation of Liability"          },
  { id: "force-majeure",    title: "16. Force Majeure"                    },
  { id: "suspension",       title: "17. Account Suspension"               },
  { id: "privacy-ref",      title: "18. Privacy"                         },
  { id: "governing-law",    title: "19. Governing Law"                    },
  { id: "contact",          title: "20. Contact Information"              },
];

export default function TermsPage() {
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
        <div
          className="absolute top-0 right-0 w-80 h-80 rounded-full blur-[120px] pointer-events-none"
          style={{ background: "rgba(249,115,22,0.07)" }}
        />
        <div className="max-w-4xl mx-auto relative">
          <div className="flex items-center gap-3 mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.3)" }}
            >
              <FileText size={20} className="text-orange-400" />
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
            Terms &amp; Conditions
          </h1>
          <p className="text-gray-400 text-base sm:text-lg max-w-2xl">
            Please read these terms carefully before using our platform. By placing an order or
            creating an account, you agree to be bound by these terms.
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
              <nav className="space-y-1 max-h-[70vh] overflow-y-auto pr-1">
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

            {/* 1. Acceptance */}
            <section id="acceptance">
              <SectionHeading number="1" title="Acceptance of Terms" />
              <p className="mb-3">
                Welcome to <strong className="text-white">Royal Zaika</strong>. These Terms &amp;
                Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the Royal Zaika website,
                web application, and all related services (collectively, the &ldquo;Platform&rdquo;). The
                Platform is owned and operated by Royal Zaika Restaurant, Prayagraj, India.
              </p>
              <p className="mb-3">
                By accessing or using the Platform — including browsing the menu, creating an
                account, placing an order, or submitting a review — you confirm that you have
                read, understood, and agree to be bound by these Terms and our{" "}
                <Link href="/privacy" className="text-orange-400 hover:underline">Privacy Policy</Link>.
              </p>
              <p>
                If you do not agree with any part of these Terms, you must immediately stop using
                the Platform. We reserve the right to update these Terms at any time, and your
                continued use of the Platform following any changes constitutes acceptance of the
                revised Terms.
              </p>
            </section>

            {/* 2. Eligibility */}
            <section id="eligibility">
              <SectionHeading number="2" title="Eligibility" />
              <p className="mb-3">
                To use the Platform, you must meet the following eligibility requirements:
              </p>
              <InfoList items={[
                "You must be at least 13 years of age. Users under 18 must have parental or guardian consent.",
                "You must be a resident of, or ordering from within, a location within our delivery radius.",
                "You must provide accurate, current, and complete information during registration and at checkout.",
                "You must not be barred from receiving services under applicable Indian law.",
                "You must have a valid phone number for OTP verification — this is mandatory for order placement.",
              ]} />
            </section>

            {/* 3. User Accounts */}
            <section id="user-accounts">
              <SectionHeading number="3" title="User Accounts" />

              <SubHeading>3.1 Account Creation</SubHeading>
              <p className="mb-3">
                You may create an account using your email address and password or by signing in
                with Google. You agree to provide accurate and truthful information during
                registration and to keep your profile information up to date.
              </p>

              <SubHeading>3.2 Account Responsibilities</SubHeading>
              <InfoList items={[
                "You are solely responsible for maintaining the confidentiality of your account credentials.",
                "You must never share your One-Time Password (OTP) with any person, including our staff.",
                "You are responsible for all activities that occur under your account.",
                "If you suspect unauthorised access to your account, you must notify us immediately.",
                "You must not create multiple accounts to abuse promotional offers or circumvent any suspension.",
                "We reserve the right to suspend or terminate accounts that violate these Terms.",
              ]} />

              <SubHeading>3.3 Account Security</SubHeading>
              <p>
                We use OTP-based verification for every order to confirm your identity.
                This is a security measure to protect you from unauthorised orders. If you receive
                an OTP that you did not request, please change your account password and contact us
                immediately.
              </p>
            </section>

            {/* 4. Ordering Rules */}
            <section id="ordering">
              <SectionHeading number="4" title="Ordering Rules" />
              <p className="mb-3">
                By placing an order on the Platform, you acknowledge and agree to the following:
              </p>
              <InfoList items={[
                "All orders are subject to availability of menu items and restaurant operating hours.",
                "You must be within our defined delivery radius to place a delivery order.",
                "An OTP verification is required to confirm every order — unverified orders will not be processed.",
                "The order becomes confirmed only after you receive an on-screen order confirmation and a confirmation notification.",
                "Menu items, ingredients, and pricing displayed on the Platform may differ slightly from what is actually served due to seasonal availability or recipe updates.",
                "You are responsible for providing accurate delivery address details. We are not liable for failed deliveries due to incorrect address information.",
                "Orders are prepared fresh upon confirmation and may not be modified after submission.",
                "We reserve the right to cancel any order that we are unable to fulfil for operational reasons, with a full refund where applicable.",
              ]} />
            </section>

            {/* 5. Pricing */}
            <section id="pricing">
              <SectionHeading number="5" title="Pricing Policy &amp; Offers" />

              <SubHeading>5.1 Pricing</SubHeading>
              <InfoList items={[
                "All prices displayed on the Platform are in Indian Rupees (INR) and include applicable taxes unless stated otherwise.",
                "Prices are subject to change without prior notice. The price applicable to your order is the price displayed at the time of checkout.",
                "A delivery fee may be applied based on your delivery distance from the restaurant. The fee is calculated and displayed clearly before you confirm your order.",
              ]} />

              <SubHeading>5.2 Offers &amp; Discounts</SubHeading>
              <InfoList items={[
                "Promotional offers, discount codes, and limited-time deals are subject to their own specific terms and validity periods.",
                "Offers cannot be combined unless explicitly stated.",
                "We reserve the right to withdraw or modify any offer at any time without notice.",
                "Offers are intended for genuine customer use. Fraudulent use of offers — including creating multiple accounts — will result in order cancellation and account suspension.",
                "Minimum order amounts may apply for certain offers. These are displayed clearly on the offer banner.",
              ]} />
            </section>

            {/* 6. Payment */}
            <section id="payment">
              <SectionHeading number="6" title="Payment Terms" />

              <SubHeading>6.1 Accepted Payment Methods</SubHeading>
              <p className="mb-3">
                We currently accept the following payment methods:
              </p>
              <InfoList items={[
                "Cash on Delivery (COD) — pay in cash when your order arrives at your doorstep.",
                "Online payment via Razorpay (UPI, debit/credit cards, net banking) — currently available for select orders.",
              ]} />

              <SubHeading>6.2 Cash on Delivery Policy</SubHeading>
              <InfoList items={[
                "COD is available for all orders within our delivery radius.",
                "Please keep exact change ready. Our delivery riders may not carry large amounts of change.",
                "If you are unavailable at the delivery address at the time of delivery, the order will be returned and you will be charged a failed delivery fee.",
                "Repeated COD order cancellations may result in COD being disabled on your account.",
              ]} />

              <SubHeading>6.3 Online Payment Security</SubHeading>
              <p>
                Online payments are processed by Razorpay, a PCI-DSS Level 1 compliant payment
                gateway. We do not store your card or bank account information on our servers.
                All payment transactions are encrypted and secured.
              </p>
            </section>

            {/* 7. Cancellation */}
            <section id="cancellation">
              <SectionHeading number="7" title="Cancellation Policy" />

              <SubHeading>7.1 Customer Cancellations</SubHeading>
              <InfoList items={[
                "You may request an order cancellation only before the restaurant begins preparing your order.",
                "Once the order status changes to 'Preparing', cancellations are not accepted.",
                "To request a cancellation, contact our support immediately via the Platform.",
                "Repeated cancellations without valid reason may result in order restrictions on your account.",
              ]} />

              <SubHeading>7.2 Restaurant Cancellations</SubHeading>
              <InfoList items={[
                "We reserve the right to cancel any order due to: unavailability of items, operational issues, incorrect pricing displayed due to a technical error, or force majeure events.",
                "In the event of a restaurant-initiated cancellation, you will receive a full refund to your original payment method.",
                "We will notify you promptly if your order cannot be fulfilled.",
              ]} />
            </section>

            {/* 8. Refund */}
            <section id="refund">
              <SectionHeading number="8" title="Refund Policy" />
              <p className="mb-3">
                Refunds are issued in the following circumstances:
              </p>
              <InfoList items={[
                "Order cancelled by the restaurant — full refund processed within 5–7 business days.",
                "Incorrect or missing items in your order — partial or full refund after verification.",
                "Order not delivered within a reasonable time due to our fault — full refund.",
                "Payment debited but order not confirmed due to a technical failure — full refund.",
              ]} />
              <p className="mt-3 mb-3">
                Refunds are <strong className="text-white">not</strong> provided in the following cases:
              </p>
              <InfoList items={[
                "Customer cancellation after the restaurant has begun preparing the order.",
                "Failed delivery due to incorrect address or customer unavailability.",
                "Order consumed and then reported as unsatisfactory without a valid reason.",
                "Change of mind after order confirmation.",
              ]} />
              <p className="mt-3">
                All refund requests must be raised through our support system within 24 hours of
                the order. Refunds for online payments are processed to the original payment
                instrument. Cash on Delivery refunds are processed via bank transfer or
                platform credit.
              </p>
            </section>

            {/* 9. Delivery */}
            <section id="delivery">
              <SectionHeading number="9" title="Delivery Policy" />
              <InfoList items={[
                "Delivery is available only within our defined delivery radius. The exact radius is shown during checkout.",
                "Estimated delivery times displayed on the Platform are indicative and may vary based on order volume, traffic, and weather conditions.",
                "You are responsible for providing accurate and complete delivery address details, including flat number, building name, landmark, and PIN code.",
                "Our delivery riders will attempt to contact you via phone before arriving. If you are unreachable after reasonable attempts, the order will be marked as undeliverable.",
                "We are not liable for delays caused by circumstances beyond our control, including traffic, extreme weather, or civil disturbances.",
                "Delivery charges (if applicable) are non-refundable unless the delay was caused by our fault.",
              ]} />
            </section>

            {/* 10. Opening Hours */}
            <section id="opening-hours">
              <SectionHeading number="10" title="Restaurant Opening &amp; Closing Policy" />
              <p className="mb-3">
                Our Platform reflects the current operating status of the restaurant in real time:
              </p>
              <InfoList items={[
                "Orders can only be placed when the restaurant is marked as Open on the Platform.",
                "The restaurant may be closed during its scheduled off-hours, on public holidays, or due to unforeseen circumstances.",
                "When the restaurant is temporarily closed, the Platform will clearly display a 'Closed' status and order placement will be disabled.",
                "Opening and closing times are subject to change without advance notice due to operational requirements.",
                "Orders that were placed before the restaurant closed will be fulfilled in the normal course. If we are unable to fulfil a confirmed order, we will notify you and issue a full refund.",
              ]} />
            </section>

            {/* 11. Customer Responsibilities */}
            <section id="responsibilities">
              <SectionHeading number="11" title="Customer Responsibilities" />
              <p className="mb-3">
                As a customer using our Platform, you agree to:
              </p>
              <InfoList items={[
                "Provide accurate personal information, delivery address, and contact details.",
                "Be available at the delivery address at the scheduled delivery time.",
                "Keep your payment information up to date and ensure sufficient funds for online payments.",
                "Treat our delivery riders with respect and courtesy.",
                "Use the Platform only for lawful, personal, non-commercial purposes.",
                "Not engage in any behaviour that may harm, disrupt, or abuse the Platform or our staff.",
                "Not submit false, misleading, or defamatory reviews or support tickets.",
                "Report any issues with your order within 24 hours of delivery.",
              ]} />
            </section>

            {/* 12. Rider */}
            <section id="rider">
              <SectionHeading number="12" title="Rider Responsibilities" />
              <p className="mb-3">
                Our delivery riders are required to comply with the following standards:
              </p>
              <InfoList items={[
                "Delivery riders must accept assigned orders promptly and complete deliveries within the estimated time.",
                "Riders must handle food with care to prevent spillage, contamination, or damage.",
                "Riders must comply with all applicable traffic laws and road safety regulations.",
                "Riders must be courteous and professional when interacting with customers.",
                "Riders must update their real-time location and delivery status accurately on the Platform.",
                "Any misconduct, fraud, or gross negligence by a rider may result in immediate suspension from the Platform.",
              ]} />
            </section>

            {/* 13. Prohibited */}
            <section id="prohibited">
              <SectionHeading number="13" title="Prohibited Activities" />
              <p className="mb-3">
                You must not engage in any of the following activities when using the Platform:
              </p>
              <InfoList items={[
                "Creating fake or multiple accounts to abuse promotional offers or circumvent restrictions.",
                "Using automated bots, scrapers, or scripts to access the Platform.",
                "Attempting to reverse-engineer, hack, or otherwise tamper with the Platform's code or infrastructure.",
                "Submitting false, fraudulent, or defamatory content including reviews, support tickets, or order details.",
                "Impersonating any person or entity, including our staff or other customers.",
                "Attempting to intercept, redirect, or interfere with communications on the Platform.",
                "Using the Platform for any commercial resale purpose without our written consent.",
                "Violating any applicable local, state, or national law or regulation.",
              ]} />
              <p className="mt-3">
                Violation of these prohibited activities may result in immediate account
                suspension, order cancellation, and potential legal action under applicable
                Indian law.
              </p>
            </section>

            {/* 14. IP */}
            <section id="ip">
              <SectionHeading number="14" title="Intellectual Property" />
              <p className="mb-3">
                All content on the Platform — including but not limited to the Royal Zaika name,
                logo, menu design, food photographs, website design, text, graphics, and code — is
                the exclusive intellectual property of Royal Zaika Restaurant and is protected
                under applicable Indian and international intellectual property laws.
              </p>
              <p className="mb-3">
                You may not reproduce, distribute, modify, publicly display, or create derivative
                works from any content on the Platform without our prior written permission.
              </p>
              <p>
                Content submitted by users (such as reviews and ratings) remains the property of
                the user but grants Royal Zaika a non-exclusive, royalty-free, perpetual licence
                to use, display, and moderate that content on the Platform.
              </p>
            </section>

            {/* 15. Liability */}
            <section id="liability">
              <SectionHeading number="15" title="Limitation of Liability" />
              <p className="mb-3">
                To the fullest extent permitted by applicable law, Royal Zaika shall not be
                liable for:
              </p>
              <InfoList items={[
                "Any indirect, incidental, consequential, or punitive damages arising from your use of the Platform.",
                "Loss of data, revenue, or profits arising from Platform downtime, errors, or unavailability.",
                "Allergic reactions, food intolerances, or health issues arising from consumption of food ordered through the Platform — it is your responsibility to inform us of any dietary restrictions or allergies.",
                "Delivery delays caused by factors outside our reasonable control (see Force Majeure clause).",
                "Unauthorised access to your account due to your failure to maintain account security.",
                "Technical issues arising from third-party services including Razorpay, Google, or your internet service provider.",
              ]} />
              <p className="mt-3">
                Our total liability to you for any claim arising out of or relating to these Terms
                or your use of the Platform shall not exceed the total amount paid by you for the
                order giving rise to the claim.
              </p>
            </section>

            {/* 16. Force Majeure */}
            <section id="force-majeure">
              <SectionHeading number="16" title="Force Majeure" />
              <p className="mb-3">
                Royal Zaika shall not be liable for any failure or delay in fulfilling its
                obligations under these Terms where such failure or delay is caused by events
                beyond our reasonable control, including but not limited to:
              </p>
              <InfoList items={[
                "Natural disasters, floods, earthquakes, or severe weather conditions",
                "Pandemic, epidemic, or public health emergency",
                "Government-imposed lockdowns, curfews, or restrictions",
                "Power outages or internet infrastructure failures",
                "Civil disturbance, riots, or acts of terrorism",
                "Strikes or labour disputes affecting supply chains",
              ]} />
              <p className="mt-3">
                In such events, we will make reasonable efforts to notify affected customers and
                process refunds for undelivered orders as soon as practicable.
              </p>
            </section>

            {/* 17. Suspension */}
            <section id="suspension">
              <SectionHeading number="17" title="Account Suspension &amp; Termination" />
              <p className="mb-3">
                We reserve the right to suspend, restrict, or permanently terminate your account
                at our sole discretion, with or without prior notice, in the following
                circumstances:
              </p>
              <InfoList items={[
                "Violation of any provision of these Terms.",
                "Fraudulent use of the Platform, including misuse of promotions or filing false claims.",
                "Abusive, threatening, or inappropriate behaviour towards our staff or riders.",
                "Repeated order cancellations or failed cash-on-delivery collections.",
                "Provision of false or misleading information during registration or checkout.",
                "Any activity that we reasonably believe may cause harm to Royal Zaika, our customers, or our staff.",
              ]} />
              <p className="mt-3">
                Upon termination, your right to access the Platform immediately ceases. You may
                contact us to appeal a suspension at{" "}
                <a href="mailto:support@royalzaika.in" className="text-orange-400 hover:underline">
                  support@royalzaika.in
                </a>
                .
              </p>
            </section>

            {/* 18. Privacy */}
            <section id="privacy-ref">
              <SectionHeading number="18" title="Privacy" />
              <p>
                Your privacy is important to us. By using the Platform, you agree to the
                collection and use of your information as described in our{" "}
                <Link href="/privacy" className="text-orange-400 hover:underline">
                  Privacy Policy
                </Link>
                . The Privacy Policy is incorporated into these Terms by reference and forms part
                of this agreement. Please read it carefully before using the Platform.
              </p>
            </section>

            {/* 19. Governing Law */}
            <section id="governing-law">
              <SectionHeading number="19" title="Governing Law &amp; Dispute Resolution" />
              <p className="mb-3">
                These Terms shall be governed by and construed in accordance with the laws of
                <strong className="text-white"> India</strong>, without regard to its conflict of
                law provisions.
              </p>
              <p className="mb-3">
                Any dispute, claim, or controversy arising out of or relating to these Terms or
                your use of the Platform shall first be attempted to be resolved through good-faith
                negotiation. If such negotiation fails, the dispute shall be subject to the
                exclusive jurisdiction of the courts located in{" "}
                <strong className="text-white">Varanasi, Uttar Pradesh, India</strong>.
              </p>
              <p>
                We comply with the following applicable Indian legislation:
              </p>
              <InfoList items={[
                "Information Technology Act, 2000 and its amendments",
                "Consumer Protection Act, 2019",
                "Digital Personal Data Protection Act, 2023 (DPDPA)",
                "Food Safety and Standards Act, 2006 (FSSAI)",
                "Indian Contract Act, 1872",
              ]} />
            </section>

            {/* 20. Contact */}
            <section id="contact">
              <SectionHeading number="20" title="Contact Information" />
              <p className="mb-4">
                If you have questions, complaints, or concerns about these Terms, please contact us:
              </p>
              <div
                className="rounded-2xl p-6 space-y-3 text-sm"
                style={{ background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.2)" }}
              >
                <p><span className="text-orange-400 font-semibold">Restaurant:</span>{" "}
                  <span className="text-white">Royal Zaika</span>
                </p>
                <p><span className="text-orange-400 font-semibold">Address:</span>{" "}
                  <span className="text-white">123 Food Street, Lanka, Varanasi, Uttar Pradesh – 221001</span>
                </p>
                <p><span className="text-orange-400 font-semibold">General Support:</span>{" "}
                  <a href="mailto:support@royalzaika.in" className="text-orange-400 hover:underline">
                    support@royalzaika.in
                  </a>
                </p>
                <p><span className="text-orange-400 font-semibold">Legal / Privacy:</span>{" "}
                  <a href="mailto:privacy@royalzaika.in" className="text-orange-400 hover:underline">
                    privacy@royalzaika.in
                  </a>
                </p>
                <p><span className="text-orange-400 font-semibold">Phone:</span>{" "}
                  <a href="tel:+919876543210" className="text-orange-400 hover:underline">
                    +91 98765 43210
                  </a>
                </p>
                <p><span className="text-orange-400 font-semibold">Support Hours:</span>{" "}
                  <span className="text-white">Monday – Sunday, 10:00 AM – 10:30 PM IST</span>
                </p>
              </div>
            </section>

            {/* Last Updated */}
            <div
              className="rounded-2xl p-5 text-center text-xs text-gray-500"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <p className="mb-1">📅 <strong className="text-gray-400">Effective Date:</strong> 1 January 2024</p>
              <p>🔄 <strong className="text-gray-400">Last Updated:</strong> 20 July 2026</p>
            </div>

            {/* Bottom Links */}
            <div className="flex flex-col sm:flex-row gap-3 pt-4">
              <Link
                href="/privacy"
                className="flex-1 text-center py-3 rounded-xl text-sm font-semibold transition-all"
                style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}
              >
                Read Privacy Policy →
              </Link>
              <Link
                href="/"
                className="flex-1 text-center py-3 rounded-xl text-sm font-semibold transition-all text-gray-400 hover:text-white"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
              >
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
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-black text-white"
        style={{ background: "linear-gradient(135deg,#f97316,#dc2626)" }}
      >
        {number}
      </div>
      <h2
        className="text-xl font-bold text-white"
        style={{ fontFamily: "'Outfit', sans-serif" }}
        dangerouslySetInnerHTML={{ __html: title.replace(/&amp;/g, "&") }}
      />
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



