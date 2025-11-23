-- Mock Exam Portal - Seed Data
-- Run this after creating schema and RLS policies

-- ============================================================================
-- REFERENCE DATA
-- ============================================================================

-- Professions
INSERT INTO professions (code, name, description) VALUES
  ('PHARMACIST', 'Pharmacist', 'Licensed pharmacist'),
  ('NURSE', 'Nurse', 'Registered nurse'),
  ('DOCTOR', 'Doctor', 'Medical doctor'),
  ('PHARMACY_TECH', 'Pharmacy Technician', 'Pharmacy technician');

-- Medical Fields
INSERT INTO medical_fields (code, name, description) VALUES
  ('CLINICAL_PHARMACY', 'Clinical Pharmacy', 'Clinical pharmacy practice'),
  ('EMERGENCY_MEDICINE', 'Emergency Medicine', 'Emergency medicine practice'),
  ('CARDIOLOGY', 'Cardiology', 'Cardiology practice'),
  ('PEDIATRICS', 'Pediatrics', 'Pediatric medicine');

-- Health Authorities
INSERT INTO health_authorities (code, name, country, description) VALUES
  ('DHA', 'Dubai Health Authority', 'UAE', 'Dubai Health Authority licensing'),
  ('HAAD', 'Health Authority Abu Dhabi', 'UAE', 'Health Authority Abu Dhabi licensing'),
  ('MOH_QATAR', 'Ministry of Health Qatar', 'Qatar', 'Ministry of Health Qatar licensing'),
  ('MOH_UAE', 'Ministry of Health UAE', 'UAE', 'Ministry of Health UAE licensing');

-- ============================================================================
-- ADMIN USER
-- ============================================================================

-- Note: In production, create admin user via Supabase Auth UI or Edge Function
-- This is a template - you'll need to:
-- 1. Create user in Supabase Auth (Dashboard > Authentication > Users)
-- 2. Get the user ID
-- 3. Insert profile with that ID

-- Example SQL (replace USER_ID with actual UUID from auth.users):
/*
INSERT INTO profiles (
  id,
  email,
  full_name,
  role,
  status,
  exam_access_enabled
) VALUES (
  'USER_ID_FROM_AUTH', -- Replace with actual UUID
  'admin@example.com',
  'Admin User',
  'admin',
  'active',
  true
);
*/

-- ============================================================================
-- SAMPLE QUESTIONS
-- ============================================================================

-- Get IDs for references
DO $$
DECLARE
  v_pharmacist_id UUID;
  v_clinical_pharmacy_id UUID;
  v_dha_id UUID;
BEGIN
  SELECT id INTO v_pharmacist_id FROM professions WHERE code = 'PHARMACIST';
  SELECT id INTO v_clinical_pharmacy_id FROM medical_fields WHERE code = 'CLINICAL_PHARMACY';
  SELECT id INTO v_dha_id FROM health_authorities WHERE code = 'DHA';

  -- MCQ Single Select
  INSERT INTO question_bank (
    statement,
    type,
    choices_json,
    correct_answer_json,
    explanation,
    profession_id,
    medical_field_id,
    health_authority_id,
    topic,
    difficulty,
    tags,
    points,
    status
  ) VALUES
  (
    'What is the primary mechanism of action of metformin?',
    'mcq_single',
    '{"A": "Increases insulin secretion", "B": "Decreases hepatic glucose production", "C": "Increases glucose uptake in muscles", "D": "Inhibits alpha-glucosidase"}'::jsonb,
    '["B"]'::jsonb,
    'Metformin primarily works by decreasing hepatic glucose production and increasing peripheral glucose uptake.',
    v_pharmacist_id,
    v_clinical_pharmacy_id,
    v_dha_id,
    'Pharmacology',
    'medium',
    ARRAY['diabetes', 'metformin', 'mechanism'],
    1.0,
    'active'
  ),
  (
    'Which medication is contraindicated in pregnancy due to teratogenic effects?',
    'mcq_single',
    '{"A": "Folic acid", "B": "Warfarin", "C": "Insulin", "D": "Metformin"}'::jsonb,
    '["B"]'::jsonb,
    'Warfarin is a Category X medication and is contraindicated in pregnancy due to teratogenic effects.',
    v_pharmacist_id,
    v_clinical_pharmacy_id,
    v_dha_id,
    'Clinical Pharmacy',
    'hard',
    ARRAY['pregnancy', 'warfarin', 'contraindications'],
    1.0,
    'active'
  ),
  (
    'What is the recommended first-line treatment for uncomplicated hypertension?',
    'mcq_single',
    '{"A": "Beta-blockers", "B": "ACE inhibitors", "C": "Calcium channel blockers", "D": "Diuretics"}'::jsonb,
    '["B"]'::jsonb,
    'ACE inhibitors are recommended as first-line treatment for uncomplicated hypertension.',
    v_pharmacist_id,
    v_clinical_pharmacy_id,
    v_dha_id,
    'Clinical Pharmacy',
    'medium',
    ARRAY['hypertension', 'treatment', 'guidelines'],
    1.0,
    'active'
  );

  -- MCQ Multi Select
  INSERT INTO question_bank (
    statement,
    type,
    choices_json,
    correct_answer_json,
    explanation,
    profession_id,
    medical_field_id,
    health_authority_id,
    topic,
    difficulty,
    tags,
    points,
    negative_marking,
    status
  ) VALUES
  (
    'Which of the following are beta-blockers? (Select all that apply)',
    'mcq_multi',
    '{"A": "Metoprolol", "B": "Atenolol", "C": "Lisinopril", "D": "Propranolol"}'::jsonb,
    '["A", "B", "D"]'::jsonb,
    'Metoprolol, Atenolol, and Propranolol are beta-blockers. Lisinopril is an ACE inhibitor.',
    v_pharmacist_id,
    v_clinical_pharmacy_id,
    v_dha_id,
    'Pharmacology',
    'medium',
    ARRAY['beta-blockers', 'cardiovascular'],
    2.0,
    0.5,
    'active'
  );

  -- True/False
  INSERT INTO question_bank (
    statement,
    type,
    correct_answer_json,
    explanation,
    profession_id,
    medical_field_id,
    health_authority_id,
    topic,
    difficulty,
    tags,
    points,
    status
  ) VALUES
  (
    'Aspirin should be avoided in children with viral infections due to the risk of Reye''s syndrome.',
    'true_false',
    '["true"]'::jsonb,
    'Aspirin is contraindicated in children with viral infections due to the risk of Reye''s syndrome, a rare but serious condition.',
    v_pharmacist_id,
    v_clinical_pharmacy_id,
    v_dha_id,
    'Clinical Pharmacy',
    'easy',
    ARRAY['aspirin', 'pediatrics', 'safety'],
    1.0,
    'active'
  ),
  (
    'All antibiotics require a prescription in the UAE.',
    'true_false',
    '["true"]'::jsonb,
    'In the UAE, all antibiotics require a prescription from a licensed healthcare provider.',
    v_pharmacist_id,
    v_clinical_pharmacy_id,
    v_dha_id,
    'Regulations',
    'easy',
    ARRAY['antibiotics', 'regulations', 'UAE'],
    1.0,
    'active'
  );

  -- Short Text
  INSERT INTO question_bank (
    statement,
    type,
    correct_answer_json,
    explanation,
    profession_id,
    medical_field_id,
    health_authority_id,
    topic,
    difficulty,
    tags,
    points,
    status
  ) VALUES
  (
    'What is the recommended first-line treatment for uncomplicated hypertension in patients without comorbidities?',
    'short_text',
    '["ACE inhibitor", "ACE inhibitors", "Angiotensin-converting enzyme inhibitor"]'::jsonb,
    'ACE inhibitors are recommended as first-line treatment for uncomplicated hypertension in patients without comorbidities.',
    v_pharmacist_id,
    v_clinical_pharmacy_id,
    v_dha_id,
    'Clinical Pharmacy',
    'medium',
    ARRAY['hypertension', 'treatment', 'guidelines'],
    2.0,
    'active'
  );

END $$;

-- ============================================================================
-- SAMPLE EXAM TEMPLATE
-- ============================================================================

DO $$
DECLARE
  v_pharmacist_id UUID;
  v_clinical_pharmacy_id UUID;
  v_dha_id UUID;
  v_template_id UUID;
BEGIN
  SELECT id INTO v_pharmacist_id FROM professions WHERE code = 'PHARMACIST';
  SELECT id INTO v_clinical_pharmacy_id FROM medical_fields WHERE code = 'CLINICAL_PHARMACY';
  SELECT id INTO v_dha_id FROM health_authorities WHERE code = 'DHA';

  -- Create exam template
  INSERT INTO exam_templates (
    name,
    description,
    question_selection_rules,
    total_questions,
    time_limit_seconds,
    per_question_time_limit_seconds,
    shuffle_questions,
    shuffle_choices,
    allow_review,
    allow_navigation,
    show_explanation_after,
    negative_marking_enabled,
    passing_score_percent,
    status
  ) VALUES (
    'DHA Pharmacist Clinical Pharmacy Mock Exam',
    'Mock exam for DHA Pharmacist Clinical Pharmacy licensing',
    '[
      {"topic": "Pharmacology", "difficulty": "medium", "count": 10},
      {"topic": "Clinical Pharmacy", "difficulty": "medium", "count": 10},
      {"topic": "Clinical Pharmacy", "difficulty": "hard", "count": 5}
    ]'::jsonb,
    25,
    3600, -- 60 minutes
    120, -- 2 minutes per question
    true,
    true,
    true,
    true,
    true,
    false,
    60.0,
    'active'
  ) RETURNING id INTO v_template_id;

  -- Create exam instance
  INSERT INTO exam_instances (
    template_id,
    name,
    description,
    available_from,
    available_until,
    template_version,
    status
  ) VALUES (
    v_template_id,
    'DHA Pharmacist Clinical Pharmacy Mock Exam - January 2024',
    'Mock exam available for practice',
    NOW() - INTERVAL '1 day',
    NOW() + INTERVAL '30 days',
    1,
    'active'
  );

END $$;

-- ============================================================================
-- NOTES
-- ============================================================================

-- To create admin user:
-- 1. Go to Supabase Dashboard > Authentication > Users
-- 2. Click "Add user" > "Create new user"
-- 3. Enter email: admin@example.com
-- 4. Set password: Admin123!@#
-- 5. Copy the user ID
-- 6. Run:
--    INSERT INTO profiles (id, email, full_name, role, status, exam_access_enabled)
--    VALUES ('PASTE_USER_ID_HERE', 'admin@example.com', 'Admin User', 'admin', 'active', true);

-- To create test candidate:
-- 1. Use the bulk-create-users Edge Function
-- 2. Or create manually via Supabase Auth UI and insert profile

-- Verify seed data:
-- SELECT COUNT(*) FROM professions; -- Should be 4
-- SELECT COUNT(*) FROM medical_fields; -- Should be 4
-- SELECT COUNT(*) FROM health_authorities; -- Should be 4
-- SELECT COUNT(*) FROM question_bank; -- Should be 6+
-- SELECT COUNT(*) FROM exam_templates; -- Should be 1+

