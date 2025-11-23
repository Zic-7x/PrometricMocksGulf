# Quick Reference Guide

## Common SQL Queries

### Get All Unpaid Candidates
```sql
SELECT p.*, pr.name as profession, mf.name as medical_field, ha.name as health_authority
FROM profiles p
LEFT JOIN professions pr ON p.profession_id = pr.id
LEFT JOIN medical_fields mf ON p.medical_field_id = mf.id
LEFT JOIN health_authorities ha ON p.health_authority_id = ha.id
WHERE p.role = 'candidate' AND p.payment_status = 'unpaid'
ORDER BY p.created_at DESC;
```

### Create Exam Instance for DHA Pharmacists
```sql
-- First, get the template ID
SELECT id FROM exam_templates WHERE name = 'DHA Pharmacist Clinical Pharmacy Mock Exam';

-- Then create instance (replace TEMPLATE_ID)
INSERT INTO exam_instances (
  template_id,
  name,
  description,
  available_from,
  available_until,
  template_version,
  status
) VALUES (
  'TEMPLATE_ID',
  'DHA Pharmacist Exam - February 2024',
  'Mock exam for DHA Pharmacist Clinical Pharmacy',
  NOW(),
  NOW() + INTERVAL '30 days',
  1,
  'active'
) RETURNING id;

-- Then assign to group (replace EXAM_INSTANCE_ID and reference IDs)
INSERT INTO exam_assignments (
  exam_instance_id,
  assignment_type,
  profession_id,
  medical_field_id,
  health_authority_id
) VALUES (
  'EXAM_INSTANCE_ID',
  'group',
  (SELECT id FROM professions WHERE code = 'PHARMACIST'),
  (SELECT id FROM medical_fields WHERE code = 'CLINICAL_PHARMACY'),
  (SELECT id FROM health_authorities WHERE code = 'DHA')
);
```

### Get Candidate Attempt History
```sql
SELECT 
  a.id,
  a.started_at,
  a.submitted_at,
  a.status,
  a.score_percent,
  ei.name as exam_name,
  et.name as template_name
FROM attempts a
JOIN exam_instances ei ON a.exam_instance_id = ei.id
JOIN exam_templates et ON ei.template_id = et.id
WHERE a.candidate_id = 'CANDIDATE_USER_ID'
ORDER BY a.started_at DESC;
```

### Get Questions Requiring Manual Grading
```sql
SELECT 
  a.id as answer_id,
  a.attempt_id,
  qb.statement,
  qb.type,
  a.answer_text,
  p.full_name as candidate_name,
  ei.name as exam_name
FROM answers a
JOIN question_bank qb ON a.question_id = qb.id
JOIN attempts att ON a.attempt_id = att.id
JOIN profiles p ON att.candidate_id = p.id
JOIN exam_instances ei ON att.exam_instance_id = ei.id
WHERE a.manually_graded = FALSE
  AND qb.type IN ('short_text', 'image_based')
  AND att.status = 'submitted'
ORDER BY att.submitted_at DESC;
```

### Calculate Pass Rate by Health Authority
```sql
SELECT 
  ha.name as health_authority,
  COUNT(*) as total_attempts,
  COUNT(*) FILTER (WHERE a.score_percent >= et.passing_score_percent) as passed,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE a.score_percent >= et.passing_score_percent) / COUNT(*),
    2
  ) as pass_rate_percent
FROM attempts a
JOIN exam_instances ei ON a.exam_instance_id = ei.id
JOIN exam_templates et ON ei.template_id = et.id
JOIN profiles p ON a.candidate_id = p.id
JOIN health_authorities ha ON p.health_authority_id = ha.id
WHERE a.status = 'released'
GROUP BY ha.id, ha.name
ORDER BY pass_rate_percent DESC;
```

## Common API Calls

### Create Candidate (Edge Function)
```typescript
const { data, error } = await supabase.functions.invoke('bulk-create-users', {
  body: {
    candidates: [{
      email: 'newcandidate@example.com',
      full_name: 'New Candidate',
      profession: 'PHARMACIST',
      medical_field: 'CLINICAL_PHARMACY',
      health_authority: 'DHA',
      payment_status: 'unpaid'
    }],
    send_invites: false
  }
});
```

### Send Invite Email
```typescript
const { data, error } = await supabase.functions.invoke('send-invite-email', {
  body: {
    email: 'candidate@example.com',
    reset_password: false
  }
});
```

### Import Questions (Edge Function)
```typescript
// First, read CSV file
const csvData = await file.text();

const { data, error } = await supabase.functions.invoke('import-questions', {
  body: {
    csv_data: csvData,
    file_name: 'questions.csv'
  }
});
```

### Start Exam (API Route)
```typescript
const response = await fetch(`/api/exams/${examInstanceId}/start`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
});

const { attempt_id, questions, time_limit_seconds } = await response.json();
```

### Save Answer (Auto-save)
```typescript
const { error } = await supabase
  .from('answers')
  .upsert({
    attempt_id: attemptId,
    question_id: questionId,
    answer_json: ['A'], // or ['A', 'C'] for multi-select
    answer_text: null, // for short_text type
    marked_for_review: false,
    time_spent_seconds: 45,
    answered_at: new Date().toISOString(),
  });
```

### Submit Exam
```typescript
const { error } = await supabase
  .from('attempts')
  .update({
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    time_spent_seconds: totalTimeSpent,
  })
  .eq('id', attemptId);
```

### Grade Subjective Answer (Edge Function)
```typescript
const { data, error } = await supabase.functions.invoke('manual-scoring', {
  body: {
    answer_id: answerId,
    points_awarded: 1.5,
    grading_notes: 'Good answer, minor grammar issues'
  }
});
```

## RLS Policy Testing

### Test as Candidate
```sql
-- Set role to authenticated user
SET ROLE authenticated;

-- Try to read all exam instances (should only see assigned)
SELECT * FROM exam_instances;

-- Try to read all questions (should only see from assigned exams)
SELECT * FROM question_bank;

-- Try to insert a question (should fail)
INSERT INTO question_bank (statement, type, correct_answer_json) 
VALUES ('Test', 'mcq_single', '["A"]'::jsonb);
-- Expected: Error - violates RLS policy
```

### Test as Admin
```sql
-- Use service role (in Edge Function or API route)
-- Or test with admin user
SELECT * FROM exam_instances; -- Should see all
SELECT * FROM question_bank; -- Should see all
```

## Common Issues & Solutions

### Issue: "new row violates row-level security policy"

**Solution**:
1. Check user role: `SELECT role FROM profiles WHERE id = auth.uid();`
2. Verify RLS is enabled: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';`
3. Check policy conditions match your use case
4. Use service_role for admin operations

### Issue: Candidate cannot see assigned exam

**Solution**:
1. Verify exam_assignment exists:
   ```sql
   SELECT * FROM exam_assignments 
   WHERE exam_instance_id = 'EXAM_ID' 
   AND (
     (assignment_type = 'individual' AND candidate_id = 'USER_ID') OR
     (assignment_type = 'group' AND ...)
   );
   ```
2. Check payment status: `SELECT payment_status FROM profiles WHERE id = 'USER_ID';`
3. Check availability window: `SELECT available_from, available_until FROM exam_instances WHERE id = 'EXAM_ID';`

### Issue: Auto-save not working

**Solution**:
1. Check network tab for errors
2. Verify attempt status is 'in_progress'
3. Check RLS policy allows update:
   ```sql
   SELECT * FROM answers WHERE attempt_id = 'ATTEMPT_ID';
   ```
4. Verify user owns the attempt

### Issue: CSV import fails

**Solution**:
1. Check CSV format matches template
2. Verify reference codes exist (profession, field, authority)
3. Check Edge Function logs in Supabase Dashboard
4. Review error_report in import_history table

## Environment Variables Checklist

### Required for Frontend (Vercel)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Required for Backend (Vercel Server/Edge Functions)
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only!)
- `SUPABASE_URL`
- `SMTP_HOST` (optional, for emails)
- `SMTP_USER` (optional)
- `SMTP_PASS` (optional)

## Storage Path Patterns

### Candidate Video Upload
```
candidate-videos/{user_id}/{timestamp}-{filename}.mp4
```

### Candidate Attachment
```
candidate-attachments/{user_id}/{filename}.pdf
```

### Question Image
```
question-images/{question_id}/{filename}.jpg
```

## Useful Supabase CLI Commands

```bash
# Login
supabase login

# Link project
supabase link --project-ref your-project-ref

# Deploy function
supabase functions deploy function-name

# View function logs
supabase functions logs function-name

# Set secrets
supabase secrets set KEY=value

# Generate TypeScript types
supabase gen types typescript --project-id your-project-id > types.ts

# Database dump
supabase db dump -f backup.sql
```

## Performance Tips

### Database Indexes
All critical indexes are in `schema.sql`. Verify they exist:
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
ORDER BY tablename, indexname;
```

### Query Optimization
- Use `SELECT` with specific columns (not `*`)
- Use pagination for large result sets
- Add `LIMIT` to prevent large queries
- Use indexes for WHERE clauses

### Caching
- Cache reference data (professions, fields, authorities)
- Cache exam templates
- Use React Query or SWR for client-side caching

## Debugging Tips

### Enable Query Logging
In Supabase Dashboard > Settings > Database, enable query logging.

### Check RLS Policies
```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Test Authentication
```typescript
// In browser console
const { data: { user } } = await supabase.auth.getUser();
console.log('User:', user);

const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', user.id)
  .single();
console.log('Profile:', profile);
```

---

**Need more help?** See [ARCHITECTURE.md](./ARCHITECTURE.md), [DEPLOYMENT.md](./DEPLOYMENT.md), or [TESTING.md](./TESTING.md).

