-- Manual SQL-client alternative to npm run migrate:inventory.
-- Run the WHOLE file on the intended Railway PostgreSQL database.
-- Pause order/inventory writes while switching backend versions.
BEGIN;
SET LOCAL lock_timeout = '15s';
SELECT pg_advisory_xact_lock(hashtext('servon_inventory_migrations'));
CREATE TABLE IF NOT EXISTS inventory_schema_versions (
  version TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
DO $inventory_upgrade$
DECLARE
  stock_id_type TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM inventory_schema_versions WHERE version = '20261028_inventory_upgrade') THEN
    RAISE NOTICE 'Inventory migration already applied; nothing changed.';
    RETURN;
  END IF;

  IF to_regclass('businesses') IS NULL OR to_regclass('menu_items') IS NULL OR to_regclass('orders') IS NULL THEN
    RAISE EXCEPTION 'Required businesses, menu_items or orders table is missing. Check the selected database/schema.';
  END IF;

  SELECT data_type INTO stock_id_type FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'inventory_items' AND column_name = 'id';
  IF stock_id_type IS NOT NULL AND stock_id_type <> 'integer' THEN
    RAISE EXCEPTION 'Existing inventory_items.id must be integer. Review the deployed schema before migrating.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name IN ('inventory_items','menu_item_ingredients','inventory_stock_logs')
      AND column_name IN ('current_stock','low_stock_threshold','quantity_required','change_amount')
      AND numeric_scale > 6
  ) THEN
    RAISE EXCEPTION 'An existing inventory quantity has more than six decimal places. Review precision before migrating.';
  END IF;

  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Additive upgrade. Apply explicitly; never run at server startup.
-- Existing installations use integer stock IDs and UUID business/menu/order IDs.
CREATE TABLE IF NOT EXISTS inventory_items (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  name VARCHAR(255) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  current_stock NUMERIC(18,6) NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC(18,6) NOT NULL DEFAULT 0,
  bottle_size NUMERIC(12,3),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS bottle_size NUMERIC(12,3);
ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE inventory_items ALTER COLUMN current_stock TYPE NUMERIC(18,6);
ALTER TABLE inventory_items ALTER COLUMN low_stock_threshold TYPE NUMERIC(18,6);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_items_tenant_id ON inventory_items(business_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_menu_tenant_id ON menu_items(business_id,id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_order_tenant_id ON orders(business_id,id);

CREATE TABLE IF NOT EXISTS menu_item_ingredients (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  quantity_required NUMERIC(18,6) NOT NULL CHECK (quantity_required > 0),
  UNIQUE(menu_item_id,inventory_item_id)
);
CREATE INDEX IF NOT EXISTS inventory_recipe_tenant ON menu_item_ingredients(business_id,menu_item_id);
ALTER TABLE menu_item_ingredients ALTER COLUMN quantity_required TYPE NUMERIC(18,6);

CREATE TABLE IF NOT EXISTS inventory_preparations (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  name VARCHAR(255) NOT NULL,
  yield_quantity NUMERIC(18,6) NOT NULL CHECK (yield_quantity > 0),
  yield_unit VARCHAR(20) NOT NULL CHECK (yield_unit IN ('kg','gm','litre','ml','pcs')),
  wastage_percent NUMERIC(6,3) NOT NULL DEFAULT 0 CHECK (wastage_percent >= 0 AND wastage_percent < 100),
  version INTEGER NOT NULL DEFAULT 1,
  archived BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_prep_name ON inventory_preparations(business_id,lower(name)) WHERE NOT archived;
CREATE TABLE IF NOT EXISTS inventory_preparation_components (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL,
  preparation_id INTEGER NOT NULL,
  inventory_item_id INTEGER,
  component_preparation_id INTEGER,
  quantity_required NUMERIC(18,6) NOT NULL CHECK (quantity_required > 0),
  CHECK ((inventory_item_id IS NOT NULL)::int + (component_preparation_id IS NOT NULL)::int = 1),
  CHECK (preparation_id <> component_preparation_id),
  FOREIGN KEY(business_id,preparation_id) REFERENCES inventory_preparations(business_id,id),
  FOREIGN KEY(business_id,component_preparation_id) REFERENCES inventory_preparations(business_id,id),
  FOREIGN KEY(business_id,inventory_item_id) REFERENCES inventory_items(business_id,id)
);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_prep_stock_component ON inventory_preparation_components(preparation_id,inventory_item_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_prep_prep_component ON inventory_preparation_components(preparation_id,component_preparation_id);
CREATE TABLE IF NOT EXISTS menu_item_preparations (
  business_id UUID NOT NULL,
  menu_item_id UUID NOT NULL,
  preparation_id INTEGER NOT NULL,
  quantity_required NUMERIC(18,6) NOT NULL CHECK(quantity_required > 0),
  PRIMARY KEY(menu_item_id,preparation_id),
  FOREIGN KEY(business_id,menu_item_id) REFERENCES menu_items(business_id,id) ON DELETE CASCADE,
  FOREIGN KEY(business_id,preparation_id) REFERENCES inventory_preparations(business_id,id)
);

CREATE TABLE IF NOT EXISTS inventory_scans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id),
  image_hash TEXT NOT NULL,
  catalogue_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('processing','review','failed','confirmed','reconciled')),
  detections JSONB NOT NULL DEFAULT '[]',
  expected_snapshot JSONB NOT NULL DEFAULT '{}',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  error TEXT,
  created_by TEXT NOT NULL,
  confirmed_by TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(business_id,id),
  UNIQUE(business_id,image_hash,catalogue_key)
);
CREATE TABLE IF NOT EXISTS inventory_physical_counts (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL,
  scan_id UUID NOT NULL,
  inventory_item_id INTEGER NOT NULL,
  expected_stock NUMERIC(18,6) NOT NULL,
  physical_stock NUMERIC(18,6) NOT NULL CHECK(physical_stock >= 0),
  unit TEXT NOT NULL,
  full_bottles INTEGER CHECK(full_bottles >= 0),
  bottle_size_ml NUMERIC(12,3),
  opened_ml NUMERIC(18,6),
  variance NUMERIC(18,6) GENERATED ALWAYS AS (physical_stock - expected_stock) STORED,
  reconciled_by TEXT,
  reconciled_at TIMESTAMPTZ,
  reconciliation_note TEXT,
  UNIQUE(scan_id,inventory_item_id),
  FOREIGN KEY(business_id,scan_id) REFERENCES inventory_scans(business_id,id),
  FOREIGN KEY(business_id,inventory_item_id) REFERENCES inventory_items(business_id,id)
);
CREATE TABLE IF NOT EXISTS inventory_stock_logs (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  inventory_item_id INTEGER NOT NULL REFERENCES inventory_items(id),
  change_amount NUMERIC(18,6) NOT NULL,
  reason TEXT NOT NULL,
  order_id UUID REFERENCES orders(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE inventory_stock_logs ADD COLUMN IF NOT EXISTS actor TEXT;
ALTER TABLE inventory_stock_logs ALTER COLUMN change_amount TYPE NUMERIC(18,6);
ALTER TABLE inventory_stock_logs ADD COLUMN IF NOT EXISTS menu_item_id UUID;
ALTER TABLE inventory_stock_logs ADD COLUMN IF NOT EXISTS physical_count_id INTEGER REFERENCES inventory_physical_counts(id);
ALTER TABLE inventory_stock_logs ADD COLUMN IF NOT EXISTS unit TEXT;
ALTER TABLE inventory_stock_logs ADD COLUMN IF NOT EXISTS note TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS inventory_single_reconciliation ON inventory_stock_logs(physical_count_id) WHERE physical_count_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS inventory_history ON inventory_stock_logs(business_id,created_at DESC);
CREATE INDEX IF NOT EXISTS inventory_order_history ON inventory_stock_logs(business_id,order_id);
-- NOT VALID preserves legacy data while checking all future writes. Validate
-- these constraints separately after auditing any old ownership mismatches.
ALTER TABLE menu_item_ingredients ADD CONSTRAINT inventory_recipe_owned_menu
 FOREIGN KEY(business_id,menu_item_id) REFERENCES menu_items(business_id,id) ON DELETE CASCADE NOT VALID;
ALTER TABLE menu_item_ingredients ADD CONSTRAINT inventory_recipe_owned_stock
 FOREIGN KEY(business_id,inventory_item_id) REFERENCES inventory_items(business_id,id) NOT VALID;

-- Per-line snapshots keep reversals correct even after a recipe is changed.
CREATE TABLE IF NOT EXISTS inventory_order_state (
  business_id UUID NOT NULL,
  order_id UUID NOT NULL,
  lines JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(business_id,order_id),
  FOREIGN KEY(business_id,order_id) REFERENCES orders(business_id,id) ON DELETE CASCADE
);
-- Seed already-deducted orders. Preserve historical net deductions, including
-- old reversals; do not retrospectively deduct pre-upgrade sales again.
INSERT INTO inventory_order_state(business_id,order_id,lines)
SELECT o.business_id,o.id,jsonb_build_object('_legacy',jsonb_build_object('quantity',1,'consumption',COALESCE((
 SELECT jsonb_agg(jsonb_build_object('inventory_item_id',s.inventory_item_id,'quantity',s.amount))
 FROM (SELECT inventory_item_id,-SUM(change_amount) AS amount FROM inventory_stock_logs
       WHERE order_id=o.id AND business_id=o.business_id AND reason LIKE 'order_%'
       GROUP BY inventory_item_id HAVING SUM(change_amount)<0) s
),'[]'::jsonb),'items',o.items))
FROM orders o WHERE o.status <> 'EDITABLE' OR EXISTS(SELECT 1 FROM inventory_stock_logs l WHERE l.order_id=o.id AND l.business_id=o.business_id AND l.reason='order_deduction')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS inventory_request_keys (
  business_id UUID NOT NULL REFERENCES businesses(id),
  request_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  response JSONB NOT NULL,
  status INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY(business_id,request_key)
);


  INSERT INTO inventory_schema_versions(version) VALUES ('20261028_inventory_upgrade');
  RAISE NOTICE 'Inventory migration applied successfully.';
END;
$inventory_upgrade$;
COMMIT;

-- Expected result: exactly one version row, including on repeated runs.
SELECT version, applied_at FROM inventory_schema_versions
WHERE version = '20261028_inventory_upgrade';