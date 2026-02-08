-- Migration: Add AQF3 scoring fields
-- Run against llnd-core-db

-- Add new columns to questions table
ALTER TABLE questions ADD COLUMN response_type TEXT DEFAULT 'mcq';
ALTER TABLE questions ADD COLUMN max_score REAL DEFAULT 1.0;
ALTER TABLE questions ADD COLUMN difficulty_tag TEXT DEFAULT 'core';
ALTER TABLE questions ADD COLUMN context_table TEXT;

-- Add new columns to assessment_attempts table
ALTER TABLE assessment_attempts ADD COLUMN report_json TEXT;
ALTER TABLE assessment_attempts ADD COLUMN benchmark_version TEXT DEFAULT 'AQF3_V1';
ALTER TABLE assessment_attempts ADD COLUMN overall_outcome TEXT;

-- Add new columns to domain_scores table (recreate since structure changed significantly)
ALTER TABLE domain_scores ADD COLUMN raw_score REAL DEFAULT 0;
ALTER TABLE domain_scores ADD COLUMN max_score REAL DEFAULT 0;
ALTER TABLE domain_scores ADD COLUMN acsf2_percent REAL DEFAULT 0;
ALTER TABLE domain_scores ADD COLUMN acsf3_core_percent REAL DEFAULT 0;
ALTER TABLE domain_scores ADD COLUMN acsf3_stretch_percent REAL DEFAULT 0;
ALTER TABLE domain_scores ADD COLUMN estimated_acsf_band TEXT;
ALTER TABLE domain_scores ADD COLUMN strategies TEXT;

-- Rename domain_scores columns to match new schema
-- Note: SQLite doesn't support RENAME COLUMN in older versions, but D1 should support it
