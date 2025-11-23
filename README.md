# Mock Exam Portal - Complete Technical Design & Implementation Guide

A comprehensive mock examination platform for medical professionals preparing for licensing exams across multiple health authorities (DHA, HAAD, MOH Qatar).

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Project Structure](#project-structure)
- [Key Features](#key-features)
- [Documentation](#documentation)
- [Deployment](#deployment)
- [Testing](#testing)
- [Security](#security)
- [Roadmap](#roadmap)

## Overview

This project provides a complete, production-ready scaffold for a mock exam portal with:

- **Admin-only user management** (no public registration)
- **Role-based access control** with Supabase RLS
- **Multiple question types** (MCQ single/multi, True/False, Short text, Image-based)
- **Automated scoring** with manual review workflow
- **Payment gating** (manual payment status management)
- **Bulk CSV imports** for candidates and questions
- **Exam versioning** and assignment (group-level and individual)
- **Real-time exam delivery** with auto-save and timers
- **Analytics and reporting** capabilities

## Architecture

### Tech Stack

- **Frontend**: Next.js 14+ (App Router), React 18+, Tailwind CSS
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Edge Functions)
- **Hosting**: Vercel (Frontend), Supabase (Backend)
- **Language**: TypeScript

### System Architecture

```
┌─────────────────┐
│   Next.js App   │ (Vercel)
│   (Frontend)    │
└────────┬────────┘
         │
         │ HTTPS
         │
┌────────▼────────┐
│   Supabase      │
│   - PostgreSQL  │
│   - Auth        │
│   - Storage     │
│   - Edge Funcs  │
└─────────────────┘
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Quick Start

### Prerequisites

- Node.js 18+
- Supabase account
- Vercel account (for deployment)

### Local Development Setup

1. **Clone and install dependencies**:
   ```bash
   cd nextjs-scaffold
   npm install
   ```

2. **Set up Supabase**:
   - Create a new Supabase project
   - Run `database/schema.sql` in SQL Editor
   - Run `database/rls_policies.sql` in SQL Editor
   - Run `database/seed_data.sql` in SQL Editor

3. **Configure environment variables**:
   Create `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

4. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy bulk-create-users
   supabase functions deploy send-invite-email
   supabase functions deploy import-questions
   supabase functions deploy manual-scoring
   ```

5. **Run development server**:
   ```bash
   npm run dev
   ```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete setup instructions.

## Project Structure

```
.
├── ARCHITECTURE.md              # System architecture documentation
├── DEPLOYMENT.md                # Deployment guide
├── TESTING.md                    # Testing checklist
├── README.md                     # This file
│
├── database/
│   ├── schema.sql               # Complete database schema
│   ├── rls_policies.sql         # Row Level Security policies
│   └── seed_data.sql           # Sample seed data
│
├── supabase/
│   └── functions/
│       ├── bulk-create-users/   # Bulk user creation Edge Function
│       ├── send-invite-email/   # Email invite Edge Function
│       ├── import-questions/    # Question import Edge Function
│       └── manual-scoring/      # Manual scoring helper
│
├── nextjs-scaffold/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   │   ├── dashboard/       # Candidate dashboard
│   │   │   ├── admin/           # Admin routes
│   │   │   └── api/             # API routes
│   │   ├── components/          # React components
│   │   │   └── ExamRunner.tsx   # Main exam component
│   │   └── lib/
│   │       └── supabase/        # Supabase client utilities
│   ├── package.json
│   └── tailwind.config.js
│
└── templates/
    ├── candidates-import.csv    # CSV template for candidate import
    └── questions-import.csv     # CSV template for question import
```

## Key Features

### 1. Admin User Management

- Create candidates individually or via bulk CSV import
- Assign profession, medical field, and health authority
- Manage payment status and exam access
- Reset passwords and send invite emails

### 2. Role-Based Access Control

- **RLS Policies**: Database-level security enforcement
- Candidates can only access assigned exams
- Admins have full access
- Service role key never exposed to client

### 3. Exam Delivery

- Randomized question selection per template rules
- Timed exams with per-question and overall limits
- Auto-save answers every 15 seconds
- Mark for review functionality
- Single-mode option (no navigation)

### 4. Scoring System

- Auto-scoring for objective questions (MCQ, True/False)
- Manual grading workflow for subjective questions
- Negative marking support
- Score calculation with percentage and percentile

### 5. Bulk Operations

- CSV import for candidates (with validation)
- CSV import for questions (with validation)
- Error reporting for failed rows
- Import history tracking

## Documentation

### Core Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: System architecture, components, data flow
- **[DEPLOYMENT.md](./DEPLOYMENT.md)**: Step-by-step deployment guide
- **[TESTING.md](./TESTING.md)**: Testing checklist and acceptance criteria

### Database

- **[database/schema.sql](./database/schema.sql)**: Complete database schema with all tables
- **[database/rls_policies.sql](./database/rls_policies.sql)**: RLS policies for security
- **[database/seed_data.sql](./database/seed_data.sql)**: Sample data for testing

### Code Examples

- **Edge Functions**: See `supabase/functions/` for serverless function examples
- **Next.js Components**: See `nextjs-scaffold/src/` for React components
- **API Routes**: See `nextjs-scaffold/src/app/api/` for server-side logic

### CSV Templates

- **[templates/candidates-import.csv](./templates/candidates-import.csv)**: Candidate import format
- **[templates/questions-import.csv](./templates/questions-import.csv)**: Question import format

## Deployment

### Environment Variables

Required environment variables (set in Vercel):

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_URL=https://your-project.supabase.co
SMTP_HOST=smtp.sendgrid.net
SMTP_USER=your-smtp-user
SMTP_PASS=your-smtp-password
APP_ADMIN_EMAIL=admin@yourdomain.com
```

**⚠️ Security Note**: Never expose `SUPABASE_SERVICE_ROLE_KEY` in client code. Only use it in:
- Edge Functions
- Next.js API routes (server-side)
- Server-side code only

### Deployment Steps

1. **Supabase Setup**:
   - Create project
   - Run schema SQL
   - Run RLS policies SQL
   - Configure storage buckets
   - Deploy Edge Functions

2. **Vercel Setup**:
   - Connect Git repository
   - Set environment variables
   - Deploy

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## Testing

### Test Accounts

- **Admin**: `admin@example.com` / `Admin123!@#`
- **Candidate 1**: `candidate1@example.com` / `Candidate123!@#` (paid)
- **Candidate 2**: `candidate2@example.com` / `Candidate123!@#` (unpaid)

### Test Checklist

- [ ] RLS policies prevent unauthorized access
- [ ] Admin can create and manage users
- [ ] Candidates can only see assigned exams
- [ ] Payment gating works correctly
- [ ] Exam timer and auto-save work
- [ ] Auto-scoring calculates correctly
- [ ] CSV imports validate and report errors

See [TESTING.md](./TESTING.md) for complete testing checklist.

## Security

### Security Features

1. **Row Level Security (RLS)**: Database-level access control
2. **Service Role Protection**: Never exposed to client
3. **Payment Gating**: Server-side enforcement
4. **Audit Logging**: All admin actions logged
5. **HTTPS**: Enforced on all connections
6. **CORS**: Configured for allowed origins

### Security Checklist

- [ ] Service role key not in client bundle
- [ ] RLS enabled on all tables
- [ ] Storage buckets have proper policies
- [ ] Admin routes protected server-side
- [ ] Environment variables set securely
- [ ] HTTPS enforced

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
- Multi-language support (Urdu, Arabic)
- Advanced proctoring
- Question versioning with history
- Exam scheduling and reminders
- Payment gateway integration

**Total Estimated Effort**: 60-90 developer-days

## Support & Contributing

### Getting Help

- Review [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- Check [DEPLOYMENT.md](./DEPLOYMENT.md) for setup issues
- See [TESTING.md](./TESTING.md) for test scenarios

### Common Issues

**RLS Policy Errors**:
- Verify user role in profiles table
- Check policy conditions match use case
- Test policies in SQL Editor

**Edge Function Errors**:
- Check function logs in Supabase Dashboard
- Verify environment variables are set
- Test locally with `supabase functions serve`

**Build Errors**:
- Ensure Node.js 18+ is installed
- Check all dependencies are installed
- Review TypeScript errors

## License

This is a technical design and scaffold. Customize as needed for your use case.

## Acknowledgments

Built with:
- [Next.js](https://nextjs.org/)
- [Supabase](https://supabase.com/)
- [Vercel](https://vercel.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

**Ready to implement?** Start with [DEPLOYMENT.md](./DEPLOYMENT.md) for step-by-step setup instructions.

