-- Add expiry timestamp to assessment_attempts
-- Assessments expire 72 hours (3 days) after issuance

ALTER TABLE assessment_attempts ADD COLUMN expires_at INTEGER;

-- Set default expiry for existing records (72 hours from issued_at)
UPDATE assessment_attempts
SET expires_at = strftime('%s', issued_at) + (72 * 60 * 60)
WHERE expires_at IS NULL AND status != 'submitted';

-- Mark assessments that should be expired
UPDATE assessment_attempts
SET status = 'expired'
WHERE status IN ('issued', 'in_progress')
  AND expires_at < unixepoch();
