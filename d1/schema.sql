-- Bremoh Beauty Glow: Cloudflare D1 schema
-- Run once:  wrangler d1 execute bremoh-db --remote --file=d1/schema.sql
-- (or paste into D1 > your database > Console in the Cloudflare dashboard)

CREATE TABLE IF NOT EXISTS services (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL DEFAULT 0,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  service_id TEXT,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  booking_date TEXT NOT NULL,
  booking_time TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','confirmed','completed','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gallery (
  id TEXT PRIMARY KEY,
  image_url TEXT NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL CHECK (price >= 0),
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  image_url TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  customer_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  items TEXT NOT NULL,           -- JSON snapshot: [{id,name,price,qty}]
  total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','confirmed','delivered','cancelled')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Uploaded photos (resized in the browser before upload, stored as base64)
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  content_type TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Used to slow down password guessing and form spam
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket TEXT NOT NULL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits ON rate_limits (bucket, ts);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings (booking_date);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders (created_at);

-- Sample data (edit or delete later from the admin dashboard)
INSERT INTO services (id, name, description, price, duration_minutes) VALUES
  ('svc-facial',  'Signature Glow Facial', 'Deep cleanse, exfoliation, massage and hydrating mask for radiant skin.', 3500, 60),
  ('svc-makeup',  'Makeup Application',    'Full-face makeup for weddings, events and photoshoots.', 5000, 75),
  ('svc-nails',   'Manicure & Pedicure',   'Relaxing nail care with polish of your choice.', 2500, 90),
  ('svc-braids',  'Braids & Styling',      'Professional hair braiding and styling.', 4000, 180);

INSERT INTO products (id, name, description, price, stock) VALUES
  ('prd-serum',  'Glow Vitamin C Serum', 'Brightening serum for an even, radiant complexion.', 1800, 25),
  ('prd-butter', 'Shea Body Butter',     'Rich, nourishing body butter with natural shea.', 1200, 40),
  ('prd-gloss',  'Hydrating Lip Gloss',  'Non-sticky shine with all-day moisture.', 650, 60);
