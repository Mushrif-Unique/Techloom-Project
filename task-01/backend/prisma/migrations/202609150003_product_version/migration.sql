ALTER TABLE "Product" ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Product" ADD CONSTRAINT "Product_version_nonnegative" CHECK (version >= 0);
