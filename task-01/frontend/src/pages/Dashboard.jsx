import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Package,
  Timer,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from 'lucide-react';
import { useResource } from '../hooks/useResource.js';
import { OrdersTable, ErrorBox, Loading } from '../components/UI.jsx';
export function Dashboard() {
  const { data, error, loading, reload } = useResource('/dashboard');
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">A LITTLE CLARITY FOR YOUR EVERYDAY</div>
          <h1>
            Your store, at a glance<span>.</span>
          </h1>
          <p>
            Keep things moving. Every product, every order, all in one place.
          </p>
        </div>
        <Link className="button primary" to="/products">
          <ShoppingBag size={17} /> New sale <ArrowUpRight size={17} />
        </Link>
      </div>
      <ErrorBox message={error} retry={reload} />
      {loading ? (
        <Loading />
      ) : (
        <>
          <div className="stats-grid">
            {[
              [
                Package,
                'Active products',
                data?.products ?? '—',
                'In your product catalog',
                'sage',
              ],
              [
                Box,
                'Available units',
                data?.availableStock ?? '—',
                'Ready for the next sale',
                'sand',
              ],
              [
                Timer,
                'Active reservations',
                data?.activeReservations ?? '—',
                'Held for up to 5 minutes',
                'lavender',
              ],
            ].map(([Icon, label, value, detail, color]) => (
              <section className="stat-card" key={label}>
                <div className="stat-top">
                  <span>{label}</span>
                  <span className={`stat-icon ${color}`}>
                    <Icon size={20} />
                  </span>
                </div>
                <strong className="stat-number">{value}</strong>
                <div className="stat-detail">
                  <span className="tiny-dot" />
                  {detail}
                </div>
              </section>
            ))}
          </div>
          <section className="feature-banner">
            <div className="feature-copy">
              <span className="feature-label">
                <Sparkles size={14} /> LESS FRICTION. MORE FLOW.
              </span>
              <h2>
                A good day starts
                <br />
                with a great checkout.
              </h2>
              <p>
                Browse your collection, build a cart, and make your next sale.
                <br />
                We'll keep the inventory in order.
              </p>
              <Link className="button cream" to="/products">
                Open product catalog <ArrowRight size={17} />
              </Link>
            </div>
            <div className="banner-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="receipt-art">
                <div className="receipt-logo">c.</div>
                <span>ONE LESS THING TO WORRY ABOUT</span>
                <div className="receipt-line" />
                <div className="receipt-row">
                  <span>Good products</span>
                  <b>✓</b>
                </div>
                <div className="receipt-row">
                  <span>Happy customers</span>
                  <b>✓</b>
                </div>
                <div className="receipt-row">
                  <span>Stock in sync</span>
                  <b>✓</b>
                </div>
                <div className="receipt-dashed" />
                <div className="receipt-total">
                  All accounted for.
                  <ShieldCheck size={20} />
                </div>
                <div className="barcode" />
              </div>
              <div className="floating-check">
                <ShieldCheck size={25} />
              </div>
            </div>
          </section>
          <section className="panel">
            <div className="section-heading">
              <div>
                <h2>Recent orders</h2>
                <p>A live look at what's moving through your store.</p>
              </div>
              <Link className="text-link" to="/orders">
                View all orders <ArrowUpRight size={16} />
              </Link>
            </div>
            <OrdersTable orders={data?.recentOrders} />
          </section>
          <div className="assurance">
            <ShieldCheck size={19} />
            <span>
              <strong>Safe by design.</strong> Stock is reserved at checkout and
              automatically released if payment doesn't go through.
            </span>
            <span className="live-indicator">
              <i /> Live inventory
            </span>
          </div>
        </>
      )}
    </>
  );
}
