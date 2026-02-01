-- Migration number: 0002 	 2026-02-01T03:16:15.184Z
-- Fix schema mismatches between database and API implementation

-- ============================================
-- Fix 1: Add missing columns to assessment_attempts
-- ============================================
ALTER TABLE assessment_attempts ADD COLUMN version_id TEXT;
ALTER TABLE assessment_attempts ADD COLUMN total_score REAL DEFAULT 0;
ALTER TABLE assessment_attempts ADD COLUMN domain_breakdown TEXT;
ALTER TABLE assessment_attempts ADD COLUMN created_at INTEGER;

-- ============================================
-- Fix 2: Add missing columns to questions
-- ============================================
ALTER TABLE questions ADD COLUMN text TEXT;
ALTER TABLE questions ADD COLUMN type TEXT;
ALTER TABLE questions ADD COLUMN domain TEXT;
ALTER TABLE questions ADD COLUMN order_index INTEGER DEFAULT 0;
ALTER TABLE questions ADD COLUMN correct_response TEXT;
ALTER TABLE questions ADD COLUMN weight REAL DEFAULT 1.0;
ALTER TABLE questions ADD COLUMN version_id TEXT;

-- Copy data from old columns to new columns for questions
UPDATE questions SET
    text = question_text,
    type = question_type,
    domain = acsf_domain,
    correct_response = correct_answer,
    weight = points_possible
WHERE text IS NULL;

-- ============================================
-- Fix 3: Add missing column to responses
-- ============================================
ALTER TABLE responses ADD COLUMN is_correct INTEGER DEFAULT 0;

-- ============================================
-- Fix 4: Create view aliases for table name compatibility
-- ============================================
-- API expects "versions" but schema has "assessment_versions"
CREATE VIEW IF NOT EXISTS versions AS
SELECT
    version_id,
    product_id,
    version_number,
    is_active as active,
    description,
    created_at
FROM assessment_versions;

-- API expects "products" but schema has "assessment_products"
CREATE VIEW IF NOT EXISTS products AS
SELECT
    product_id,
    name,
    aqf_level,
    stream,
    active,
    version
FROM assessment_products;

-- ============================================
-- Fix 5: Add indexes for new columns
-- ============================================
CREATE INDEX IF NOT EXISTS idx_attempts_version ON assessment_attempts(version_id);
CREATE INDEX IF NOT EXISTS idx_questions_version ON questions(version_id);
CREATE INDEX IF NOT EXISTS idx_questions_order ON questions(order_index);
CREATE INDEX IF NOT EXISTS idx_responses_correct ON responses(is_correct);

-- ============================================
-- Fix 6: Migrate timestamp data
-- ============================================
-- Convert datetime strings to unix timestamps where created_at is null
UPDATE assessment_attempts
SET created_at = CAST(strftime('%s', issued_at) AS INTEGER)
WHERE created_at IS NULL AND issued_at IS NOT NULL;

UPDATE audit_logs
SET timestamp = strftime('%s', timestamp)
WHERE typeof(timestamp) = 'text';
