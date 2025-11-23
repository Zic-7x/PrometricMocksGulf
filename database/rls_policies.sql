-- Mock Exam Portal - Row Level Security (RLS) Policies
-- Run this SQL after creating the schema
-- Enable RLS on all tables and create policies

-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE professions ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_fields ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_authorities ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE import_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- HELPER FUNCTION: Check if user is admin
-- ============================================================================

CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- REFERENCE TABLES POLICIES
-- ============================================================================

-- Professions: Everyone can read, only admins can write
CREATE POLICY "Professions are viewable by everyone"
    ON professions FOR SELECT
    USING (true);

CREATE POLICY "Only admins can insert professions"
    ON professions FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update professions"
    ON professions FOR UPDATE
    USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete professions"
    ON professions FOR DELETE
    USING (is_admin(auth.uid()));

-- Medical Fields: Everyone can read, only admins can write
CREATE POLICY "Medical fields are viewable by everyone"
    ON medical_fields FOR SELECT
    USING (true);

CREATE POLICY "Only admins can insert medical fields"
    ON medical_fields FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update medical fields"
    ON medical_fields FOR UPDATE
    USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete medical fields"
    ON medical_fields FOR DELETE
    USING (is_admin(auth.uid()));

-- Health Authorities: Everyone can read, only admins can write
CREATE POLICY "Health authorities are viewable by everyone"
    ON health_authorities FOR SELECT
    USING (true);

CREATE POLICY "Only admins can insert health authorities"
    ON health_authorities FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update health authorities"
    ON health_authorities FOR UPDATE
    USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete health authorities"
    ON health_authorities FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================

-- Profiles: Users can read their own profile, admins can read all
CREATE POLICY "Users can view their own profile"
    ON profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    USING (is_admin(auth.uid()));

-- Profiles: Users can update their own profile (limited fields), admins can update all
CREATE POLICY "Users can update their own profile (limited)"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (
        auth.uid() = id AND
        -- Users cannot change their own role, payment_status, or assignment fields
        role = (SELECT role FROM profiles WHERE id = auth.uid()) AND
        payment_status = (SELECT payment_status FROM profiles WHERE id = auth.uid()) AND
        profession_id = (SELECT profession_id FROM profiles WHERE id = auth.uid()) AND
        medical_field_id = (SELECT medical_field_id FROM profiles WHERE id = auth.uid()) AND
        health_authority_id = (SELECT health_authority_id FROM profiles WHERE id = auth.uid())
    );

CREATE POLICY "Admins can update all profiles"
    ON profiles FOR UPDATE
    USING (is_admin(auth.uid()));

-- Profiles: Only admins can insert (via service_role in Edge Functions)
CREATE POLICY "Only admins can insert profiles"
    ON profiles FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

-- Profiles: Only admins can delete
CREATE POLICY "Only admins can delete profiles"
    ON profiles FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- QUESTION BANK POLICIES
-- ============================================================================

-- Question Bank: Candidates can only read questions for exams they're assigned to
-- Admins can read all

-- Helper function: Check if candidate has access to question via exam assignment
CREATE OR REPLACE FUNCTION candidate_has_question_access(question_uuid UUID, candidate_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM question_bank qb
        JOIN exam_instances ei ON true -- Question matches exam's scope
        JOIN exam_assignments ea ON ea.exam_instance_id = ei.id
        WHERE qb.id = question_uuid
          AND (
              -- Individual assignment
              (ea.assignment_type = 'individual' AND ea.candidate_id = candidate_uuid) OR
              -- Group assignment matching candidate's profile
              (
                  ea.assignment_type = 'group' AND
                  EXISTS (
                      SELECT 1 FROM profiles p
                      WHERE p.id = candidate_uuid
                        AND p.profession_id = ea.profession_id
                        AND p.medical_field_id = ea.medical_field_id
                        AND p.health_authority_id = ea.health_authority_id
                  )
              )
          )
          AND qb.deleted_at IS NULL
          AND qb.status = 'active'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Question Bank: Candidates can read questions from their assigned exams
CREATE POLICY "Candidates can read questions from assigned exams"
    ON question_bank FOR SELECT
    USING (
        deleted_at IS NULL AND
        (
            is_admin(auth.uid()) OR
            candidate_has_question_access(id, auth.uid())
        )
    );

-- Question Bank: Only admins can write
CREATE POLICY "Only admins can insert questions"
    ON question_bank FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update questions"
    ON question_bank FOR UPDATE
    USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete questions"
    ON question_bank FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- EXAM TEMPLATES POLICIES
-- ============================================================================

-- Exam Templates: Only admins can read/write
CREATE POLICY "Only admins can view exam templates"
    ON exam_templates FOR SELECT
    USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can insert exam templates"
    ON exam_templates FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update exam templates"
    ON exam_templates FOR UPDATE
    USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete exam templates"
    ON exam_templates FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- EXAM INSTANCES POLICIES
-- ============================================================================

-- Helper function: Check if candidate has access to exam instance
CREATE OR REPLACE FUNCTION candidate_has_exam_access(exam_instance_uuid UUID, candidate_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM exam_instances ei
        JOIN exam_assignments ea ON ea.exam_instance_id = ei.id
        WHERE ei.id = exam_instance_uuid
          AND ei.deleted_at IS NULL
          AND ei.status = 'active'
          AND ei.available_from <= NOW()
          AND ei.available_until >= NOW()
          AND (
              -- Individual assignment
              (ea.assignment_type = 'individual' AND ea.candidate_id = candidate_uuid) OR
              -- Group assignment matching candidate's profile
              (
                  ea.assignment_type = 'group' AND
                  EXISTS (
                      SELECT 1 FROM profiles p
                      WHERE p.id = candidate_uuid
                        AND p.profession_id = ea.profession_id
                        AND p.medical_field_id = ea.medical_field_id
                        AND p.health_authority_id = ea.health_authority_id
                        AND p.payment_status = 'paid'
                        AND p.status = 'active'
                        AND p.exam_access_enabled = TRUE
                  )
              )
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Exam Instances: Candidates can read exams they're assigned to, admins can read all
CREATE POLICY "Candidates can read assigned exam instances"
    ON exam_instances FOR SELECT
    USING (
        deleted_at IS NULL AND
        (
            is_admin(auth.uid()) OR
            candidate_has_exam_access(id, auth.uid())
        )
    );

-- Exam Instances: Only admins can write
CREATE POLICY "Only admins can insert exam instances"
    ON exam_instances FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update exam instances"
    ON exam_instances FOR UPDATE
    USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete exam instances"
    ON exam_instances FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- EXAM ASSIGNMENTS POLICIES
-- ============================================================================

-- Exam Assignments: Candidates can read their own assignments, admins can read all
CREATE POLICY "Candidates can read their own exam assignments"
    ON exam_assignments FOR SELECT
    USING (
        is_admin(auth.uid()) OR
        (
            assignment_type = 'individual' AND candidate_id = auth.uid()
        ) OR
        (
            assignment_type = 'group' AND
            EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.id = auth.uid()
                  AND p.profession_id = exam_assignments.profession_id
                  AND p.medical_field_id = exam_assignments.medical_field_id
                  AND p.health_authority_id = exam_assignments.health_authority_id
            )
        )
    );

-- Exam Assignments: Only admins can write
CREATE POLICY "Only admins can insert exam assignments"
    ON exam_assignments FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update exam assignments"
    ON exam_assignments FOR UPDATE
    USING (is_admin(auth.uid()));

CREATE POLICY "Only admins can delete exam assignments"
    ON exam_assignments FOR DELETE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- ATTEMPTS POLICIES
-- ============================================================================

-- Attempts: Candidates can read/write their own attempts, admins can read all
CREATE POLICY "Candidates can read their own attempts"
    ON attempts FOR SELECT
    USING (
        is_admin(auth.uid()) OR
        candidate_id = auth.uid()
    );

CREATE POLICY "Candidates can insert their own attempts"
    ON attempts FOR INSERT
    WITH CHECK (
        is_admin(auth.uid()) OR
        candidate_id = auth.uid()
    );

CREATE POLICY "Candidates can update their own in-progress attempts"
    ON attempts FOR UPDATE
    USING (
        is_admin(auth.uid()) OR
        (
            candidate_id = auth.uid() AND
            status = 'in_progress'
        )
    );

CREATE POLICY "Admins can update all attempts"
    ON attempts FOR UPDATE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- ANSWERS POLICIES
-- ============================================================================

-- Answers: Candidates can read/write answers for their own attempts, admins can read all
CREATE POLICY "Candidates can read answers for their own attempts"
    ON answers FOR SELECT
    USING (
        is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM attempts a
            WHERE a.id = answers.attempt_id
              AND a.candidate_id = auth.uid()
        )
    );

CREATE POLICY "Candidates can insert answers for their own attempts"
    ON answers FOR INSERT
    WITH CHECK (
        is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM attempts a
            WHERE a.id = answers.attempt_id
              AND a.candidate_id = auth.uid()
              AND a.status = 'in_progress'
        )
    );

CREATE POLICY "Candidates can update answers for their own in-progress attempts"
    ON answers FOR UPDATE
    USING (
        is_admin(auth.uid()) OR
        EXISTS (
            SELECT 1 FROM attempts a
            WHERE a.id = answers.attempt_id
              AND a.candidate_id = auth.uid()
              AND a.status = 'in_progress'
        )
    );

CREATE POLICY "Admins can update all answers (for grading)"
    ON answers FOR UPDATE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- AUDIT LOGS POLICIES
-- ============================================================================

-- Audit Logs: Only admins can read
CREATE POLICY "Only admins can view audit logs"
    ON audit_logs FOR SELECT
    USING (is_admin(auth.uid()));

-- Audit Logs: System can insert (via triggers or Edge Functions)
-- Note: In production, use service_role for inserts, not RLS policy
-- This policy allows authenticated users to insert (for Edge Functions)
CREATE POLICY "Authenticated users can insert audit logs"
    ON audit_logs FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================================================
-- IMPORT HISTORY POLICIES
-- ============================================================================

-- Import History: Only admins can read
CREATE POLICY "Only admins can view import history"
    ON import_history FOR SELECT
    USING (is_admin(auth.uid()));

-- Import History: Only admins can insert
CREATE POLICY "Only admins can insert import history"
    ON import_history FOR INSERT
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Only admins can update import history"
    ON import_history FOR UPDATE
    USING (is_admin(auth.uid()));

-- ============================================================================
-- NOTES ON SERVICE_ROLE USAGE
-- ============================================================================

-- IMPORTANT: Some operations require service_role key (bypasses RLS):
-- 1. Creating auth.users entries (must use Admin API)
-- 2. Bulk operations in Edge Functions
-- 3. System-level audit log inserts
-- 4. Admin operations that need to bypass RLS for performance

-- Example Edge Function pattern:
-- const supabaseAdmin = createClient(
--   Deno.env.get('SUPABASE_URL')!,
--   Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
-- );
-- // This client bypasses RLS

-- ============================================================================
-- TESTING RLS POLICIES
-- ============================================================================

-- To test RLS policies:
-- 1. Create test admin user
-- 2. Create test candidate user
-- 3. As candidate, try to SELECT from exam_instances (should only see assigned)
-- 4. As candidate, try to INSERT into question_bank (should fail)
-- 5. As admin, try to SELECT all exam_instances (should succeed)
-- 6. As candidate, try to access another candidate's attempt (should fail)

-- Example test query (run as candidate):
-- SELECT * FROM exam_instances; -- Should only return assigned exams

-- Example test query (run as admin):
-- SELECT * FROM exam_instances; -- Should return all exams

