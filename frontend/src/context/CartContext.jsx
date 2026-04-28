import React, { createContext, useContext, useEffect, useState } from "react";

const CartContext = createContext(null);
const KEY = "ja_cart";

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState(() => {
    try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => { localStorage.setItem(KEY, JSON.stringify(items)); }, [items]);

  const add = (product, qty) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.product_id === product.product_id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [...prev, {
        product_id: product.product_id, name: product.name, sku: product.sku,
        image_url: product.image_url, price_bdt: product.price_bdt, moq: product.moq,
        quantity: qty
      }];
    });
  };

  const update = (product_id, quantity) => {
    setItems((prev) => prev.map((x) => x.product_id === product_id ? { ...x, quantity } : x));
  };

  const remove = (product_id) => setItems((prev) => prev.filter((x) => x.product_id !== product_id));
  const clear = () => setItems([]);
  const total = items.reduce((s, x) => s + x.price_bdt * x.quantity, 0);
  const count = items.reduce((s, x) => s + x.quantity, 0);

  return (
    <CartContext.Provider value={{ items, add, update, remove, clear, total, count }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
