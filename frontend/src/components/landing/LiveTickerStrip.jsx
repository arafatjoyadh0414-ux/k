import React from "react";

const LiveTickerStrip = ({ ticker, hasNews }) => (
  <div
    className="bg-zinc-950 dark:bg-black text-zinc-400 dark:text-[#FFB1C1] text-[10px] tracking-[0.18em] uppercase overflow-hidden h-7 flex items-center border-b border-transparent dark:border-[#E11D48]/30 relative"
    aria-label={hasNews ? "Worldwide automotive news ticker" : "Live platform activity ticker"}
  >
    <div className="hidden sm:flex items-center gap-1.5 bg-[#E11D48] text-white font-mono text-[9px] tracking-[0.22em] uppercase font-bold px-2.5 h-full pl-3 pr-3 flex-shrink-0 relative z-[2] shadow-[2px_0_8px_rgba(0,0,0,0.45)]">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-white" />
      </span>
      {hasNews ? "Live · World Auto News" : "Live"}
    </div>
    <div className="ticker-track px-5 sm:pl-7 sm:pr-4 flex-1 min-w-0 ticker-mask">
      {[...ticker, ...ticker].map((t, i) => (
        <span key={i} className="font-mono inline-flex items-center gap-2">
          <span>{t}</span>
          <span className="text-zinc-700 dark:text-[#E11D48]/40">/</span>
        </span>
      ))}
    </div>
  </div>
);

export default LiveTickerStrip;
