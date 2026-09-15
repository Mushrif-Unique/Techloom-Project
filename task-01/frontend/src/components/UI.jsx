import {
  Laptop,
  Mouse,
  Keyboard,
  Monitor,
  Headphones,
  Cable,
  Package,
  X,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { money, shortId, dateTime } from '../utils/format.js';
export function Status({ value }) {
  return (
    <span className={`status status-${value?.toLowerCase()}`}>
      <i />
      {value?.replaceAll('_', ' ')}
    </span>
  );
}
export function ProductArt({ name = '', small = false }) {
  const lower = name.toLowerCase();
  const index = [
    'laptop',
    'mouse',
    'keyboard',
    'monitor',
    'headphone',
    'dock',
  ].findIndex((word) => lower.includes(word));
  const Icon =
    [Laptop, Mouse, Keyboard, Monitor, Headphones, Cable][index] || Package;
  return (
    <div
      className={`product-art art-${index < 0 ? 0 : index} ${small ? 'small' : ''}`}
    >
      <div className="art-ring" />
      <Icon strokeWidth={1.05} />
      {!small && <span className="art-caption">THE WORKSPACE COLLECTION</span>}
    </div>
  );
}
export function Empty({ title, children }) {
  return (
    <div className="empty">
      <Package size={34} strokeWidth={1.2} />
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}
export function Loading() {
  return (
    <div className="loading" role="status">
      <RefreshCw className="spin" size={20} /> Loading your workspace…
    </div>
  );
}
export function ErrorBox({ message, retry }) {
  return (
    message && (
      <div className="error-box" role="alert">
        <span>{message}</span>
        {retry && <button onClick={retry}>Try again</button>}
      </div>
    )
  );
}
export function Modal({ title, onClose, children }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
      >
        <div className="section-heading">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="Close dialog"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function OrdersTable({ orders }) {
  if (!orders?.length)
    return (
      <Empty title="Your first order starts here">
        Add a product to the cart, then reserve it at checkout.
      </Empty>
    );
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Items</th>
            <th>Date & time</th>
            <th>Amount</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>
                <Link className="order-link" to={`/orders/${order.id}`}>
                  #{shortId(order.id)}
                </Link>
              </td>
              <td>
                {order.items.reduce((n, item) => n + item.quantity, 0)} items
              </td>
              <td>{dateTime(order.createdAt)}</td>
              <td className="amount">{money(order.totalAmount)}</td>
              <td>
                <Status value={order.status} />
              </td>
              <td>
                <Link
                  className="table-arrow"
                  aria-label={`Open order ${shortId(order.id)}`}
                  to={`/orders/${order.id}`}
                >
                  <ArrowUpRight size={18} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
