import React from "react";
import "@/App.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AuthCallback from "@/components/AuthCallback";

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
import ProductDetail from "@/pages/ProductDetail";
import PaymentReturn from "@/pages/PaymentReturn";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminInquiries from "@/pages/AdminInquiries";
import AdminPartRequests from "@/pages/AdminPartRequests";
import AdminSuppliers from "@/pages/AdminSuppliers";
import AdminDeliveryPersons from "@/pages/AdminDeliveryPersons";
import AdminReports from "@/pages/AdminReports";
import AdminWorkshops from "@/pages/AdminWorkshops";
import AdminWorkshopDetail from "@/pages/AdminWorkshopDetail";
import AdminOrders from "@/pages/AdminOrders";
import AdminOrderDetail from "@/pages/AdminOrderDetail";
import AdminProducts from "@/pages/AdminProducts";

const AppRouter = () => {
  const location = useLocation();
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

      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/kits" element={<ProtectedRoute><Kits /></ProtectedRoute>} />
      <Route path="/service-packs" element={<ProtectedRoute><ServicePacks /></ProtectedRoute>} />
      <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
      <Route path="/products/:id" element={<ProtectedRoute><ProductDetail /></ProtectedRoute>} />
      <Route path="/part-requests" element={<ProtectedRoute><PartRequest /></ProtectedRoute>} />
      <Route path="/cart" element={<ProtectedRoute><Cart /></ProtectedRoute>} />
      <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
      <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
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
      <Route path="/admin/reports" element={<ProtectedRoute adminOnly><AdminReports /></ProtectedRoute>} />
    </Routes>
  );
};

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <AppRouter />
            <Toaster richColors position="top-right" />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
