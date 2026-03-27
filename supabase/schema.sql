-- ============================================
-- GUPTA FAMILY FINANCIAL ERP - DATABASE SCHEMA
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- FAMILY MEMBERS TABLE
-- ============================================
CREATE TABLE family_members (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  full_name TEXT NOT NULL,
  relationship TEXT NOT NULL, -- Owner, Spouse, Child
  pan_number TEXT,
  aadhaar_number TEXT,
  date_of_birth DATE,
  email TEXT,
  phone TEXT,
  avatar_color TEXT DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert the Gupta family
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
  account_type TEXT NOT NULL, -- Savings, Current, Salary, NRE, NRO
  balance DECIMAL(15,2) DEFAULT 0,
  cif_number TEXT,
  linked_mobile TEXT,
  linked_email TEXT,
  nominee TEXT,
  joint_holder TEXT,
  minimum_balance DECIMAL(15,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  billing_cycle_date INTEGER, -- Day of month
  statement_date INTEGER,     -- Day of month
  due_date INTEGER,           -- Day of month
  auto_debit BOOLEAN DEFAULT false,
  linked_bank_account_id UUID REFERENCES bank_accounts(id),
  is_active BOOLEAN DEFAULT true,
  expiry_month INTEGER,
  expiry_year INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INVESTMENTS TABLE
-- ============================================
CREATE TABLE investments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  investment_type TEXT NOT NULL, -- FD, MF, Stocks, PPF, NPS, Gold, RD, Bonds, Real Estate
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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INSURANCE POLICIES TABLE
-- ============================================
CREATE TABLE insurance_policies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  policy_type TEXT NOT NULL, -- Term, Health, ULIP, Endowment, Vehicle, Home
  insurer_name TEXT NOT NULL,
  policy_number TEXT NOT NULL,
  sum_assured DECIMAL(15,2),
  annual_premium DECIMAL(15,2),
  premium_frequency TEXT DEFAULT 'Annual', -- Monthly, Quarterly, Annual
  premium_due_date DATE,
  policy_start_date DATE,
  policy_end_date DATE,
  nominee TEXT,
  auto_debit BOOLEAN DEFAULT false,
  linked_bank_account_id UUID REFERENCES bank_accounts(id),
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
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
  transaction_type TEXT NOT NULL, -- Credit, Debit
  category TEXT, -- Food, Travel, EMI, Investment, Salary, etc.
  description TEXT,
  reference_number TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- LIABILITIES TABLE
-- ============================================
CREATE TABLE liabilities (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id UUID REFERENCES family_members(id) ON DELETE CASCADE,
  liability_type TEXT NOT NULL, -- Home Loan, Car Loan, Personal Loan, Education Loan
  lender_name TEXT NOT NULL,
  loan_account_number TEXT,
  principal_amount DECIMAL(15,2) NOT NULL,
  outstanding_amount DECIMAL(15,2) NOT NULL,
  interest_rate DECIMAL(5,2),
  emi_amount DECIMAL(15,2),
  emi_due_date INTEGER, -- Day of month
  start_date DATE,
  end_date DATE,
  linked_bank_account_id UUID REFERENCES bank_accounts(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_bank_accounts_member ON bank_accounts(member_id);
CREATE INDEX idx_credit_cards_member ON credit_cards(member_id);
CREATE INDEX idx_investments_member ON investments(member_id);
CREATE INDEX idx_insurance_member ON insurance_policies(member_id);
CREATE INDEX idx_transactions_member ON transactions(member_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_liabilities_member ON liabilities(member_id);
