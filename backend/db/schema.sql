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
