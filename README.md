# framer-auth-kit

**Self-hosted auth for Framer sites. Supabase + Resend + your backend.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

---

## Features

- **OTP email login** powered by Supabase Auth and Resend
- **Cookie-based sessions** with HttpOnly, Secure, SameSite=None cookies
- **Two backend options**: Cloudflare Worker (edge) or Next.js (App Router)
- **Framer overrides** for protecting pages, displaying user info, and managing redirects
- **Profiles and roles** with admin, member, and guest roles out of the box
- **User rules** for flexible per-user feature flags
- **Row Level Security** policies pre-configured in Supabase
- **Interactive CLI** that scaffolds everything in one command

## Quick Start

```bash
npx framer-auth-kit
```

The CLI walks you through setup and generates:

- A backend (Cloudflare Worker or Next.js) with auth endpoints
- Framer override files ready to paste into your project
- A Supabase SQL migration for profiles, roles, and user rules

## Architecture

```
Browser (Framer site)
  |
  |  fetch with credentials: "include"
  v
Backend (Cloudflare Worker or Next.js)
  |
  |  Supabase JS client
  v
Supabase Auth + PostgreSQL
  |
  |  SMTP
  v
Resend (sends OTP emails)
```

**Auth flow:**

1. User enters their email on the Framer login page.
2. Frontend calls `POST /auth/send-otp` with the email.
3. Supabase sends an OTP code via Resend.
4. User enters the code; frontend calls `POST /auth/verify-otp`.
5. Backend verifies with Supabase and sets HttpOnly session cookies.
6. Subsequent requests to `GET /auth/session` use cookies to check auth state.

**Endpoints:**

| Method | Path              | Description              |
|--------|-------------------|--------------------------|
| POST   | `/auth/send-otp`  | Send OTP to email        |
| POST   | `/auth/verify-otp`| Verify OTP, set cookies  |
| GET    | `/auth/session`   | Check current session    |
| POST   | `/auth/logout`    | Clear session cookies    |

## Documentation

- [Getting Started](./docs/getting-started.md)
- [Cloudflare Worker Setup](./docs/cloudflare-setup.md)
- [Next.js Setup](./docs/nextjs-setup.md)
- [Framer Overrides Guide](./docs/framer-overrides-guide.md)
- [Supabase Schema](./docs/supabase-schema.md)

## Project Structure

```
framer-auth-kit/
  cli/                    # Interactive CLI (npx framer-auth-kit)
  backends/
    cloudflare-worker/    # Cloudflare Worker backend template
    nextjs/               # Next.js App Router backend template
  framer-overrides/       # Framer code override files
    authStore.ts          # Shared auth state
    withAuth.ts           # Page protection override
    userDisplay.ts        # User info display overrides
    authRedirect.ts       # Login page redirect override
  supabase/
    migrations/           # SQL migration for profiles + rules
  docs/                   # Documentation
```

## License

MIT - see [LICENSE](./LICENSE).

---

By [Proofly](https://proofly.xyz)

---

Looking for page-level protection that blocks content before it even renders? Check out [PageLock by Proofly](https://proofly.xyz).
