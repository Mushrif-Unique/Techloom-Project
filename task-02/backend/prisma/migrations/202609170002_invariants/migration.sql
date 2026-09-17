ALTER TABLE "Product" ADD CONSTRAINT "product_stock_valid" CHECK ("stockQuantity" >= 0 AND "reservedQuantity" >= 0 AND "reservedQuantity" <= "stockQuantity"), ADD CONSTRAINT "product_price_positive" CHECK (price > 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "cart_quantity_valid" CHECK (quantity BETWEEN 1 AND 99);
ALTER TABLE "StockReservation" ADD CONSTRAINT "reservation_quantity_valid" CHECK (quantity > 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "order_item_valid" CHECK (quantity > 0 AND "unitPrice" > 0 AND "lineTotal" = "unitPrice" * quantity);
ALTER TABLE "CheckoutSession" ADD CONSTRAINT "checkout_amount_positive" CHECK ("totalAmount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "payment_amount_positive" CHECK (amount > 0);
ALTER TABLE "Order" ADD CONSTRAINT "order_amount_positive" CHECK ("totalAmount" > 0);
ALTER TABLE "Refund" ADD CONSTRAINT "refund_amount_positive" CHECK (amount > 0);
CREATE UNIQUE INDEX "one_active_checkout_per_user" ON "CheckoutSession" ("userId") WHERE status IN ('RESERVED', 'PAYMENT_PROCESSING', 'PAYMENT_TIMEOUT');
