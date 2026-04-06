# Getting Started with framer-auth-kit

This guide walks you through setting up self-hosted authentication for your Framer site from scratch. By the end, you will have a working OTP/magic-link login flow powered by Supabase, Resend, and your choice of backend.

---

## Prerequisites

Before you begin, make sure the following are in place.

### Node.js 18+

You need Node.js 18 or later to run the CLI and install backend dependencies. Download it from [nodejs.org](https://nodejs.org/). Verify your version:

```bash
node --version
```

### Supabase Project

You need a Supabase project with an active Postgres database. If you do not have one yet:

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in (or create an account).
2. Click **New Project**.
3. Choose an organization, give the project a name, set a database password, and select a region close to your users.
4. Wait for the project to finish provisioning (usually under a minute).

Once the project is ready, grab two values you will need shortly:

- **Supabase URL** -- Go to **Settings > API** in the Supabase dashboard. Copy the **Project URL** (it looks like `https://abcdefgh.supabase.co`).
- **Supabase anon key** -- On the same **Settings > API** page, copy the key listed under **Project API keys > anon / public**. This is safe to expose in client-side code; it is not a secret key.

### Resend Account

Resend handles transactional email delivery (the OTP codes your users receive). Set it up:

1. Create an account at [resend.com](https://resend.com).
2. **Verify a sending domain.** In the Resend dashboard, go to **Domains** and add the domain you want to send from (e.g., `yourdomain.com`). Resend will give you DNS records (SPF, DKIM) to add at your domain registrar. Verification usually takes a few minutes.
3. **Create an API key.** Go to **API Keys** in the Resend dashboard and create a new key. Copy the value -- it starts with `re_`. You will need this both for the CLI and for configuring Supabase SMTP later.

> **Note:** You can use Resend's free tier during development. The free tier allows sending from the `onboarding@resend.dev` address without domain verification, but for production you must verify your own domain.

---

## Step 1: Run the CLI

Open your terminal and run:

```bash
npx framer-auth-kit
```

The interactive CLI will walk you through six prompts:

| Prompt | What to enter | Example |
|---|---|---|
| **Project name** | A lowercase, hyphen-separated name for your project. Used to name the output folder. | `my-app` |
| **Supabase project URL** | Your project's URL from **Settings > API**. | `https://abcdefgh.supabase.co` |
| **Supabase anon key** | The anon/public key from **Settings > API**. Starts with `eyJ...`. | `eyJhbGciOiJI...` |
| **Resend API key** | Your API key from Resend. Starts with `re_`. | `re_abc123...` |
| **Backend choice** | Pick one of two backend options (see below). | `Cloudflare Worker` or `Next.js` |
| **Output directory** | Where the generated project files will be written. Defaults to `./framer-auth-<project-name>`. | `./framer-auth-my-app` |

### Choosing a Backend

| | Cloudflare Worker | Next.js |
|---|---|---|
| **Best for** | Lightweight, edge-first deployments | Teams already using Next.js or Vercel |
| **Runtime** | Runs on Cloudflare's edge network in 300+ cities | Runs as serverless functions (Vercel, self-hosted, etc.) |
| **Cold starts** | Near-zero (V8 isolates) | Depends on hosting platform |
| **Cost** | Generous free tier (100k requests/day) | Free tier on Vercel; varies elsewhere |
| **Deployment** | `wrangler deploy` | `vercel deploy`, `npm run build && npm start`, etc. |

Both backends expose the same API surface, so you can switch later if needed.

### What Gets Generated

After the CLI finishes, your output directory will contain:

```
framer-auth-<project-name>/
  backend/                    # Your chosen backend (Cloudflare Worker or Next.js)
    src/                      # Route handlers for /auth/send-otp, /auth/verify-otp, /auth/session, /auth/logout
    package.json              # Backend dependencies (supabase-js, resend, etc.)
    wrangler.toml             # (Cloudflare only) Worker configuration
  framer-overrides/           # Code override files for your Framer project
    authStore.ts              # Shared auth state store and session checker
    withAuth.ts               # Protect pages -- redirects unauthenticated users
    userDisplay.ts            # Show logged-in user's email, name, or role
    authRedirect.ts           # Redirect authenticated users away from the login page
  supabase/
    migrations/
      001_auth_setup.sql      # SQL migration for profiles, user_rules, RLS policies
```

---

## Step 2: Run the SQL Migration

The generated migration file creates the database tables and security policies that power user profiles and feature flags.

### Run the Migration

1. Open your [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project.
3. Go to **SQL Editor** in the left sidebar.
4. Click **New Query**.
5. Open the file `supabase/migrations/001_auth_setup.sql` from your generated project and paste its entire contents into the query editor.
6. Click **Run** (or press Ctrl/Cmd + Enter).

You should see a "Success. No rows returned" message.

### What the Migration Creates

**`public.profiles` table** -- Extends Supabase's built-in `auth.users` with additional fields:

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid (PK, FK to `auth.users`) | Links to the Supabase auth user |
| `email` | text | Copied from auth for easy querying |
| `full_name` | text | User's display name |
| `avatar_url` | text | URL to a profile image |
| `role` | enum (`admin`, `member`, `guest`) | Defaults to `member` |
| `created_at` | timestamptz | Auto-set on creation |
| `updated_at` | timestamptz | Auto-set on creation |

**`public.user_rules` table** -- Per-user boolean feature flags:

| Column | Type | Purpose |
|---|---|---|
| `id` | uuid (PK) | Auto-generated |
| `user_id` | uuid (FK to `profiles`) | Which user this rule belongs to |
| `rule_key` | text | Name of the rule (e.g., `can_access_beta`) |
| `rule_value` | boolean | Whether the rule is enabled |
| `created_at` | timestamptz | Auto-set on creation |

**`handle_new_user()` trigger** -- Automatically creates a `profiles` row whenever a new user signs up through Supabase Auth. You never need to manually insert profiles.

**Row Level Security (RLS) policies:**

- Users can read and update their own profile.
- Users can read their own rules.
- Admins have full access to all profiles and all user rules.

### Verify the Migration

After running the SQL, go to **Table Editor** in the left sidebar of the Supabase dashboard. You should see two new tables: `profiles` and `user_rules`. Both will be empty until users start signing up.

---

## Step 3: Configure Resend as SMTP in Supabase

Supabase needs to send OTP codes via email. By default it uses a built-in mail provider with strict rate limits. You will replace it with Resend for reliable, branded email delivery.

### 3a. Configure the Email Auth Provider

1. In the Supabase dashboard, go to **Authentication** in the left sidebar.
2. Click **Providers**.
3. Find **Email** and make sure it is **enabled**.
4. **Turn OFF "Confirm email"** -- framer-auth-kit uses OTP verification instead of confirmation links, so this setting should be disabled. If left on, users will receive a redundant confirmation email.
5. Click **Save**.

### 3b. Set Up Custom SMTP

1. In the Supabase dashboard, go to **Project Settings** (gear icon in the left sidebar).
2. Click **Authentication** in the settings menu.
3. Scroll down to **SMTP Settings**.
4. Toggle **Enable Custom SMTP** to on.
5. Fill in the following:

| Field | Value |
|---|---|
| **Sender email** | `noreply@yourdomain.com` (must be on a domain you verified in Resend) |
| **Sender name** | Your app or brand name (e.g., `MyApp`) |
| **Host** | `smtp.resend.com` |
| **Port number** | `465` |
| **Minimum interval** | Leave at default (60 seconds) or adjust to your preference |
| **Username** | `resend` |
| **Password** | Your Resend API key (`re_...`) |

6. Click **Save**.

### Verify SMTP

To confirm it works, go to **Authentication > Users** in the Supabase dashboard and invite a user with your own email address. You should receive the email within a few seconds, and it should show your custom sender address rather than the default Supabase sender.

---

## Step 4: Deploy Your Backend

Choose the instructions for the backend you selected during CLI setup.

### Option A: Cloudflare Worker

1. Install dependencies:
   ```bash
   cd framer-auth-<project-name>/backend
   npm install
   ```
2. If you have not already, install Wrangler and log in:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
3. Set your secrets (Wrangler will prompt you to paste each value):
   ```bash
   wrangler secret put SUPABASE_URL
   wrangler secret put SUPABASE_ANON_KEY
   wrangler secret put RESEND_API_KEY
   ```
4. Deploy:
   ```bash
   wrangler deploy
   ```
5. Note the deployed URL (e.g., `https://framer-auth-my-app.your-account.workers.dev`). You will need this in Step 5.

For full details, see [Cloudflare Worker Setup](./cloudflare-setup.md).

### Option B: Next.js

1. Install dependencies:
   ```bash
   cd framer-auth-<project-name>/backend
   npm install
   ```
2. Create a `.env.local` file in the backend directory:
   ```env
   SUPABASE_URL=https://abcdefgh.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJI...
   RESEND_API_KEY=re_abc123...
   ```
3. To deploy to Vercel:
   ```bash
   npx vercel deploy
   ```
   Or to self-host:
   ```bash
   npm run build
   npm start
   ```
4. Note the deployed URL (e.g., `https://framer-auth-my-app.vercel.app`). You will need this in Step 5.

For full details, see [Next.js Setup](./nextjs-setup.md).

---

## Step 5: Update the Backend URL in Framer Overrides

Now that your backend is deployed, you need to point the Framer overrides at it.

1. Open `framer-overrides/authStore.ts` in your generated project.
2. Find this line near the top of the file:
   ```ts
   const BACKEND_URL = "YOUR_BACKEND_URL"
   ```
3. Replace `YOUR_BACKEND_URL` with your actual deployed backend URL:
   ```ts
   const BACKEND_URL = "https://framer-auth-my-app.your-account.workers.dev"
   ```

**Important:** Do not include a trailing slash. Use `https://example.com`, not `https://example.com/`.

---

## Step 6: Add Overrides to Your Framer Project

Framer **code overrides** let you attach custom logic to any element on your canvas -- they can control visibility, trigger redirects, display dynamic text, and more. framer-auth-kit provides four override files that handle the entire auth flow.

### Add the Override Files

1. Open your Framer project.
2. In the left sidebar, click the **Assets** panel (or press `A`), then open the **Code** tab.
3. Create four new code override files, one for each file in your `framer-overrides/` directory:
   - `authStore.ts` -- Shared auth state and session management
   - `withAuth.ts` -- Protects pages by redirecting unauthenticated visitors
   - `userDisplay.ts` -- Displays the logged-in user's email, name, or role on any text element
   - `authRedirect.ts` -- Redirects already-authenticated users away from the login/signup page
4. Copy the contents of each generated file into the corresponding Framer code file.

### Apply Overrides to Elements

Once the files are in Framer:

- Apply `AuthProvider` (from `authStore.ts`) to your **top-level page wrapper** or a persistent layout element so the session is checked on every page load.
- Apply `withAuth` to any **page or section** that should be visible only to logged-in users.
- Apply `userDisplay` to **text elements** where you want to show the user's email or name.
- Apply `authRedirect` to your **login page** so users who are already logged in get redirected to the dashboard.

For a detailed breakdown of every override, its props, and advanced usage patterns, see [Framer Overrides Guide](./framer-overrides-guide.md).

---

## Step 7: Test the Flow

With everything deployed and wired up, walk through the full authentication flow.

### Test Checklist

1. **Visit your Framer site** in an incognito/private browser window.
2. **Navigate to the login page.** You should see your login form.
3. **Enter your email address** and submit. The form should call your backend's `/auth/send-otp` endpoint.
4. **Check your inbox** for the OTP email. It should arrive within a few seconds and come from your custom sender address (e.g., `noreply@yourdomain.com`).
5. **Enter the OTP code** on the verification screen. The form should call `/auth/verify-otp`.
6. **Verify you are redirected** to the protected area of your site (e.g., a dashboard page).
7. **Refresh the page.** You should remain logged in (the session is persisted via cookies).
8. **Log out** and confirm you are redirected back to the login page.

### Common Issues and Quick Fixes

| Problem | Likely Cause | Fix |
|---|---|---|
| OTP email never arrives | SMTP not configured or domain not verified in Resend | Double-check Step 3. Make sure the sender email uses your verified Resend domain. Test from **Authentication > Users > Invite User** in Supabase. |
| `Failed to fetch` or CORS errors in browser console | Backend URL is wrong or missing CORS headers | Verify the `BACKEND_URL` in `authStore.ts` matches your deployed URL exactly (no trailing slash). Check that your backend includes CORS headers allowing your Framer site's origin. |
| OTP is sent but verification fails | Supabase "Confirm email" is still enabled | Go to **Authentication > Providers > Email** in Supabase and make sure "Confirm email" is turned off. |
| User logs in but page does not update | `AuthProvider` override is not applied | Make sure `AuthProvider` from `authStore.ts` is applied to a top-level element that is present on every page. |
| Profile is not created after first login | Migration was not run | Run the SQL migration from Step 2. The `handle_new_user` trigger must exist for automatic profile creation. |
| "Invalid API key" error from the backend | Wrong Supabase anon key or Resend API key | Re-check the values in your environment variables or Wrangler secrets. The Supabase key should start with `eyJ` and the Resend key with `re_`. |

---

## What's Next

You are up and running. Here are some places to go from here:

- **[Supabase Schema Guide](./supabase-schema.md)** -- Learn how to use roles (`admin`, `member`, `guest`) and user rules to control access to different parts of your site. Covers how to assign roles, create custom rule keys, and query them from your backend.

- **[Framer Overrides Guide](./framer-overrides-guide.md)** -- Deep dive into all four override files, including how to customize redirect paths, conditionally show/hide elements based on role, and display user metadata.

- **[Cloudflare Worker Setup](./cloudflare-setup.md)** / **[Next.js Setup](./nextjs-setup.md)** -- Detailed backend deployment guides with environment variable reference, custom domain setup, and production hardening tips.

- **[PageLock by Proofly](https://proofly.xyz)** -- For page-level protection that blocks content _before_ it renders (at the edge, before Framer's HTML reaches the browser). framer-auth-kit's overrides protect content at the client level after the page loads; PageLock adds a server-side layer for stricter access control.
