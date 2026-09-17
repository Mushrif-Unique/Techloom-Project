import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowUpRight, ArrowLeft, Check } from 'lucide-react';
import { api, money, date } from '../api';
import { useStore } from '../context';
import { useResource, Loading, ErrorBox, Empty, Badge, ProductImage, Summary } from '../components';
export function Orders() {
  const { data, error, loading, reload } = useResource('/orders');
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="page">
        <ErrorBox message={error} retry={reload} />
      </div>
    );
  return (
    <div className="page">
      <span className="eyebrow">YOUR ATELIER COLLECTION</span>
      <h1>My orders.</h1>
      <p className="page-intro">Good choices, all in one place.</p>
      {!data.length ? (
        <Empty
          title="Your story starts here"
          text="When you find something you love, your orders will appear here."
        />
      ) : (
        <div className="order-list">
          {data.map((o) => (
            <Link className="order-card" key={o.id} to={`/orders/${o.id}`}>
              <div className="order-card-top">
                <div>
                  <span className="eyebrow">ORDER #{o.id.slice(0, 8).toUpperCase()}</span>
                  <p>{date(o.createdAt)}</p>
                </div>
                <Badge status={o.status} />
              </div>
              <div className="order-card-bottom">
                <div className="order-thumbs">
                  {o.items.slice(0, 3).map((i) => (
                    <ProductImage key={i.id} src={i.imageUrl} alt={i.productName} />
                  ))}
                </div>
                <div className="order-items-label">
                  <strong>{o.items.map((i) => i.productName).join(', ')}</strong>
                  <small>{o.items.reduce((n, i) => n + i.quantity, 0)} items</small>
                </div>
                <strong>{money(o.totalAmount)}</strong>
                <ArrowUpRight size={22} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
export function OrderDetail() {
  const { id } = useParams();
  const { data: o, setData, error, loading, reload } = useResource(`/orders/${id}`);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const { notify } = useStore();
  async function cancel(e) {
    e.preventDefault();
    setBusy(true);
    setFailure('');
    try {
      setData(
        await api.post(`/orders/${id}/cancel`, { reason: new FormData(e.target).get('reason') }),
      );
      setConfirming(false);
      notify('Order cancelled. Your full refund is complete.');
    } catch (err) {
      setFailure(err.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <Loading />;
  if (error)
    return (
      <div className="page">
        <ErrorBox message={error} retry={reload} />
      </div>
    );
  return (
    <div className="page">
      <Link className="back-link" to="/orders">
        <ArrowLeft size={16} />
        All orders
      </Link>
      <div className="order-title">
        <div>
          <span className="eyebrow">PLACED {date(o.createdAt)}</span>
          <h1>Order #{o.id.slice(0, 8).toUpperCase()}</h1>
        </div>
        <Badge status={o.status} />
      </div>
      <div className="two-column">
        <div>
          <section className="panel">
            <h2>Your order's journey</h2>
            <ol className="timeline">
              <li>
                <span className="timeline-dot">
                  <Check size={13} />
                </span>
                <div>
                  <strong>Checkout started · stock reserved</strong>
                  <small>{date(o.checkout.createdAt)}</small>
                </div>
              </li>
              <li>
                <span className="timeline-dot">
                  <Check size={13} />
                </span>
                <div>
                  <strong>Payment successful</strong>
                  <small>{date(o.checkout.payment.createdAt)}</small>
                </div>
              </li>
              {o.history.map((h) => (
                <li key={h.id}>
                  <span className="timeline-dot">
                    <Check size={13} />
                  </span>
                  <div>
                    <strong>{h.note}</strong>
                    <small>{date(h.createdAt)}</small>
                  </div>
                </li>
              ))}
            </ol>
          </section>
          <section className="panel payment-info">
            <h2>Payment details</h2>
            <div className="summary-line">
              <span>Mock payment</span>
              <Badge status={o.checkout.payment.status} />
            </div>
            <p className="muted break">Reference: {o.checkout.payment.transactionReference}</p>
            {o.refund && (
              <div className="refund-box">
                <strong>Full refund · {money(o.refund.amount)}</strong>
                <p>{o.refund.reason}</p>
                <small>Completed {date(o.refund.processedAt)}</small>
              </div>
            )}
          </section>
          {o.status === 'CONFIRMED' && (
            <section className="panel">
              <h2>Changed your mind?</h2>
              <p>Cancel this order for a full simulated refund. Your items will return to stock.</p>
              {confirming ? (
                <form onSubmit={cancel}>
                  <label>
                    Reason for cancellation
                    <textarea
                      name="reason"
                      required
                      minLength="3"
                      maxLength="300"
                      defaultValue="I changed my mind."
                    />
                  </label>
                  <div className="actions">
                    <button className="button" disabled={busy}>
                      {busy ? 'Processing refund…' : 'Confirm cancellation'}
                    </button>
                    <button
                      type="button"
                      className="text-button"
                      disabled={busy}
                      onClick={() => setConfirming(false)}
                    >
                      Keep order
                    </button>
                  </div>
                </form>
              ) : (
                <button className="text-button" onClick={() => setConfirming(true)}>
                  Cancel order
                </button>
              )}
              {failure && <ErrorBox message={failure} />}
            </section>
          )}
        </div>
        <Summary items={o.items} total={o.totalAmount} />
      </div>
    </div>
  );
}
