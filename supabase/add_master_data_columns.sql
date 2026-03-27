-- Add UPI and Net Banking fields to bank_accounts
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS net_banking_user_id TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS registered_mobile TEXT;
ALTER TABLE bank_accounts ADD COLUMN IF NOT EXISTS registered_email TEXT;

-- Add additional personal fields to family_members
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS nominee_name TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS nominee_relation TEXT;
ALTER TABLE family_members ADD COLUMN IF NOT EXISTS notes TEXT;

-- Done!
SELECT 'Master data columns added successfully' AS status;
