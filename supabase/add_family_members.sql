-- Add extended Gupta family members
-- Vishal Gupta is the beneficiary for HUF and parent accounts

INSERT INTO family_members (full_name, relationship, avatar_color, email, phone) VALUES
  ('Vishal Gupta (HUF)', 'HUF', '#818cf8', null, null),
  ('Manohar Lal Gupta (HUF)', 'HUF', '#a78bfa', null, null),
  ('Manohar Lal Gupta', 'Father', '#34d399', null, null),
  ('Daya Gupta', 'Mother', '#f472b6', null, null);

-- Verify all members
SELECT id, full_name, relationship, avatar_color FROM family_members ORDER BY created_at;
