import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock3, ShieldCheck, ArrowRight } from 'lucide-react';
import { api } from '../api';
import { useStore } from '../context';
import { useResource, Loading, ErrorBox, Empty, Summary } from '../components';
export default function Checkout() {
  const { data, loading, error, reload } = useResource('/cart');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const { user } = useStore();
  const navigate = useNavigate();
  async function begin() {
    setBusy(true);
    setFailure('');
    let key = sessionStorage.getItem('atelier-checkout-key');
    if (!key) {
      key = crypto.randomUUID();
      sessionStorage.setItem('atelier-checkout-key', key);
    }
    try {
      const c = await api.post('/checkout', {}, { headers: { 'Idempotency-Key': key } });
      sessionStorage.removeItem('atelier-checkout-key');
      navigate(`/payment/${c.id}`);
    } catch (e) {
      setFailure(e.message);
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
  if (!data.items.length)
    return <Empty title="Your bag is empty" text="Add your favorites before checking out." />;
  return (
    <div className="page">
      <div className="steps">
        <span>01 Bag</span>
        <b>02 Review</b>
        <span>03 Payment</span>
      </div>
      <h1>One step closer.</h1>
      <p className="page-intro">A few good things, ready for your everyday.</p>
      <div className="two-column">
        <div className="checkout-copy">
          <div className="panel">
            <span className="eyebrow">YOUR DETAILS</span>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
            <p className="muted">
              This is a demo store. Delivery is simulated; no address is needed.
            </p>
          </div>
          <div className="info-row">
            <Clock3 />
            <div>
              <h3>A little time to make it yours</h3>
              <p>
                Continue to reserve your items. Your payment page shows the exact reservation
                deadline. If it expires, your items return to the collection.
              </p>
            </div>
          </div>
          <div className="info-row">
            <ShieldCheck />
            <div>
              <h3>Try every payment outcome</h3>
              <p>
                Try success, decline, timeout, or an order that fails after successful payment and
                receives an automatic full refund. No money changes hands.
              </p>
            </div>
          </div>
          <Link className="back-link" to="/cart">
            ← Back to your bag
          </Link>
        </div>
        <Summary items={data.items} total={data.subtotal}>
          {failure && <ErrorBox message={failure} />}
          <button className="button full" onClick={begin} disabled={busy}>
            {busy ? 'Reserving your items…' : 'Reserve & continue'}
            <ArrowRight size={17} />
          </button>
        </Summary>
      </div>
    </div>
  );
}
