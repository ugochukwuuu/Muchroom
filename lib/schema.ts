export const schema = `
CREATE TABLE IF NOT EXISTS inventory_lock (id integer PRIMARY KEY);
INSERT INTO inventory_lock VALUES (1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY, name text NOT NULL, brand text NOT NULL, category text NOT NULL,
  description text NOT NULL, image text NOT NULL DEFAULT '', published boolean NOT NULL DEFAULT false
);
CREATE TABLE IF NOT EXISTS variants (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES products,
  sku text NOT NULL UNIQUE, name text NOT NULL, price integer NOT NULL CHECK (price > 0),
  quantity integer NOT NULL DEFAULT 0 CHECK (quantity >= 0), specs jsonb NOT NULL DEFAULT '{}',
  uses text[] NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS product_photos (
  id uuid PRIMARY KEY, product_id uuid NOT NULL REFERENCES products ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('listing', 'issue')),
  url text, public_id text UNIQUE, format text NOT NULL CHECK (format IN ('jpg', 'png', 'webp')),
  note text NOT NULL DEFAULT '', is_cover boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((purpose='listing' AND url IS NOT NULL) OR
         (purpose='issue' AND url IS NULL AND public_id IS NOT NULL AND NOT is_cover))
);
CREATE INDEX IF NOT EXISTS product_photos_product ON product_photos (product_id, purpose);
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY, channel text NOT NULL CHECK (channel IN ('online', 'in_store')),
  status text NOT NULL CHECK (status IN ('pending', 'paid', 'review', 'cancelled')),
  fulfilment text NOT NULL DEFAULT 'unfulfilled' CHECK (fulfilment IN ('unfulfilled', 'fulfilled')),
  payment_method text NOT NULL, customer text NOT NULL, email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '', method text NOT NULL, address text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '', source text NOT NULL DEFAULT '',
  total integer NOT NULL CHECK (total > 0), delivery_fee integer NOT NULL DEFAULT 0,
  expires_at timestamptz, paid_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS order_items (
  order_id uuid NOT NULL REFERENCES orders, variant_id uuid NOT NULL REFERENCES variants,
  label text NOT NULL, quantity integer NOT NULL CHECK (quantity > 0),
  price integer NOT NULL CHECK (price > 0), PRIMARY KEY (order_id, variant_id)
);
CREATE TABLE IF NOT EXISTS stock_movements (
  id uuid PRIMARY KEY, variant_id uuid NOT NULL REFERENCES variants, order_id uuid REFERENCES orders,
  change integer NOT NULL CHECK (change <> 0), reason text NOT NULL, actor text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS payments (
  reference text PRIMARY KEY, order_id uuid NOT NULL UNIQUE REFERENCES orders,
  amount integer NOT NULL CHECK (amount > 0), verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_items_variant ON order_items (variant_id);
CREATE INDEX IF NOT EXISTS stock_movements_variant ON stock_movements (variant_id, created_at);
CREATE INDEX IF NOT EXISTS orders_paid_at ON orders (paid_at);
`;
