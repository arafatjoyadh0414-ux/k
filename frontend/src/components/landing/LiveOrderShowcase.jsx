import React from "react";

const LiveOrderShowcase = () => (
  <section className="max-w-7xl mx-auto px-5 sm:px-6 pb-14">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 border border-zinc-200 rounded-sm bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#E11D48] opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#E11D48]" />
          </span>
          <span className="overline text-[#E11D48]">Live order tracking</span>
        </div>
        <div className="flex items-baseline gap-3 flex-wrap">
          <div className="font-display text-xl sm:text-2xl text-zinc-900">ORD-20260209-A12B</div>
          <span className="text-xs px-2 py-1 bg-amber-100 text-amber-800 rounded-sm font-semibold uppercase tracking-wider">
            Shipped
          </span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs sm:text-sm">
          <div>
            <div className="text-zinc-500 uppercase tracking-wider text-[10px]">Items</div>
            <div className="font-semibold text-zinc-900 mt-1">Brake Disc Rotor × 4</div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase tracking-wider text-[10px]">Total</div>
            <div className="font-semibold text-zinc-900 mt-1">৳ 18,000</div>
          </div>
          <div>
            <div className="text-zinc-500 uppercase tracking-wider text-[10px]">ETA</div>
            <div className="font-semibold text-zinc-900 mt-1">Tomorrow</div>
          </div>
        </div>
        <div className="mt-5 h-1.5 bg-zinc-100 overflow-hidden rounded-full">
          <div className="h-full bg-[#E11D48] rounded-full" style={{ width: "65%" }} />
        </div>
        <div className="flex justify-between text-[10px] uppercase tracking-wider text-zinc-500 mt-2">
          <span>Placed</span>
          <span>Confirmed</span>
          <span>Packed</span>
          <span className="text-[#E11D48] font-semibold">Shipped</span>
          <span>Delivered</span>
        </div>
      </div>
      <div className="border border-zinc-200 rounded-sm bg-zinc-900 text-white p-5 sm:p-6 flex flex-col justify-between">
        <div>
          <div className="overline text-zinc-400">Don't have JavaScript?</div>
          <h3 className="font-display text-xl mt-2">Order on WhatsApp.</h3>
          <p className="text-sm text-zinc-300 mt-2 leading-relaxed">
            Send your part number to <strong className="text-white">01886-799533</strong>. Stock + price confirmed in
            minutes.
          </p>
        </div>
        <a
          href="https://wa.me/8801886799533"
          data-testid="cta-whatsapp-link"
          className="mt-5 inline-flex items-center justify-center gap-2 bg-[#25D366] hover:bg-[#1ca352] text-white px-5 py-2.5 rounded-full font-semibold text-sm transition-colors"
        >
          Open WhatsApp →
        </a>
      </div>
    </div>
  </section>
);

export default LiveOrderShowcase;
