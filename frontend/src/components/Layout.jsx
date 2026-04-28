import React from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import {
  LayoutDashboard, Package, ShoppingCart, ClipboardList, UserCircle2,
  Shield, LogOut, Wrench, Sparkles, Inbox
} from "lucide-react";

const LOGO = "https://customer-assets.emergentagent.com/job_458d530b-69c9-4d64-8b89-03923696b1c8/artifacts/gnewd2f2_IMG-20260209-WA0017.jpg";

const NavItem = ({ to, icon: Icon, label, testid }) => (
  <NavLink
    to={to}
    data-testid={testid}
    className={({ isActive }) =>
      `flex items-center gap-3 px-4 py-2.5 text-sm border-l-2 transition-colors duration-200 ${
        isActive
          ? "border-l-[#E11D48] bg-slate-50 text-slate-900 font-semibold"
          : "border-l-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
  const navigate = useNavigate();
  const isAdmin = user?.role === "admin";

  return (
    <div className="min-h-screen flex bg-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-slate-200 bg-white flex flex-col sticky top-0 h-screen">
        <div className="p-5 border-b border-slate-200 flex items-center gap-3">
          <img src={LOGO} alt="Joy Automart" className="w-10 h-10 object-contain" data-testid="brand-logo" />
          <div>
            <div className="font-display text-lg leading-none">Joy Automart</div>
            <div className="overline mt-1">B2B Portal</div>
          </div>
        </div>

        <nav className="flex-1 py-4 space-y-0.5">
          {!isAdmin && (
            <>
              <NavItem to="/dashboard" icon={LayoutDashboard} label="Dashboard" testid="nav-dashboard" />
              <NavItem to="/kits" icon={Sparkles} label="Signature Kits" testid="nav-kits" />
              <NavItem to="/products" icon={Package} label="Products" testid="nav-products" />
              <NavItem to="/cart" icon={ShoppingCart} label={`Cart${count ? ` (${count})` : ""}`} testid="nav-cart" />
              <NavItem to="/orders" icon={ClipboardList} label="Orders" testid="nav-orders" />
              <NavItem to="/profile" icon={UserCircle2} label="Profile & KYC" testid="nav-profile" />
            </>
          )}
          {isAdmin && (
            <>
              <NavItem to="/admin" icon={Shield} label="Admin Console" testid="nav-admin" />
              <NavItem to="/admin/workshops" icon={Wrench} label="Workshops" testid="nav-admin-workshops" />
              <NavItem to="/admin/orders" icon={ClipboardList} label="Orders" testid="nav-admin-orders" />
              <NavItem to="/admin/inquiries" icon={Inbox} label="Inquiries" testid="nav-admin-inquiries" />
              <NavItem to="/admin/products" icon={Package} label="Products" testid="nav-admin-products" />
            </>
          )}
        </nav>

        <div className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-3 mb-3">
            {user?.picture ? (
              <img src={user.picture} alt="" className="w-9 h-9 rounded-sm object-cover border border-slate-200" />
            ) : (
              <div className="w-9 h-9 rounded-sm bg-slate-200 grid place-items-center text-slate-600 text-sm font-semibold">
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm font-semibold truncate">{user?.name}</div>
              <div className="text-xs text-slate-500 truncate">{user?.email}</div>
            </div>
          </div>
          <button
            data-testid="logout-button"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 text-sm py-2 border border-slate-200 hover:border-[#E11D48] hover:text-[#E11D48] transition-colors duration-200 rounded-sm"
          >
            <LogOut className="w-4 h-4" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0">
        <header className="h-14 border-b border-slate-200 px-6 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="overline">{isAdmin ? "Admin Console" : "Workshop Portal"}</div>
          <div className="text-xs text-slate-500">www.joyautomart.com</div>
        </header>
        <div className="p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
