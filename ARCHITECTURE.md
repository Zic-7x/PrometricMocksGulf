# Mock Exam Portal - Technical Architecture

## Overview

A comprehensive mock examination platform built on Next.js (Vercel) and Supabase, designed for medical professionals preparing for licensing exams across multiple health authorities (DHA, HAAD, MOH Qatar). The system enforces strict role-based access control, supports multiple question types, and provides automated scoring with manual review capabilities.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                             │
│  ┌──────────────────┐  ┌──────────────────┐                    │
│  │  Admin Portal    │  │ Candidate Portal │                    │
│  │  (Next.js App)   │  │  (Next.js App)   │                    │
│  └──────────────────┘  └──────────────────┘                    │
│           │                      │                              │
│           └──────────┬───────────┘                              │
│                      │                                           │
│         ┌────────────▼────────────┐                             │
│         │   Next.js API Routes    │                             │
│         │  (Server-side Actions)  │                             │
│         └────────────┬────────────┘                             │
└──────────────────────┼──────────────────────────────────────────┘
                       │
                       │ HTTPS
                       │
┌──────────────────────▼──────────────────────────────────────────┐
│                      SUPABASE LAYER                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Authentication (Email/Password, Magic Link)             │  │
│  │  - No public registration                                │  │
│  │  - Admin creates accounts via Admin API                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database (RLS Enabled)                      │  │
│  │  - Row Level Security policies enforce access            │  │
│  │  - JWT claims for role-based permissions                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Edge Functions (Deno Runtime)                           │  │
│  │  - Bulk user creation                                    │  │
│  │  - Email notifications                                   │  │
│  │  - Question import validation                            │  │
│  │  - Manual scoring helpers                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Storage (Private Buckets)                               │  │
│  │  - Candidate video uploads                               │  │
│  │  - Attachments                                           │  │
│  │  - RLS policies for folder-level access                  │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Authentication & Authorization

**Model**: Admin-only account creation
- Admin uses Supabase Admin API (service_role key) to create user accounts
- Users authenticate via email/password or magic link
- Role stored in `profiles.role` ('admin' | 'candidate')
- JWT custom claims include role for RLS policy evaluation

**Security**:
- Service role key NEVER exposed to client
- All admin operations via Edge Functions or Next.js API routes
- RLS policies enforce data access at database level

### 2. Data Model

**Core Entities**:
- **Users**: Authentication (managed by Supabase Auth)
- **Profiles**: Extended user data (role, profession, medical_field, health_authority)
- **Professions**: e.g., Pharmacist, Nurse, Doctor
- **Medical Fields**: e.g., Clinical Pharmacy, Emergency Medicine
- **Health Authorities**: DHA, HAAD, MOH Qatar
- **Question Bank**: Questions with metadata (topic, difficulty, tags)
- **Exam Templates**: Exam configuration (question count, time limits, settings)
- **Exam Instances**: Specific exam assignments with availability windows
- **Exam Assignments**: Links candidates/groups to exam instances
- **Attempts**: Candidate exam attempts with timestamps
- **Answers**: Individual question responses
- **Audit Logs**: Admin action tracking

### 3. Access Control Strategy

**Group-Level Assignment**:
- Exam assigned to (profession, medical_field, health_authority) triplet
- All candidates matching that triplet can access the exam

**Individual Assignment**:
- Exam assigned directly to specific candidate user_id
- Overrides group-level access

**RLS Enforcement**:
- Candidates can only read exam_instances where:
  - An exam_assignment exists linking their user_id, OR
  - An exam_assignment exists matching their (profession, field, authority)
- Admins bypass RLS via service_role or explicit admin policies

### 4. Exam Delivery Flow

1. **Pre-Attempt Checks**:
   - Payment status = 'paid'
   - Exam available_from <= now <= available_until
   - Candidate has assignment (group or individual)
   - No active attempt exists

2. **Question Selection**:
   - Randomize from question pools per exam template rules
   - Shuffle question order if configured
   - Create attempt record with start timestamp

3. **During Exam**:
   - Auto-save answers every 15 seconds
   - Enforce per-question and overall time limits
   - Prevent navigation if single-mode enabled
   - Allow mark-for-review if configured

4. **Submission**:
   - Auto-score objective questions (MCQ, True/False)
   - Flag subjective questions (short text, image-based) for manual review
   - Calculate preliminary score
   - Lock attempt record

5. **Review & Finalization**:
   - Admin reviews subjective answers
   - Admin releases final score
   - Candidate views results with explanations (if enabled)

### 5. Storage Strategy

**Buckets**:
- `candidate-videos`: Private, RLS-enforced, folder per candidate
- `candidate-attachments`: Private, RLS-enforced, folder per candidate
- `question-images`: Public read, admin write

**Access Pattern**:
- Candidates upload to their own folder: `candidate-videos/{user_id}/`
- Signed URLs generated for viewing/downloading
- Admin can access all via service_role

### 6. Performance Considerations

**Question Bank**:
- Index on (profession, medical_field, health_authority, topic, difficulty)
- Pagination for admin question browser
- Pre-compute question pools for high-traffic exams

**Exam Instances**:
- Pre-generate question sets for scheduled exams (optional optimization)
- Cache exam templates in Redis (future enhancement)

**Concurrency**:
- Use database transactions for attempt creation
- Optimistic locking for answer updates
- Rate limiting on submission endpoints

## Technology Stack

### Frontend
- **Framework**: Next.js 14+ (App Router)
- **UI**: React 18+, Tailwind CSS
- **State**: React Context + Server Components
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Supabase JS Client
- **Hosting**: Vercel

### Backend
- **Database**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Storage**: Supabase Storage
- **Functions**: Supabase Edge Functions (Deno)
- **API**: Supabase REST API + Next.js API Routes

### Development
- **Language**: TypeScript
- **Package Manager**: npm/yarn/pnpm
- **Linting**: ESLint
- **Formatting**: Prettier

## Security Model

### Authentication
- Email/password or magic link (Supabase Auth)
- No public registration endpoints
- Admin creates accounts via Edge Function

### Authorization
- **RLS Policies**: Database-level enforcement
- **JWT Claims**: Role included in token
- **Service Role**: Only in server-side code (Edge Functions, API routes)

### Data Privacy
- Candidate data isolated by user_id
- Storage folders scoped to user_id
- Audit logs for admin actions
- Data retention policy: 2 years for attempts, 1 year for videos

### Anti-Cheat Measures
- Question order randomization
- Per-question time limits
- IP address logging (optional)
- Browser focus detection (future)
- Video recording (optional, manual review)

## Deployment Architecture

### Vercel (Frontend)
- Automatic deployments from Git
- Environment variables for Supabase connection
- Edge Network for global CDN

### Supabase (Backend)
- Managed PostgreSQL
- Edge Functions deployed via Supabase CLI
- Storage buckets configured via dashboard/CLI
- SMTP configured for email notifications

## Data Flow Examples

### Admin Creates Candidate
1. Admin uploads CSV or fills form
2. Next.js API route receives request (admin auth required)
3. API route calls Edge Function with service_role
4. Edge Function creates auth.users entry
5. Edge Function creates profiles entry
6. Edge Function sends invite email
7. Response returned to admin

### Candidate Takes Exam
1. Candidate views dashboard (RLS filters visible exams)
2. Candidate clicks "Start Exam"
3. Next.js page calls API route to create attempt
4. API route validates payment, availability, assignment
5. API route selects random questions per template
6. Questions returned to client
7. Client auto-saves answers every 15s
8. On submit, answers scored and attempt finalized

### Admin Reviews Subjective Answer
1. Admin views attempt detail page
2. Admin sees flagged subjective questions
3. Admin enters score for each
4. API route updates answer.score
5. Final score recalculated
6. Candidate notified (optional)

## Scalability Considerations

### Current Design (MVP)
- Supports 1000+ concurrent candidates
- Question bank up to 10,000 questions
- Single Supabase instance

### Future Enhancements
- Read replicas for reporting queries
- Redis cache for exam templates
- CDN for question images
- Queue system for bulk imports
- Real-time notifications via Supabase Realtime

## Localization Notes

**Primary Language**: English
**Future Languages**: Urdu, Arabic

**Implementation Strategy**:
- Store labels in database `i18n_labels` table
- Use translation keys in components
- Admin can manage translations via UI
- Default to English if translation missing

**Key Areas for Translation**:
- UI labels and buttons
- Question statements (future)
- Email templates
- Error messages

## Roadmap

### MVP (Phase 1) - 4-6 weeks
- Core authentication and user management
- Basic exam creation and assignment
- MCQ and True/False questions
- Auto-scoring
- Candidate dashboard and exam runner
- Admin dashboard (basic)

### v1.0 (Phase 2) - 2-3 weeks
- Short text and image-based questions
- Manual scoring workflow
- Bulk CSV imports
- Analytics dashboard
- Email notifications
- Payment status gating

### v1.1 (Phase 3) - 2-3 weeks
- Video recording support
- Advanced analytics (item analysis)
- Export functionality
- Audit logging
- Mobile optimization

### v2.0 (Future) - 4-6 weeks
- Multi-language support
- Advanced proctoring
- Question versioning with history
- Exam scheduling and reminders
- Integration with payment gateways

## Estimated Effort

- **MVP**: 20-30 developer-days
- **v1.0**: 10-15 developer-days
- **v1.1**: 10-15 developer-days
- **v2.0**: 20-30 developer-days

**Total**: 60-90 developer-days for full implementation

