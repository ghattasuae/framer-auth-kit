# Supabase Schema Guide

This guide provides a complete reference for the database schema used by framer-auth-kit, including table definitions, Row Level Security policies, trigger functions, and step-by-step instructions for configuring Supabase email OTP authentication with Resend SMTP.

---

## Overview

The framer-auth-kit database layer consists of a single SQL migration that creates everything needed for authentication and user management:

- **`user_role` enum** -- Defines three roles: `admin`, `member`, and `guest`.
- **`profiles` table** -- Extends Supabase's built-in `auth.users` with application-specific fields like display name, avatar, and role.
- **`user_rules` table** -- A flexible key-value store for per-user feature flags and access controls.
- **`handle_new_user()` trigger function** -- Automatically creates a profile row whenever a new user signs up.
- **Row Level Security (RLS) policies** -- Ensures users can only access their own data, while admins have full access.

### Where to find the migration

```
supabase/migrations/001_auth_setup.sql
```

### How to run it

1. Open your Supabase project dashboard.
2. Go to **SQL Editor** in the left sidebar.
3. Click **New Query**.
4. Paste the entire contents of `001_auth_setup.sql` into the editor.
5. Click **Run**.

The migration is idempotent for the trigger function (uses `CREATE OR REPLACE`), but the table and enum creation statements will fail if they already exist. Run this on a fresh project or drop existing objects first.

---

## Enabling Email OTP Authentication

Before configuring SMTP, you must enable OTP-based email sign-in within Supabase. Without this, the authentication flow will not work.

1. Go to **Supabase Dashboard > Authentication > Providers > Email**.
2. Toggle **"Enable Email provider"** to **ON**.
3. Toggle **"Confirm email"** to **OFF**.
   > This is important. OTP codes already handle email verification. If "Confirm email" is left ON, Supabase sends a separate confirmation email that conflicts with the OTP flow, causing users to receive two emails and potentially breaking the sign-in process.
4. Optionally adjust the **OTP expiry time**. The default is 60 seconds, which can feel rushed for users checking email on another device. Consider extending it to **300 seconds** (5 minutes) for a better user experience.
5. Click **Save**.

---

## Setting Up Resend as Supabase SMTP Provider

Supabase uses SMTP to deliver OTP emails. By default, it uses a built-in email provider with strict rate limits (approximately 2 emails per hour in development). For production use, configure a dedicated SMTP provider. Resend is recommended for its simplicity and developer experience.

### Step 1: Verify a domain in Resend

1. Go to [Resend Dashboard > Domains](https://resend.com/domains).
2. Click **Add Domain**.
3. Enter your domain (e.g., `yourdomain.com`).
4. Follow the DNS instructions to add the required MX, SPF, and DKIM records to your domain's DNS settings.
5. Wait for verification to complete (usually a few minutes, sometimes up to 24 hours depending on DNS propagation).

### Step 2: Generate a Resend API key

1. Go to [Resend Dashboard > API Keys](https://resend.com/api-keys).
2. Click **Create API Key**.
3. Give it a descriptive name (e.g., "Supabase SMTP").
4. Select **Sending access** permission.
5. Copy the API key. It starts with `re_` and is only shown once.

### Step 3: Configure SMTP in Supabase

1. Go to **Supabase Dashboard > Project Settings > Authentication**.
2. Scroll down to **SMTP Settings**.
3. Toggle **"Enable Custom SMTP"** to **ON**.
4. Enter the following settings:

| Setting       | Value                                                      |
| ------------- | ---------------------------------------------------------- |
| Host          | `smtp.resend.com`                                          |
| Port          | `465`                                                      |
| Username      | `resend`                                                   |
| Password      | Your Resend API key (`re_...`)                             |
| Sender email  | `noreply@yourdomain.com` (must match your verified domain) |
| Sender name   | Your App Name                                              |

5. Click **Save**.

### Step 4: Customize email template (optional)

1. Go to **Authentication > Email Templates > Magic Link**.
2. Customize the subject line, body, and styling of the OTP email.
3. The `{{ .Token }}` variable contains the OTP code. Make sure it is present in your template.

After completing these steps, Supabase will send all OTP emails through Resend using your verified domain.

---

## Tables

### profiles

Extends Supabase's built-in `auth.users` table with application-specific fields. Every row in `profiles` corresponds one-to-one with a row in `auth.users`, linked by the `id` column.

| Column       | Type           | Default    | Nullable | Description                                                  |
| ------------ | -------------- | ---------- | -------- | ------------------------------------------------------------ |
| `id`         | uuid (PK, FK)  | --         | No       | References `auth.users(id)` with cascading delete            |
| `email`      | text           | --         | Yes      | User's email address (copied from `auth.users` on signup)    |
| `full_name`  | text           | --         | Yes      | User's display name (set by user or admin)                   |
| `avatar_url` | text           | --         | Yes      | URL to user's profile picture                                |
| `role`       | `user_role`    | `'member'` | No       | User's role: `admin`, `member`, or `guest`                   |
| `created_at` | timestamptz    | `now()`    | No       | Profile creation timestamp                                   |
| `updated_at` | timestamptz    | `now()`    | No       | Last update timestamp                                        |

The profile is auto-created when a user signs up via the `handle_new_user()` trigger function. The trigger copies the `id` and `email` from `auth.users`. All other fields use their defaults (`full_name` and `avatar_url` are null, `role` defaults to `'member'`).

Because `id` references `auth.users(id)` with `ON DELETE CASCADE`, deleting a user from Supabase Authentication automatically removes their profile row.

### user_rules

A flexible key-value table for per-user feature flags and access controls. Use this to gate features or content for individual users without changing their role. This is useful when you need fine-grained permissions beyond the three-role system.

| Column       | Type           | Default              | Nullable | Description                                       |
| ------------ | -------------- | -------------------- | -------- | ------------------------------------------------- |
| `id`         | uuid (PK)      | `gen_random_uuid()`  | No       | Auto-generated unique identifier                  |
| `user_id`    | uuid (FK)      | --                   | Yes      | References `profiles(id)` with cascading delete   |
| `rule_key`   | text           | --                   | No       | Rule identifier (e.g., `"premium_access"`)        |
| `rule_value` | boolean        | `false`              | Yes      | Whether the rule is enabled                       |
| `created_at` | timestamptz    | `now()`              | No       | Rule creation timestamp                           |

#### Usage examples

```sql
-- Grant premium access to a specific user
INSERT INTO public.user_rules (user_id, rule_key, rule_value)
VALUES ('user-uuid-here', 'premium_access', true);

-- Check if a user has premium access
SELECT rule_value FROM public.user_rules
WHERE user_id = 'user-uuid-here' AND rule_key = 'premium_access';

-- List all rules for a user
SELECT rule_key, rule_value FROM public.user_rules
WHERE user_id = 'user-uuid-here';

-- Revoke a rule
UPDATE public.user_rules
SET rule_value = false
WHERE user_id = 'user-uuid-here' AND rule_key = 'premium_access';
```

#### Example use cases

| Rule key          | Purpose                                        |
| ----------------- | ---------------------------------------------- |
| `premium_access`  | Gate premium content or features               |
| `can_export`      | Allow exporting data (PDF, CSV, etc.)          |
| `can_download`    | Allow downloading protected files              |
| `beta_tester`     | Grant access to beta features                  |
| `can_invite_users`| Allow the user to send invitations to others   |

---

## Roles

The `user_role` enum defines three roles that control access through Row Level Security policies.

### admin

Full read/write access to **all** profiles and **all** user_rules via RLS policies. Admins can view and edit any user's profile, create and modify rules for any user, and promote or demote other users. Use sparingly -- in most applications, only one or two users should have this role.

### member

The default role assigned to every new user on signup. Members can:
- **View** their own profile (`SELECT` on `profiles` where `auth.uid() = id`)
- **Update** their own profile (`UPDATE` on `profiles` where `auth.uid() = id`)
- **View** their own rules (`SELECT` on `user_rules` where `auth.uid() = user_id`)

Members **cannot** view other users' profiles, modify rules, or perform any administrative actions.

### guest

Has the same RLS permissions as `member`. The `guest` role exists to let your application distinguish between trial/limited users and full members at the application logic level. For example, your frontend could check the role and show an upgrade prompt to guests, or your API could restrict certain endpoints to members and above.

---

## Row Level Security (RLS) Policies

Both tables have RLS enabled. Without a matching policy, all access is denied by default. The following policies control who can do what.

### profiles table

#### 1. "Users can view own profile"

```sql
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);
```

**Operation:** `SELECT`
**Rule:** The authenticated user's ID (from `auth.uid()`) must match the profile's `id` column.
**Effect:** Users can read their own profile but cannot see anyone else's.

#### 2. "Users can update own profile"

```sql
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);
```

**Operation:** `UPDATE`
**Rule:** The authenticated user's ID must match the profile's `id` column.
**Effect:** Users can update their own profile fields (e.g., `full_name`, `avatar_url`). They cannot update their own `role` through the API in practice because the application logic should not expose that field in update forms, but the RLS policy itself does not prevent it. If this is a concern, add a more restrictive policy or use a server-side function.

#### 3. "Admins have full access to profiles"

```sql
CREATE POLICY "Admins have full access to profiles"
  ON public.profiles FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Operation:** `ALL` (SELECT, INSERT, UPDATE, DELETE)
**Rule:** The authenticated user must have a profile with `role = 'admin'`.
**Effect:** Admins can read, create, update, and delete any profile. The policy uses a subquery to look up the requesting user's role from the `profiles` table itself.

### user_rules table

#### 1. "Users can view own rules"

```sql
CREATE POLICY "Users can view own rules"
  ON public.user_rules FOR SELECT
  USING (auth.uid() = user_id);
```

**Operation:** `SELECT`
**Rule:** The authenticated user's ID must match the rule's `user_id` column.
**Effect:** Users can see what rules have been assigned to them, but cannot see other users' rules.

#### 2. "Admins have full access to user_rules"

```sql
CREATE POLICY "Admins have full access to user_rules"
  ON public.user_rules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Operation:** `ALL` (SELECT, INSERT, UPDATE, DELETE)
**Rule:** The authenticated user must have a profile with `role = 'admin'`.
**Effect:** Admins can create, read, update, and delete rules for any user.

### Important security note

Regular users (members and guests) **cannot** insert, update, or delete their own rules. There are no INSERT, UPDATE, or DELETE policies for non-admin users on the `user_rules` table. This is intentional -- users should not be able to grant themselves premium access or modify their own feature flags. Only admins can manage rules.

---

## Trigger Functions

### handle_new_user()

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

This function fires automatically after every `INSERT` on the `auth.users` table, via the `on_auth_user_created` trigger:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

**What it does:** When a new user signs up (a row is inserted into `auth.users`), the trigger creates a corresponding row in `public.profiles` with the user's `id` and `email`. All other profile fields use their defaults.

**Why `SECURITY DEFINER`:** The trigger function is declared with `SECURITY DEFINER`, which means it runs with the **function owner's** privileges (typically the database superuser) rather than the invoking user's privileges. This is necessary because:

- The newly created user does not have an INSERT policy on the `profiles` table (RLS only grants SELECT and UPDATE to regular users).
- Without `SECURITY DEFINER`, the insert into `profiles` would be blocked by RLS.
- By running as the function owner, the trigger bypasses RLS and can insert the profile row regardless of the new user's permissions.

---

## Promoting a User to Admin

The first admin must be created manually via the SQL Editor. After that, admins can manage other users through the application API since admin RLS policies grant full access.

```sql
-- Promote by email
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'admin@example.com';

-- Promote by user ID
UPDATE public.profiles
SET role = 'admin'
WHERE id = 'user-uuid-here';

-- Verify the promotion
SELECT id, email, role FROM public.profiles WHERE role = 'admin';
```

Run these queries from the **Supabase Dashboard > SQL Editor** as a superuser. The SQL Editor bypasses RLS, so you do not need admin privileges to run these statements there.

To demote an admin back to a regular user:

```sql
UPDATE public.profiles
SET role = 'member'
WHERE email = 'admin@example.com';
```

---

## Querying the Schema

Here are useful SQL queries you can run in the Supabase SQL Editor for debugging and administration.

### List all users with their roles

```sql
SELECT id, email, full_name, role, created_at
FROM public.profiles
ORDER BY created_at DESC;
```

### Find users by role

```sql
SELECT id, email, full_name, created_at
FROM public.profiles
WHERE role = 'admin';
```

### Check a specific user's rules

```sql
SELECT r.rule_key, r.rule_value, r.created_at
FROM public.user_rules r
JOIN public.profiles p ON r.user_id = p.id
WHERE p.email = 'user@example.com';
```

### Count users by role

```sql
SELECT role, COUNT(*) AS user_count
FROM public.profiles
GROUP BY role
ORDER BY user_count DESC;
```

### Find users who signed up in the last 7 days

```sql
SELECT id, email, full_name, role, created_at
FROM public.profiles
WHERE created_at >= now() - interval '7 days'
ORDER BY created_at DESC;
```

### List all rules across all users

```sql
SELECT p.email, r.rule_key, r.rule_value, r.created_at
FROM public.user_rules r
JOIN public.profiles p ON r.user_id = p.id
ORDER BY p.email, r.rule_key;
```

---

## Extending the Schema

### Adding columns to profiles

To add new fields (e.g., phone number, company name, subscription plan), create a new migration:

```sql
ALTER TABLE public.profiles
ADD COLUMN phone text,
ADD COLUMN company text,
ADD COLUMN plan text DEFAULT 'free';
```

Remember to update your application code and TypeScript types to reflect the new columns.

### Creating additional RLS policies

If you need more granular access control, add new policies. For example, to let all authenticated users view each other's basic profile info (for a user directory):

```sql
CREATE POLICY "Authenticated users can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.role() = 'authenticated');
```

Or to restrict profile updates to specific columns, use a `WITH CHECK` clause:

```sql
CREATE POLICY "Users can update own name and avatar only"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
```

### Adding indexes for performance

As your user base grows, add indexes on frequently queried columns:

```sql
-- Index for looking up profiles by email
CREATE INDEX idx_profiles_email ON public.profiles (email);

-- Index for looking up profiles by role
CREATE INDEX idx_profiles_role ON public.profiles (role);

-- Index for looking up rules by user_id and rule_key
CREATE INDEX idx_user_rules_user_key ON public.user_rules (user_id, rule_key);
```

### Creating views for common queries

If you frequently join profiles with rules, create a view:

```sql
CREATE VIEW public.user_summary AS
SELECT
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.created_at,
  COUNT(r.id) AS rule_count,
  BOOL_OR(r.rule_key = 'premium_access' AND r.rule_value = true) AS has_premium
FROM public.profiles p
LEFT JOIN public.user_rules r ON r.user_id = p.id
GROUP BY p.id, p.email, p.full_name, p.role, p.created_at;
```

Remember to add RLS policies to any new tables you create, and consider adding `ON DELETE CASCADE` to foreign keys that reference `profiles(id)` so that data is cleaned up when a user is deleted.
