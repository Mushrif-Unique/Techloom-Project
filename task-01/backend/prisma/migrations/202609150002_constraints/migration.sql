ALTER TABLE "Product" ADD CONSTRAINT "Product_stock_nonnegative" CHECK (stock >= 0),
  ADD CONSTRAINT "Product_price_nonnegative" CHECK (price >= 0),
  ADD CONSTRAINT "Product_name_not_empty" CHECK (length(trim(name)) > 0);
ALTER TABLE "CartItem" ADD CONSTRAINT "CartItem_quantity_positive" CHECK (quantity > 0 AND quantity <= 1000);
ALTER TABLE "Order" ADD CONSTRAINT "Order_total_nonnegative" CHECK ("totalAmount" >= 0);
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_quantity_positive" CHECK (quantity > 0),
  ADD CONSTRAINT "OrderItem_price_nonnegative" CHECK ("unitPrice" >= 0),
  ADD CONSTRAINT "OrderItem_subtotal_correct" CHECK (subtotal::bigint = "unitPrice"::bigint * quantity);
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_quantity_positive" CHECK (quantity > 0),
  ADD CONSTRAINT "Reservation_five_minutes" CHECK ("expiresAt" = "createdAt" + interval '5 minutes');
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_outcome_valid" CHECK (outcome IN ('success', 'failure', 'timeout'));
