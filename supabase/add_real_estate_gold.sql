-- ============================================
-- REAL ESTATE TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS real_estate (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  property_name TEXT NOT NULL,
  property_type TEXT NOT NULL DEFAULT 'Residential Flat',
  address TEXT,
  city TEXT,
  state TEXT,
  pin_code TEXT,
  area_value DECIMAL(10,2),
  area_unit TEXT DEFAULT 'sq ft',
  purchase_price DECIMAL(15,2),
  current_value DECIMAL(15,2),
  purchase_date DATE,
  registration_date DATE,
  registration_number TEXT,
  stamp_duty_paid DECIMAL(15,2),
  co_owner_name TEXT,
  is_rented BOOLEAN DEFAULT false,
  annual_rental_income DECIMAL(15,2),
  loan_outstanding DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_real_estate_member ON real_estate(member_id);

-- ============================================
-- GOLD INVESTMENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS gold_investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  gold_type TEXT NOT NULL DEFAULT 'Physical Jewellery',
  item_description TEXT NOT NULL,
  weight_grams DECIMAL(10,3),
  purity TEXT DEFAULT '22K',
  purchase_price_total DECIMAL(15,2),
  purchase_price_per_gram DECIMAL(10,2),
  current_value DECIMAL(15,2),
  purchase_date DATE,
  hallmark_number TEXT,
  making_charges DECIMAL(10,2),
  storage_location TEXT DEFAULT 'Home Safe',
  folio_number TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gold_member ON gold_investments(member_id);

SELECT 'Real Estate and Gold tables created successfully' AS status;
