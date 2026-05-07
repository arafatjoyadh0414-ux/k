import React from "react";
import { Link } from "react-router-dom";
import { LOGO } from "./landingHelpers";

const LandingFooter = ({ onLogin }) => (
  <footer className="border-t border-zinc-200 bg-white">
    <div className="max-w-7xl mx-auto px-5 sm:px-6 py-10">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="sm:col-span-2">
          <div className="flex items-center gap-3 mb-3">
            <img src={LOGO} alt="JOY Automart" className="w-9 h-9 object-contain" />
            <div className="font-display text-lg text-zinc-900">JOY Automart</div>
          </div>
          <p className="text-sm text-zinc-600 max-w-md leading-relaxed">
            Bangladesh's first AI-powered auto parts commerce &amp; data platform. B2B wholesale · B2C retail ·
            Experience Centre · JOY BEAST atelier.
          </p>
        </div>
        <div>
          <div className="overline text-zinc-500 mb-3">Platforms</div>
          <ul className="space-y-2 text-sm text-zinc-700">
            <li>
              <button onClick={onLogin} className="hover:text-[#E11D48]" data-testid="footer-portal-link">
                B2B Portal · Sign in
              </button>
            </li>
            <li>
              <a
                href="https://www.joyautomart.com"
                target="_blank"
                rel="noreferrer"
                className="hover:text-[#E11D48]"
                data-testid="footer-retail-link"
              >
                Retail Store · joyautomart.com
              </a>
            </li>
            <li>
              <Link to="/catalog" className="hover:text-[#E11D48]">
                Catalogue
              </Link>
            </li>
            <li>
              <Link to="/inquire" className="hover:text-[#E11D48]">
                JOY BEAST kits
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <div className="overline text-zinc-500 mb-3">Company</div>
          <ul className="space-y-2 text-sm text-zinc-700">
            <li>
              <a href="https://wa.me/8801886799533" className="hover:text-[#E11D48]">
                WhatsApp · 01886-799533
              </a>
            </li>
            <li>
              <a href="mailto:sales@joyautomart.com" className="hover:text-[#E11D48]">
                sales@joyautomart.com
              </a>
            </li>
            <li>
              <Link to="/terms" className="hover:text-[#E11D48]" data-testid="footer-terms-link">
                Terms
              </Link>
            </li>
            <li>
              <Link to="/privacy" className="hover:text-[#E11D48]" data-testid="footer-privacy-link">
                Privacy
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-zinc-200 mt-8 pt-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-zinc-500">
        <div>© {new Date().getFullYear()} JOY Automart · Dhaka, Bangladesh</div>
        <div>Built in Bangladesh · Engineered for the world</div>
      </div>
    </div>
  </footer>
);

export default LandingFooter;
