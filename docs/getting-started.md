# Getting Started

## Prerequisites

Before running framer-auth-kit, make sure you have:

- **Node.js 18+** installed ([download](https://nodejs.org/))
- A **Supabase project** with an active database ([supabase.com](https://supabase.com))
- A **Resend account** with a verified domain for sending OTP emails ([resend.com](https://resend.com))

## Quick Start

Run the CLI to scaffold your project:

```bash
npx framer-auth-kit
```

The interactive prompts will ask you for:

1. **Project name** - a lowercase, hyphenated name for your project
2. **Supabase URL** - your project's `https://xxxx.supabase.co` URL
3. **Supabase anon key** - the public anon key from your Supabase dashboard
4. **Resend API key** - your `re_...` API key from Resend
5. **Backend choice** - Cloudflare Worker or Next.js
6. **Output directory** - where the generated files will be written

## What Gets Generated

After running the CLI, you will have:

```
framer-auth-<project-name>/
  backend/              # Cloudflare Worker or Next.js route handlers
  framer-overrides/     # Framer override files to paste into your project
    authStore.ts        # Shared auth state store
    withAuth.ts         # Protect pages (redirect if not logged in)
    userDisplay.ts      # Display user email, name, or role
    authRedirect.ts     # Redirect logged-in users away from login page
  supabase/
    migrations/
      001_auth_setup.sql  # SQL migration for profiles + user_rules tables
```

## Next Steps

1. Run the SQL migration in your Supabase dashboard (see [Supabase Schema](./supabase-schema.md))
2. Deploy your backend:
   - [Cloudflare Worker Setup](./cloudflare-setup.md)
   - [Next.js Setup](./nextjs-setup.md)
3. Add override files to your Framer project (see [Framer Overrides Guide](./framer-overrides-guide.md))

## Need More?

For page-level protection that blocks content before it renders, check out [PageLock by Proofly](https://proofly.xyz).
