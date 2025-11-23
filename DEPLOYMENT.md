# Deployment Guide - Mock Exam Portal

## Prerequisites

- Supabase account (https://supabase.com)
- Vercel account (https://vercel.com)
- Node.js 18+ installed locally
- Git repository for your project

## Step 1: Supabase Setup

### 1.1 Create Supabase Project

1. Go to https://supabase.com and create a new project
2. Note down your project URL and API keys:
   - Project URL: `https://your-project.supabase.co`
   - Anon Key: Found in Settings > API
   - Service Role Key: Found in Settings > API (keep this secret!)

### 1.2 Run Database Schema

1. Open Supabase SQL Editor
2. Copy and paste the contents of `database/schema.sql`
3. Execute the SQL script
4. Verify tables are created in the Table Editor

### 1.3 Enable Row Level Security

1. In SQL Editor, run `database/rls_policies.sql`
2. Verify RLS is enabled on all tables (check in Table Editor)

### 1.4 Configure Storage Buckets

Run the following SQL in Supabase SQL Editor:

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('candidate-videos', 'candidate-videos', false),
  ('candidate-attachments', 'candidate-attachments', false),
  ('question-images', 'question-images', true);

-- Storage policies for candidate-videos (private, user-specific)
CREATE POLICY "Users can upload to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'candidate-videos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own files"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'candidate-videos' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Storage policies for candidate-attachments (same as videos)
CREATE POLICY "Users can upload attachments to their own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'candidate-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can read their own attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'candidate-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Question images are public read, admin write
CREATE POLICY "Anyone can read question images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'question-images');

CREATE POLICY "Only admins can upload question images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'question-images' AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

### 1.5 Configure Email (SMTP)

1. Go to Settings > Auth > SMTP Settings
2. Configure your SMTP provider (SendGrid, Mailgun, AWS SES, etc.)
   - SMTP Host: `smtp.sendgrid.net` (example)
   - SMTP Port: `587`
   - SMTP User: Your SMTP username
   - SMTP Password: Your SMTP password
   - Sender Email: `noreply@yourdomain.com`
   - Sender Name: `Mock Exam Portal`

Alternatively, use Supabase's built-in email (limited to 3 emails/hour on free tier).

### 1.6 Deploy Edge Functions

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link your project:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. Deploy functions:
   ```bash
   supabase functions deploy bulk-create-users
   supabase functions deploy send-invite-email
   supabase functions deploy import-questions
   supabase functions deploy manual-scoring
   ```

5. Set function secrets (if needed):
   ```bash
   supabase secrets set SMTP_HOST=smtp.sendgrid.net
   supabase secrets set SMTP_USER=your_user
   supabase secrets set SMTP_PASS=your_password
   ```

### 1.7 Seed Initial Data

1. Run `database/seed_data.sql` in SQL Editor
2. This creates reference data and an admin user

## Step 2: Vercel Setup

### 2.1 Create Vercel Project

1. Go to https://vercel.com and create a new project
2. Connect your Git repository
3. Configure build settings:
   - Framework Preset: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

### 2.2 Set Environment Variables

In Vercel Dashboard > Project Settings > Environment Variables, add:

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

**Important**: 
- `SUPABASE_SERVICE_ROLE_KEY` should only be used in server-side code (API routes, Edge Functions)
- Never expose service role key to the client
- Add these variables for all environments (Production, Preview, Development)

### 2.3 Deploy

1. Push your code to the connected Git repository
2. Vercel will automatically deploy
3. Check deployment logs for any errors

## Step 3: Post-Deployment Setup

### 3.1 Create First Admin User

1. Use Supabase Dashboard > Authentication > Users
2. Create a new user manually, OR
3. Use the SQL seed script which creates an admin user

### 3.2 Verify RLS Policies

1. Test as candidate user:
   - Login and verify you can only see assigned exams
   - Try to access admin routes (should be blocked)

2. Test as admin user:
   - Login and verify you can access admin dashboard
   - Create a test candidate
   - Create a test exam

### 3.3 Configure Custom Domain (Optional)

1. In Vercel Dashboard > Settings > Domains
2. Add your custom domain
3. Follow DNS configuration instructions

## Step 4: Environment-Specific Configuration

### Development

Create `.env.local` in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
SUPABASE_URL=https://your-project.supabase.co
```

### Production

All variables should be set in Vercel Dashboard (see Step 2.2).

## Step 5: Monitoring & Maintenance

### 5.1 Enable Supabase Logs

- Go to Supabase Dashboard > Logs
- Monitor Edge Function invocations
- Check for RLS policy violations

### 5.2 Set Up Backups

- Supabase automatically backs up your database
- Configure backup retention in Supabase Dashboard > Settings > Database
- Export backups manually if needed:
  ```bash
  supabase db dump -f backup.sql
  ```

### 5.3 Monitor Vercel

- Check Vercel Dashboard > Analytics for performance metrics
- Set up error tracking (Sentry, etc.)
- Monitor API route performance

## Troubleshooting

### RLS Policy Errors

If you see "new row violates row-level security policy":
1. Check that RLS is enabled on the table
2. Verify the user has the correct role
3. Check policy conditions match your use case
4. Test policies in SQL Editor with `SET ROLE authenticated;`

### Edge Function Errors

1. Check function logs in Supabase Dashboard > Edge Functions
2. Verify environment variables are set
3. Check function code for syntax errors
4. Test locally with `supabase functions serve`

### Build Errors

1. Check Node.js version (should be 18+)
2. Verify all dependencies are installed
3. Check for TypeScript errors
4. Review Vercel build logs

## Security Checklist

- [ ] Service role key is NOT exposed in client code
- [ ] RLS policies are enabled on all tables
- [ ] Storage buckets have proper access policies
- [ ] Environment variables are set in Vercel (not in code)
- [ ] HTTPS is enforced (automatic on Vercel)
- [ ] CORS is configured correctly
- [ ] Admin routes are protected server-side
- [ ] Rate limiting is implemented (future enhancement)

## Next Steps

1. Set up monitoring and alerts
2. Configure custom email templates
3. Set up CI/CD pipeline (optional)
4. Configure custom domain and SSL
5. Set up analytics tracking
6. Implement backup strategy

