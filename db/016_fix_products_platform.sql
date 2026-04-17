-- Migration: 016_fix_products_platform
-- Make products.platform nullable — supports products from non-catalogued affiliate
-- platforms (e.g. direct merchants, Shopify stores) where the user doesn't know
-- or doesn't want to specify a platform.
-- The Drizzle v2 schema already models it as nullable; this aligns the DB constraint.
ALTER TABLE products ALTER COLUMN platform DROP NOT NULL;
