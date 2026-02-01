-- Migration number: 0004 	 2026-02-01T03:47:06.460Z
-- Add autosave support for assessment attempts

-- ============================================
-- Add column to store draft responses
-- ============================================
ALTER TABLE assessment_attempts ADD COLUMN draft_responses TEXT;

-- ============================================
-- Add column to track last autosave timestamp
-- ============================================
ALTER TABLE assessment_attempts ADD COLUMN last_autosave_at INTEGER;

-- ============================================
-- Create index for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_attempts_autosave ON assessment_attempts(last_autosave_at);
