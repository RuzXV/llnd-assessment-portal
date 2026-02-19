-- ============================================
-- EEPT (English Placement Test) Module Schema
-- Migration: 0006_eept_schema.sql
-- Date: 2026-02-19
-- ============================================

-- ============================================
-- EEPT TEST FORMS - Assessment form definitions
-- ============================================
CREATE TABLE IF NOT EXISTS eept_test_forms (
    form_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT '1.0',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- EEPT PASSAGES - Reading comprehension passages
-- ============================================
CREATE TABLE IF NOT EXISTS eept_passages (
    passage_id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    cefr TEXT NOT NULL CHECK(cefr IN ('A2','B1','B2','C1')),
    title TEXT,
    text TEXT NOT NULL,
    word_count INTEGER,
    text_type TEXT, -- informational|email|report|article|opinion
    topic_domain TEXT, -- study|workplace|community|general
    order_index INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (form_id) REFERENCES eept_test_forms(form_id)
);

-- ============================================
-- EEPT QUESTIONS - Grammar + Reading MCQ items
-- ============================================
CREATE TABLE IF NOT EXISTS eept_questions (
    question_id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    section TEXT NOT NULL CHECK(section IN ('grammar','reading')),
    passage_id TEXT, -- NULL for grammar, set for reading
    cefr TEXT NOT NULL CHECK(cefr IN ('A2','B1','B2','C1')),
    subskill TEXT,
    prompt TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL CHECK(correct_option IN ('A','B','C','D')),
    points REAL NOT NULL DEFAULT 1.0,
    order_index INTEGER DEFAULT 0,
    rationale_correct TEXT,
    rationale_distractors TEXT,
    cefr_alignment_note TEXT,
    review_status TEXT DEFAULT 'approved' CHECK(review_status IN ('draft','reviewed','approved','retired')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (form_id) REFERENCES eept_test_forms(form_id),
    FOREIGN KEY (passage_id) REFERENCES eept_passages(passage_id)
);

-- ============================================
-- EEPT WRITING PROMPTS - Task 1 and Task 2
-- ============================================
CREATE TABLE IF NOT EXISTS eept_writing_prompts (
    prompt_id TEXT PRIMARY KEY,
    form_id TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK(task_type IN ('task1','task2')),
    cefr_target TEXT NOT NULL,
    prompt TEXT NOT NULL,
    requirement_1 TEXT,
    requirement_2 TEXT,
    requirement_3 TEXT,
    word_limit_min INTEGER,
    word_limit_max INTEGER,
    assessment_focus TEXT, -- internal note
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (form_id) REFERENCES eept_test_forms(form_id)
);

-- ============================================
-- EEPT ASSESSMENTS - Individual assessment sessions
-- ============================================
CREATE TABLE IF NOT EXISTS eept_assessments (
    assessment_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    candidate_user_id TEXT, -- references eept_candidates
    form_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN (
        'issued','started','submitted','scoring_in_progress',
        'review_required','finalised','cancelled'
    )),
    issued_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    submitted_at TEXT,
    finalised_at TEXT,
    course_intended TEXT,
    cohort_tag TEXT,
    agent_name TEXT,
    notes TEXT,
    secure_token TEXT NOT NULL,
    token_hash TEXT NOT NULL,
    token_expires_at TEXT,
    issued_by TEXT, -- user_id of RTO manager who issued
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    FOREIGN KEY (form_id) REFERENCES eept_test_forms(form_id)
);

-- ============================================
-- EEPT CANDIDATES - Candidate user records
-- ============================================
CREATE TABLE IF NOT EXISTS eept_candidates (
    candidate_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    mobile TEXT,
    student_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(tenant_id, email)
);

-- ============================================
-- EEPT MCQ RESPONSES - Individual MCQ answers
-- ============================================
CREATE TABLE IF NOT EXISTS eept_responses_mcq (
    response_id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    selected_option TEXT NOT NULL CHECK(selected_option IN ('A','B','C','D')),
    is_correct INTEGER NOT NULL DEFAULT 0,
    response_time_seconds REAL,
    answered_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES eept_assessments(assessment_id) ON DELETE CASCADE,
    FOREIGN KEY (question_id) REFERENCES eept_questions(question_id)
);

-- ============================================
-- EEPT WRITING SUBMISSIONS - Candidate writing text
-- ============================================
CREATE TABLE IF NOT EXISTS eept_writing_submissions (
    submission_id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    task_type TEXT NOT NULL CHECK(task_type IN ('task1','task2')),
    prompt_id TEXT NOT NULL,
    text TEXT NOT NULL,
    word_count INTEGER NOT NULL DEFAULT 0,
    paragraph_count INTEGER NOT NULL DEFAULT 0,
    submitted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES eept_assessments(assessment_id) ON DELETE CASCADE,
    FOREIGN KEY (prompt_id) REFERENCES eept_writing_prompts(prompt_id)
);

-- ============================================
-- EEPT WRITING SCORES - Hybrid scoring results
-- ============================================
CREATE TABLE IF NOT EXISTS eept_writing_scores (
    score_id TEXT PRIMARY KEY,
    writing_submission_id TEXT NOT NULL,
    engine_version TEXT NOT NULL DEFAULT 'hybrid-v1.0',
    -- Rule-based scores (Layer 2)
    rule_scores_json TEXT NOT NULL DEFAULT '{}',
    rule_metrics_json TEXT DEFAULT '{}',
    -- LLM scores (Layer 3)
    llm_scores_json TEXT,
    llm_justifications_json TEXT,
    -- Final reconciled scores (Layer 4)
    final_scores_json TEXT NOT NULL DEFAULT '{}',
    raw_total_0_20 REAL,
    scaled_total REAL,
    cefr_estimate TEXT,
    acsf_estimate INTEGER,
    -- Confidence & flags (Layer 5)
    confidence_score INTEGER DEFAULT 100,
    flags_json TEXT DEFAULT '[]',
    needs_human_review INTEGER NOT NULL DEFAULT 0,
    review_reason TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (writing_submission_id) REFERENCES eept_writing_submissions(submission_id) ON DELETE CASCADE
);

-- ============================================
-- EEPT INTEGRITY CHECKS - Plagiarism, AI detection, etc.
-- ============================================
CREATE TABLE IF NOT EXISTS eept_integrity_checks (
    check_id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    writing_submission_id TEXT,
    check_type TEXT NOT NULL CHECK(check_type IN ('plagiarism','ai_generated','tab_switch','time_anomaly')),
    score REAL, -- e.g., similarity %
    details_json TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES eept_assessments(assessment_id) ON DELETE CASCADE
);

-- ============================================
-- EEPT HUMAN REVIEWS - Reviewer overrides
-- ============================================
CREATE TABLE IF NOT EXISTS eept_human_reviews (
    review_id TEXT PRIMARY KEY,
    writing_submission_id TEXT NOT NULL,
    reviewer_user_id TEXT NOT NULL,
    review_reason TEXT NOT NULL CHECK(review_reason IN ('flagged','random_qa','rto_required','appeal')),
    final_domain_scores_json TEXT NOT NULL,
    final_raw_total REAL,
    final_notes TEXT,
    reviewed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (writing_submission_id) REFERENCES eept_writing_submissions(submission_id) ON DELETE CASCADE,
    FOREIGN KEY (reviewer_user_id) REFERENCES users(user_id)
);

-- ============================================
-- EEPT ASSESSMENT RESULTS - Computed final results
-- ============================================
CREATE TABLE IF NOT EXISTS eept_assessment_results (
    assessment_id TEXT PRIMARY KEY,
    grammar_score REAL NOT NULL DEFAULT 0,
    reading_score REAL NOT NULL DEFAULT 0,
    writing_task1_score REAL NOT NULL DEFAULT 0,
    writing_task2_score REAL NOT NULL DEFAULT 0,
    writing_raw_total REAL NOT NULL DEFAULT 0,
    composite_score REAL NOT NULL DEFAULT 0,
    reading_cefr TEXT NOT NULL DEFAULT 'A2',
    writing_cefr TEXT NOT NULL DEFAULT 'A2',
    overall_cefr_pre_floor TEXT NOT NULL DEFAULT 'A2',
    overall_cefr TEXT NOT NULL DEFAULT 'A2',
    ielts_indicative TEXT NOT NULL DEFAULT 'N/A',
    reading_acsf INTEGER NOT NULL DEFAULT 2,
    writing_acsf INTEGER NOT NULL DEFAULT 2,
    skill_floor_applied INTEGER NOT NULL DEFAULT 0,
    skill_floor_reason TEXT,
    integrity_json TEXT DEFAULT '{}',
    benchmark_json TEXT DEFAULT '{}',
    report_id TEXT,
    report_valid_until TEXT,
    scoring_config_version TEXT,
    score_engine_version TEXT DEFAULT 'ebpa-score-v1.0',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES eept_assessments(assessment_id) ON DELETE CASCADE
);

-- ============================================
-- EEPT REPORT FILES - PDF storage pointers
-- ============================================
CREATE TABLE IF NOT EXISTS eept_report_files (
    report_id TEXT PRIMARY KEY,
    assessment_id TEXT NOT NULL,
    candidate_pdf_url TEXT,
    manager_pdf_url TEXT,
    verification_hash TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES eept_assessments(assessment_id) ON DELETE CASCADE
);

-- ============================================
-- EEPT TENANT SETTINGS - Per-tenant configuration
-- ============================================
CREATE TABLE IF NOT EXISTS eept_tenant_settings (
    tenant_id TEXT PRIMARY KEY,
    default_form_id TEXT DEFAULT 'eept-form-1',
    review_mode TEXT NOT NULL DEFAULT 'flagged_only' CHECK(review_mode IN (
        'auto_release','flagged_only','random_qa','always_review'
    )),
    qa_percent INTEGER NOT NULL DEFAULT 10,
    low_confidence_threshold INTEGER NOT NULL DEFAULT 65,
    similarity_review_threshold INTEGER NOT NULL DEFAULT 10,
    similarity_high_threshold INTEGER NOT NULL DEFAULT 25,
    report_validity_days INTEGER NOT NULL DEFAULT 180,
    allow_candidate_report_download INTEGER NOT NULL DEFAULT 1,
    send_results_email INTEGER NOT NULL DEFAULT 1,
    token_expiry_days INTEGER NOT NULL DEFAULT 14,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE
);

-- ============================================
-- EEPT SCORING MAPS - Config-driven scoring tables
-- ============================================
CREATE TABLE IF NOT EXISTS eept_scoring_maps (
    map_id TEXT PRIMARY KEY,
    map_type TEXT NOT NULL CHECK(map_type IN (
        'cefr_cutoffs','ielts_mapping','acsf_mapping',
        'integrity_policy','course_benchmarks','writing_rubric_thresholds'
    )),
    map_json TEXT NOT NULL,
    version TEXT NOT NULL DEFAULT 'v1.0-pilot',
    is_active INTEGER DEFAULT 1,
    tenant_id TEXT, -- NULL = global default, set = tenant override
    updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- EEPT COURSE BENCHMARKS - Per-course admission thresholds
-- ============================================
CREATE TABLE IF NOT EXISTS eept_course_benchmarks (
    benchmark_id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    course_code TEXT NOT NULL,
    course_name TEXT,
    overall_cefr_min TEXT DEFAULT 'B2',
    reading_cefr_min TEXT DEFAULT 'B1',
    writing_cefr_min TEXT DEFAULT 'B2',
    ielts_indicative_min TEXT, -- NULL = not required
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id) ON DELETE CASCADE,
    UNIQUE(tenant_id, course_code)
);

-- ============================================
-- EEPT AUDIT LOG - Immutable event trail
-- ============================================
CREATE TABLE IF NOT EXISTS eept_audit_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenant_id TEXT,
    assessment_id TEXT,
    actor_user_id TEXT,
    actor_type TEXT NOT NULL DEFAULT 'system' CHECK(actor_type IN ('system','user','candidate')),
    event_type TEXT NOT NULL,
    event_data_json TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- EEPT EMAIL LOG - Track sent emails
-- ============================================
CREATE TABLE IF NOT EXISTS eept_email_log (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id TEXT,
    recipient_email TEXT NOT NULL,
    email_type TEXT NOT NULL CHECK(email_type IN ('assessment_issued','reminder','results_ready')),
    status TEXT DEFAULT 'queued' CHECK(status IN ('queued','sent','failed')),
    error_message TEXT,
    sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (assessment_id) REFERENCES eept_assessments(assessment_id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES for EEPT tables
-- ============================================
CREATE INDEX IF NOT EXISTS idx_eept_questions_form ON eept_questions(form_id);
CREATE INDEX IF NOT EXISTS idx_eept_questions_section ON eept_questions(section);
CREATE INDEX IF NOT EXISTS idx_eept_questions_passage ON eept_questions(passage_id);
CREATE INDEX IF NOT EXISTS idx_eept_passages_form ON eept_passages(form_id);
CREATE INDEX IF NOT EXISTS idx_eept_assessments_tenant ON eept_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eept_assessments_status ON eept_assessments(status);
CREATE INDEX IF NOT EXISTS idx_eept_assessments_token ON eept_assessments(token_hash);
CREATE INDEX IF NOT EXISTS idx_eept_assessments_candidate ON eept_assessments(candidate_user_id);
CREATE INDEX IF NOT EXISTS idx_eept_candidates_tenant ON eept_candidates(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eept_candidates_email ON eept_candidates(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_eept_responses_assessment ON eept_responses_mcq(assessment_id);
CREATE INDEX IF NOT EXISTS idx_eept_writing_subs_assessment ON eept_writing_submissions(assessment_id);
CREATE INDEX IF NOT EXISTS idx_eept_writing_scores_sub ON eept_writing_scores(writing_submission_id);
CREATE INDEX IF NOT EXISTS idx_eept_integrity_assessment ON eept_integrity_checks(assessment_id);
CREATE INDEX IF NOT EXISTS idx_eept_reviews_sub ON eept_human_reviews(writing_submission_id);
CREATE INDEX IF NOT EXISTS idx_eept_results_assessment ON eept_assessment_results(assessment_id);
CREATE INDEX IF NOT EXISTS idx_eept_report_files_assessment ON eept_report_files(assessment_id);
CREATE INDEX IF NOT EXISTS idx_eept_audit_assessment ON eept_audit_log(assessment_id);
CREATE INDEX IF NOT EXISTS idx_eept_audit_tenant ON eept_audit_log(tenant_id);
CREATE INDEX IF NOT EXISTS idx_eept_audit_event ON eept_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_eept_scoring_maps_type ON eept_scoring_maps(map_type, is_active);
CREATE INDEX IF NOT EXISTS idx_eept_email_log_assessment ON eept_email_log(assessment_id);
