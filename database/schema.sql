-- Mock Exam Portal - Complete Database Schema
-- Run this SQL in Supabase SQL Editor or via migration

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for password hashing (if needed)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- REFERENCE TABLES
-- ============================================================================

-- Professions (e.g., Pharmacist, Nurse, Doctor)
CREATE TABLE professions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Medical Fields (e.g., Clinical Pharmacy, Emergency Medicine)
CREATE TABLE medical_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health Authorities (e.g., DHA, HAAD, MOH Qatar)
CREATE TABLE health_authorities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    country VARCHAR(100),
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- USER MANAGEMENT
-- ============================================================================

-- User profiles (extends Supabase auth.users)
-- Note: auth.users is managed by Supabase Auth
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'candidate' CHECK (role IN ('admin', 'candidate')),
    
    -- Candidate-specific fields
    profession_id UUID REFERENCES professions(id),
    medical_field_id UUID REFERENCES medical_fields(id),
    health_authority_id UUID REFERENCES health_authorities(id),
    payment_status VARCHAR(20) DEFAULT 'unpaid' CHECK (payment_status IN ('paid', 'unpaid', 'pending')),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
    exam_access_enabled BOOLEAN DEFAULT TRUE,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    
    -- Ensure candidates have required fields
    CONSTRAINT candidate_fields_check CHECK (
        role != 'candidate' OR (
            profession_id IS NOT NULL AND
            medical_field_id IS NOT NULL AND
            health_authority_id IS NOT NULL
        )
    )
);

-- Indexes for profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_profession ON profiles(profession_id);
CREATE INDEX idx_profiles_medical_field ON profiles(medical_field_id);
CREATE INDEX idx_profiles_health_authority ON profiles(health_authority_id);
CREATE INDEX idx_profiles_payment_status ON profiles(payment_status);
CREATE INDEX idx_profiles_status ON profiles(status);

-- ============================================================================
-- QUESTION BANK
-- ============================================================================

-- Question Bank
CREATE TABLE question_bank (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Question content
    statement TEXT NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('mcq_single', 'mcq_multi', 'true_false', 'short_text', 'image_based')),
    
    -- Choices (JSONB for MCQ types)
    -- Format: {"A": "Option A text", "B": "Option B text", ...}
    choices_json JSONB,
    
    -- Correct answer(s) (JSONB)
    -- Format for MCQ single: ["A"]
    -- Format for MCQ multi: ["A", "C"]
    -- Format for True/False: ["true"] or ["false"]
    -- Format for short_text: ["expected answer 1", "expected answer 2"] (multiple acceptable)
    -- Format for image_based: ["answer text"] or null if manual only
    correct_answer_json JSONB,
    
    -- Explanation shown after exam (optional)
    explanation TEXT,
    
    -- Metadata
    profession_id UUID REFERENCES professions(id),
    medical_field_id UUID REFERENCES medical_fields(id),
    health_authority_id UUID REFERENCES health_authorities(id),
    topic VARCHAR(255),
    difficulty VARCHAR(20) DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    tags TEXT[], -- Array of tags
    source VARCHAR(255),
    
    -- Scoring
    points DECIMAL(5,2) DEFAULT 1.0,
    negative_marking DECIMAL(5,2) DEFAULT 0.0, -- Points deducted for wrong answer
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_question_id UUID REFERENCES question_bank(id), -- For versioning
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for question_bank
CREATE INDEX idx_question_bank_type ON question_bank(type);
CREATE INDEX idx_question_bank_profession ON question_bank(profession_id);
CREATE INDEX idx_question_bank_medical_field ON question_bank(medical_field_id);
CREATE INDEX idx_question_bank_health_authority ON question_bank(health_authority_id);
CREATE INDEX idx_question_bank_topic ON question_bank(topic);
CREATE INDEX idx_question_bank_difficulty ON question_bank(difficulty);
CREATE INDEX idx_question_bank_status ON question_bank(status);
CREATE INDEX idx_question_bank_deleted ON question_bank(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_question_bank_composite ON question_bank(profession_id, medical_field_id, health_authority_id, topic, difficulty, status) WHERE deleted_at IS NULL;

-- GIN index for JSONB and array searches
CREATE INDEX idx_question_bank_choices ON question_bank USING GIN(choices_json);
CREATE INDEX idx_question_bank_tags ON question_bank USING GIN(tags);

-- ============================================================================
-- EXAM TEMPLATES
-- ============================================================================

-- Exam Templates (defines exam structure)
CREATE TABLE exam_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Question selection rules (JSONB)
    -- Format: [
    --   {"topic": "Pharmacology", "difficulty": "medium", "count": 30},
    --   {"topic": "Clinical", "difficulty": "hard", "count": 30}
    -- ]
    question_selection_rules JSONB NOT NULL,
    
    -- Total questions (sum of all rules)
    total_questions INTEGER NOT NULL,
    
    -- Time limits (in seconds)
    time_limit_seconds INTEGER, -- Overall exam time limit (null = no limit)
    per_question_time_limit_seconds INTEGER, -- Per question limit (null = no limit)
    
    -- Exam settings
    shuffle_questions BOOLEAN DEFAULT TRUE,
    shuffle_choices BOOLEAN DEFAULT TRUE,
    allow_review BOOLEAN DEFAULT TRUE,
    allow_navigation BOOLEAN DEFAULT TRUE, -- If false, single-mode (no back button)
    show_explanation_after BOOLEAN DEFAULT FALSE,
    negative_marking_enabled BOOLEAN DEFAULT FALSE,
    
    -- Passing criteria
    passing_score_percent DECIMAL(5,2) DEFAULT 60.0,
    
    -- Versioning
    version INTEGER DEFAULT 1,
    parent_template_id UUID REFERENCES exam_templates(id),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'draft')),
    deleted_at TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for exam_templates
CREATE INDEX idx_exam_templates_status ON exam_templates(status);
CREATE INDEX idx_exam_templates_deleted ON exam_templates(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- EXAM INSTANCES & ASSIGNMENTS
-- ============================================================================

-- Exam Instances (specific exam assignments)
CREATE TABLE exam_instances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES exam_templates(id),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Availability window
    available_from TIMESTAMPTZ NOT NULL,
    available_until TIMESTAMPTZ NOT NULL,
    
    -- Versioning (snapshot of template at creation)
    template_version INTEGER NOT NULL,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'scheduled')),
    deleted_at TIMESTAMPTZ,
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for exam_instances
CREATE INDEX idx_exam_instances_template ON exam_instances(template_id);
CREATE INDEX idx_exam_instances_availability ON exam_instances(available_from, available_until);
CREATE INDEX idx_exam_instances_status ON exam_instances(status);
CREATE INDEX idx_exam_instances_deleted ON exam_instances(deleted_at) WHERE deleted_at IS NULL;

-- Exam Assignments (links exams to candidates or groups)
CREATE TABLE exam_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_instance_id UUID NOT NULL REFERENCES exam_instances(id) ON DELETE CASCADE,
    
    -- Assignment type: 'individual' or 'group'
    assignment_type VARCHAR(20) NOT NULL CHECK (assignment_type IN ('individual', 'group')),
    
    -- Individual assignment (if assignment_type = 'individual')
    candidate_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Group assignment (if assignment_type = 'group')
    profession_id UUID REFERENCES professions(id),
    medical_field_id UUID REFERENCES medical_fields(id),
    health_authority_id UUID REFERENCES health_authorities(id),
    
    -- Ensure either candidate_id or group fields are set
    CONSTRAINT assignment_check CHECK (
        (assignment_type = 'individual' AND candidate_id IS NOT NULL) OR
        (assignment_type = 'group' AND profession_id IS NOT NULL AND medical_field_id IS NOT NULL AND health_authority_id IS NOT NULL)
    ),
    
    -- Metadata
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for exam_assignments
CREATE INDEX idx_exam_assignments_exam ON exam_assignments(exam_instance_id);
CREATE INDEX idx_exam_assignments_candidate ON exam_assignments(candidate_id) WHERE candidate_id IS NOT NULL;
CREATE INDEX idx_exam_assignments_group ON exam_assignments(profession_id, medical_field_id, health_authority_id) WHERE assignment_type = 'group';
CREATE INDEX idx_exam_assignments_type ON exam_assignments(assignment_type);

-- ============================================================================
-- EXAM ATTEMPTS & ANSWERS
-- ============================================================================

-- Exam Attempts
CREATE TABLE attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_instance_id UUID NOT NULL REFERENCES exam_instances(id),
    candidate_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Selected questions (JSONB array of question IDs in order)
    -- Format: ["question_id_1", "question_id_2", ...]
    selected_question_ids JSONB NOT NULL,
    
    -- Timing
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    time_spent_seconds INTEGER, -- Calculated on submission
    
    -- Scoring
    auto_score DECIMAL(10,2), -- Score from auto-graded questions
    manual_score DECIMAL(10,2), -- Score from manually graded questions
    total_score DECIMAL(10,2), -- Final score (auto + manual)
    max_possible_score DECIMAL(10,2), -- Total points possible
    score_percent DECIMAL(5,2), -- Percentage score
    
    -- Status
    status VARCHAR(20) DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'submitted', 'graded', 'released')),
    
    -- Flags
    has_subjective_questions BOOLEAN DEFAULT FALSE,
    requires_manual_grading BOOLEAN DEFAULT FALSE,
    manual_grading_completed BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for attempts
CREATE INDEX idx_attempts_exam ON attempts(exam_instance_id);
CREATE INDEX idx_attempts_candidate ON attempts(candidate_id);
CREATE INDEX idx_attempts_status ON attempts(status);
CREATE INDEX idx_attempts_started ON attempts(started_at);
CREATE INDEX idx_attempts_submitted ON attempts(submitted_at);
CREATE INDEX idx_attempts_requires_grading ON attempts(requires_manual_grading, manual_grading_completed) WHERE requires_manual_grading = TRUE;

-- Answers (individual question responses)
CREATE TABLE answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attempt_id UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES question_bank(id),
    
    -- Answer content (JSONB)
    -- Format for MCQ: ["A"] or ["A", "C"]
    -- Format for True/False: ["true"] or ["false"]
    -- Format for short_text: "answer text"
    -- Format for image_based: "answer text" or null
    answer_json JSONB,
    
    -- Text answer (for short_text and image_based)
    answer_text TEXT,
    
    -- Scoring
    is_correct BOOLEAN, -- For auto-graded questions
    points_awarded DECIMAL(5,2) DEFAULT 0,
    points_deducted DECIMAL(5,2) DEFAULT 0, -- For negative marking
    
    -- Manual grading
    manually_graded BOOLEAN DEFAULT FALSE,
    graded_by UUID REFERENCES auth.users(id),
    graded_at TIMESTAMPTZ,
    grading_notes TEXT,
    
    -- Timing
    time_spent_seconds INTEGER,
    answered_at TIMESTAMPTZ,
    
    -- Review flag
    marked_for_review BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one answer per question per attempt
    UNIQUE(attempt_id, question_id)
);

-- Indexes for answers
CREATE INDEX idx_answers_attempt ON answers(attempt_id);
CREATE INDEX idx_answers_question ON answers(question_id);
CREATE INDEX idx_answers_manually_graded ON answers(manually_graded, graded_by) WHERE manually_graded = TRUE;
CREATE INDEX idx_answers_is_correct ON answers(is_correct);

-- ============================================================================
-- AUDIT & LOGGING
-- ============================================================================

-- Audit Log (admin actions)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id),
    action VARCHAR(100) NOT NULL, -- e.g., 'create_user', 'update_exam', 'grade_answer'
    resource_type VARCHAR(50), -- e.g., 'user', 'exam', 'question'
    resource_id UUID,
    details JSONB, -- Additional context
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for audit_logs
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at);

-- Import History (track CSV imports)
CREATE TABLE import_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_type VARCHAR(50) NOT NULL CHECK (import_type IN ('candidates', 'questions')),
    imported_by UUID NOT NULL REFERENCES auth.users(id),
    file_name VARCHAR(255),
    total_rows INTEGER,
    successful_rows INTEGER,
    failed_rows INTEGER,
    error_report JSONB, -- Array of error objects
    status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Indexes for import_history
CREATE INDEX idx_import_history_type ON import_history(import_type);
CREATE INDEX idx_import_history_user ON import_history(imported_by);
CREATE INDEX idx_import_history_status ON import_history(status);
CREATE INDEX idx_import_history_created ON import_history(created_at);

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_question_bank_updated_at BEFORE UPDATE ON question_bank
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_templates_updated_at BEFORE UPDATE ON exam_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_exam_instances_updated_at BEFORE UPDATE ON exam_instances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_attempts_updated_at BEFORE UPDATE ON attempts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_answers_updated_at BEFORE UPDATE ON answers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate attempt score
CREATE OR REPLACE FUNCTION calculate_attempt_score(attempt_uuid UUID)
RETURNS VOID AS $$
DECLARE
    v_auto_score DECIMAL(10,2);
    v_manual_score DECIMAL(10,2);
    v_total_score DECIMAL(10,2);
    v_max_score DECIMAL(10,2);
    v_score_percent DECIMAL(5,2);
BEGIN
    -- Calculate auto score (from auto-graded questions)
    SELECT COALESCE(SUM(points_awarded - points_deducted), 0)
    INTO v_auto_score
    FROM answers
    WHERE attempt_id = attempt_uuid
      AND manually_graded = FALSE
      AND is_correct IS NOT NULL;
    
    -- Calculate manual score (from manually graded questions)
    SELECT COALESCE(SUM(points_awarded - points_deducted), 0)
    INTO v_manual_score
    FROM answers
    WHERE attempt_id = attempt_uuid
      AND manually_graded = TRUE;
    
    -- Calculate max possible score
    SELECT COALESCE(SUM(qb.points), 0)
    INTO v_max_score
    FROM attempts a
    JOIN question_bank qb ON qb.id::text = ANY(
        SELECT jsonb_array_elements_text(a.selected_question_ids)
    )
    WHERE a.id = attempt_uuid;
    
    -- Calculate totals
    v_total_score := COALESCE(v_auto_score, 0) + COALESCE(v_manual_score, 0);
    
    IF v_max_score > 0 THEN
        v_score_percent := (v_total_score / v_max_score) * 100;
    ELSE
        v_score_percent := 0;
    END IF;
    
    -- Update attempt
    UPDATE attempts
    SET auto_score = v_auto_score,
        manual_score = v_manual_score,
        total_score = v_total_score,
        max_possible_score = v_max_score,
        score_percent = v_score_percent
    WHERE id = attempt_uuid;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users. Contains role, profession, and payment status.';
COMMENT ON TABLE question_bank IS 'Question bank with support for multiple question types and versioning.';
COMMENT ON TABLE exam_templates IS 'Exam templates defining structure, time limits, and question selection rules.';
COMMENT ON TABLE exam_instances IS 'Specific exam instances with availability windows.';
COMMENT ON TABLE exam_assignments IS 'Links exam instances to candidates (individual) or groups (profession/field/authority).';
COMMENT ON TABLE attempts IS 'Candidate exam attempts with timing and scoring information.';
COMMENT ON TABLE answers IS 'Individual question responses within an attempt.';
COMMENT ON TABLE audit_logs IS 'Audit trail for admin actions.';
COMMENT ON TABLE import_history IS 'History of CSV imports for candidates and questions.';

