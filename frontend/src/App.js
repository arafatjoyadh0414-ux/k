import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthCallback from "@/components/AuthCallback";
import GuardianBot from "@/components/GuardianBot";

import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Products from "@/pages/Products";
import Cart from "@/pages/Cart";
import Orders from "@/pages/Orders";
import OrderDetail from "@/pages/OrderDetail";
import Profile from "@/pages/Profile";
import Kits from "@/pages/Kits";
import ServicePacks from "@/pages/ServicePacks";
import Inquire from "@/pages/Inquire";
import PartRequest from "@/pages/PartRequest";
import Returns from "@/pages/Returns";
import ProductDetail from "@/pages/ProductDetail";
import PaymentReturn from "@/pages/PaymentReturn";
import PublicCatalog from "@/pages/PublicCatalog";
import Insights from "@/pages/Insights";
import QuickTools from "@/pages/QuickTools";
import { Terms, Privacy, NotFound } from "@/pages/Legal";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminInquiries from "@/pages/AdminInquiries";
import AdminPartRequests from "@/pages/AdminPartRequests";
import AdminSuppliers from "@/pages/AdminSuppliers";
import AdminDeliveryPersons from "@/pages/AdminDeliveryPersons";
import AdminReturns from "@/pages/AdminReturns";
import AdminTierUpgrades from "@/pages/AdminTierUpgrades";
import AdminReports from "@/pages/AdminReports";
import AdminSearchIntelligence from "@/pages/AdminSearchIntelligence";
import AdminGeniusAnalytics from "@/pages/AdminGeniusAnalytics";
import AdminWorkshops from "@/pages/AdminWorkshops";
import AdminWorkshopDetail from "@/pages/AdminWorkshopDetail";
import AdminOrders from "@/pages/AdminOrders";
import AdminOrderDetail from "@/pages/AdminOrderDetail";
import AdminProducts from "@/pages/AdminProducts";
import Driver from "@/pages/Driver";
import VinLookup from "@/pages/VinLookup";
import Recurring from "@/pages/Recurring";
import PassportPublic from "@/pages/PassportPublic";
import Team from "@/pages/Team";
import Fleets from "@/pages/Fleets";
import AcceptInvite from "@/pages/AcceptInvite";
import VisualSearch from "@/pages/VisualSearch";
import JobCards from "@/pages/JobCards";
import PublicJobCard from "@/pages/PublicJobCard";
import AuditLog from "@/pages/AuditLog";
import ExperienceCentre from "@/pages/ExperienceCentre";
import useAutoTranslate from "@/hooks/useAutoTranslate";

const AppRouter = () => {
  const location = useLocation();
  useAutoTranslate();
  // Check URL fragment for session_id - process synchronously to avoid race conditions
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/inquire" element={<Inquire />} />
      <Route path="/inquire/:sku" element={<Inquire />} />
      <Route path="/catalog" element={<PublicCatalog />} />
      <Route path="/driver/:driverId" element={<Driver />} />
      <Route path="/p/:token" element={<PassportPublic />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/kits" element={<ProtectedRoute><Kits /></ProtectedRoute>} />
      <Route path="/service-packs" element={<ProtectedRoute><ServicePacks /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/products/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
      <Route path="/part-requests" element={<ProtectedRoute><PartRequest /></ProtectedRoute>} />
      <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
      <Route path="/returns" element={<ProtectedRoute><Returns /></ProtectedRoute>} />
      <Route path="/insights" element={<ProtectedRoute><Insights /></ProtectedRoute>} />
      <Route path="/quick-tools" element={<ProtectedRoute><QuickTools /></ProtectedRoute>} />
      <Route path="/vin-lookup" element={<ProtectedRoute><VinLookup /></ProtectedRoute>} />
      <Route path="/recurring" element={<ProtectedRoute><Recurring /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/team" element={<ProtectedRoute><Team /></ProtectedRoute>} />
      <Route path="/fleets" element={<ProtectedRoute><Fleets /></ProtectedRoute>} />
      <Route path="/visual-search" element={<ProtectedRoute><VisualSearch /></ProtectedRoute>} />
      <Route path="/job-cards" element={<ProtectedRoute><JobCards /></ProtectedRoute>} />
      <Route path="/jc/:token" element={<PublicJobCard />} />
      <Route path="/experience-centre" element={<ExperienceCentre />} />
      <Route path="/activity" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
      <Route path="/accept-invite" element={<AcceptInvite />} />
      <Route path="/payment/return" element={<ProtectedRoute><PaymentReturn /></ProtectedRoute>} />

      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/workshops" element={<ProtectedRoute adminOnly><AdminWorkshops /></ProtectedRoute>} />
      <Route path="/admin/workshops/:id" element={<ProtectedRoute adminOnly><AdminWorkshopDetail /></ProtectedRoute>} />
      <Route path="/admin/orders" element={<ProtectedRoute adminOnly><AdminOrders /></ProtectedRoute>} />
      <Route path="/admin/orders/:id" element={<ProtectedRoute adminOnly><AdminOrderDetail /></ProtectedRoute>} />
      <Route path="/admin/products" element={<ProtectedRoute adminOnly><AdminProducts /></ProtectedRoute>} />
      <Route path="/admin/inquiries" element={<ProtectedRoute adminOnly><AdminInquiries /></ProtectedRoute>} />
      <Route path="/admin/part-requests" element={<ProtectedRoute adminOnly><AdminPartRequests /></ProtectedRoute>} />
      <Route path="/admin/suppliers" element={<ProtectedRoute adminOnly><AdminSuppliers /></ProtectedRoute>} />
      <Route path="/admin/delivery-persons" element={<ProtectedRoute adminOnly><AdminDeliveryPersons /></ProtectedRoute>} />
      <Route path="/admin/returns" element={<ProtectedRoute adminOnly><AdminReturns /></ProtectedRoute>} />
      <Route path="/admin/tier-upgrades" element={<ProtectedRoute adminOnly><AdminTierUpgrades /></ProtectedRoute>} />
      <Route path="/admin/reports" element={<ProtectedRoute adminOnly><AdminReports /></ProtectedRoute>} />
      <Route path="/admin/search-intelligence" element={<ProtectedRoute adminOnly><AdminSearchIntelligence /></ProtectedRoute>} />
      <Route path="/admin/genius-analytics" element={<ProtectedRoute adminOnly><AdminGeniusAnalytics /></ProtectedRoute>} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <ThemeProvider>
            <LanguageProvider>
              <CartProvider>
                <AppRouter />
                <GuardianBot />
                <Toaster richColors position="top-right" />
              </CartProvider>
            </LanguageProvider>
          </ThemeProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
