-- LLND Assessment Portal - Database Schema
-- Cloudflare D1 Database
-- Generated from existing database: llnd-core-db
-- Updated: 2026-02-16 - Multi-AQF support, PER portal, schema fixes

-- ============================================
-- TENANTS - Multi-tenant RTO organizations
-- ============================================
CREATE TABLE IF NOT EXISTS tenants (
    tenant_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT,
    logo_url TEXT,
    brand_primary_color TEXT DEFAULT '#000000',
    brand_secondary_color TEXT DEFAULT '#4F46E5',
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
-- BENCHMARK CONFIG - Config-driven scoring engine
-- Stores all thresholds, weights, override rules per AQF level
-- New AQF Level = new row, no code rewrite needed
-- ============================================
CREATE TABLE IF NOT EXISTS benchmark_config (
    config_id TEXT PRIMARY KEY,
    aqf_level TEXT NOT NULL,           -- '3', '4', '5', '6', '8-9'
    version TEXT NOT NULL DEFAULT '1', -- config version for audit trail
    is_active INTEGER DEFAULT 1,

    -- Domain weights (must sum to 1.0)
    reading_weight REAL NOT NULL,
    writing_weight REAL NOT NULL,
    numeracy_weight REAL NOT NULL,
    digital_weight REAL NOT NULL,
    oral_weight REAL NOT NULL,

    -- Writing rubric config
    writing_scale_max INTEGER NOT NULL DEFAULT 3,  -- 3,4,4,5,6 per AQF level
    writing_max_points INTEGER NOT NULL DEFAULT 15, -- 15,20,20,25,30 per AQF level

    -- Classification bands (overall weighted score thresholds)
    threshold_strong REAL NOT NULL,    -- >= this = "Exceeds/Strong"
    threshold_meets REAL NOT NULL,     -- >= this = "Meets Benchmark"
    threshold_monitor REAL NOT NULL,   -- >= this = "Monitor"
    -- Below threshold_monitor = "Support Required"

    -- Override rules stored as JSON for flexibility
    -- Format: { "auto_support": [...], "monitor_cap": [...], "multi_domain_rule": {...} }
    override_rules TEXT NOT NULL DEFAULT '{}',

    -- Risk flag thresholds per domain (JSON)
    -- Format: { "Reading": 70, "Writing": 60, "Numeracy": 70, "Digital": 60 }
    risk_thresholds TEXT NOT NULL DEFAULT '{}',

    -- Monitor trigger thresholds per domain (JSON)
    -- Format: { "Writing": 50, "Digital": 50 }
    monitor_triggers TEXT NOT NULL DEFAULT '{}',

    -- Report descriptor templates (JSON) - different narrative per AQF level
    report_descriptors TEXT NOT NULL DEFAULT '{}',

    -- ACSF configuration
    acsf_core_meets REAL DEFAULT 70,
    acsf_stretch_meets REAL DEFAULT 50,
    acsf2_meets REAL DEFAULT 70,
    acsf2_fail REAL DEFAULT 60,

    -- Safety / critical domain rules
    critical_domains TEXT DEFAULT '["Reading", "Numeracy"]', -- JSON array
    critical_fail_threshold REAL DEFAULT 60,

    -- Metadata
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),

    UNIQUE(aqf_level, version)
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
    max_score REAL DEFAULT 1.0,
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
    overall_outcome TEXT, -- 'exceeds', 'meets', 'monitor', 'support_required'
    overall_classification TEXT, -- Human-readable: "Meets Entry Benchmark", etc.
    risk_flags TEXT, -- JSON array of risk flags
    override_triggered INTEGER DEFAULT 0,
    report_file_path TEXT,
    outcome_flag TEXT,
    aqf_level TEXT, -- '3', '4', '5', '6', '8-9'
    stream TEXT,    -- 'Health', 'Technical', 'Trade', 'Business', 'Hospitality'
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
-- DOMAIN SCORES - ACSF domain-level aggregated scores
-- Updated: 4-band classification + risk flags
-- ============================================
CREATE TABLE IF NOT EXISTS domain_scores (
    score_id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL,
    domain TEXT NOT NULL, -- Reading, Writing, Numeracy, Oral, Digital
    raw_score REAL DEFAULT 0,
    max_score REAL DEFAULT 0,
    percentage REAL DEFAULT 0,
    weighted_contribution REAL DEFAULT 0, -- domain_percentage * domain_weight
    acsf2_percent REAL DEFAULT 0,
    acsf3_core_percent REAL DEFAULT 0,
    acsf3_stretch_percent REAL DEFAULT 0,
    estimated_acsf_band TEXT,
    outcome TEXT CHECK(outcome IN ('exceeds', 'meets_expected', 'monitor', 'support_required')),
    risk_flag INTEGER DEFAULT 0, -- 1 if domain triggered risk flag
    risk_flag_detail TEXT, -- e.g. "Reading borderline"
    justification TEXT,
    strategies TEXT, -- JSON array of recommended support strategies
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (attempt_id) REFERENCES assessment_attempts(attempt_id) ON DELETE CASCADE,
    UNIQUE(attempt_id, domain)
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
-- AUDIT LOGS - Compliance and security audit trail
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT, -- 'assessment', 'per_submission', 'tenant', 'user', 'config'
    entity_id TEXT,
    details TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);


-- ================================================================
-- PRE-ENROLMENT REVIEW (PER) PORTAL TABLES
-- ================================================================

-- ============================================
-- PER SUBMISSIONS - Main submission record
-- ============================================
CREATE TABLE IF NOT EXISTS per_submissions (
    submission_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    student_name TEXT NOT NULL,
    student_id TEXT,
    student_email TEXT,
    application_id TEXT,
    is_international INTEGER DEFAULT 0,
    status TEXT CHECK(status IN ('draft', 'submitted', 'under_review', 'decided')) DEFAULT 'draft',

    -- Section A raw responses (JSON)
    section_a_responses TEXT,

    -- Section B raw responses (JSON)
    section_b_responses TEXT,

    -- Computed report JSON (full contract output)
    report_json TEXT,

    -- Admin decision
    admin_decision TEXT CHECK(admin_decision IN (
        'suitable_to_proceed',
        'proceed_with_interview',
        'further_evidence_required',
        'support_plan_required'
    )),
    admin_notes TEXT,
    reviewed_by TEXT,
    reviewed_at TEXT,

    -- Timestamps
    submitted_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),

    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id)
);

-- ============================================
-- PER SECTION A FLAGS - Course suitability indicators
-- ============================================
CREATE TABLE IF NOT EXISTS per_section_a_flags (
    flag_id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    career_clarity_score TEXT CHECK(career_clarity_score IN ('Strong', 'Moderate', 'Weak')),
    course_alignment_score TEXT CHECK(course_alignment_score IN ('Aligned', 'Partial', 'Weak')),
    academic_progression_score TEXT CHECK(academic_progression_score IN ('Strong', 'Moderate', 'Weak')),
    study_readiness_status TEXT CHECK(study_readiness_status IN ('Confirmed', 'Review Required')),
    english_preparedness_status TEXT CHECK(english_preparedness_status IN ('Adequate', 'Review Required')),
    financial_preparedness_status TEXT CHECK(financial_preparedness_status IN ('Sufficient', 'Review Required')),
    interview_recommended INTEGER DEFAULT 0,
    flags TEXT, -- JSON array of specific flag strings
    raw_word_counts TEXT, -- JSON: { "A1": 135, "A2": 98, ... }
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (submission_id) REFERENCES per_submissions(submission_id) ON DELETE CASCADE
);

-- ============================================
-- PER SECTION B DOMAIN SCORES - Early LLND self-assessment
-- ============================================
CREATE TABLE IF NOT EXISTS per_domain_scores (
    score_id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    domain TEXT NOT NULL, -- Reading, Writing, Numeracy, Learning, Digital
    confidence_level TEXT CHECK(confidence_level IN ('High', 'Moderate', 'Low')),
    domain_percentage REAL DEFAULT 0,
    may_need_support_count INTEGER DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    support_flag INTEGER DEFAULT 0, -- 1 if domain < 50%
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (submission_id) REFERENCES per_submissions(submission_id) ON DELETE CASCADE,
    UNIQUE(submission_id, domain)
);

-- ============================================
-- PER RISK FLAGS - Consolidated risk flag output
-- ============================================
CREATE TABLE IF NOT EXISTS per_risk_flags (
    flag_id TEXT PRIMARY KEY,
    submission_id TEXT NOT NULL,
    overall_llnd_self_risk INTEGER DEFAULT 0, -- 1 if total MNS >= 5 or any domain MNS >= 3
    reading_support_flag INTEGER DEFAULT 0,
    writing_support_flag INTEGER DEFAULT 0,
    numeracy_support_flag INTEGER DEFAULT 0,
    learning_support_flag INTEGER DEFAULT 0,
    digital_support_flag INTEGER DEFAULT 0,
    high_digital_risk_flag INTEGER DEFAULT 0, -- upload AND virtual class both = 0
    total_may_need_support INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (submission_id) REFERENCES per_submissions(submission_id) ON DELETE CASCADE
);

-- ============================================
-- PER CONFIG - Configurable thresholds
-- ============================================
CREATE TABLE IF NOT EXISTS per_config (
    config_id TEXT PRIMARY KEY,
    config_key TEXT NOT NULL,
    config_value TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    UNIQUE(config_key)
);

-- ============================================
-- PER AUDIT - Audit trail for PER decisions
-- ============================================
CREATE TABLE IF NOT EXISTS per_audit (
    audit_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT NOT NULL,
    submission_id TEXT NOT NULL,
    action TEXT NOT NULL, -- 'submitted', 'reviewed', 'decision_made', 'exported'
    actor_id TEXT,
    actor_type TEXT CHECK(actor_type IN ('student', 'admin', 'system')),
    details TEXT, -- JSON
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (submission_id) REFERENCES per_submissions(submission_id) ON DELETE CASCADE
);


-- ============================================
-- INDEXES for performance
-- ============================================

-- Core LLND indexes
CREATE INDEX IF NOT EXISTS idx_users_tenant ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_seats_tenant ON seats(tenant_id);
CREATE INDEX IF NOT EXISTS idx_seats_status ON seats(status);
CREATE INDEX IF NOT EXISTS idx_attempts_tenant ON assessment_attempts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_attempts_token ON assessment_attempts(token_hash);
CREATE INDEX IF NOT EXISTS idx_attempts_aqf ON assessment_attempts(aqf_level);
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
CREATE INDEX IF NOT EXISTS idx_domain_scores_domain ON domain_scores(domain);
CREATE INDEX IF NOT EXISTS idx_benchmark_config_aqf ON benchmark_config(aqf_level, is_active);

-- PER Portal indexes
CREATE INDEX IF NOT EXISTS idx_per_submissions_tenant ON per_submissions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_per_submissions_status ON per_submissions(status);
CREATE INDEX IF NOT EXISTS idx_per_submissions_student ON per_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_per_domain_scores_sub ON per_domain_scores(submission_id);
CREATE INDEX IF NOT EXISTS idx_per_risk_flags_sub ON per_risk_flags(submission_id);
CREATE INDEX IF NOT EXISTS idx_per_section_a_sub ON per_section_a_flags(submission_id);
CREATE INDEX IF NOT EXISTS idx_per_audit_sub ON per_audit(submission_id);


-- ============================================
-- SEED DATA: Benchmark configurations for all AQF levels
-- ============================================

-- AQF 3 - Certificate III (Foundation)
INSERT OR REPLACE INTO benchmark_config (
    config_id, aqf_level, version, is_active,
    reading_weight, writing_weight, numeracy_weight, digital_weight, oral_weight,
    writing_scale_max, writing_max_points,
    threshold_strong, threshold_meets, threshold_monitor,
    override_rules, risk_thresholds, monitor_triggers,
    critical_domains, critical_fail_threshold,
    acsf_core_meets, acsf_stretch_meets, acsf2_meets, acsf2_fail
) VALUES (
    'bench_aqf3_v1', '3', '1', 1,
    0.30, 0.15, 0.30, 0.15, 0.10,
    3, 15,
    80, 65, 50,
    '{"auto_support":[{"condition":"OR","rules":[{"domain":"Reading","threshold":60},{"domain":"Numeracy","threshold":60}]}],"monitor_cap":[],"multi_domain_rule":null}',
    '{"Reading":70,"Writing":60,"Numeracy":70,"Digital":60}',
    '{"Writing":50,"Digital":50}',
    '["Reading","Numeracy"]', 60,
    70, 50, 70, 60
);

-- AQF 4 - Certificate IV (Emerging Autonomy)
INSERT OR REPLACE INTO benchmark_config (
    config_id, aqf_level, version, is_active,
    reading_weight, writing_weight, numeracy_weight, digital_weight, oral_weight,
    writing_scale_max, writing_max_points,
    threshold_strong, threshold_meets, threshold_monitor,
    override_rules, risk_thresholds, monitor_triggers,
    critical_domains, critical_fail_threshold,
    acsf_core_meets, acsf_stretch_meets, acsf2_meets, acsf2_fail
) VALUES (
    'bench_aqf4_v1', '4', '1', 1,
    0.25, 0.20, 0.25, 0.20, 0.10,
    4, 20,
    85, 70, 55,
    '{"auto_support":[{"condition":"AND","rules":[{"domain":"Reading","threshold":60},{"domain":"Numeracy","threshold":60}]},{"condition":"SINGLE","rules":[{"domain":"Writing","threshold":50}]}],"monitor_cap":[{"condition":"multi_below","threshold":65,"count":2}],"multi_domain_rule":{"threshold":65,"count":2}}',
    '{"Reading":70,"Writing":65,"Numeracy":70,"Digital":65}',
    '{"Writing":50,"Digital":50}',
    '["Reading","Numeracy"]', 60,
    70, 50, 70, 60
);

-- AQF 5 - Diploma (Integrated Capability)
INSERT OR REPLACE INTO benchmark_config (
    config_id, aqf_level, version, is_active,
    reading_weight, writing_weight, numeracy_weight, digital_weight, oral_weight,
    writing_scale_max, writing_max_points,
    threshold_strong, threshold_meets, threshold_monitor,
    override_rules, risk_thresholds, monitor_triggers,
    critical_domains, critical_fail_threshold,
    acsf_core_meets, acsf_stretch_meets, acsf2_meets, acsf2_fail
) VALUES (
    'bench_aqf5_v1', '5', '1', 1,
    0.25, 0.25, 0.20, 0.20, 0.10,
    4, 20,
    85, 70, 60,
    '{"auto_support":[{"condition":"ANY_2_CORE","core_domains":["Reading","Writing","Numeracy"],"threshold":60},{"condition":"SINGLE","rules":[{"domain":"Writing","threshold":55}]}],"monitor_cap":[{"condition":"single_below","domain":"Digital","threshold":60}],"multi_domain_rule":{"threshold":60,"count":2,"domains":["Reading","Writing","Numeracy"]}}',
    '{"Reading":70,"Writing":70,"Numeracy":70,"Digital":65}',
    '{"Digital":60}',
    '["Reading","Writing","Numeracy"]', 60,
    70, 50, 70, 60
);

-- AQF 6 - Advanced Diploma (Analytical Depth)
INSERT OR REPLACE INTO benchmark_config (
    config_id, aqf_level, version, is_active,
    reading_weight, writing_weight, numeracy_weight, digital_weight, oral_weight,
    writing_scale_max, writing_max_points,
    threshold_strong, threshold_meets, threshold_monitor,
    override_rules, risk_thresholds, monitor_triggers,
    critical_domains, critical_fail_threshold,
    acsf_core_meets, acsf_stretch_meets, acsf2_meets, acsf2_fail
) VALUES (
    'bench_aqf6_v1', '6', '1', 1,
    0.20, 0.30, 0.20, 0.20, 0.10,
    5, 25,
    90, 75, 65,
    '{"auto_support":[{"condition":"SINGLE","rules":[{"domain":"Writing","threshold":60}]},{"condition":"SINGLE","rules":[{"domain":"Reading","threshold":65}]}],"monitor_cap":[{"condition":"multi_below","threshold":70,"count":2},{"condition":"single_below","domain":"Digital","threshold":65}],"multi_domain_rule":{"threshold":70,"count":2}}',
    '{"Reading":70,"Writing":70,"Numeracy":70,"Digital":70}',
    '{"Digital":65}',
    '["Reading","Writing"]', 65,
    70, 50, 70, 60
);

-- AQF 8-9 - Graduate Diploma (Postgraduate Readiness)
INSERT OR REPLACE INTO benchmark_config (
    config_id, aqf_level, version, is_active,
    reading_weight, writing_weight, numeracy_weight, digital_weight, oral_weight,
    writing_scale_max, writing_max_points,
    threshold_strong, threshold_meets, threshold_monitor,
    override_rules, risk_thresholds, monitor_triggers,
    critical_domains, critical_fail_threshold,
    acsf_core_meets, acsf_stretch_meets, acsf2_meets, acsf2_fail
) VALUES (
    'bench_aqf89_v1', '8-9', '1', 1,
    0.25, 0.35, 0.15, 0.15, 0.10,
    6, 30,
    90, 80, 70,
    '{"auto_support":[{"condition":"SINGLE","rules":[{"domain":"Writing","threshold":70}]},{"condition":"SINGLE","rules":[{"domain":"Reading","threshold":65}]}],"monitor_cap":[{"condition":"multi_below","threshold":70,"count":2},{"condition":"single_below","domain":"Digital","threshold":65}],"multi_domain_rule":{"threshold":70,"count":2}}',
    '{"Reading":75,"Writing":75,"Numeracy":65,"Digital":70}',
    '{"Digital":65}',
    '["Reading","Writing"]', 65,
    70, 50, 70, 60
);

-- PER Config seed data - word count thresholds
INSERT OR REPLACE INTO per_config (config_id, config_key, config_value, description) VALUES
    ('pc_01', 'A1_required_min', '120', 'Min words for Course Selection Motivation'),
    ('pc_02', 'A1_low_threshold', '80', 'Low quality threshold for A1'),
    ('pc_03', 'A2_required_min', '100', 'Min words for Provider Selection Rationale'),
    ('pc_04', 'A2_low_threshold', '70', 'Low quality threshold for A2'),
    ('pc_05', 'A3_required_min', '100', 'Min words for Academic Progression'),
    ('pc_06', 'A5_required_min', '120', 'Min words for Long-Term Career Goals'),
    ('pc_07', 'A7_required_min', '100', 'Min words for Study Management Plan'),
    ('pc_08', 'A9_explanation_min', '80', 'Min words for withdrawal explanation'),
    ('pc_09', 'A10_explanation_min', '50', 'Min words for funding explanation'),
    ('pc_10', 'A12_required_min', '100', 'Min words for Post-Qualification Plans'),
    ('pc_11', 'domain_high_min_percent', '75', 'Min % for High confidence level'),
    ('pc_12', 'domain_moderate_min_percent', '50', 'Min % for Moderate confidence level'),
    ('pc_13', 'overall_mns_risk_threshold', '5', 'Total MNS items to trigger overall risk'),
    ('pc_14', 'domain_mns_threshold', '3', 'MNS items in single domain to trigger risk');
