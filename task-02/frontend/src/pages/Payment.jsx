import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Clock3, CreditCard, ArrowRight } from 'lucide-react';
import { api, money, date } from '../api';
import { useStore } from '../context';
import { useResource, Loading, ErrorBox, Summary, Badge } from '../components';
const scenarios = [
  { title: 'Success', card: '4242 4242 4242 4242', detail: 'Payment approved' },
  { title: 'Decline', card: '4000 0000 0000 0002', detail: 'Payment declined' },
  { title: 'Timeout', card: '4000 0000 0000 9995', detail: 'Response unknown' },
  {
    title: 'Paid order fails',
    card: '4000 0000 0000 9987',
    detail: 'Successful payment, automatic refund',
  },
];
export default function Payment() {
  const { checkoutId } = useParams();
  const { data: c, setData, error, loading, reload } = useResource(`/checkout/${checkoutId}`);
  const [card, setCard] = useState(scenarios[0].card);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [now, setNow] = useState(Date.now());
  const { refreshCart } = useStore();
  const keyName = `atelier-payment-${checkoutId}`;
  const stored = sessionStorage.getItem(keyName);
  useEffect(() => {
    if (stored) {
      try {
        setCard(
          scenarios.find((s) => s.title === JSON.parse(stored).scenario)?.card || scenarios[0].card,
        );
      } catch {
        /* An invalid saved request can be replaced before submission. */
      }
    }
  }, [checkoutId]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = c ? Math.max(0, Math.ceil((new Date(c.expiresAt).getTime() - now) / 1000)) : 0;
  useEffect(() => {
    if (c && remaining === 0 && ['RESERVED', 'PAYMENT_TIMEOUT'].includes(c.status)) reload();
  }, [remaining, c?.status]);
  async function action(type) {
    setBusy(true);
    setFailure('');
    try {
      let result;
      if (type === 'pay') {
        let request;
        try {
          request = JSON.parse(sessionStorage.getItem(keyName));
        } catch {
          request = null;
        }
        if (!request) {
          request = {
            key: crypto.randomUUID(),
            scenario: scenarios.find((s) => s.card === card).title,
          };
          sessionStorage.setItem(keyName, JSON.stringify(request));
        }
        result = await api.post(
          `/payments/${checkoutId}/pay`,
          { cardNumber: scenarios.find((s) => s.title === request.scenario).card },
          { headers: { 'Idempotency-Key': request.key } },
        );
      } else
        result = await api.post(
          type === 'cancel'
            ? `/checkout/${checkoutId}/cancel`
            : `/payments/${checkoutId}/reconcile`,
          {},
        );
      setData(result);
      await refreshCart();
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
  const complete = c.status === 'COMPLETED';
  const refunded = complete && c.order?.status === 'REFUNDED';
  const payable = c.status === 'RESERVED' && remaining > 0;
  const timeout = c.status === 'PAYMENT_TIMEOUT';
  return (
    <div className="page">
      <div className="steps">
        <span>01 Bag</span>
        <span>02 Review</span>
        <b>03 Payment</b>
      </div>
      <h1>
        {refunded
          ? 'Your payment has been refunded.'
          : complete
            ? 'Good things are on their way.'
            : 'Make it yours.'}
      </h1>
      <div className="two-column">
        <div>
          <div className="panel">
            <div className="panel-heading">
              <h2>
                {refunded
                  ? 'Full refund complete'
                  : complete
                    ? 'Thank you for your order'
                    : 'Payment'}
              </h2>
              <Badge status={refunded ? 'REFUNDED' : c.status} />
            </div>
            {complete ? (
              <div className="payment-result">
                <CheckCircle2 size={48} />
                <p>
                  {refunded
                    ? `Your payment succeeded, but the order was cancelled or could not be fulfilled. The full ${money(c.totalAmount)} has been refunded and the items returned to stock. See your order for the reason. No real money was charged.`
                    : 'Your payment was successful and your order is confirmed.'}
                </p>
                <Link className="button" to={`/orders/${c.order.id}`}>
                  View your order
                  <ArrowRight size={17} />
                </Link>
              </div>
            ) : timeout ? (
              <>
                <div className="notice">
                  <Clock3 />
                  <p>
                    The gateway did not return a result. Your reservation is held while this attempt
                    is unresolved. Checking the result will not charge you again.
                  </p>
                </div>
                <button className="button full" disabled={busy} onClick={() => action('reconcile')}>
                  {busy ? 'Checking…' : 'Check payment result'}
                </button>
                <p className="muted">
                  In this mock scenario, reconciliation confirms no charge and releases the items.
                  This also happens automatically at the reservation deadline.
                </p>
              </>
            ) : payable ? (
              <>
                <p className="muted">SIMULATED PAYMENT · NO REAL CHARGE</p>
                <p>Choose a test scenario to explore the checkout.</p>
                <div className="scenarios">
                  {scenarios.map((s) => (
                    <button
                      key={s.title}
                      disabled={busy || Boolean(stored)}
                      className={card === s.card ? 'active' : ''}
                      onClick={() => setCard(s.card)}
                    >
                      <strong>{s.title}</strong>
                      <small>{s.detail}</small>
                    </button>
                  ))}
                </div>
                <label>
                  Mock card number
                  <div className="card-input">
                    <CreditCard size={19} />
                    <input aria-label="Mock card number" value={card} readOnly />
                  </div>
                </label>
                <p className="muted">
                  No expiry or CVV required. Only these test values are accepted.
                </p>
                <button className="button full" disabled={busy} onClick={() => action('pay')}>
                  {busy ? 'Processing payment…' : `Pay ${money(c.totalAmount)}`}
                  <ArrowRight size={17} />
                </button>
                {stored && (
                  <p className="muted">
                    A submitted request is saved for safe retries. Retry uses the same payment key
                    and scenario.
                  </p>
                )}
                <button
                  className="text-button full"
                  disabled={busy}
                  onClick={() => action('cancel')}
                >
                  Cancel checkout & release items
                </button>
              </>
            ) : (
              <>
                <p>
                  {c.payment?.failureReason ||
                    'This checkout has ended. Your reserved items have been released.'}
                </p>
                <Link className="button" to="/checkout">
                  Start a new checkout
                  <ArrowRight size={17} />
                </Link>
              </>
            )}
            {failure && <ErrorBox message={failure} />}
          </div>
          {!complete && (
            <div className="reservation-note">
              <Clock3 size={18} />
              <div>
                <strong>
                  {remaining && (payable || timeout)
                    ? `Reservation: ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')} remaining`
                    : 'Reservation ended'}
                </strong>
                <small>Deadline: {date(c.expiresAt)}</small>
              </div>
            </div>
          )}
        </div>
        <Summary items={c.items} total={c.totalAmount} />
      </div>
    </div>
  );
}
