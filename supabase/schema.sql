-- ============================================
-- GUPTA FAMILY FINANCIAL ERP - DATABASE SCHEMA
-- Safe to run multiple times (drops existing tables first)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables in reverse order (to avoid foreign key conflicts)
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS liabilities CASCADE;
DROP TABLE IF EXISTS insurance_policies CASCADE;
DROP TABLE IF EXISTS investments CASCADE;
DROP TABLE IF EXISTS credit_cards CASCADE;
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS family_members CASCADE;

-- ============================================
-- FAMILY MEMBERS TABLE
-- ============================================
CREATE TABLE family_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  pan_number TEXT,
  aadhaar_number TEXT,
  date_of_birth DATE,
  email TEXT,
  phone TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO family_members (full_name, relationship, avatar_color) VALUES
  ('Vishal Gupta', 'Owner', '#6366f1'),
  ('Kavita Gupta', 'Spouse', '#ec4899'),
  ('Shubh Gupta', 'Child', '#f59e0b'),
  ('Krishiv Gupta', 'Child', '#10b981');

-- ============================================
-- BANK ACCOUNTS TABLE
-- ============================================
CREATE TABLE bank_accounts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT,
  account_type TEXT NOT NULL,
  balance DECIMAL(15,2) DEFAULT 0,
  cif_number TEXT,
  linked_mobile TEXT,
  linked_email TEXT,
  nominee TEXT,
  joint_holder TEXT,
  minimum_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- CREDIT CARDS TABLE
-- ============================================
CREATE TABLE credit_cards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  bank_name TEXT NOT NULL,
  card_name TEXT NOT NULL,
  last_four_digits TEXT NOT NULL,
  credit_limit DECIMAL(15,2) DEFAULT 0,
  outstanding_amount DECIMAL(15,2) DEFAULT 0,
  billing_cycle_date INTEGER,
  statement_date INTEGER,
  due_date INTEGER,
  auto_debit BOOLEAN DEFAULT false,
  linked_bank_account_id UUID REFERENCES bank_accounts(id),
  is_active BOOLEAN DEFAULT true,
  expiry_month INTEGER,
  expiry_year INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVESTMENTS TABLE
-- ============================================
CREATE TABLE investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  investment_type TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  account_number TEXT,
  principal_amount DECIMAL(15,2) NOT NULL,
  current_value DECIMAL(15,2),
  interest_rate DECIMAL(5,2),
  start_date DATE,
  maturity_date DATE,
  tenure_months INTEGER,
  nominee TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INSURANCE POLICIES TABLE
-- ============================================
CREATE TABLE insurance_policies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL,
  insurer_name TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  sum_assured DECIMAL(15,2),
  annual_premium DECIMAL(15,2),
  premium_frequency TEXT DEFAULT 'Annual',
  premium_due_date DATE,
  policy_start_date DATE,
  policy_end_date DATE,
  nominee TEXT,
  auto_debit BOOLEAN DEFAULT false,
  linked_bank_account_id UUID REFERENCES bank_accounts(id),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  bank_account_id UUID REFERENCES bank_accounts(id),
  credit_card_id UUID REFERENCES credit_cards(id),
  transaction_date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  transaction_type TEXT NOT NULL,
  category TEXT,
  description TEXT,
  reference_number TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- LIABILITIES TABLE
-- ============================================
CREATE TABLE liabilities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  liability_type TEXT NOT NULL,
  lender_name TEXT NOT NULL,
  loan_account_number TEXT,
  principal_amount DECIMAL(15,2) NOT NULL,
  outstanding_amount DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(5,2),
  emi_amount DECIMAL(15,2),
  emi_due_date INTEGER,
  start_date DATE,
  end_date DATE,
  linked_bank_account_id UUID REFERENCES bank_accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_bank_accounts_member ON bank_accounts(member_id);
CREATE INDEX idx_credit_cards_member ON credit_cards(member_id);
CREATE INDEX idx_investments_member ON investments(member_id);
CREATE INDEX idx_insurance_member ON insurance_policies(member_id);
CREATE INDEX idx_transactions_member ON transactions(member_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_liabilities_member ON liabilities(member_id);

-- ============================================
-- DONE! All tables created successfully.
-- ============================================
