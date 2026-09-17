import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { StoreProvider } from './context';
import { Layout, Protected, Empty } from './components';
import Catalog from './pages/Catalog';
import Product from './pages/Product';
import Auth from './pages/Auth';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Payment from './pages/Payment';
import { Orders, OrderDetail } from './pages/Orders';
import './styles.css';
import './modern.css';
class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="empty">
        <h1>Something went wrong.</h1>
        <p>Please refresh the page to try again.</p>
        <button className="button" onClick={() => window.location.reload()}>
          Refresh
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
const root = import.meta.hot?.data.root ?? ReactDOM.createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Catalog />} />
              <Route path="products/:id" element={<Product />} />
              <Route path="login" element={<Auth />} />
              <Route path="register" element={<Auth register />} />
              <Route element={<Protected />}>
                <Route path="cart" element={<Cart />} />
                <Route path="checkout" element={<Checkout />} />
                <Route path="payment/:checkoutId" element={<Payment />} />
                <Route path="orders" element={<Orders />} />
                <Route path="orders/:id" element={<OrderDetail />} />
              </Route>
              <Route
                path="*"
                element={
                  <Empty
                    title="A little off the beaten path"
                    text="We couldn't find that page. Return to the collection."
                  />
                }
              />
            </Route>
          </Routes>
        </StoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
