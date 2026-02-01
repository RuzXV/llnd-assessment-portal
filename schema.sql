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
    token_hash TEXT NOT NULL UNIQUE,
    student_name TEXT,
    student_id TEXT,
    status TEXT CHECK(status IN ('issued', 'in_progress', 'submitted', 'expired')) DEFAULT 'issued',
    issued_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    submitted_at TEXT,
    report_file_path TEXT,
    outcome_flag TEXT,
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (seat_id) REFERENCES seats(seat_id)
);

-- ============================================
-- RESPONSES - Individual question responses
-- ============================================
CREATE TABLE IF NOT EXISTS responses (
    response_id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    response_data TEXT,
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
CREATE INDEX IF NOT EXISTS idx_questions_acsf ON questions(acsf_domain, acsf_level);
CREATE INDEX IF NOT EXISTS idx_questions_active ON questions(active);
CREATE INDEX IF NOT EXISTS idx_reports_attempt ON reports(attempt_id);
CREATE INDEX IF NOT EXISTS idx_versions_product ON assessment_versions(product_id);
CREATE INDEX IF NOT EXISTS idx_versions_active ON assessment_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_domain_scores_attempt ON domain_scores(attempt_id);
CREATE INDEX IF NOT EXISTS idx_domain_scores_domain ON domain_scores(acsf_domain);
