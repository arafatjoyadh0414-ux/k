import React, { useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useLang } from "../context/LanguageContext";
import { useTheme } from "../context/ThemeContext";
import {
  LayoutDashboard, Package, ShoppingCart, ClipboardList, UserCircle2,
  Shield, LogOut, Wrench, Sparkles, Inbox, FileQuestion, Truck, BarChart3, Boxes, Bike, RotateCcw, Globe, Zap, TrendingUp, ScanSearch, Repeat, Menu, X, Sun, Moon, Users, Camera, Briefcase, History, Search
} from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";

const NavItem = ({ to, icon: Icon, label, testid }) => (
  <NavLink
    to={to}
    data-testid={testid}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 transition-colors duration-200 ${
        isActive
          ? "border-l-[#E11D48] bg-zinc-50 dark:bg-white/5 text-zinc-900 dark:text-white font-semibold"
          : "border-l-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-white/5 hover:text-zinc-900 dark:hover:text-white"
      }`
    }
  >
    <Icon className="w-4 h-4" strokeWidth={2} />
    <span>{label}</span>
  </NavLink>
);

const Layout = ({ children }) => {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { lang, t, toggle } = useLang();
  const { theme, toggle: toggleTheme } = useTheme();
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Auto-close drawer on route change
  React.useEffect(() => { setDrawerOpen(false); }, [location.pathname]);

  return (
    <div className="min-h-screen flex bg-white dark:bg-zinc-950 portal-shell">
      {/* Mobile drawer backdrop */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/40"
          onClick={() => setDrawerOpen(false)}
          data-testid="sidebar-backdrop"
        />
      )}

      {/* Sidebar — fixed drawer on <lg, sticky panel on ≥lg */}
      <aside
        data-testid="sidebar"
        className={`
          fixed lg:sticky lg:top-0 inset-y-0 left-0 z-40
          w-[260px] max-w-[80vw]
          border-r border-zinc-200 dark:border-white/10 bg-white dark:bg-zinc-950 flex flex-col h-screen
          transition-transform duration-200 ease-out
          ${drawerOpen ? "translate-x-0" : "-translate-x-full"}
          lg:translate-x-0
        `}
      >
        <div className="p-5 border-b border-zinc-200 dark:border-white/10 flex items-center gap-3">
          <img src={LOGO} alt="Joy Automart" className="w-10 h-10 object-contain" data-testid="brand-logo" />
          <div className="min-w-0">
            <div className="font-display text-lg leading-none truncate text-zinc-900 dark:text-white">Joy Automart</div>
            <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 mt-1.5">B2B Portal</div>
          </div>
          <button
            onClick={() => setDrawerOpen(false)}
            className="lg:hidden ml-auto p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            aria-label="Close menu"
            data-testid="sidebar-close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 space-y-0.5 overflow-y-auto">
          {!isAdmin && (
            <>
              <NavItem to="/dashboard" icon={LayoutDashboard} label={t("nav.dashboard")} testid="nav-dashboard" />
              <NavItem to="/insights" icon={TrendingUp} label="Insights" testid="nav-insights" />
              <NavItem to="/quick-tools" icon={Zap} label="Quick Tools" testid="nav-quick-tools" />
              <NavItem to="/kits" icon={Sparkles} label={t("nav.kits")} testid="nav-kits" />
              <NavItem to="/service-packs" icon={Boxes} label={t("nav.service_packs")} testid="nav-service-packs" />
              <NavItem to="/products" icon={Package} label={t("nav.products")} testid="nav-products" />
              <NavItem to="/vin-lookup" icon={ScanSearch} label="VIN Lookup" testid="nav-vin-lookup" />
              <NavItem to="/recurring" icon={Repeat} label="Recurring" testid="nav-recurring" />
              <NavItem to="/fleets" icon={Truck} label="Fleets" testid="nav-fleets" />
              <NavItem to="/job-cards" icon={Briefcase} label="Job Cards" testid="nav-job-cards" />
              <NavItem to="/visual-search" icon={Camera} label="Visual Search" testid="nav-visual-search" />
              <NavItem to="/part-requests" icon={FileQuestion} label={t("nav.part_requests")} testid="nav-part-requests" />
              <NavItem to="/cart" icon={ShoppingCart} label={`${t("nav.cart")}${count ? ` (${count})` : ""}`} testid="nav-cart" />
              <NavItem to="/orders" icon={ClipboardList} label={t("nav.orders")} testid="nav-orders" />
              <NavItem to="/returns" icon={RotateCcw} label={t("nav.returns")} testid="nav-returns" />
              <NavItem to="/team" icon={Users} label="Team" testid="nav-team" />
              <NavItem to="/activity" icon={History} label="Activity" testid="nav-activity" />
              <NavItem to="/profile" icon={UserCircle2} label={t("nav.profile")} testid="nav-profile" />
            </>
          )}
          {isAdmin && (
            <>
              <NavItem to="/admin" icon={Shield} label="Admin Console" testid="nav-admin" />
              <NavItem to="/admin/workshops" icon={Wrench} label="Workshops" testid="nav-admin-workshops" />
              <NavItem to="/admin/orders" icon={ClipboardList} label="Orders" testid="nav-admin-orders" />
              <NavItem to="/admin/returns" icon={RotateCcw} label="Returns" testid="nav-admin-returns" />
              <NavItem to="/admin/tier-upgrades" icon={TrendingUp} label="Tier Upgrades" testid="nav-admin-tier-upgrades" />
              <NavItem to="/admin/part-requests" icon={FileQuestion} label="Part Requests" testid="nav-admin-part-requests" />
              <NavItem to="/admin/inquiries" icon={Inbox} label="Inquiries" testid="nav-admin-inquiries" />
              <NavItem to="/admin/products" icon={Package} label="Products" testid="nav-admin-products" />
              <NavItem to="/admin/suppliers" icon={Truck} label="Suppliers" testid="nav-admin-suppliers" />
              <NavItem to="/admin/delivery-persons" icon={Bike} label="Delivery Team" testid="nav-admin-delivery" />
              <NavItem to="/admin/reports" icon={BarChart3} label="Reports" testid="nav-admin-reports" />
              <NavItem to="/admin/search-intelligence" icon={Search} label="Search Intel" testid="nav-admin-search-intel" />
            </>
          )}
        </nav>

        <div className="border-t border-zinc-200 dark:border-white/10 p-4">
          <div className="flex items-center gap-3 mb-3">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-9 h-9 rounded-sm object-cover border border-zinc-200 dark:border-white/10" />
            ) : (
              <div className="w-9 h-9 rounded-sm bg-zinc-200 dark:bg-white/10 grid place-items-center text-zinc-600 dark:text-zinc-300 text-sm font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate text-zinc-900 dark:text-white">{user?.name}</div>
              <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{user?.joy_id || user?.email}</div>
            </div>
          </div>
          <button
            data-testid="logout-button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-sm py-2 border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] hover:text-[#E11D48] transition-colors duration-200 rounded-sm text-zinc-700 dark:text-zinc-300"
          >
            <LogOut className="w-4 h-4" /> {t("nav.signout")}
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="h-14 border-b border-zinc-200 dark:border-white/10 px-4 sm:px-6 flex items-center justify-between bg-white/80 dark:bg-zinc-950/80 backdrop-blur sticky top-0 z-20 gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-1.5 -ml-1.5 text-zinc-700 dark:text-zinc-300 hover:text-[#E11D48]"
              aria-label="Open menu"
              data-testid="sidebar-open"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link
              to={isAdmin ? "/admin" : "/dashboard"}
              data-testid="header-portal-link"
              className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500 dark:text-zinc-400 truncate hover:text-[#E11D48] dark:hover:text-[#FFB1C1] transition-colors"
            >
              {isAdmin ? t("header.admin") : t("header.workshop")} →
            </Link>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              onClick={toggleTheme}
              data-testid="layout-theme-toggle"
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              className="inline-flex items-center justify-center w-8 h-8 text-zinc-600 dark:text-zinc-300 hover:text-[#E11D48] border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] rounded-sm transition-colors duration-200"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            <button
              onClick={toggle}
              data-testid="lang-toggle"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-[#E11D48] border border-zinc-200 dark:border-white/10 hover:border-[#E11D48] px-2.5 py-1 rounded-sm transition-colors duration-200"
              title="Toggle language"
            >
              <Globe className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{lang === "en" ? t("lang.toggle_to_bn") : t("lang.toggle_to_en")}</span>
              <span className="sm:hidden">{lang === "en" ? "বাং" : "EN"}</span>
            </button>
            <div className="hidden md:block text-xs text-zinc-500 dark:text-zinc-400">www.joyautomart.com</div>
          </div>
        </header>
        <div className="p-4 sm:p-6 lg:p-8 text-zinc-900 dark:text-zinc-100">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
