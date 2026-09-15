import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Minus,
  Plus,
  Timer,
} from 'lucide-react';
import { useStore } from '../context/Store.jsx';
import { useResource } from '../hooks/useResource.js';
import { api } from '../services/api.js';
import { money } from '../utils/format.js';
import { Empty, ErrorBox, Loading, ProductArt } from '../components/UI.jsx';
function ActiveCart({ id }) {
  const { data: cart, loading, error, reload } = useResource(`/carts/${id}`);
  const { setCartCount, clearCart, cartRevision, notify } = useStore();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  useEffect(() => {
    reload();
  }, [cartRevision, reload]);
  useEffect(() => {
    if (cart)
      setCartCount(
        cart.status === 'ACTIVE'
          ? cart.items.reduce((n, item) => n + item.quantity, 0)
          : 0,
      );
  }, [cart, setCartCount]);
  async function change(item, quantity) {
    setBusy(true);
    try {
      await api(`/carts/${id}/items/${item.id}`, {
        method: quantity ? 'PATCH' : 'DELETE',
        ...(quantity ? { body: { quantity } } : {}),
      });
      await reload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy(false);
    }
  }
  async function checkout() {
    setBusy(true);
    try {
      const order = await api(`/carts/${id}/checkout`, { method: 'POST' });
      clearCart();
      navigate(`/orders/${order.id}`);
      notify('Stock reserved. You have 5 minutes to complete payment.');
    } catch (error) {
      notify(error.message, 'error');
      await reload();
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (cart.status !== 'ACTIVE')
    return (
      <Empty title="This cart has been checked out">
        <button className="button primary" onClick={clearCart}>
          Start a new cart
        </button>
      </Empty>
    );
  if (!cart.items.length)
    return (
      <Empty title="A little empty, a lot of possibility.">
        Find something great in your <Link to="/products">product catalog</Link>
        .
      </Empty>
    );
  return (
    <div className="checkout-grid">
      <section className="panel cart-panel">
        <div className="section-heading">
          <h2>
            Items in your cart{' '}
            <span className="count-pill">{cart.items.length}</span>
          </h2>
          <ShoppingBag size={20} />
        </div>
        {cart.items.map((item) => (
          <div className="cart-item" key={item.id}>
            <ProductArt name={item.product.name} small />
            <div className="cart-item-name">
              <h3>{item.product.name}</h3>
              <p>{money(item.product.price)} each</p>
              <small>
                {item.product.stock} available
                {!item.product.isActive && ' · Archived'}
              </small>
            </div>
            <div className="quantity-control">
              <button
                aria-label={`Decrease ${item.product.name} quantity`}
                disabled={busy || item.quantity <= 1}
                onClick={() => change(item, item.quantity - 1)}
              >
                <Minus size={13} />
              </button>
              <span>{item.quantity}</span>
              <button
                aria-label={`Increase ${item.product.name} quantity`}
                disabled={busy || item.quantity >= 1000}
                onClick={() => change(item, item.quantity + 1)}
              >
                <Plus size={13} />
              </button>
            </div>
            <strong>{money(item.subtotal)}</strong>
            <button
              className="icon-button"
              aria-label={`Remove ${item.product.name}`}
              disabled={busy}
              onClick={() => change(item, 0)}
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))}
        <div className="cart-note">
          <ShieldCheck size={17} /> Prices and availability are checked again at
          checkout.
        </div>
      </section>
      <aside className="panel summary-panel">
        <h2>Order summary</h2>
        <div className="summary-line">
          <span>Subtotal</span>
          <span>{money(cart.totalAmount)}</span>
        </div>
        <div className="summary-line">
          <span>Additional charges</span>
          <span>{money(0)}</span>
        </div>
        <div className="summary-total">
          <span>Total</span>
          <strong>{money(cart.totalAmount)}</strong>
        </div>
        <button
          disabled={busy}
          className="button primary full"
          onClick={checkout}
        >
          {busy ? 'Processing…' : 'Reserve & checkout'}
          <ArrowRight size={17} />
        </button>
        <div className="reservation-note">
          <Timer size={19} />
          <p>
            Checkout holds your items for <strong>5 minutes</strong>. Complete
            mock payment before the reservation expires.
          </p>
        </div>
        <Link className="continue-link" to="/products">
          Continue browsing
        </Link>
      </aside>
    </div>
  );
}
export function Cart() {
  const { cartId } = useStore();
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ONE STEP CLOSER</div>
          <h1>
            Your current cart<span>.</span>
          </h1>
          <p>Review your items. We'll handle the stock when you're ready.</p>
        </div>
        <Link className="button secondary" to="/products">
          Browse products <ArrowRight size={17} />
        </Link>
      </div>
      {cartId ? (
        <ActiveCart id={cartId} />
      ) : (
        <section className="panel">
          <Empty title="Your next sale starts here.">
            <Link className="button primary" to="/products">
              Explore the catalog <ArrowRight size={17} />
            </Link>
          </Empty>
        </section>
      )}
    </>
  );
}
