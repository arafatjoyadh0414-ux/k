import React from "react";
import { Link } from "react-router-dom";
import InstallPwaButton from "../InstallPwaButton";
import HeaderSearchTrigger from "../HeaderSearchTrigger";
import { LOGO, ThemeToggle } from "./landingHelpers";

const StickyHeader = ({ onLogin }) => (
  <header className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-zinc-950/80 border-b hairline dark:border-white/10">
    <div className="max-w-7xl mx-auto px-3 sm:px-5 lg:px-7 h-[80px] sm:h-[100px] lg:h-[112px] flex items-center justify-between gap-2 sm:gap-4">
      <Link
        to="/"
        className="flex items-center gap-3 sm:gap-4 lg:gap-5 group min-w-0 flex-shrink overflow-hidden"
        data-testid="header-logo-link"
        aria-label="JOY Automart — The Automotive Intelligence Company"
      >
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <img
            src={LOGO}
            alt="JOY Automart"
            className="w-[72px] h-[72px] sm:w-[92px] sm:h-[92px] lg:w-[108px] lg:h-[108px] object-contain transition-transform duration-300 group-hover:scale-105"
            style={{ filter: "drop-shadow(0 4px 14px rgba(225,29,72,0.28)) drop-shadow(0 1px 2px rgba(0,0,0,0.08))" }}
          />
        </div>
        <div className="leading-[1.05] min-w-0 hidden xs:block">
          <div className="font-display text-[20px] sm:text-[28px] lg:text-[32px] text-zinc-950 dark:text-white tracking-[-0.028em] font-bold whitespace-nowrap truncate">
            JOY Automart
          </div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <span aria-hidden="true" className="block w-3 sm:w-4 h-px bg-[#E11D48] flex-shrink-0" />
            <span className="font-mono text-[8.5px] xs:text-[9px] sm:text-[10.5px] lg:text-[11.5px] uppercase tracking-[0.2em] sm:tracking-[0.26em] lg:tracking-[0.28em] text-[#E11D48] font-bold whitespace-nowrap">
              The Automotive Intelligence Company
            </span>
          </div>
        </div>
      </Link>
      <nav className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
        <div className="hidden md:inline-flex">
          <HeaderSearchTrigger />
        </div>
        <ThemeToggle />
        <InstallPwaButton testid="landing-install-pwa" className="hidden sm:inline-flex" />
        <button
          data-testid="top-login-button"
          onClick={onLogin}
          className="magnetic inline-flex items-center bg-zinc-900 dark:bg-[#E11D48] hover:bg-zinc-800 dark:hover:bg-[#BE123C] text-white text-[12px] sm:text-sm font-semibold px-3.5 sm:px-5 lg:px-6 py-2 sm:py-2.5 rounded-full whitespace-nowrap shadow-sm hover:shadow-md transition-all"
        >
          Sign in
        </button>
      </nav>
    </div>
  </header>
);

export default StickyHeader;
