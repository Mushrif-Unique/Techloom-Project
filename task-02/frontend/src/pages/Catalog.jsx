import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Search, SlidersHorizontal, Plus } from 'lucide-react';
import { api, money } from '../api';
import { isCatalog } from '../api-response';
import { useStore } from '../context';
import { useResource, Loading, ErrorBox, Empty, ProductImage, Benefits } from '../components';
export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, notify, refreshCart } = useStore();
  const [search, setSearch] = useState(params.get('search') || '');
  const [adding, setAdding] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const { data, loading, error, reload } = useResource(`/products?${params}`);
  function filter(key, value) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setParams(next);
  }
  async function add(product) {
    if (!user) return navigate('/login', { state: { from: '/' } });
    setAdding(product.id);
    try {
      await api.post('/cart/items', { productId: product.id, quantity: 1 });
      await refreshCart();
      notify(`${product.name} added to your bag.`);
    } catch (e) {
      notify(e.message);
    } finally {
      setAdding(null);
    }
  }
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="edit-dot" /> THE EVERYDAY EDIT — VOL. 01
          </span>
          <h1>
            Good things.
            <br />
            <em>Better days.</em>
          </h1>
          <p>
            A fresh perspective on your everyday essentials.
            <br />
            Thoughtful objects. Great design. All in one place.
          </p>
          <a href="#collection" className="button">
            Shop the collection
            <ArrowRight size={17} />
          </a>
          <div className="hero-note">
            <span className="tiny-line" /> CURATED WITH INTENTION. MADE FOR LIVING.
          </div>
        </div>
        <div className="hero-art">
          <img
            src="/images/hero.svg"
            alt="A sculptural lamp, ceramic vase and books on a warm sunlit shelf"
          />
          <Link to="/?category=Home#collection" className="hero-caption">
            <span>
              <small>SPACES THAT FEEL LIKE YOU</small>Find your softer side.
            </span>
            <ArrowUpRight size={22} />
          </Link>
          <span className="edition">THE HOME EDIT ↗</span>
        </div>
      </section>
      <Benefits />
      <section id="collection" className="collection">
        <div className="section-heading">
          <div>
            <span className="eyebrow">A LITTLE SOMETHING FOR EVERY DAY</span>
            <h2>
              Discover your next favorite<span>.</span>
            </h2>
          </div>
          <p>Made for your day. Here to stay.</p>
        </div>
        <div className="catalog-toolbar">
          <div className="tabs">
            {['All', 'Electronics', 'Home', 'Clothing', 'Accessories', 'Sports'].map((c) => (
              <button
                key={c}
                className={(params.get('category') || 'All') === c ? 'selected' : ''}
                aria-pressed={(params.get('category') || 'All') === c}
                onClick={() => filter('category', c === 'All' ? '' : c)}
              >
                {c}
              </button>
            ))}
          </div>
          <button
            className={`filter-toggle ${showFilters ? 'selected' : ''}`}
            aria-expanded={showFilters}
            aria-controls="catalog-filters"
            onClick={() => setShowFilters(!showFilters)}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>
        <div className="search-row">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              filter('search', search);
            }}
          >
            <Search size={18} />
            <input
              aria-label="Search products"
              placeholder="Find something good…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button type="submit">Search</button>
          </form>
          <label className="sort-label">
            Sort by{' '}
            <select
              aria-label="Sort products"
              value={params.get('sort') || 'featured'}
              onChange={(e) => filter('sort', e.target.value)}
            >
              <option value="featured">Featured</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        {showFilters && (
          <div className="filter-panel" id="catalog-filters">
            <label>
              Minimum price
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="$0"
                value={params.get('minPrice') || ''}
                onChange={(e) => filter('minPrice', e.target.value)}
              />
            </label>
            <label>
              Maximum price
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Any price"
                value={params.get('maxPrice') || ''}
                onChange={(e) => filter('maxPrice', e.target.value)}
              />
            </label>
            <label>
              Availability
              <select
                value={params.get('available') || ''}
                onChange={(e) => filter('available', e.target.value)}
              >
                <option value="">All products</option>
                <option value="true">In stock</option>
                <option value="false">Out of stock</option>
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                setSearch('');
                setParams({});
              }}
            >
              Clear all filters
            </button>
          </div>
        )}
        {params.size > 0 && (
          <div className="active-filters">
            <span>Filtered collection</span>
            <button
              onClick={() => {
                setSearch('');
                setParams({});
              }}
            >
              Clear filters ×
            </button>
          </div>
        )}
        {loading ? (
          <Loading />
        ) : error || !isCatalog(data) ? (
          <ErrorBox
            message={error || 'The store returned an invalid product list. Please try again.'}
            retry={reload}
          />
        ) : (
          <>
            <div className="results-label">{data.total} considered essentials</div>
            {data.items.length ? (
              <div className="product-grid">
                {data.items.map((p, index) => (
                  <article className="product-card" key={p.id}>
                    <Link className={`product-photo tone-${index % 4}`} to={`/products/${p.id}`}>
                      <ProductImage src={p.imageUrl} alt={p.name} />
                      {p.availableQuantity === 0 ? (
                        <span className="product-tag">Back soon</span>
                      ) : (
                        index === 0 && <span className="product-tag">Everyday favorite</span>
                      )}
                      <span className="photo-arrow">
                        <ArrowUpRight size={18} />
                      </span>
                    </Link>
                    <div className="product-meta">
                      <span>{p.category}</span>
                      <span>{money(p.price)}</span>
                    </div>
                    <div className="product-bottom">
                      <Link to={`/products/${p.id}`}>
                        <h3>{p.name}</h3>
                      </Link>
                      <button
                        className="add-button"
                        aria-label={`Add ${p.name} to bag`}
                        disabled={!p.availableQuantity || adding === p.id}
                        onClick={() => add(p)}
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <Empty
                title="Nothing here just yet"
                text="Try another search or adjust your filters."
              />
            )}
            {data.pages > 1 && (
              <div className="pagination">
                <button
                  disabled={data.page === 1}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', data.page - 1);
                    setParams(next);
                  }}
                >
                  Previous
                </button>
                <span>
                  Page {data.page} of {data.pages}
                </span>
                <button
                  disabled={data.page === data.pages}
                  onClick={() => {
                    const next = new URLSearchParams(params);
                    next.set('page', data.page + 1);
                    setParams(next);
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
        <div className="collection-note">
          <LeafMark />
          <h3>
            Not more things.
            <br />
            <em>More meaning.</em>
          </h3>
          <p>
            We believe the things you surround yourself with should earn their place.
            <br />
            Useful, beautiful, and made for the everyday.
          </p>
        </div>
      </section>
    </>
  );
}
function LeafMark() {
  return <span className="leaf-mark">a.</span>;
}
