import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";

const Wrap = ({ title, children, testid }) => (
  <div className="min-h-screen bg-white">
    <header className="border-b border-slate-200 bg-white sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3" data-testid="legal-back-home">
          <img src={LOGO} alt="JOY Automart" className="w-9 h-9 object-contain" />
          <div>
            <div className="font-display text-base leading-none">JOY Automart</div>
            <div className="overline mt-0.5">B2B Portal · Bangladesh</div>
          </div>
        </Link>
        <Link to="/" className="text-xs text-slate-500 hover:text-[#E11D48] inline-flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </Link>
      </div>
    </header>
    <main className="max-w-4xl mx-auto px-6 py-10" data-testid={testid}>
      <div className="overline">Legal</div>
      <h1 className="font-display text-4xl mt-1 mb-2">{title}</h1>
      <div className="text-xs text-slate-500 mb-8">Last updated: 9 February 2026</div>
      <article className="prose prose-slate max-w-none text-sm leading-relaxed text-slate-700 space-y-4">
        {children}
      </article>
    </main>
    <footer className="border-t border-slate-200 mt-16">
      <div className="max-w-4xl mx-auto px-6 py-6 text-xs text-slate-500">
        © {new Date().getFullYear()} JOY Automart · Dhaka, Bangladesh ·{" "}
        <a href="mailto:support@joyautomart.com" className="hover:text-[#E11D48]">support@joyautomart.com</a>
      </div>
    </footer>
  </div>
);

export const Terms = () => (
  <Wrap title="Terms of Service" testid="terms-page">
    <p>
      Welcome to the JOY Automart B2B Workshop Portal ("Portal"). These Terms of Service ("Terms")
      govern your access to and use of the Portal, including the catalog, ordering, credit, and
      delivery features.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">1. Eligibility & KYC</h2>
    <p>
      The Portal is for verified auto-repair workshops operating in Bangladesh. To order parts,
      workshops must complete KYC by submitting trade-license details and required documents.
      JOY Automart reserves the right to approve, reject, or revoke access at its discretion.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">2. Pricing & Tiers</h2>
    <p>
      Wholesale prices shown reflect your assigned pricing tier (Silver / Gold / Platinum / Custom).
      Volume discounts apply automatically at checkout based on order subtotal. Prices are subject to
      change without notice.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">3. Credit & Payment</h2>
    <p>
      Approved workshops may receive a credit limit set at JOY Automart's discretion. Credit orders
      are due within 30 days of placement unless otherwise agreed. Late payments may result in
      credit suspension. JOY Automart may also accept cash on delivery (COD) and online payments
      (Stripe / bKash / SSLCommerz where enabled).
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">4. Orders & Delivery</h2>
    <p>
      All orders are subject to stock availability. Delivery timelines are estimates and may vary by
      area. Tracking is provided through the Portal. Delivery charges, where applicable, are added
      to the order total and visible before payment.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">5. Returns</h2>
    <p>
      Returns are accepted within <b>7 days of delivery</b> for unused, undamaged parts in original
      packaging. Refund methods include credit-back to your account, replacement (re-ship), or cash
      refund — at JOY Automart's discretion. Custom-ordered or special-procurement items are
      non-returnable unless defective.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">6. Sourcing Requests</h2>
    <p>
      For parts not in stock, you may submit a sourcing request. Quotes are non-binding until
      confirmed by both parties. Lead times depend on supplier and origin.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">7. Account & Security</h2>
    <p>
      You are responsible for safeguarding your login credentials. Sign-in is via Google OAuth.
      Notify JOY Automart immediately of any unauthorised use. We may suspend accounts showing
      suspicious activity.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">8. Limitation of Liability</h2>
    <p>
      The Portal is provided "as is". JOY Automart is not liable for indirect, incidental, or
      consequential damages arising from use of the Portal or the products supplied. Total
      liability for any claim is limited to the amount paid for the specific product in question.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">9. Governing Law</h2>
    <p>
      These Terms are governed by the laws of the People's Republic of Bangladesh. Disputes will be
      resolved in the courts of Dhaka.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">10. Contact</h2>
    <p>
      For any questions about these Terms, write to{" "}
      <a href="mailto:legal@joyautomart.com" className="text-[#E11D48] hover:underline">
        legal@joyautomart.com
      </a>
      .
    </p>
  </Wrap>
);

export const Privacy = () => (
  <Wrap title="Privacy Policy" testid="privacy-page">
    <p>
      JOY Automart respects your privacy. This policy explains what information we collect, how we
      use it, and your choices.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">1. What we collect</h2>
    <ul className="list-disc pl-5 space-y-1.5">
      <li><b>Account info</b>: name, email, profile picture (from Google sign-in)</li>
      <li><b>Workshop info</b>: company name, contact phone, address, trade-license number</li>
      <li><b>KYC documents</b>: trade license, NID, owner photo (stored encrypted)</li>
      <li><b>Order data</b>: cart items, prices, delivery address, payment method</li>
      <li><b>Usage data</b>: pages visited, search queries, device/browser type</li>
    </ul>

    <h2 className="font-display text-xl text-slate-900 mt-8">2. How we use it</h2>
    <ul className="list-disc pl-5 space-y-1.5">
      <li>Verifying your workshop and processing orders</li>
      <li>Setting credit limits and pricing tier</li>
      <li>Sending transactional notifications (KYC updates, order status, delivery)</li>
      <li>Improving the catalog and Portal experience</li>
      <li>Compliance with applicable laws</li>
    </ul>

    <h2 className="font-display text-xl text-slate-900 mt-8">3. How we share it</h2>
    <p>
      We do <b>not</b> sell your data. We share necessary details only with:
    </p>
    <ul className="list-disc pl-5 space-y-1.5">
      <li>Logistics partners (rider name + phone for active deliveries)</li>
      <li>Payment processors (Stripe / bKash / SSLCommerz) for transactions you initiate</li>
      <li>Email service (Resend) for transactional messages</li>
      <li>Authorities, when legally required</li>
    </ul>

    <h2 className="font-display text-xl text-slate-900 mt-8">4. Cookies & sessions</h2>
    <p>
      We use a session cookie to keep you signed in. We do not use third-party advertising cookies
      on the Portal.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">5. Data retention</h2>
    <p>
      Account data is retained while your account is active and for up to 7 years after closure for
      tax and audit compliance. KYC documents are deleted within 90 days of account closure unless
      retention is required by law.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">6. Your rights</h2>
    <p>
      You may request access, correction, or deletion of your personal data at any time by writing
      to{" "}
      <a href="mailto:privacy@joyautomart.com" className="text-[#E11D48] hover:underline">
        privacy@joyautomart.com
      </a>
      . We will respond within 30 days.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">7. Security</h2>
    <p>
      We use TLS in transit, encrypted object storage for KYC documents, and role-based access
      controls. No system is 100% secure — please use strong Google account security and notify us
      immediately of any suspicious activity.
    </p>

    <h2 className="font-display text-xl text-slate-900 mt-8">8. Changes</h2>
    <p>
      We may update this policy occasionally. Material changes will be communicated via email or
      Portal banner.
    </p>
  </Wrap>
);

export const NotFound = () => (
  <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 text-center" data-testid="not-found-page">
    <img src={LOGO} alt="JOY Automart" className="w-16 h-16 object-contain mb-6" />
    <div className="overline">404</div>
    <h1 className="font-display text-5xl mt-2">Page not found</h1>
    <p className="text-sm text-slate-600 mt-3 max-w-md">
      The page you're looking for has been moved, renamed, or never existed. Let's get you back on track.
    </p>
    <Link
      to="/"
      data-testid="404-home-link"
      className="mt-6 inline-flex items-center gap-2 bg-[#E11D48] hover:bg-[#BE123C] text-white text-sm font-semibold px-5 py-3 rounded-sm transition-colors duration-200"
    >
      Back to home <ArrowLeft className="w-4 h-4 rotate-180" />
    </Link>
  </div>
);
