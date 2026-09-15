import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { StoreProvider } from './context/Store.jsx';
import { Shell } from './layouts/Shell.jsx';
import { Dashboard } from './pages/Dashboard.jsx';
import { Products } from './pages/Products.jsx';
import { Cart } from './pages/Cart.jsx';
import { Orders } from './pages/Orders.jsx';
import { OrderDetail } from './pages/OrderDetail.jsx';
import './styles.css';
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <Routes>
          <Route element={<Shell />}>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<Products />} />
            <Route path="cart" element={<Cart />} />
            <Route path="orders" element={<Orders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route
              path="*"
              element={
                <div className="empty">
                  <h1>Page not found.</h1>
                  <Link to="/">Back to overview</Link>
                </div>
              }
            />
          </Route>
        </Routes>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
