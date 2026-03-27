export interface FamilyMember {
  id: string
  full_name: string
  relationship: string
  pan_number?: string
  aadhaar_number?: string
  date_of_birth?: string
  email?: string
  phone?: string
  avatar_color: string
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  member_id: string
  bank_name: string
  account_number: string
  ifsc_code?: string
  account_type: string
  balance: number
  cif_number?: string
  linked_mobile?: string
  linked_email?: string
  nominee?: string
  joint_holder?: string
  minimum_balance: number
  is_active: boolean
  created_at: string
  updated_at: string
  family_members?: FamilyMember
}

export interface CreditCard {
  id: string
  member_id: string
  bank_name: string
  card_name: string
  last_four_digits: string
  credit_limit: number
  outstanding_amount: number
  billing_cycle_date?: number
  statement_date?: number
  due_date?: number
  auto_debit: boolean
  linked_bank_account_id?: string
  is_active: boolean
  expiry_month?: number
  expiry_year?: number
  created_at: string
  updated_at: string
  family_members?: FamilyMember
}

export interface Investment {
  id: string
  member_id: string
  investment_type: string
  institution_name: string
  account_number?: string
  principal_amount: number
  current_value?: number
  interest_rate?: number
  start_date?: string
  maturity_date?: string
  tenure_months?: number
  nominee?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
  family_members?: FamilyMember
}

export interface InsurancePolicy {
  id: string
  member_id: string
  policy_type: string
  insurer_name: string
  policy_number: string
  sum_assured?: number
  annual_premium?: number
  premium_frequency: string
  premium_due_date?: string
  policy_start_date?: string
  policy_end_date?: string
  nominee?: string
  auto_debit: boolean
  linked_bank_account_id?: string
  notes?: string
  is_active: boolean
  created_at: string
  updated_at: string
  family_members?: FamilyMember
}

export interface Liability {
  id: string
  member_id: string
  liability_type: string
  lender_name: string
  loan_account_number?: string
  principal_amount: number
  outstanding_amount: number
  interest_rate?: number
  emi_amount?: number
  emi_due_date?: number
  start_date?: string
  end_date?: string
  linked_bank_account_id?: string
  is_active: boolean
  created_at: string
  updated_at: string
  family_members?: FamilyMember
}

export interface DashboardStats {
  totalAssets: number
  totalLiabilities: number
  netWorth: number
  totalBankBalance: number
  totalInvestments: number
  totalInsuredValue: number
  totalCreditOutstanding: number
  monthlyEMI: number
}
