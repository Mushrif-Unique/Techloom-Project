import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Timer,
  ShieldCheck,
  Check,
  X,
  Clock3,
  FlaskConical,
  RotateCcw,
} from 'lucide-react';
import { useResource } from '../hooks/useResource.js';
import { useStore } from '../context/Store.jsx';
import { api } from '../services/api.js';
import { money, shortId, dateTime } from '../utils/format.js';
import {
  Status,
  Loading,
  ErrorBox,
  ProductArt,
  Modal,
} from '../components/UI.jsx';
function Countdown({ expiresAt, active }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seconds = Math.max(
    0,
    Math.ceil((new Date(expiresAt).getTime() - now) / 1000),
  );
  return (
    <div className={`countdown ${seconds < 60 ? 'urgent' : ''}`}>
      <Timer size={21} />
      <div>
        <span>
          {active ? 'Reservation expires in' : 'Reservation window closed'}
        </span>
        <strong>
          {active
            ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
            : '—'}
        </strong>
      </div>
      <small>{expiresAt ? dateTime(expiresAt) : ''}</small>
    </div>
  );
}
export function OrderDetail() {
  const { id } = useParams();
  const {
    data: order,
    loading,
    error,
    reload,
  } = useResource(`/orders/${id}`, 3000);
  const { notify } = useStore();
  const [busy, setBusy] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [pending, setPending] = useState(() =>
    JSON.parse(sessionStorage.getItem(`payment:${id}`) || 'null'),
  );
  async function pay(outcome) {
    const intent = pending || { outcome, key: crypto.randomUUID() };
    setPending(intent);
    sessionStorage.setItem(`payment:${id}`, JSON.stringify(intent));
    setBusy(true);
    try {
      const result = await api(`/orders/${id}/pay`, {
        method: 'POST',
        body: { outcome: intent.outcome },
        key: intent.key,
      });
      setPending(null);
      sessionStorage.removeItem(`payment:${id}`);
      notify(`Mock payment: ${result.payment.status.toLowerCase()}.`);
    } catch (error) {
      if (
        [
          'DUPLICATE_PAYMENT',
          'ORDER_ALREADY_PAID',
          'INVALID_ORDER_TRANSITION',
          'RESERVATION_EXPIRED',
        ].includes(error.code)
      ) {
        setPending(null);
        sessionStorage.removeItem(`payment:${id}`);
      }
      notify(error.message, 'error');
    } finally {
      await reload();
      setBusy(false);
    }
  }
  async function cancel() {
    setBusy(true);
    try {
      await api(`/orders/${id}/cancel`, { method: 'POST' });
      setCancelModal(false);
      notify('Order cancelled. Inventory restored.');
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      await reload();
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (!order) return <ErrorBox message={error} retry={reload} />;
  const active = order.status === 'RESERVED';
  return (
    <>
      <Link className="back-link" to="/orders">
        <ArrowLeft size={16} /> All orders
      </Link>
      <div className="page-heading">
        <div>
          <div className="eyebrow">ORDER DETAILS</div>
          <h1>
            Order #{shortId(order.id)}
            <span>.</span>
          </h1>
          <p>
            Created {dateTime(order.createdAt)} · {order.items.length} distinct
            products
          </p>
        </div>
        <Status value={order.status} />
      </div>
      <ErrorBox message={error} retry={reload} />
      <div className="checkout-grid">
        <div>
          <section className="panel">
            <div className="section-heading">
              <h2>Order items</h2>
              <ShieldCheck size={20} />
            </div>
            {order.items.map((item) => (
              <div className="cart-item order-item" key={item.id}>
                <ProductArt name={item.productNameSnapshot} small />
                <div className="cart-item-name">
                  <h3>{item.productNameSnapshot}</h3>
                  <p>
                    {money(item.unitPrice)} × {item.quantity}
                  </p>
                </div>
                <strong>{money(item.subtotal)}</strong>
              </div>
            ))}
            <div className="order-grand-total">
              <span>Order total</span>
              <strong>{money(order.totalAmount)}</strong>
            </div>
          </section>
          <section className="panel reservation-panel">
            <div className="section-heading">
              <h2>Reservation details</h2>
              <span className="subtle-label">SERVER MANAGED</span>
            </div>
            {order.reservations.map((reservation) => (
              <div className="reservation-row" key={reservation.id}>
                <span>
                  {
                    order.items.find(
                      (item) => item.productId === reservation.productId,
                    )?.productNameSnapshot
                  }
                  <small>
                    {reservation.quantity} units · expires{' '}
                    {dateTime(reservation.expiresAt)}
                  </small>
                </span>
                <Status value={reservation.status} />
              </div>
            ))}
            <p className="field-hint">
              The countdown is visual. The server determines whether a
              reservation is valid.
            </p>
          </section>
        </div>
        <aside>
          <section className="panel payment-panel">
            <div className="section-heading">
              <h2>Payment sandbox</h2>
              <FlaskConical size={20} />
            </div>
            <p className="muted">
              A mock gateway for testing the full order lifecycle. No real money
              is charged.
            </p>
            <Countdown
              expiresAt={order.reservations[0]?.expiresAt}
              active={active}
            />
            {active ? (
              <>
                <p className="payment-caption">
                  {pending
                    ? 'A previous request may have completed. Retry it with the same key.'
                    : 'CHOOSE A PAYMENT OUTCOME'}
                </p>
                {pending ? (
                  <button
                    className="button primary full"
                    disabled={busy}
                    onClick={() => pay(pending.outcome)}
                  >
                    <RotateCcw size={16} /> Retry {pending.outcome}
                  </button>
                ) : (
                  <div className="payment-buttons">
                    <button
                      className="button primary full"
                      disabled={busy}
                      onClick={() => pay('success')}
                    >
                      <Check size={17} /> Simulate success
                    </button>
                    <button
                      className="button secondary full"
                      disabled={busy}
                      onClick={() => pay('failure')}
                    >
                      <X size={17} /> Simulate failure
                    </button>
                    <button
                      className="button secondary full"
                      disabled={busy}
                      onClick={() => pay('timeout')}
                    >
                      <Clock3 size={17} /> Simulate timeout
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="payment-result">
                <span>Payment result</span>
                <Status value={order.payment?.status || 'NOT_ATTEMPTED'} />
                {order.payment && (
                  <small>Reference: {order.payment.providerReference}</small>
                )}
              </div>
            )}
            {['RESERVED', 'PAID'].includes(order.status) && (
              <button
                className="cancel-order"
                disabled={busy}
                onClick={() => setCancelModal(true)}
              >
                {order.status === 'PAID'
                  ? 'Cancel & simulate refund'
                  : 'Cancel order'}
              </button>
            )}
          </section>
          <p className="order-id-note">
            Order ID
            <br />
            {order.id}
          </p>
        </aside>
      </div>
      {cancelModal && (
        <Modal
          title="Cancel this order?"
          onClose={() => {
            if (!busy) setCancelModal(false);
          }}
        >
          <p className="muted">
            The order will be cancelled and its inventory restored.
            {order.status === 'PAID' &&
              ' This is a simulated refund; no real payment is involved.'}
          </p>
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setCancelModal(false)}
            >
              Keep order
            </button>
            <button className="button primary" disabled={busy} onClick={cancel}>
              {busy ? 'Cancelling…' : 'Cancel order'}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
