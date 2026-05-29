-- Add archived_at to leagues so a renewed season can be locked as read-only
-- while preserving all historical data for the Season Recap + franchise history.

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
