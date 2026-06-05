/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { create } from 'zustand';
import { User, BriefProduct, Order } from './types.ts';

export interface CartItem {
  product: BriefProduct;
  quantity: number;
  appliedDiscountPercentage: number; // 0-100%
}

export interface HeldOrder {
  id: string;
  items: CartItem[];
  customerId?: string;
  discountPercentage: number;
  createdAt: string;
}

interface AppState {
  // Auth state
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;

  // Selected Branch (to separate inventories)
  selectedBranchId: string;
  setSelectedBranchId: (id: string) => void;

  // POS Checkout Cart
  cart: CartItem[];
  addToCart: (product: BriefProduct) => void;
  removeFromCart: (productId: string) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  setCartDiscount: (productId: string, discountPct: number) => void;
  cartDiscountPercentage: number;
  setTotalCartDiscount: (discountPct: number) => void;
  clearCart: () => void;

  // Hold / Recall Transactions
  heldOrders: HeldOrder[];
  holdCurrentOrder: (customerId?: string) => void;
  recallOrder: (heldId: string) => void;
  deleteHeldOrder: (heldId: string) => void;

  // Active Customer selected at POS
  selectedCustomerId: string | null;
  setSelectedCustomerId: (id: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => {
  // Load initial local values safely
  const initialToken = typeof window !== 'undefined' ? localStorage.getItem('apex_token') : null;
  const initialUser = typeof window !== 'undefined' ? localStorage.getItem('apex_user') : null;
  const parsedUser = initialUser ? JSON.parse(initialUser) : null;
  const initialBranch = parsedUser ? parsedUser.branchId : 'b1';

  return {
    token: initialToken,
    user: parsedUser,
    selectedBranchId: initialBranch,

    setAuth: (token, user) => {
      localStorage.setItem('apex_token', token);
      localStorage.setItem('apex_user', JSON.stringify(user));
      set({ token, user, selectedBranchId: user.branchId });
    },

    logout: () => {
      localStorage.removeItem('apex_token');
      localStorage.removeItem('apex_user');
      set({ token: null, user: null, cart: [], selectedCustomerId: null });
    },

    setSelectedBranchId: (id) => set({ selectedBranchId: id }),

    // Cart Management
    cart: [],
    cartDiscountPercentage: 0,
    selectedCustomerId: null,

    addToCart: (product) => {
      const currentCart = get().cart;
      const existing = currentCart.find((item) => item.product.id === product.id);

      if (existing) {
        set({
          cart: currentCart.map((item) =>
            item.product.id === product.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
        });
      } else {
        set({ cart: [...currentCart, { product, quantity: 1, appliedDiscountPercentage: 0 }] });
      }
    },

    removeFromCart: (productId) => {
      set({ cart: get().cart.filter((item) => item.product.id !== productId) });
    },

    updateCartQuantity: (productId, quantity) => {
      if (quantity <= 0) {
        get().removeFromCart(productId);
        return;
      }
      set({
        cart: get().cart.map((item) =>
          item.product.id === productId ? { ...item, quantity } : item
        ),
      });
    },

    setCartDiscount: (productId, discountPct) => {
      set({
        cart: get().cart.map((item) =>
          item.product.id === productId
            ? { ...item, appliedDiscountPercentage: Math.min(100, Math.max(0, discountPct)) }
            : item
        ),
      });
    },

    setTotalCartDiscount: (discountPct) => {
      set({ cartDiscountPercentage: Math.min(100, Math.max(0, discountPct)) });
    },

    clearCart: () => set({ cart: [], cartDiscountPercentage: 0, selectedCustomerId: null }),

    // Hold / Recall Order Logic
    heldOrders: [],
    holdCurrentOrder: (customerId) => {
      const currentCart = get().cart;
      if (currentCart.length === 0) return;

      const newHeld: HeldOrder = {
        id: `held-${Date.now()}`,
        items: currentCart,
        customerId: customerId || get().selectedCustomerId || undefined,
        discountPercentage: get().cartDiscountPercentage,
        createdAt: new Date().toISOString(),
      };

      set({
        heldOrders: [newHeld, ...get().heldOrders],
        cart: [],
        cartDiscountPercentage: 0,
        selectedCustomerId: null,
      });
    },

    recallOrder: (heldId) => {
      const target = get().heldOrders.find((h) => h.id === heldId);
      if (!target) return;

      set({
        cart: target.items,
        selectedCustomerId: target.customerId || null,
        cartDiscountPercentage: target.discountPercentage,
        heldOrders: get().heldOrders.filter((h) => h.id !== heldId),
      });
    },

    deleteHeldOrder: (heldId) => {
      set({ heldOrders: get().heldOrders.filter((h) => h.id !== heldId) });
    },

    setSelectedCustomerId: (id) => set({ selectedCustomerId: id }),
  };
});
export default useAppStore;
