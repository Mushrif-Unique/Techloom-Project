import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, ShieldCheck, Package } from 'lucide-react';
import { api, money } from '../api';
import { useStore } from '../context';
import { useResource, Loading, ErrorBox, ProductImage } from '../components';
export default function Product() {
  const { id } = useParams();
  const { data: p, error, loading, reload } = useResource(`/products/${id}`);
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const { user, refreshCart, notify } = useStore();
  const navigate = useNavigate();
  async function add() {
    if (!user) return navigate('/login', { state: { from: `/products/${id}` } });
    setBusy(true);
    try {
      await api.post('/cart/items', { productId: id, quantity });
      await refreshCart();
      notify('Added to your bag.');
    } catch (e) {
      notify(e.message);
      reload();
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
      <Link className="back-link" to="/">
        <ArrowLeft size={16} />
        Back to the collection
      </Link>
      <div className="product-detail">
        <div className="detail-photo">
          <ProductImage src={p.imageUrl} alt={p.name} />
        </div>
        <div className="detail-copy">
          <span className="eyebrow">{p.category} / THE EVERYDAY EDIT</span>
          <h1>{p.name}</h1>
          <p className="detail-price">{money(p.price)}</p>
          <p className="description">{p.description}</p>
          <div className="stock">
            <i className={!p.availableQuantity ? 'out' : ''} />
            {p.availableQuantity
              ? `${p.availableQuantity} available · Ready for your everyday`
              : 'Out of stock · Good things return'}
          </div>
          <div className="purchase-row">
            <label>
              Quantity
              <input
                aria-label="Quantity"
                type="number"
                min="1"
                max={Math.min(99, p.availableQuantity)}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </label>
            <button
              className="button"
              disabled={
                busy ||
                quantity < 1 ||
                !Number.isInteger(quantity) ||
                quantity > p.availableQuantity
              }
              onClick={add}
            >
              <ShoppingBag size={18} />
              {busy ? 'Adding…' : 'Add to bag'}
            </button>
          </div>
          <div className="detail-promises">
            <p>
              <Package size={18} />
              Complimentary delivery on every order
            </p>
            <p>
              <ShieldCheck size={18} />
              Easy cancellations and full simulated refunds
            </p>
          </div>
          <p className="muted">
            A thoughtfully selected essential. Stock is reserved for 10 minutes when you begin
            checkout.
          </p>
        </div>
      </div>
    </div>
  );
}
