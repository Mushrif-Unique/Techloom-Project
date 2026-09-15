import { useState } from 'react';
import { ReceiptText, ArrowLeft, ArrowRight } from 'lucide-react';
import { useResource } from '../hooks/useResource.js';
import { OrdersTable, ErrorBox, Loading } from '../components/UI.jsx';
export function Orders() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('ALL');
  const { data, loading, error, reload } = useResource(
    `/orders?page=${page}&limit=20`,
  );
  const orders = data?.orders.filter(
    (order) => filter === 'ALL' || order.status === filter,
  );
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">EVERY TRANSACTION TELLS A STORY</div>
          <h1>
            Order history<span>.</span>
          </h1>
          <p>From reservation to receipt. All your orders, accounted for.</p>
        </div>
        <span className="page-mark">
          <ReceiptText size={24} />
        </span>
      </div>
      <div className="catalog-toolbar">
        <div className="tabs order-tabs">
          {['ALL', 'RESERVED', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED'].map(
            (value) => (
              <button
                className={filter === value ? 'selected' : ''}
                onClick={() => setFilter(value)}
                key={value}
              >
                {value === 'ALL'
                  ? 'All orders'
                  : value[0] + value.slice(1).toLowerCase()}
              </button>
            ),
          )}
        </div>
      </div>
      <ErrorBox message={error} retry={reload} />
      <section className="panel">
        {loading ? <Loading /> : <OrdersTable orders={orders} />}
        <div className="pagination">
          <span>{data?.total ?? 0} orders · filters apply to this page</span>
          <div>
            <button
              className="icon-button"
              aria-label="Previous page"
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              <ArrowLeft size={16} />
            </button>
            <span>Page {page}</span>
            <button
              className="icon-button"
              aria-label="Next page"
              disabled={!data || page * data.limit >= data.total}
              onClick={() => setPage(page + 1)}
            >
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      </section>
    </>
  );
}
