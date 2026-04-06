# framer-auth-kit

**Self-hosted authentication for Framer sites. Supabase + Resend + your backend. Zero third-party auth services.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## Why framer-auth-kit?

Framer is great for building sites, but adding authentication usually means paying for third-party services or cobbling together fragile workarounds. **framer-auth-kit** gives you a complete, production-ready auth system that you fully own:

- **No monthly auth fees** - uses Supabase's generous free tier and Resend's free email tier
- **No vendor lock-in** - you own every line of code, deploy it on your own infrastructure
- **Works with any Framer site** - drop-in override files that integrate with Framer's built-in code override system
- **One command setup** - interactive CLI scaffolds everything in under 2 minutes

---

## Features

- **OTP / magic-link email login** - powered by Supabase Auth, delivered via Resend
- **Secure cookie-based sessions** - HttpOnly, Secure, SameSite=None cookies (no tokens in localStorage)
- **Two backend options** - Cloudflare Worker (edge-first, globally distributed) or Next.js App Router (familiar, Vercel-deployable)
- **Framer code overrides** - protect pages, display user info, manage auth redirects
- **Profiles & roles** - admin, member, and guest roles with auto-profile creation on signup
- **Per-user feature flags** - flexible `user_rules` table for gating content per user
- **Row Level Security** - Supabase RLS policies pre-configured out of the box
- **Interactive CLI** - scaffolds your entire backend, overrides, and database migration in one command

---

## Quick Start

### Prerequisites

Before you begin, make sure you have:

1. **Node.js 18+** installed ([download](https://nodejs.org/))
2. A **Supabase project** ([create one free](https://supabase.com/dashboard))
3. A **Resend account** with a verified domain ([sign up free](https://resend.com/))
4. Your Supabase **project URL** and **anon key** (found in Supabase Dashboard > Settings > API)
5. Your Resend **API key** (found in Resend Dashboard > API Keys)

### Run the CLI

```bash
npx framer-auth-kit
```

The CLI will ask you for:

| Prompt | Description | Example |
|--------|-------------|---------|
| Project name | Used for the output folder and wrangler config | `my-saas` |
| Supabase URL | Your Supabase project URL | `https://abc123.supabase.co` |
| Supabase anon key | The public `anon` key (safe to expose in client code) | `eyJhbG...` |
| Resend API key | Your Resend API key for sending emails | `re_abc123...` |
| Backend choice | Cloudflare Worker or Next.js | `Cloudflare Worker` |
| Output directory | Where to write the generated files | `./framer-auth-my-saas` |

### What gets generated

```
framer-auth-my-saas/
  src/index.ts              # Backend with all 4 auth endpoints (CF) or app/api/auth/... (Next.js)
  wrangler.toml             # Wrangler config (CF) or .env.local (Next.js)
  package.json              # Dependencies, ready to npm install
  framer-overrides/
    authStore.ts            # Shared auth state + API functions
    withAuth.ts             # Page protection HOC
    userDisplay.ts          # Show user email/name in text layers
    authRedirect.ts         # Redirect logic for login/dashboard pages
  supabase/
    migrations/
      001_auth_setup.sql    # Database schema, triggers, RLS policies
  .env.template             # Environment variable reference
```

### Next steps after scaffolding

1. **Run the SQL migration** - Paste `001_auth_setup.sql` into your Supabase SQL Editor and run it
2. **Configure Resend as SMTP** - Set up Resend in Supabase's SMTP settings ([detailed guide](./docs/supabase-schema.md#setting-up-resend-as-supabase-smtp-provider))
3. **Deploy your backend** - Follow the [Cloudflare guide](./docs/cloudflare-setup.md) or [Next.js guide](./docs/nextjs-setup.md)
4. **Update `API_BASE`** - Set the deployed backend URL in `framer-overrides/authStore.ts`
5. **Add overrides to Framer** - Copy the override files into your Framer project ([override guide](./docs/framer-overrides-guide.md))

---

## Architecture

```
                                    ┌──────────────────────┐
                                    │   Resend (SMTP)      │
                                    │   Sends OTP emails   │
                                    └──────────┬───────────┘
                                               │
┌─────────────────────┐            ┌───────────┴───────────┐
│   Framer Site       │  fetch()   │   Your Backend        │
│                     │ ────────── │   (CF Worker / Next)  │
│   authStore.ts      │ cookies    │                       │
│   withAuth.ts       │ ◄──────── │   /auth/send-otp      │
│   userDisplay.ts    │            │   /auth/verify-otp    │
│   authRedirect.ts   │            │   /auth/session       │
│                     │            │   /auth/logout        │
└─────────────────────┘            └───────────┬───────────┘
                                               │
                                    ┌──────────┴───────────┐
                                    │   Supabase           │
                                    │   Auth + PostgreSQL   │
                                    │   profiles, roles,   │
                                    │   user_rules, RLS    │
                                    └──────────────────────┘
```

### Auth flow step by step

1. User visits your Framer site. The `authStore.ts` override calls `GET /auth/session` on load to check for an existing session cookie.
2. If no session exists and the page is protected with `withAuth`, the user is redirected to the login page.
3. User enters their email. Your Framer login form calls `sendOtp(email)` from `authStore.ts`.
4. The backend calls `supabase.auth.signInWithOtp()`. Supabase sends a 6-digit OTP code via Resend.
5. User enters the OTP code. Your form calls `verifyOtp(email, token)`.
6. The backend verifies with Supabase and sets HttpOnly cookies (`access_token`, `refresh_token`) on the response.
7. The browser stores the cookies automatically. All subsequent requests to the backend include them.
8. Protected pages check `GET /auth/session` via cookies - no tokens in localStorage, no XSS risk.

### API Endpoints

All endpoints are identical between the Cloudflare Worker and Next.js backends:

| Method | Path | Request Body | Response | Description |
|--------|------|-------------|----------|-------------|
| `POST` | `/auth/send-otp` | `{ "email": "user@example.com" }` | `{ "success": true }` | Sends a 6-digit OTP to the email via Supabase + Resend |
| `POST` | `/auth/verify-otp` | `{ "email": "user@example.com", "token": "123456" }` | `{ "success": true, "user": {...} }` | Verifies OTP, sets HttpOnly session cookies |
| `GET` | `/auth/session` | - | `{ "user": {...} }` or `{ "user": null }` | Reads cookies, returns current user or null |
| `POST` | `/auth/logout` | - | `{ "success": true }` | Clears session cookies, signs out from Supabase |

All responses include CORS headers with `Access-Control-Allow-Credentials: true` for cross-origin cookie support.

---

## Environment Variables

Both backends use the same set of environment variables:

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL (e.g., `https://abc123.supabase.co`) |
| `SUPABASE_ANON_KEY` | Yes | Your Supabase public anon key |
| `RESEND_API_KEY` | Yes | Your Resend API key for email delivery |
| `ALLOWED_ORIGIN` | Yes | Your Framer site's full URL for CORS (e.g., `https://mysite.framer.app`). Must match exactly, no trailing slash. |
| `COOKIE_DOMAIN` | Yes | Domain for session cookies (e.g., `mysite.framer.app`). Must be accessible from both your backend and Framer site. |

---

## Database Schema

The generated SQL migration creates:

### `profiles` table
Extends Supabase's built-in `auth.users` with app-specific fields:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` (PK) | - | References `auth.users(id)`, cascades on delete |
| `email` | `text` | - | User's email address |
| `full_name` | `text` | - | Display name |
| `avatar_url` | `text` | - | Avatar image URL |
| `role` | `user_role` | `'member'` | One of: `admin`, `member`, `guest` |
| `created_at` | `timestamptz` | `now()` | When the profile was created |
| `updated_at` | `timestamptz` | `now()` | Last profile update |

A profile is **automatically created** when a user signs up via the `handle_new_user()` trigger.

### `user_rules` table
Per-user boolean feature flags:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `id` | `uuid` (PK) | `gen_random_uuid()` | Auto-generated |
| `user_id` | `uuid` (FK) | - | References `profiles(id)` |
| `rule_key` | `text` | - | Rule name (e.g., `"can_export"`, `"premium_access"`) |
| `rule_value` | `boolean` | `false` | Whether the rule is enabled |
| `created_at` | `timestamptz` | `now()` | When the rule was created |

### Row Level Security policies

| Table | Policy | Operation | Rule |
|-------|--------|-----------|------|
| `profiles` | Users can view own profile | `SELECT` | `auth.uid() = id` |
| `profiles` | Users can update own profile | `UPDATE` | `auth.uid() = id` |
| `profiles` | Admins have full access | `ALL` | User's role = `admin` |
| `user_rules` | Users can view own rules | `SELECT` | `auth.uid() = user_id` |
| `user_rules` | Admins have full access | `ALL` | User's role = `admin` |

---

## Framer Overrides

The generated overrides are TypeScript files you copy into your Framer project. They provide:

| File | Purpose | Usage |
|------|---------|-------|
| `authStore.ts` | Global auth state + API functions (`sendOtp`, `verifyOtp`, `logout`, `checkSession`) | Imported by all other overrides. Auto-checks session on page load. |
| `withAuth.ts` | Protects components/pages - hides content if not logged in | Apply as a code override on any frame you want to protect |
| `userDisplay.ts` | Shows user email or name in text layers | Apply `withUserEmail` or `withUserName` as code overrides on text elements |
| `authRedirect.ts` | Redirects unauthenticated users to login, or logged-in users away from login | Apply `withAuthRedirect` on protected pages, `withLogoutRedirect` on login page |

See the [Framer Overrides Guide](./docs/framer-overrides-guide.md) for detailed setup instructions.

---

## Project Structure

```
framer-auth-kit/
├── cli/                              # Interactive CLI (npx framer-auth-kit)
│   ├── index.ts                      # Entry point - banner, wizard, generators
│   ├── prompts.ts                    # All CLI questions (clack)
│   ├── generators/
│   │   ├── cloudflare.ts             # Generates CF Worker files
│   │   ├── nextjs.ts                 # Generates Next.js API route files
│   │   ├── supabase.ts              # Generates SQL migration + .env template
│   │   └── framer.ts                # Generates Framer override files
│   └── utils/
│       ├── files.ts                  # File writing utility (fs-extra)
│       └── banner.ts                 # ASCII banner + success messages
├── backends/
│   ├── cloudflare-worker/
│   │   ├── src/index.ts              # Worker: all 4 auth endpoints
│   │   ├── wrangler.toml             # Wrangler config
│   │   └── package.json
│   └── nextjs/
│       ├── app/api/auth/
│       │   ├── send-otp/route.ts     # POST /api/auth/send-otp
│       │   ├── verify-otp/route.ts   # POST /api/auth/verify-otp
│       │   ├── session/route.ts      # GET /api/auth/session
│       │   └── logout/route.ts       # POST /api/auth/logout
│       ├── lib/                      # Shared utilities (supabase, cookies, cors)
│       └── package.json
├── framer-overrides/                 # Reference override files
│   ├── authStore.ts                  # Auth state (Framer Data store)
│   ├── withAuth.ts                   # Page guard override
│   ├── userDisplay.ts               # User info display overrides
│   └── authRedirect.ts              # Auth redirect overrides
├── supabase/
│   └── migrations/
│       └── 001_auth_setup.sql        # Profiles, roles, user_rules, RLS
├── docs/                             # Detailed guides
│   ├── getting-started.md
│   ├── cloudflare-setup.md
│   ├── nextjs-setup.md
│   ├── framer-overrides-guide.md
│   └── supabase-schema.md
├── README.md
├── LICENSE                           # MIT
└── package.json                      # Root config, CLI entry point
```

---

## Documentation

| Guide | Description |
|-------|-------------|
| [Getting Started](./docs/getting-started.md) | Full walkthrough from zero to deployed |
| [Cloudflare Worker Setup](./docs/cloudflare-setup.md) | Deploy, configure secrets, test endpoints |
| [Next.js Setup](./docs/nextjs-setup.md) | Deploy to Vercel or self-host, configure env vars |
| [Framer Overrides Guide](./docs/framer-overrides-guide.md) | Add overrides to Framer, configure each file |
| [Supabase Schema](./docs/supabase-schema.md) | Database tables, RLS policies, SMTP setup, admin roles |

---

## Security Considerations

- **Cookies over localStorage** - Session tokens are stored in HttpOnly cookies, making them inaccessible to JavaScript and resistant to XSS attacks.
- **SameSite=None + Secure** - Required for cross-origin cookies (Framer site to your backend). Both sides must use HTTPS.
- **CORS with credentials** - The `ALLOWED_ORIGIN` env var restricts which domains can make authenticated requests. Never set this to `*` in production.
- **Row Level Security** - All database tables have RLS enabled. Users can only access their own data. Admins have full access.
- **Server-side validation** - All auth operations (OTP send, verify, session check) happen server-side via the Supabase client. The frontend never touches raw tokens.

---

## License

MIT - see [LICENSE](./LICENSE).

---

Built by [Proofly](https://proofly.xyz)

Want page-level content protection that blocks rendering before the page loads? Check out **[PageLock by Proofly](https://proofly.xyz)**.
