import React from "react";

const BottomCTASection = ({ onLogin }) => (
  <section id="cta" className="border-t border-zinc-200 bg-zinc-50 scroll-mt-28">
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-12 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
      <div>
        <div className="overline mb-2 text-zinc-500">Apply now</div>
        <h3 className="font-display text-2xl sm:text-3xl lg:text-4xl tracking-tight">
          Ready to place your first wholesale order?
        </h3>
        <p className="text-zinc-600 mt-2 text-sm sm:text-base">
          Sign up free. KYC takes a day. Credit gets approved on review.
        </p>
      </div>
      <button
        data-testid="bottom-cta-button"
        onClick={onLogin}
        className="inline-flex items-center gap-3 bg-zinc-900 hover:bg-[#E11D48] text-white px-6 py-3 rounded-full text-sm font-semibold transition-colors self-start lg:self-auto"
      >
        Get started →
      </button>
    </div>
  </section>
);

export default BottomCTASection;
