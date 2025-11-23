# Testing Checklist & Acceptance Criteria

## Test Accounts

### Admin Account
- Email: `admin@example.com`
- Password: `Admin123!@#`
- Role: `admin`

### Candidate Account 1
- Email: `candidate1@example.com`
- Password: `Candidate123!@#`
- Role: `candidate`
- Profession: Pharmacist
- Medical Field: Clinical Pharmacy
- Health Authority: DHA
- Payment Status: `paid`

### Candidate Account 2
- Email: `candidate2@example.com`
- Password: `Candidate123!@#`
- Role: `candidate`
- Profession: Nurse
- Medical Field: Emergency Medicine
- Health Authority: HAAD
- Payment Status: `unpaid`

## Unit Tests

### Database Functions

- [ ] `is_admin()` function returns true for admin users
- [ ] `is_admin()` function returns false for candidate users
- [ ] `candidate_has_exam_access()` returns true for assigned exams
- [ ] `candidate_has_exam_access()` returns false for unassigned exams
- [ ] `calculate_attempt_score()` calculates correct auto score
- [ ] `calculate_attempt_score()` includes manual score in total
- [ ] `update_updated_at_column()` trigger updates timestamp

### RLS Policies

- [ ] Candidates cannot read other candidates' profiles
- [ ] Candidates can read their own profile
- [ ] Admins can read all profiles
- [ ] Candidates cannot insert/update/delete questions
- [ ] Candidates can only read questions from assigned exams
- [ ] Admins can read all questions
- [ ] Candidates cannot access unassigned exam instances
- [ ] Candidates can only read their own attempts
- [ ] Candidates cannot modify submitted attempts
- [ ] Admins can read all attempts

## Integration Tests

### Authentication Flow

- [ ] User can login with email/password
- [ ] User can login with magic link
- [ ] Invalid credentials are rejected
- [ ] Session persists across page refreshes
- [ ] User can logout
- [ ] Unauthenticated users are redirected to login

### Admin User Management

- [ ] Admin can create single candidate via form
- [ ] Admin can bulk import candidates via CSV
- [ ] CSV import validates required fields
- [ ] CSV import reports errors for invalid rows
- [ ] Admin can update candidate payment status
- [ ] Admin can suspend/activate candidates
- [ ] Admin can reset candidate password
- [ ] Admin can send invite emails
- [ ] Non-admin users cannot access admin routes

### Exam Management

- [ ] Admin can create exam template
- [ ] Admin can create exam instance
- [ ] Admin can assign exam to group (profession/field/authority)
- [ ] Admin can assign exam to individual candidate
- [ ] Admin can set availability window
- [ ] Admin can edit exam template
- [ ] Admin can delete exam (soft delete)

### Question Management

- [ ] Admin can create question (all types)
- [ ] Admin can bulk import questions via CSV
- [ ] CSV import validates question format
- [ ] CSV import reports errors for invalid rows
- [ ] Admin can edit question
- [ ] Admin can delete question (soft delete)
- [ ] Question versioning works correctly

### Candidate Exam Flow

- [ ] Candidate sees only assigned exams on dashboard
- [ ] Candidate cannot access unassigned exams
- [ ] Candidate cannot start exam if payment_status != 'paid'
- [ ] Candidate cannot start exam outside availability window
- [ ] Candidate can start exam (creates attempt)
- [ ] Questions are randomized per template rules
- [ ] Timer counts down correctly
- [ ] Answers auto-save every 15 seconds
- [ ] Candidate can navigate between questions (if allowed)
- [ ] Candidate can mark questions for review
- [ ] Candidate can submit exam
- [ ] Exam auto-scores objective questions
- [ ] Subjective questions are flagged for manual grading

### Scoring & Results

- [ ] Auto-scoring calculates correct points for MCQ single
- [ ] Auto-scoring calculates correct points for MCQ multi
- [ ] Auto-scoring calculates correct points for True/False
- [ ] Negative marking is applied correctly
- [ ] Manual grading updates answer score
- [ ] Final score includes auto + manual scores
- [ ] Score percentage is calculated correctly
- [ ] Candidate can view results after release
- [ ] Explanations are shown (if configured)

## Manual QA Tests

### Exam Runner

- [ ] Timer displays correctly
- [ ] Progress bar updates as questions are answered
- [ ] MCQ single-select works correctly
- [ ] MCQ multi-select works correctly
- [ ] True/False questions work correctly
- [ ] Short text input works correctly
- [ ] Image-based questions display correctly
- [ ] Mark for review button toggles correctly
- [ ] Previous/Next navigation works (if enabled)
- [ ] Single-mode prevents navigation (if enabled)
- [ ] Auto-save indicator shows (optional)
- [ ] Submit button is disabled during submission
- [ ] Timeout auto-submits exam

### Payment Gating

- [ ] Unpaid candidate sees payment message
- [ ] Unpaid candidate cannot start exams
- [ ] Paid candidate can start exams
- [ ] Admin can update payment status
- [ ] Payment status change takes effect immediately

### Access Control

- [ ] Candidate cannot access `/admin/*` routes
- [ ] Candidate cannot call admin API endpoints
- [ ] Admin can access all routes
- [ ] Unauthenticated users are redirected
- [ ] RLS prevents unauthorized data access

### CSV Import

- [ ] Candidate CSV import validates email format
- [ ] Candidate CSV import validates reference codes
- [ ] Candidate CSV import reports duplicate emails
- [ ] Question CSV import validates JSON fields
- [ ] Question CSV import validates question types
- [ ] Question CSV import reports row-level errors
- [ ] Import history is logged correctly

### Mobile Responsiveness

- [ ] Dashboard is usable on mobile (375px width)
- [ ] Exam runner is usable on mobile
- [ ] Forms are usable on mobile
- [ ] Tables scroll horizontally on mobile
- [ ] Touch targets are at least 44x44px

### Accessibility

- [ ] All images have alt text
- [ ] Forms have proper labels
- [ ] Keyboard navigation works
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA standards
- [ ] Screen reader announces important changes

## Performance Tests

- [ ] Dashboard loads in < 2 seconds
- [ ] Exam start creates attempt in < 1 second
- [ ] Question rendering is smooth (60fps)
- [ ] Auto-save doesn't block UI
- [ ] Large CSV imports (1000+ rows) complete in < 30 seconds
- [ ] Database queries use indexes (check EXPLAIN)

## Security Tests

- [ ] Service role key is not exposed in client bundle
- [ ] RLS policies prevent unauthorized access
- [ ] SQL injection attempts are blocked
- [ ] XSS attempts are sanitized
- [ ] CSRF protection is enabled
- [ ] Rate limiting prevents abuse
- [ ] File uploads are validated
- [ ] Storage access is restricted

## Edge Cases

- [ ] Exam expires during attempt (auto-submit)
- [ ] Network disconnection during exam (answers saved)
- [ ] Multiple tabs open (prevent duplicate attempts)
- [ ] Browser back button (handle gracefully)
- [ ] Very long answer text (truncate/validate)
- [ ] Empty question pools (show error)
- [ ] Concurrent exam starts (prevent duplicates)
- [ ] Large file uploads (validate size)

## Acceptance Criteria

### MVP (Phase 1)

- [ ] Admin can create and manage candidates
- [ ] Admin can create exams and assign them
- [ ] Candidates can take MCQ and True/False exams
- [ ] Exams auto-score correctly
- [ ] RLS prevents unauthorized access
- [ ] Payment gating works correctly
- [ ] Basic dashboard for candidates and admins

### v1.0 (Phase 2)

- [ ] Short text and image-based questions work
- [ ] Manual scoring workflow is complete
- [ ] Bulk CSV imports work correctly
- [ ] Email notifications are sent
- [ ] Analytics dashboard shows basic metrics
- [ ] Export functionality works

### v1.1 (Phase 3)

- [ ] Video recording and upload works
- [ ] Advanced analytics (item analysis) works
- [ ] Audit logging captures all admin actions
- [ ] Mobile experience is optimized
- [ ] Performance meets targets

## Test Data Setup

Before running tests, ensure:

1. Reference data is seeded (professions, fields, authorities)
2. Test admin user exists
3. Test candidate users exist
4. At least one exam template exists
5. At least one exam instance is assigned to test candidate
6. Question bank has sufficient questions for exam template

## Regression Tests

After each deployment, verify:

- [ ] Existing candidates can still login
- [ ] Existing exams are still accessible
- [ ] Existing attempts are still viewable
- [ ] RLS policies still work correctly
- [ ] Edge functions still work correctly

## Load Tests (Future)

- [ ] 100 concurrent exam attempts
- [ ] 1000 candidate CSV import
- [ ] 10,000 question CSV import
- [ ] Database handles 1M+ answers

## Test Execution Order

1. **Setup**: Seed test data, create test accounts
2. **Unit Tests**: Run database function tests
3. **RLS Tests**: Verify security policies
4. **Integration Tests**: Test complete flows
5. **Manual QA**: Test UI/UX
6. **Performance Tests**: Measure load times
7. **Security Tests**: Verify protections
8. **Edge Cases**: Test unusual scenarios
9. **Regression Tests**: Verify existing functionality

## Bug Reporting Template

When reporting bugs, include:

- **Steps to Reproduce**: Clear steps
- **Expected Behavior**: What should happen
- **Actual Behavior**: What actually happens
- **Environment**: Browser, OS, user role
- **Screenshots**: If applicable
- **Console Errors**: If any
- **Network Logs**: If applicable

## Sign-off Criteria

Before marking a feature as complete:

- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual QA is complete
- [ ] Security review is complete
- [ ] Performance meets targets
- [ ] Documentation is updated
- [ ] Code review is approved

