# Security Documentation

## Security Model

### Authentication

- **No Public Registration**: Only admins can create user accounts
- **Email/Password**: Standard authentication via Supabase Auth
- **Magic Links**: Optional passwordless authentication
- **Session Management**: Handled by Supabase Auth with JWT tokens

### Authorization

#### Role-Based Access Control (RBAC)

- **Roles**: `admin` and `candidate` (stored in `profiles.role`)
- **Admin**: Full access to all resources
- **Candidate**: Limited access to assigned exams and own data

#### Row Level Security (RLS)

All tables have RLS enabled with policies that enforce:

1. **Candidates**:
   - Can only read their own profile
   - Can only read exams assigned to them (individually or by group)
   - Can only read questions from assigned exams
   - Can only create/read/update their own attempts
   - Cannot access admin resources

2. **Admins**:
   - Can read/write all resources
   - Bypass RLS via service_role key (server-side only)

### Service Role Key Protection

**CRITICAL**: The `SUPABASE_SERVICE_ROLE_KEY` bypasses all RLS policies.

**Rules**:
- ✅ Use in Edge Functions (server-side)
- ✅ Use in Next.js API routes (server-side)
- ✅ Use in server-side code only
- ❌ NEVER expose in client-side code
- ❌ NEVER include in client bundle
- ❌ NEVER log or print in client

**Implementation**:
```typescript
// ✅ CORRECT: Server-side only
// nextjs-scaffold/src/lib/supabase/admin.ts
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Only in server env
  )
}

// ❌ WRONG: Client-side usage
// This would expose the key in the browser bundle
const adminClient = createClient(url, serviceRoleKey) // DON'T DO THIS
```

### Payment Gating

Payment status is enforced server-side:

1. **Database Constraint**: `profiles.payment_status` must be `'paid'` to start exams
2. **API Route Check**: `/api/exams/[id]/start` verifies payment status
3. **RLS Helper**: Exam access functions check payment status

### Data Privacy

#### Candidate Data Isolation

- Candidates can only access their own:
  - Profile data
  - Exam attempts
  - Answers
  - Storage files (folder-scoped)

#### Storage Access

- **Private Buckets**: `candidate-videos`, `candidate-attachments`
  - RLS policies restrict access to user's own folder
  - Path pattern: `{user_id}/filename.ext`

- **Public Buckets**: `question-images`
  - Read access for all
  - Write access for admins only

### Audit Logging

All admin actions are logged in `audit_logs` table:

- User creation
- Exam creation/assignment
- Payment status changes
- Manual grading
- Bulk imports

**Fields**:
- `user_id`: Admin who performed action
- `action`: Action type (e.g., 'create_user', 'grade_answer')
- `resource_type`: Resource type (e.g., 'user', 'exam')
- `resource_id`: ID of affected resource
- `details`: JSON with additional context
- `ip_address`: IP address of request
- `user_agent`: Browser/client info

### Input Validation

#### Client-Side
- Form validation with React Hook Form + Zod
- Type checking with TypeScript
- Sanitization of user inputs

#### Server-Side
- Database constraints (NOT NULL, CHECK, FOREIGN KEY)
- RLS policy enforcement
- Edge Function validation
- API route validation

#### CSV Import Validation

- Required fields check
- Email format validation
- Reference code validation (profession, field, authority)
- JSON format validation (for question choices/answers)
- Duplicate detection
- Error reporting per row

### SQL Injection Prevention

- **Parameterized Queries**: Supabase client uses parameterized queries
- **No Raw SQL**: Avoid `rpc()` with user-provided SQL
- **Input Sanitization**: Validate and sanitize all inputs

### XSS Prevention

- **React Escaping**: React automatically escapes content
- **Sanitization**: Sanitize user-generated content before display
- **Content Security Policy**: Set CSP headers (future enhancement)

### CSRF Protection

- **SameSite Cookies**: Supabase Auth uses SameSite cookies
- **Token Validation**: JWT tokens validated on each request
- **Origin Checking**: Verify request origin (future enhancement)

### Rate Limiting

**Current Implementation**:
- Manual rate limiting in Edge Functions (basic)
- Database connection pooling limits

**Future Enhancements**:
- Implement rate limiting middleware
- Use Supabase rate limiting features
- Add IP-based rate limiting

### Secure Headers

Recommended headers (configure in Vercel or Next.js):

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### Environment Variables Security

**Vercel Environment Variables**:
- Set in Vercel Dashboard (not in code)
- Different values for Production/Preview/Development
- Encrypted at rest
- Not exposed to client (unless `NEXT_PUBLIC_` prefix)

**Supabase Secrets**:
- Set via `supabase secrets set`
- Available only in Edge Functions
- Not exposed in logs

### Data Retention & Privacy

#### Retention Policy

- **Attempts**: Retain for 2 years
- **Answers**: Retain for 2 years
- **Videos**: Retain for 1 year
- **Audit Logs**: Retain for 5 years
- **Profiles**: Retain while account is active

#### Data Deletion

- **Soft Delete**: Most tables use `deleted_at` timestamp
- **Hard Delete**: Use for PII cleanup (GDPR compliance)
- **Cascade Delete**: Related records deleted automatically

#### GDPR Compliance

- Right to access: Export user data
- Right to deletion: Delete user and related data
- Data portability: Export in machine-readable format

### Security Checklist

#### Pre-Deployment

- [ ] RLS enabled on all tables
- [ ] Service role key not in client code
- [ ] Environment variables set securely
- [ ] Storage buckets have proper policies
- [ ] Admin routes protected
- [ ] Payment gating enforced
- [ ] Input validation implemented
- [ ] Error messages don't leak sensitive info

#### Post-Deployment

- [ ] HTTPS enforced
- [ ] CORS configured correctly
- [ ] Rate limiting active
- [ ] Monitoring and alerts set up
- [ ] Backup strategy in place
- [ ] Incident response plan ready

### Incident Response

#### Security Incident Steps

1. **Identify**: Detect security issue
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove threat
4. **Recover**: Restore services
5. **Document**: Log incident details
6. **Review**: Post-incident analysis

#### Common Issues

**RLS Policy Violation**:
- Check user role
- Verify policy conditions
- Test with different user roles

**Unauthorized Access**:
- Review audit logs
- Check RLS policies
- Verify authentication

**Data Leak**:
- Review access logs
- Check RLS policies
- Audit user permissions

### Security Best Practices

1. **Principle of Least Privilege**: Users have minimum required access
2. **Defense in Depth**: Multiple security layers (RLS, middleware, validation)
3. **Secure by Default**: RLS enabled, admin-only creation
4. **Regular Audits**: Review access logs and audit trails
5. **Keep Dependencies Updated**: Regular security patches
6. **Monitor**: Set up alerts for suspicious activity

### Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** create a public issue
2. Email security team with details
3. Include steps to reproduce
4. Wait for response before disclosure

---

**Last Updated**: 2024-01-01
**Next Review**: 2024-04-01

