import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  ReceiptText,
  ShieldCheck,
  ArrowUpRight,
  KeyRound,
  Command,
  Menu,
  X,
} from 'lucide-react';
import { useStore } from '../context/Store.jsx';
import { Modal } from '../components/UI.jsx';
import { setAdminKey } from '../services/api.js';
const links = [
  ['/', 'Overview', LayoutDashboard],
  ['/products', 'Products', Package],
  ['/cart', 'Current cart', ShoppingBag],
  ['/orders', 'Orders', ReceiptText],
];
export function Shell() {
  const { cartCount, notify } = useStore();
  const { pathname } = useLocation();
  const [keyModal, setKeyModal] = useState(false);
  const [key, setKey] = useState('');
  const [menu, setMenu] = useState(false);
  const title = pathname.startsWith('/orders/')
    ? 'Order details'
    : links.find(([path]) => path === pathname)?.[1] || 'Workspace';
  return (
    <div className="app-shell">
      <aside className={`sidebar ${menu ? 'open' : ''}`}>
        <NavLink to="/" className="brand">
          <span className="brand-icon">
            <Command size={23} />
          </span>
          counter<span className="brand-dot">.</span>
        </NavLink>
        <div className="workspace">
          <span className="workspace-avatar">T</span>
          <div>
            <strong>Techloom Store</strong>
            <small>Retail workspace</small>
          </div>
          <span className="workspace-label">POS</span>
        </div>
        <p className="nav-caption">WORKSPACE</p>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              onClick={() => setMenu(false)}
              className={({ isActive }) =>
                isActive ? 'nav-link active' : 'nav-link'
              }
            >
              <Icon size={19} />
              {label}
              {path === '/cart' && cartCount > 0 && (
                <span className="nav-count">{cartCount}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="safe-card">
            <ShieldCheck size={23} />
            <strong>Every unit accounted for.</strong>
            <p>Inventory protected by real-time reservations.</p>
            <span>
              Built for a better checkout <ArrowUpRight size={14} />
            </span>
          </div>
          <button className="staff-button" onClick={() => setKeyModal(true)}>
            <span className="staff-avatar">TS</span>
            <span>
              <strong>Store operator</strong>
              <small>Staff access settings</small>
            </span>
            <KeyRound size={16} />
          </button>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-toggle"
              aria-label="Toggle navigation"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span>Workspace</span>
            <span className="slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-right">
            <span className="demo-tag">DEMO WORKSPACE</span>
            <span className="avatar">TS</span>
          </div>
        </header>
        <main>
          <Outlet />
        </main>
        <footer>
          Counter · POS & Inventory
          <span>Thoughtfully built. Transactionally safe.</span>
        </footer>
      </div>
      {keyModal && (
        <Modal title="Staff access" onClose={() => setKeyModal(false)}>
          <p className="muted">
            Enter the server's staff key to manage products in a protected
            deployment. It is kept in memory only.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setAdminKey(key);
              setKey('');
              setKeyModal(false);
              notify('Staff access key updated.');
            }}
          >
            <label>
              Staff key
              <input
                autoFocus
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button className="button primary full">Save access key</button>
          </form>
        </Modal>
      )}
    </div>
  );
}
