-- Migration number: 0001 	 2026-02-01T03:03:47.051Z
-- Add missing tables per design specification

-- ============================================
-- QUESTIONS - Question bank with ACSF mapping
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
    question_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT CHECK(question_type IN ('multiple_choice', 'true_false', 'short_answer', 'essay')) NOT NULL,
    options TEXT, -- JSON array for multiple choice options
    correct_answer TEXT,
    points_possible REAL DEFAULT 1.0,
    acsf_domain TEXT NOT NULL, -- e.g., 'Learning', 'Reading', 'Writing', 'Oral Communication', 'Numeracy'
    acsf_skill TEXT NOT NULL,
    acsf_level INTEGER CHECK(acsf_level BETWEEN 1 AND 5) NOT NULL,
    difficulty_weight REAL DEFAULT 1.0,
    context_text TEXT, -- Optional context for the question
    context_image_url TEXT, -- Optional image
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES assessment_products(product_id)
);

-- ============================================
-- REPORTS - Generated PDF report metadata
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
    report_id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL UNIQUE,
    file_url TEXT NOT NULL,
    file_hash TEXT NOT NULL, -- SHA-256 hash for integrity
    generated_at TEXT DEFAULT (datetime('now')),
    status TEXT CHECK(status IN ('generated', 'locked', 'archived')) DEFAULT 'locked',
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(attempt_id) ON DELETE CASCADE
);

-- ============================================
-- ASSESSMENT VERSIONS - Version control for assessments
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_versions (
    version_id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL,
    version_number TEXT NOT NULL,
    is_active INTEGER DEFAULT 0,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (product_id) REFERENCES assessment_products(product_id),
    UNIQUE(product_id, version_number)
);

-- ============================================
-- DOMAIN SCORES - ACSF domain-level aggregated scores
-- ============================================
CREATE TABLE IF NOT EXISTS domain_scores (
    score_id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    acsf_domain TEXT NOT NULL,
    total_points REAL DEFAULT 0,
    max_points REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    acsf_level_achieved INTEGER,
    outcome TEXT CHECK(outcome IN ('meets', 'borderline', 'support_required')),
    justification TEXT, -- AI-generated or template-based justification
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(attempt_id) ON DELETE CASCADE,
    UNIQUE(attempt_id, acsf_domain)
);

-- ============================================
-- INDEXES for new tables
-- ============================================
CREATE INDEX IF NOT EXISTS idx_questions_product ON questions(product_id);
CREATE INDEX IF NOT EXISTS idx_questions_acsf ON questions(acsf_domain, acsf_level);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(active);
CREATE INDEX IF NOT EXISTS idx_reports_attempt ON reports(attempt_id);
CREATE INDEX IF NOT EXISTS idx_versions_product ON assessment_versions(product_id);
CREATE INDEX IF NOT EXISTS idx_versions_active ON assessment_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_domain_scores_attempt ON domain_scores(attempt_id);
CREATE INDEX IF NOT EXISTS idx_domain_scores_domain ON domain_scores(acsf_domain);
