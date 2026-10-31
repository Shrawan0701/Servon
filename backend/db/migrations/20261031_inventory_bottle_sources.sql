-- Apply before deploying the bottle-size linking update. Safe to repeat.
-- Existing recipes remain additive. Explicit bottle links are alternatives.
ALTER TABLE menu_item_ingredients
  ADD COLUMN IF NOT EXISTS is_stock_source BOOLEAN NOT NULL DEFAULT false;
