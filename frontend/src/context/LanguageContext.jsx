import React, { createContext, useContext, useState, useEffect } from "react";

const LangContext = createContext(null);

const STORE_KEY = "ja_lang";

const DICT = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.kits": "Signature Kits",
    "nav.service_packs": "Service Packs",
    "nav.products": "Products",
    "nav.part_requests": "Request Any Part",
    "nav.cart": "Cart",
    "nav.orders": "Orders",
    "nav.returns": "Returns",
    "nav.profile": "Profile & KYC",
    "nav.signout": "Sign out",
    "header.workshop": "Workshop Portal",
    "header.admin": "Admin Console",
    "common.loading": "Loading…",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.back": "Back",
    "common.add_to_cart": "Add to Cart",
    "common.your_price": "Your Price",
    "common.retail": "Retail",
    "common.save_amount": "save",
    "common.includes": "Includes",
    "products.title": "Products",
    "products.search": "Search by name or SKU",
    "products.find_for_car": "Find parts for your car",
    "cart.title": "Cart",
    "cart.empty": "Your cart is empty",
    "cart.subtotal": "Subtotal",
    "cart.checkout": "Checkout",
    "orders.title": "Orders",
    "orders.empty": "No orders yet",
    "order.invoice": "Invoice",
    "order.reorder": "Reorder",
    "order.request_return": "Request Return",
    "order.tracking": "Tracking",
    "order.placed": "Placed",
    "order.confirmed": "Confirmed",
    "order.packed": "Packed",
    "order.shipped": "Shipped",
    "order.delivered": "Delivered",
    "order.cancelled": "Cancelled",
    "order.out_for_delivery": "Out for Delivery",
    "returns.title": "Returns",
    "returns.empty": "No return requests yet",
    "returns.create_title": "Request a Return",
    "returns.no_eligible": "Returns are only available within 7 days of delivery.",
    "returns.reason_label": "Overall reason",
    "returns.submit": "Submit Return Request",
    "returns.window_note": "Returns accepted within 7 days of delivery.",
    "lang.toggle_to_bn": "বাংলা",
    "lang.toggle_to_en": "English",
    "service_packs.title": "JOY Service Packs",
    "service_packs.subtitle": "One click. Full service.",
    "service_packs.add": "Add Pack",
    "kits.title": "Signature Kits",
  },
  bn: {
    "nav.dashboard": "ড্যাশবোর্ড",
    "nav.kits": "সিগনেচার কিটস",
    "nav.service_packs": "সার্ভিস প্যাক",
    "nav.products": "পণ্য",
    "nav.part_requests": "যেকোনো পার্ট অনুরোধ",
    "nav.cart": "কার্ট",
    "nav.orders": "অর্ডার",
    "nav.returns": "ফেরত",
    "nav.profile": "প্রোফাইল ও KYC",
    "nav.signout": "সাইন আউট",
    "header.workshop": "ওয়ার্কশপ পোর্টাল",
    "header.admin": "অ্যাডমিন কনসোল",
    "common.loading": "লোড হচ্ছে…",
    "common.save": "সংরক্ষণ",
    "common.cancel": "বাতিল",
    "common.back": "ফিরে যান",
    "common.add_to_cart": "কার্টে যোগ করুন",
    "common.your_price": "আপনার দাম",
    "common.retail": "রিটেইল",
    "common.save_amount": "সাশ্রয়",
    "common.includes": "অন্তর্ভুক্ত",
    "products.title": "পণ্য",
    "products.search": "নাম বা SKU দিয়ে খুঁজুন",
    "products.find_for_car": "আপনার গাড়ির পার্ট খুঁজুন",
    "cart.title": "কার্ট",
    "cart.empty": "আপনার কার্ট খালি",
    "cart.subtotal": "সাবটোটাল",
    "cart.checkout": "চেকআউট",
    "orders.title": "অর্ডার",
    "orders.empty": "এখনো কোনো অর্ডার নেই",
    "order.invoice": "ইনভয়েস",
    "order.reorder": "পুনরায় অর্ডার",
    "order.request_return": "ফেরত অনুরোধ",
    "order.tracking": "ট্র্যাকিং",
    "order.placed": "প্লেসড",
    "order.confirmed": "কনফার্মড",
    "order.packed": "প্যাকড",
    "order.shipped": "শিপড",
    "order.delivered": "ডেলিভার্ড",
    "order.cancelled": "বাতিল",
    "order.out_for_delivery": "ডেলিভারির জন্য",
    "returns.title": "ফেরত",
    "returns.empty": "এখনো কোনো ফেরত অনুরোধ নেই",
    "returns.create_title": "ফেরতের অনুরোধ",
    "returns.no_eligible": "ডেলিভারির ৭ দিনের মধ্যে কেবল ফেরত গ্রহণযোগ্য।",
    "returns.reason_label": "প্রধান কারণ",
    "returns.submit": "ফেরত অনুরোধ জমা দিন",
    "returns.window_note": "ডেলিভারির ৭ দিনের মধ্যে ফেরত গ্রহণযোগ্য।",
    "lang.toggle_to_bn": "বাংলা",
    "lang.toggle_to_en": "English",
    "service_packs.title": "JOY সার্ভিস প্যাক",
    "service_packs.subtitle": "এক ক্লিকেই সম্পূর্ণ সার্ভিস।",
    "service_packs.add": "প্যাক যোগ করুন",
    "kits.title": "সিগনেচার কিটস",
  },
};

export const LanguageProvider = ({ children }) => {
  const [lang, setLang] = useState(() => {
    try {
      return localStorage.getItem(STORE_KEY) || "en";
    } catch {
      return "en";
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, lang);
      document.documentElement.lang = lang === "bn" ? "bn" : "en";
    } catch (_) { /* ignore */ }
  }, [lang]);

  const t = (key, fallback) => {
    const dict = DICT[lang] || DICT.en;
    return dict[key] || fallback || DICT.en[key] || key;
  };

  const toggle = () => setLang((l) => (l === "en" ? "bn" : "en"));

  return (
    <LangContext.Provider value={{ lang, t, toggle, setLang }}>{children}</LangContext.Provider>
  );
};

export const useLang = () => {
  const ctx = useContext(LangContext);
  if (!ctx) {
    // Fallback: don't crash if used outside provider
    return { lang: "en", t: (k, f) => f || k, toggle: () => {}, setLang: () => {} };
  }
  return ctx;
};
