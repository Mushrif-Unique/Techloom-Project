import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Minus, Plus, Trash2 } from 'lucide-react';
import { api, money } from '../api';
import { useStore } from '../context';
import { useResource, Loading, ErrorBox, Empty, ProductImage, Summary } from '../components';
export default function Cart() {
  const { data, setData, loading, error, reload } = useResource('/cart');
  const { refreshCart, notify } = useStore();
  const [busy, setBusy] = useState(false);
  async function change(item, quantity) {
    setBusy(true);
    try {
      setData(
        quantity
          ? await api.patch(`/cart/items/${item.id}`, { quantity })
          : await api.delete(`/cart/items/${item.id}`),
      );
      await refreshCart();
    } catch (e) {
      notify(e.message);
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
      <span className="eyebrow">YOUR GOOD FINDS</span>
      <h1>
        Your bag<span className="count-title">{data.itemCount}</span>
      </h1>
      {!data.items.length ? (
        <Empty
          title="Room for something good"
          text="Your bag is empty. Let's find your next everyday favorite."
        />
      ) : (
        <div className="two-column">
          <div>
            {data.items.map((item) => (
              <div className="cart-item" key={item.id}>
                <Link to={`/products/${item.productId}`}>
                  <ProductImage src={item.product.imageUrl} alt={item.product.name} />
                </Link>
                <div className="cart-item-copy">
                  <small>{item.product.category}</small>
                  <Link to={`/products/${item.productId}`}>
                    <h3>{item.product.name}</h3>
                  </Link>
                  <span>{money(item.product.price)} each</span>
                  <div className="quantity">
                    <button
                      disabled={busy || item.quantity <= 1}
                      aria-label={`Decrease ${item.product.name}`}
                      onClick={() => change(item, item.quantity - 1)}
                    >
                      <Minus size={13} />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      disabled={busy || item.quantity >= item.availableQuantity}
                      aria-label={`Increase ${item.product.name}`}
                      onClick={() => change(item, item.quantity + 1)}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {item.quantity > item.availableQuantity && (
                    <small className="warning-text">
                      Stock has changed. Adjust the quantity or resume your reserved checkout.
                    </small>
                  )}
                </div>
                <div className="cart-item-end">
                  <strong>{money(item.lineTotal)}</strong>
                  <button
                    className="icon-button"
                    disabled={busy}
                    aria-label={`Remove ${item.product.name}`}
                    onClick={() => change(item, 0)}
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              </div>
            ))}
            <Link className="back-link" to="/">
              ← Continue exploring
            </Link>
          </div>
          <Summary items={[]} total={data.subtotal}>
            <Link className="button full" to="/checkout">
              Continue to checkout
              <ArrowRight size={17} />
            </Link>
            <p className="muted">Items are reserved once you begin checkout.</p>
          </Summary>
        </div>
      )}
    </div>
  );
}
