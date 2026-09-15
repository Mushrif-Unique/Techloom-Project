import { createContext, useContext, useRef, useState } from 'react';
import { api } from '../services/api.js';
const StoreContext = createContext(null);
export function StoreProvider({ children }) {
  const [cartId, setCartId] = useState(() =>
    localStorage.getItem('counter-cart'),
  );
  const [cartCount, setCartCount] = useState(0);
  const [cartRevision, setCartRevision] = useState(0);
  const touchCart = () => setCartRevision((value) => value + 1);
  const [toast, setToast] = useState(null);
  const timer = useRef();
  const creating = useRef(null);
  function notify(message, type = 'success') {
    setToast({ message, type });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 4500);
  }
  function saveCart(id) {
    setCartId(id);
    localStorage.setItem('counter-cart', id);
  }
  async function ensureCart() {
    if (cartId) {
      try {
        const cart = await api(`/carts/${cartId}`);
        if (cart.status === 'ACTIVE') return cartId;
      } catch {
        /* A deleted demo cart can be replaced. */
      }
    }
    if (!creating.current)
      creating.current = api('/carts', { method: 'POST' })
        .then((cart) => {
          saveCart(cart.id);
          return cart.id;
        })
        .finally(() => {
          creating.current = null;
        });
    return creating.current;
  }
  function clearCart() {
    setCartId(null);
    setCartCount(0);
    localStorage.removeItem('counter-cart');
  }
  return (
    <StoreContext.Provider
      value={{
        cartId,
        cartCount,
        setCartCount,
        cartRevision,
        touchCart,
        ensureCart,
        clearCart,
        notify,
      }}
    >
      {children}
      {toast && (
        <div role="status" className={`toast ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </StoreContext.Provider>
  );
}
export const useStore = () => useContext(StoreContext);
