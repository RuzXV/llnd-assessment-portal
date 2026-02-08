-- LLND Assessment Portal - Database Schema
-- Cloudflare D1 Database
-- Generated from existing database: llnd-core-db

-- ============================================
-- TENANTS - Multi-tenant RTO organizations
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    logo_url TEXT,
    brand_primary_color TEXT DEFAULT '#000000',
    status TEXT CHECK(status IN ('active', 'inactive')) DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- USERS - Admin users with role-based access
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('super_admin', 'rto_admin', 'viewer')) DEFAULT 'rto_admin',
    status TEXT CHECK(status IN ('active', 'disabled')) DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- ============================================
-- ASSESSMENT PRODUCTS - Qualification levels and streams
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_products (
    product_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    aqf_level TEXT NOT NULL,
    stream TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    version TEXT DEFAULT '1.0'
);

-- ============================================
-- SEATS - Licensing and seat management
-- ============================================
CREATE TABLE IF NOT EXISTS seats (
    seat_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    status TEXT CHECK(status IN ('available', 'reserved', 'consumed')) DEFAULT 'available',
    purchase_reference TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    consumed_at TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES assessment_products(product_id)
);

-- ============================================
-- ASSESSMENT ATTEMPTS - Student assessment sessions
-- ============================================
CREATE TABLE IF NOT EXISTS assessment_attempts (
    attempt_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    seat_id TEXT NOT NULL UNIQUE,
    version_id TEXT,
    token_hash TEXT NOT NULL UNIQUE,
    student_name TEXT,
    student_id TEXT,
    status TEXT CHECK(status IN ('issued', 'in_progress', 'submitted', 'expired')) DEFAULT 'issued',
    issued_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    submitted_at TEXT,
    expires_at INTEGER,
    draft_responses TEXT,
    total_score REAL,
    domain_breakdown TEXT,
    report_json TEXT, -- Full structured report data
    benchmark_version TEXT DEFAULT 'AQF3_V1',
    overall_outcome TEXT, -- 'meets_confident', 'meets_monitor', 'support_required'
    report_file_path TEXT,
    outcome_flag TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(seat_id),
    FOREIGN KEY (version_id) REFERENCES assessment_versions(version_id)
);

-- ============================================
-- RESPONSES - Individual question responses
-- ============================================
CREATE TABLE IF NOT EXISTS responses (
    response_id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    response_data TEXT,
    is_correct INTEGER DEFAULT 0,
    points_awarded REAL DEFAULT 0,
    acsf_level_achieved INTEGER,
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(attempt_id) ON DELETE CASCADE
);

-- ============================================
-- AUDIT LOGS - Compliance and security audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity_id TEXT,
    details TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- QUESTIONS - Question bank with ACSF mapping
-- ============================================
CREATE TABLE IF NOT EXISTS questions (
    question_id TEXT PRIMARY KEY,
    version_id TEXT NOT NULL,
    product_id TEXT,
    text TEXT NOT NULL,
    type TEXT CHECK(type IN ('multiple_choice', 'true_false', 'short_answer', 'numeric')) NOT NULL,
    response_type TEXT CHECK(response_type IN ('mcq', 'numeric', 'short_text')) DEFAULT 'mcq',
    options TEXT, -- JSON array for multiple choice options
    correct_response TEXT,
    max_score REAL DEFAULT 1.0, -- For writing items, max is 3
    weight REAL DEFAULT 1.0,
    domain TEXT NOT NULL, -- Reading, Writing, Numeracy, Oral, Digital
    acsf_level INTEGER CHECK(acsf_level BETWEEN 2 AND 5) NOT NULL,
    difficulty_tag TEXT CHECK(difficulty_tag IN ('core', 'stretch')) DEFAULT 'core',
    order_index INTEGER DEFAULT 0,
    context_text TEXT, -- Optional context for the question
    context_image_url TEXT, -- Optional image
    context_table TEXT, -- JSON for table data if needed
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (version_id) REFERENCES assessment_versions(version_id),
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
    domain TEXT NOT NULL, -- Reading, Writing, Numeracy, Oral, Digital
    raw_score REAL DEFAULT 0,
    max_score REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    acsf2_percent REAL DEFAULT 0,
    acsf3_core_percent REAL DEFAULT 0,
    acsf3_stretch_percent REAL DEFAULT 0,
    estimated_acsf_band TEXT, -- 'ACSF 3 (confident)', 'ACSF 3 (monitor)', 'ACSF 2-3 (borderline)', 'Below ACSF 2'
    outcome TEXT CHECK(outcome IN ('meets_expected', 'monitor', 'support_required')),
    justification TEXT,
    strategies TEXT, -- JSON array of recommended support strategies
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(attempt_id) ON DELETE CASCADE,
    UNIQUE(attempt_id, domain)
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_seats_tenant ON seats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);
CREATE INDEX IF NOT EXISTS idx_attempts_tenant ON assessment_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attempts_token ON assessment_attempts(token_hash);
CREATE INDEX IF NOT EXISTS idx_responses_attempt ON responses(attempt_id);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_questions_product ON questions(product_id);
CREATE INDEX IF NOT EXISTS idx_questions_version ON questions(version_id);
CREATE INDEX IF NOT EXISTS idx_questions_acsf ON questions(domain, acsf_level);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(active);
CREATE INDEX IF NOT EXISTS idx_attempts_version ON assessment_attempts(version_id);
CREATE INDEX IF NOT EXISTS idx_reports_attempt ON reports(attempt_id);
CREATE INDEX IF NOT EXISTS idx_versions_product ON assessment_versions(product_id);
CREATE INDEX IF NOT EXISTS idx_versions_active ON assessment_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_domain_scores_attempt ON domain_scores(attempt_id);
CREATE INDEX IF NOT EXISTS idx_domain_scores_domain ON domain_scores(acsf_domain);
