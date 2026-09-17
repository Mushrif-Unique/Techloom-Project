import { useEffect, useState } from 'react';
import { Link, NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import {
  ArrowUpRight,
  ShoppingBag,
  UserRound,
  Leaf,
  ShieldCheck,
  ArrowRight,
  Package,
  LogOut,
} from 'lucide-react';
import { api, money, label } from './api';
import { useStore } from './context';
export function Layout() {
  const { user, count, logout } = useStore();
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <div className="announcement">
        GOOD DESIGN. EVERY DAY.{' '}
        <span>
          Discover your next everyday essential <ArrowUpRight size={12} />
        </span>
      </div>
      <header className="header">
        <Link className="brand" to="/">
          atelier<span>®</span>
        </Link>
        <nav aria-label="Main navigation">
          <NavLink to="/" end>
            Discover
          </NavLink>
          <Link to="/?category=Home">For your home</Link>
          <NavLink to="/orders">My orders</NavLink>
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="hello">Hi, {user.name.split(' ')[0]}</span>
              <button
                className="icon-button"
                onClick={logout}
                title="Sign out"
                aria-label="Sign out"
              >
                <LogOut size={19} />
              </button>
            </>
          ) : (
            <Link to="/login" className="icon-button" aria-label="Sign in">
              <UserRound size={20} />
            </Link>
          )}
          <Link to="/cart" className="bag-link" aria-label={`Shopping bag, ${count} items`}>
            <ShoppingBag size={20} />
            <span>Bag</span>
            <b>{count}</b>
          </Link>
        </div>
      </header>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <footer>
        <div>
          <Link className="brand" to="/">
            atelier<span>®</span>
          </Link>
          <p>Good things. Chosen with care.</p>
        </div>
        <p>Everyday essentials, a little more considered.</p>
        <span>© {new Date().getFullYear()} Atelier</span>
      </footer>
    </>
  );
}
export function Protected() {
  const { user, ready } = useStore();
  const location = useLocation();
  return !ready ? (
    <Loading />
  ) : user ? (
    <Outlet />
  ) : (
    <Navigate to="/login" state={{ from: location.pathname }} replace />
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      Just a moment…
    </div>
  );
}
export function ErrorBox({ message, retry }) {
  return (
    <div className="error" role="alert">
      {message}
      {retry && <button onClick={retry}>Try again</button>}
    </div>
  );
}
export function Empty({ title, text, to = '/', action = 'Explore the collection' }) {
  return (
    <div className="empty">
      <Package size={40} strokeWidth={1} />
      <h2>{title}</h2>
      <p>{text}</p>
      <Link className="button" to={to}>
        {action}
        <ArrowRight size={16} />
      </Link>
    </div>
  );
}
export function ProductImage({ src, alt, ...props }) {
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.onerror = null;
        e.currentTarget.src = '/images/placeholder.svg';
      }}
      {...props}
    />
  );
}
export function Badge({ status }) {
  return (
    <span
      className={`badge ${['REFUNDED', 'PAYMENT_FAILED', 'FAILED', 'EXPIRED', 'CANCELLED'].includes(status) ? 'neutral' : status.includes('TIMEOUT') ? 'warning' : ''}`}
    >
      {label(status)}
    </span>
  );
}
export function Benefits() {
  return (
    <div className="benefits">
      <span>
        <Leaf size={20} />
        Thoughtfully curated
      </span>
      <span>
        <ShieldCheck size={20} />
        Secure checkout
      </span>
      <span>
        <Package size={20} />
        Simple cancellations
      </span>
    </div>
  );
}
export function useResource(path, dependencies = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    api
      .get(path)
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [path, version, ...dependencies]);
  return { data, setData, error, loading, reload: () => setVersion((v) => v + 1) };
}
export function Summary({ items, total, children }) {
  return (
    <aside className="summary">
      <h2>Order summary</h2>
      {items.map((i) => (
        <div className="summary-item" key={i.id || i.productId}>
          <ProductImage src={i.imageUrl || i.product?.imageUrl} alt="" />
          <div>
            <strong>{i.productName || i.product?.name}</strong>
            <small>
              Qty {i.quantity} · {money(i.unitPrice || i.product?.price)} each
            </small>
          </div>
          <span>{money(i.lineTotal)}</span>
        </div>
      ))}
      <div className="summary-line">
        <span>Subtotal</span>
        <span>{money(total)}</span>
      </div>
      <div className="summary-line">
        <span>Delivery</span>
        <span className="green">Complimentary</span>
      </div>
      <div className="summary-total">
        <span>Total</span>
        <span>{money(total)}</span>
      </div>
      <small className="muted">USD · No additional fees in this demo store.</small>
      {children}
    </aside>
  );
}
