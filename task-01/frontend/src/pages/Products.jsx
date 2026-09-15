import { useMemo, useState } from 'react';
import {
  Search,
  Plus,
  SlidersHorizontal,
  Pencil,
  ShoppingBag,
  Archive,
  Check,
} from 'lucide-react';
import { useResource } from '../hooks/useResource.js';
import { useStore } from '../context/Store.jsx';
import { api } from '../services/api.js';
import { currency, money, minorUnits } from '../utils/format.js';
import {
  ProductArt,
  Modal,
  Empty,
  Loading,
  ErrorBox,
} from '../components/UI.jsx';
function ProductEditor({ product, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    description: product?.description ?? '',
    price: ((product?.price ?? 0) / 100).toFixed(2),
    stock: product?.stock ?? 0,
    isActive: product?.isActive ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const update = (e) =>
    setForm({
      ...form,
      [e.target.name]:
        e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    });
  async function save(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(product ? `/products/${product.id}` : '/products', {
        method: product ? 'PATCH' : 'POST',
        body: {
          ...form,
          price: minorUnits(form.price),
          stock: Number(form.stock),
          ...(product ? { expectedVersion: product.version } : {}),
        },
      });
      onSaved();
    } catch (error) {
      setError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={product ? 'Edit product' : 'Add a product'}
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form onSubmit={save}>
        <ErrorBox message={error} />
        <label>
          Product name
          <input
            autoFocus
            required
            maxLength={120}
            name="name"
            value={form.name}
            onChange={update}
            placeholder="e.g. Wireless Mouse"
          />
        </label>
        <label>
          Description
          <textarea
            name="description"
            maxLength={1000}
            value={form.description}
            onChange={update}
            rows={3}
            placeholder="What makes this product great?"
          />
        </label>
        <div className="form-row">
          <label>
            Price ({currency})
            <input
              required
              type="number"
              min="0"
              max="1000000"
              step="0.01"
              name="price"
              value={form.price}
              onChange={update}
            />
          </label>
          <label>
            Available stock
            <input
              required
              type="number"
              min="0"
              max="1000000"
              step="1"
              name="stock"
              value={form.stock}
              onChange={update}
            />
          </label>
        </div>
        <p className="field-hint">
          Stock is the number of units available now. Reserved units are held
          separately.
        </p>
        <label className="checkbox-label">
          <input
            type="checkbox"
            name="isActive"
            checked={form.isActive}
            onChange={update}
          />{' '}
          Active in catalog
        </label>
        <div className="modal-actions">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={onClose}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save product'}
            <Check size={16} />
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function Products() {
  const { data, error, loading, reload } = useResource('/products');
  const { ensureCart, setCartCount, touchCart, notify } = useStore();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [editor, setEditor] = useState(null);
  const [busy, setBusy] = useState('');
  const products = useMemo(
    () =>
      (data ?? []).filter(
        (p) =>
          p.name.toLowerCase().includes(query.toLowerCase()) &&
          (filter === 'archived'
            ? !p.isActive
            : p.isActive && (filter !== 'low' || p.stock <= 5)),
      ),
    [data, query, filter],
  );
  async function add(product) {
    setBusy(product.id);
    try {
      const cartId = await ensureCart();
      const cart = await api(`/carts/${cartId}/items`, {
        method: 'POST',
        body: { productId: product.id, quantity: 1 },
      });
      setCartCount(cart.items.reduce((n, item) => n + item.quantity, 0));
      touchCart();
      notify(`${product.name} added to cart.`);
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy('');
    }
  }
  async function archive(product) {
    setBusy(product.id);
    try {
      await api(`/products/${product.id}`, { method: 'DELETE' });
      notify('Product archived. Order history is preserved.');
      await reload();
    } catch (error) {
      notify(error.message, 'error');
    } finally {
      setBusy('');
    }
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CURATED FOR YOUR COUNTER</div>
          <h1>
            Product catalog<span>.</span>
          </h1>
          <p>Good products, organized. Find your next sale here.</p>
        </div>
        <button className="button primary" onClick={() => setEditor({})}>
          <Plus size={18} /> Add product
        </button>
      </div>
      <div className="catalog-toolbar">
        <div className="tabs">
          {[
            ['all', 'All products'],
            ['low', 'Low stock'],
            ['archived', 'Archived'],
          ].map(([key, label]) => (
            <button
              key={key}
              className={filter === key ? 'selected' : ''}
              onClick={() => setFilter(key)}
            >
              {label}
              {key === 'all' && (
                <span>{data?.filter((p) => p.isActive).length ?? 0}</span>
              )}
            </button>
          ))}
        </div>
        <div className="search-input">
          <Search size={18} />
          <input
            aria-label="Search products"
            placeholder="Search products…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <ErrorBox message={error} retry={reload} />
      <div className="catalog-meta">
        <span>{products.length} products in this view</span>
        <span>
          <SlidersHorizontal size={14} /> Stock updates automatically
        </span>
      </div>
      {loading ? (
        <Loading />
      ) : products.length ? (
        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.id}>
              <div className="product-visual">
                <ProductArt name={product.name} />
                {product.stock <= 5 && product.isActive && (
                  <span
                    className={`stock-flag ${product.stock === 0 ? 'out' : ''}`}
                  >
                    {product.stock === 0 ? 'Out of stock' : 'Low stock'}
                  </span>
                )}
                <button
                  className="edit-product"
                  aria-label={`Edit ${product.name}`}
                  onClick={() => setEditor(product)}
                >
                  <Pencil size={15} />
                </button>
              </div>
              <div className="product-info">
                <div className="product-category">TECH & ACCESSORIES</div>
                <h2>{product.name}</h2>
                <p>
                  {product.description || 'A great addition to your workspace.'}
                </p>
                <div className="product-price">
                  <strong>{money(product.price)}</strong>
                  <span>
                    <i
                      className={product.stock > 0 ? 'green-dot' : 'gray-dot'}
                    />
                    {product.isActive
                      ? `${product.stock} available`
                      : 'Archived'}
                  </span>
                </div>
                <div className="product-actions">
                  <button
                    className="button add-button"
                    disabled={
                      !!busy || !product.isActive || product.stock === 0
                    }
                    onClick={() => add(product)}
                  >
                    <Plus size={16} />
                    {busy === product.id ? 'Working…' : 'Add to cart'}
                    <ShoppingBag size={16} />
                  </button>
                  {product.isActive && (
                    <button
                      className="icon-button archive-button"
                      disabled={!!busy}
                      aria-label={`Archive ${product.name}`}
                      onClick={() => archive(product)}
                    >
                      <Archive size={17} />
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="No products found">
          Try a different search or add a product to your catalog.
        </Empty>
      )}
      {editor && (
        <ProductEditor
          product={editor.id ? editor : null}
          onClose={() => setEditor(null)}
          onSaved={() => {
            setEditor(null);
            reload();
            notify('Product saved.');
          }}
        />
      )}
    </>
  );
}
