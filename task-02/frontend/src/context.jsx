import { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';
const Context = createContext(null);
export function StoreProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [count, setCount] = useState(0);
  const [toast, setToast] = useState('');
  function notify(message) {
    setToast(message);
  }
  async function refreshCart() {
    try {
      const c = await api.get('/cart');
      setCount(c.itemCount);
    } catch {
      setCount(0);
    }
  }
  function logout() {
    sessionStorage.removeItem('atelier-token');
    setUser(null);
    setCount(0);
  }
  function signIn(data) {
    sessionStorage.setItem('atelier-token', data.token);
    setUser(data.user);
    void refreshCart();
  }
  useEffect(() => {
    if (sessionStorage.getItem('atelier-token'))
      api
        .get('/auth/me')
        .then((u) => {
          setUser(u);
          void refreshCart();
        })
        .catch(logout)
        .finally(() => setReady(true));
    else setReady(true);
    window.addEventListener('session-expired', logout);
    return () => window.removeEventListener('session-expired', logout);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 4000);
    return () => clearTimeout(id);
  }, [toast]);
  return (
    <Context.Provider value={{ user, ready, count, refreshCart, notify, signIn, logout }}>
      {children}
      {toast && (
        <div className="toast" role="status">
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast('')}>
            ×
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
export const useStore = () => useContext(Context);
