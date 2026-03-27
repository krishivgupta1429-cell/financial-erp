-- Add enhanced investment tracking columns
ALTER TABLE investments ADD COLUMN IF NOT EXISTS interest_credit_frequency TEXT DEFAULT 'On Maturity';
ALTER TABLE investments ADD COLUMN IF NOT EXISTS next_interest_date DATE;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS expected_maturity_amount DECIMAL(15,2);
ALTER TABLE investments ADD COLUMN IF NOT EXISTS certificate_number TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS deposit_receipt_number TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS post_office_branch TEXT;
ALTER TABLE investments ADD COLUMN IF NOT EXISTS cumulative BOOLEAN DEFAULT true;

-- Done!
