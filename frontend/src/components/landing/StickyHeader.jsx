import React from "react";
import { Link } from "react-router-dom";
import InstallPwaButton from "../InstallPwaButton";
import HeaderSearchTrigger from "../HeaderSearchTrigger";
import { LOGO, ThemeToggle } from "./landingHelpers";

const StickyHeader = ({ onLogin }) => (
  <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-zinc-950/80 border-b hairline dark:border-white/10">
    <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 min-h-[68px] xs:min-h-[78px] sm:h-[92px] lg:h-[104px] flex items-center justify-between gap-2 sm:gap-4 py-2 sm:py-0">
      <Link
        to="/"
        className="flex items-center gap-2.5 sm:gap-4 lg:gap-5 group min-w-0 flex-shrink overflow-hidden"
        data-testid="header-logo-link"
        aria-label="JOY Automart — The Automotive Intelligence Company"
      >
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <img
            src={LOGO}
            alt="JOY Automart"
            className="w-[58px] h-[58px] xs:w-[64px] xs:h-[64px] sm:w-[78px] sm:h-[78px] lg:w-[96px] lg:h-[96px] object-contain transition-transform duration-300 group-hover:scale-105"
            style={{ filter: "drop-shadow(0 4px 14px rgba(225,29,72,0.28)) drop-shadow(0 1px 2px rgba(0,0,0,0.08))" }}
          />
        </div>
        <div className="leading-[1.05] min-w-0 hidden xs:block">
          <div className="font-display text-[16px] xs:text-[18px] sm:text-[24px] lg:text-[28px] text-zinc-950 dark:text-white tracking-[-0.025em] font-bold whitespace-nowrap truncate">
            JOY Automart
          </div>
          <div className="flex items-start gap-1.5 mt-1">
            <span aria-hidden="true" className="block w-2.5 sm:w-4 h-px bg-[#E11D48] flex-shrink-0 mt-1.5" />
            <span className="font-mono text-[8px] xs:text-[8.5px] sm:text-[10px] lg:text-[11px] uppercase tracking-[0.14em] xs:tracking-[0.18em] sm:tracking-[0.22em] lg:tracking-[0.26em] text-[#E11D48] font-bold leading-[1.25] sm:whitespace-nowrap break-words">
              The Automotive Intelligence Company
            </span>
          </div>
        </div>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
        {/* Search — compact icon on mobile, pill on desktop */}
        <HeaderSearchTrigger />
        <ThemeToggle />
        <InstallPwaButton testid="landing-install-pwa" className="hidden sm:inline-flex" />
        <button
          data-testid="top-login-button"
          onClick={onLogin}
          className="magnetic inline-flex items-center bg-zinc-900 dark:bg-[#E11D48] hover:bg-zinc-800 dark:hover:bg-[#BE123C] text-white text-[12px] sm:text-sm font-semibold px-3 xs:px-3.5 sm:px-5 lg:px-6 py-2 sm:py-2.5 rounded-full whitespace-nowrap shadow-sm hover:shadow-md transition-all"
        >
          Sign in
        </button>
      </nav>
    </div>
  </header>
);

export default StickyHeader;
