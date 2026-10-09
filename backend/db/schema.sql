CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; 
CREATE TABLE IF NOT EXISTS businesses ( 
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
business_name VARCHAR(255) NOT NULL, 
owner_name VARCHAR(255) NOT NULL, 
email VARCHAR(255) UNIQUE NOT NULL, 
phone VARCHAR(20) UNIQUE NOT NULL, 
password_hash TEXT NOT NULL, 
logo_url TEXT, 
description TEXT, 
address TEXT, 
city VARCHAR(100), 
state VARCHAR(100), 
pincode VARCHAR(10), 
gst_number VARCHAR(20), 
subscription_status VARCHAR(20) DEFAULT 'INACTIVE' CHECK (subscription_status IN 
('ACTIVE','INACTIVE','EXPIRED')), 
subscription_start_date TIMESTAMPTZ, 
subscription_end_date TIMESTAMPTZ, 
last_payment_id VARCHAR(255), 
otp_code VARCHAR(6), 
otp_expires_at TIMESTAMPTZ, 
created_at TIMESTAMPTZ DEFAULT NOW(), 
updated_at TIMESTAMPTZ DEFAULT NOW() 
); 
CREATE TABLE IF NOT EXISTS tables ( 
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, 
table_number VARCHAR(20) NOT NULL, 
qr_code_url TEXT, 
created_at TIMESTAMPTZ DEFAULT NOW(), 
UNIQUE(business_id, table_number) 
); 
CREATE TABLE IF NOT EXISTS menu_items ( 
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, 
name VARCHAR(255) NOT NULL, 
name_mr VARCHAR(255), 
name_hi VARCHAR(255), 
description TEXT, 
price NUMERIC(10,2) NOT NULL, 
image_url TEXT, 
category VARCHAR(100), 
is_available BOOLEAN DEFAULT true, 
created_at TIMESTAMPTZ DEFAULT NOW(), 
updated_at TIMESTAMPTZ DEFAULT NOW() 
); 
CREATE TABLE IF NOT EXISTS orders ( 
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, 
table_id UUID REFERENCES tables(id) ON DELETE SET NULL, 
items JSONB NOT NULL, 
total_amount NUMERIC(10,2) NOT NULL, 
special_instructions TEXT, 
status VARCHAR(20) DEFAULT 'EDITABLE' CHECK (status IN 
('EDITABLE','CONFIRMED','PREPARING','SERVED','REJECTED')), 
created_at TIMESTAMPTZ DEFAULT NOW(), 
updated_at TIMESTAMPTZ DEFAULT NOW() 
); 
CREATE TABLE IF NOT EXISTS subscription_payments ( 
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, 
razorpay_payment_id VARCHAR(255) NOT NULL, 
razorpay_order_id VARCHAR(255), 
amount NUMERIC(10,2) NOT NULL, 
currency VARCHAR(10) DEFAULT 'INR', 
status VARCHAR(20) DEFAULT 'SUCCESS', 
paid_at TIMESTAMPTZ DEFAULT NOW() 
); 
CREATE TABLE IF NOT EXISTS notifications ( 
id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), 
business_id UUID REFERENCES businesses(id) ON DELETE CASCADE, 
order_id UUID REFERENCES orders(id) ON DELETE CASCADE, 
message TEXT NOT NULL, 
is_read BOOLEAN DEFAULT false, 
created_at TIMESTAMPTZ DEFAULT NOW() 
); 
CREATE INDEX IF NOT EXISTS idx_orders_business_id ON orders(business_id); 
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at); 
CREATE INDEX IF NOT EXISTS idx_menu_items_business_id ON menu_items(business_id); 
CREATE INDEX IF NOT EXISTS idx_notifications_business_id ON notifications(business_id);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_source VARCHAR(20) DEFAULT 'customer';
UPDATE orders
SET order_source = 'customer'
WHERE order_source IS NULL OR TRIM(order_source) = '';

-- ─── business_summaries: hourly AI business brief ─────────────────────────────
CREATE TABLE IF NOT EXISTS business_summaries (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  summary_date DATE NOT NULL,
  summary_hour INTEGER NOT NULL,        -- 0–23, the hour this brief was generated for
  summary_text TEXT,                    -- short plain-text fallback (push/toast)
  summary_json JSONB,                   -- structured brief shown in the UI
  key_metrics JSONB,                    -- raw metrics snapshot used to generate it
  is_read BOOLEAN DEFAULT FALSE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, summary_date, summary_hour)
);

CREATE INDEX IF NOT EXISTS idx_business_summaries_lookup
  ON business_summaries(business_id, summary_date, summary_hour);

-- ─── business_alerts: real-time alert engine ─────────────────────────────────
CREATE TABLE IF NOT EXISTS business_alerts (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id),
  alert_type VARCHAR(50) NOT NULL,      -- e.g. 'revenue_spike', 'rating_drop'
  severity VARCHAR(20) NOT NULL DEFAULT 'info', -- 'info' | 'warning' | 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  metric_data JSONB,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_business_alerts_lookup
  ON business_alerts(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_business_alerts_cooldown
  ON business_alerts(business_id, alert_type, created_at DESC);

-- ─── push_tokens: stores Expo push tokens for each business ────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform VARCHAR(20),
  language VARCHAR(5) DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, token)
);

CREATE INDEX IF NOT EXISTS idx_push_tokens_business
  ON push_tokens(business_id);

ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS language VARCHAR(5) DEFAULT 'en';

CREATE TABLE IF NOT EXISTS subscription_notification_logs (
  id SERIAL PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  reminder_type VARCHAR(20) NOT NULL,
  sent_on DATE NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, token, reminder_type, sent_on)
);

CREATE INDEX IF NOT EXISTS idx_subscription_notification_logs_lookup
  ON subscription_notification_logs(business_id, sent_on);
-- ─── hotel_rooms: staff-side room occupancy management ─────────────────────
CREATE TABLE IF NOT EXISTS hotel_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  room_number VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'AVAILABLE'
    CHECK (status IN ('AVAILABLE', 'OCCUPIED')),
  total_guests INTEGER NOT NULL DEFAULT 0,
  male INTEGER NOT NULL DEFAULT 0,
  female INTEGER NOT NULL DEFAULT 0,
  children INTEGER NOT NULL DEFAULT 0,
  checked_in_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, room_number)
);

CREATE INDEX IF NOT EXISTS idx_hotel_rooms_business_id ON hotel_rooms(business_id);

-- ─── Localized menu item names (name_mr / name_hi) — idempotent for existing DBs ──
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS name_mr VARCHAR(255);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS name_hi VARCHAR(255);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS food_type VARCHAR(20) DEFAULT 'veg';
UPDATE menu_items SET food_type = 'veg' WHERE food_type IS NULL OR TRIM(food_type) = '';
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS liquor_available BOOLEAN DEFAULT false;
UPDATE businesses SET liquor_available = false WHERE liquor_available IS NULL;
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS menu_type VARCHAR(20) DEFAULT 'food';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS liquor_code VARCHAR(50);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS size_ml NUMERIC(10,2);
UPDATE menu_items SET menu_type = 'food' WHERE menu_type IS NULL OR TRIM(menu_type) = '';

-- POS category-code support for fast staff-side order entry.
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS menu_group VARCHAR(20);
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS category_code INTEGER;

UPDATE menu_items
SET menu_group = CASE
  WHEN COALESCE(menu_type, 'food') = 'liquor' THEN 'liquor'
  WHEN LOWER(REPLACE(COALESCE(food_type, 'veg'), '-', '_')) IN ('non_veg', 'nonveg', 'non veg') THEN 'non_veg'
  ELSE 'veg'
END
WHERE menu_group IS NULL OR TRIM(menu_group) = '';

UPDATE menu_items
SET category_code = CASE
  WHEN COALESCE(menu_type, 'food') = 'liquor' THEN NULL
  WHEN LOWER(REPLACE(COALESCE(food_type, 'veg'), '-', '_')) IN ('non_veg', 'nonveg', 'non veg') THEN 7
  WHEN LOWER(COALESCE(category, '')) IN ('bread', 'breads', 'roti', 'rotis', 'chapati', 'chapatis') THEN 3
  WHEN LOWER(COALESCE(category, '')) = 'snacks' THEN 2
  WHEN LOWER(COALESCE(category, '')) LIKE '%cigarette%'
    OR LOWER(COALESCE(category, '')) LIKE '%tobacco%'
    OR LOWER(COALESCE(name, '')) LIKE '%cigarette%'
    OR LOWER(COALESCE(name, '')) LIKE '%tobacco%'
    OR LOWER(COALESCE(name, '')) LIKE '%advance%'
    OR LOWER(COALESCE(name, '')) LIKE '%classic%'
    OR LOWER(COALESCE(name, '')) LIKE '%gold flake%'
    OR LOWER(COALESCE(name, '')) LIKE '%lights%'
    OR LOWER(COALESCE(name, '')) LIKE '%eyesburst%' THEN 4
  WHEN LOWER(COALESCE(name, '')) LIKE '%bisleri%'
    OR LOWER(COALESCE(name, '')) LIKE '%water%'
    OR LOWER(COALESCE(name, '')) LIKE '%packaged drinking%' THEN 1
  WHEN LOWER(COALESCE(name, '')) LIKE '%coke%'
    OR LOWER(COALESCE(name, '')) LIKE '%coca cola%'
    OR LOWER(COALESCE(name, '')) LIKE '%pepsi%'
    OR LOWER(COALESCE(name, '')) LIKE '%sprite%'
    OR LOWER(COALESCE(name, '')) LIKE '%thums%'
    OR LOWER(COALESCE(name, '')) LIKE '%thumbs%'
    OR LOWER(COALESCE(name, '')) LIKE '%fanta%'
    OR LOWER(COALESCE(name, '')) LIKE '%sting%'
    OR LOWER(COALESCE(name, '')) LIKE '%charger%'
    OR LOWER(COALESCE(name, '')) LIKE '%energy drink%'
    OR LOWER(COALESCE(name, '')) LIKE '%soft drink%'
    OR LOWER(COALESCE(category, '')) LIKE '%cold drink%' THEN 5
  WHEN LOWER(COALESCE(category, '')) = 'beverages' THEN 1
  ELSE 6
END
WHERE COALESCE(menu_type, 'food') <> 'liquor'
  AND category_code IS NULL;

UPDATE menu_items
SET category_code = NULL
WHERE COALESCE(menu_type, 'food') = 'liquor';

CREATE INDEX IF NOT EXISTS idx_menu_items_business_category_available
  ON menu_items(business_id, category_code, is_available);

ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS liquor_brand_code INTEGER;

WITH liquor_brand_map(code, label) AS (
  VALUES
    (10, 'Tuborg Strong'), (11, 'Tuborg'), (12, 'Tuborg Classic'), (13, 'Kingfisher'), (14, 'Kingfisher Ultra'), (15, 'Carlsberg Beer'), (16, 'Heineken Beer'), (17, 'Budweiser'), (18, 'Godfather Beer'), (19, 'London Beer'), (20, 'Breezer'),
    (21, 'Royal Stag'), (22, 'Royal Stag Double'), (23, 'Royal Green'), (24, 'Signature'), (25, 'Imperial Blue'), (26, 'McDowell''s Rum'), (27, 'McDowell''s'), (28, 'McDowell''s Platinum'), (29, 'B7'), (30, 'DSP Black'), (31, 'Goa'), (32, 'Grand Masters'), (33, 'Iconiq White'), (34, 'Royal Challenge'), (35, 'Oaksmith Silver'), (36, 'Oaksmith Gold'), (37, 'Oaken'), (38, 'Antiquity'), (39, 'Green Label'), (40, 'Officer''s Choice'), (41, 'Jameson'), (42, 'Black Dog'), (43, 'Teachers'), (44, 'Black & White'), (45, 'VAT 69'), (46, 'Ballantine''s'), (47, 'Haywards 2000'), (48, 'Haywards'), (49, 'Masters Delight'), (50, 'Classic Gold'), (51, 'Brown Man'), (52, 'Premium Whisky'), (53, 'Barrel Whisky'), (54, 'X-Treme Whisky'), (55, 'Empire'), (56, 'Blenders Reserve'), (57, 'After Dark'), (58, 'Amber Whisky'), (59, 'Vulcan Blue'), (60, 'Alpha Bull'), (61, 'Kalani White'),
    (62, 'Bullet Rum'), (63, 'Old Monk'), (64, 'Dark Old Rum'), (65, 'Gold Medal Rum'), (66, 'Mad Rum'), (67, 'Blak Bacardi'),
    (68, 'Smirnoff'), (69, 'Vodka'), (70, 'Xclamation'), (71, 'Xclamation Vodka'), (72, 'Silver Kastle Vodka'), (73, 'Gold Medal Vodka'), (74, 'Shaky Vodka Jamun'), (75, 'Smirnoff Jamun'),
    (76, 'Bombay'), (77, 'Bombay Quarter'), (78, 'Lemon Duet Gin'), (79, 'Knight Fox Gin'),
    (80, 'Doctor Brandy'),
    (81, 'Let''s Go Cranberry'), (82, 'Bacardi Limon'), (83, 'Magic Moments'), (84, 'Magik Moments'), (85, 'Magic Moment'),
    (86, 'OC Blue'), (87, 'REO Wain'), (88, 'B10 Sterling'), (89, 'Red Label'), (90, '100 Pipers'), (91, 'Romeno'),
    (92, 'Danona'), (93, 'Khata Khat'), (94, 'Royal Barrel'), (95, 'Mumbai Malti'), (96, 'Cannon'), (97, 'Bullet Strong')
),
matched_liquor AS (
  SELECT DISTINCT ON (m.id) m.id, lbm.code
  FROM menu_items m
  JOIN liquor_brand_map lbm
    ON LOWER(TRIM(COALESCE(m.name, ''))) = LOWER(lbm.label)
    OR LOWER(TRIM(COALESCE(m.name, ''))) LIKE LOWER(lbm.label) || ' %'
  WHERE COALESCE(m.menu_type, 'food') = 'liquor'
  ORDER BY m.id, LENGTH(lbm.label) DESC
)
UPDATE menu_items m
SET liquor_brand_code = matched_liquor.code
FROM matched_liquor
WHERE m.id = matched_liquor.id
  AND m.liquor_brand_code IS NULL;

UPDATE menu_items
SET liquor_brand_code = NULL
WHERE COALESCE(menu_type, 'food') <> 'liquor';

CREATE INDEX IF NOT EXISTS idx_menu_items_business_liquor_brand_available
  ON menu_items(business_id, liquor_brand_code, is_available);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'inventory_items'
  ) THEN
    ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS bottle_size NUMERIC(10,2);
  END IF;
END $$;
