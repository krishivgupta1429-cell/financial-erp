CREATE TABLE IF NOT EXISTS notifications (
  id                 UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  member_id          UUID REFERENCES family_members(id) ON DELETE SET NULL,
  source_channel     TEXT NOT NULL DEFAULT 'manual',
  raw_text           TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT 'other',
  subcategory        TEXT,
  amount             DECIMAL(15,2),
  reference_number   TEXT,
  institution_name   TEXT,
  notification_date  DATE,
  due_date           DATE,
  action_title       TEXT NOT NULL,
  action_description TEXT,
  action_priority    TEXT NOT NULL DEFAULT 'medium',
  action_due_date    DATE,
  status             TEXT NOT NULL DEFAULT 'open',
  disposed_at        TIMESTAMPTZ,
  disposal_note      TEXT,
  disposed_by        TEXT,
  is_linked          BOOLEAN DEFAULT false,
  linked_table       TEXT,
  linked_record_id   UUID,
  confidence         TEXT DEFAULT 'medium',
  needs_review       BOOLEAN DEFAULT false,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_member   ON notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status   ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_created  ON notifications(created_at DESC);

SELECT 'Notifications table created successfully' AS status;
