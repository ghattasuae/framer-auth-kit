# Cloudflare Worker Setup

This guide covers deploying the generated Cloudflare Worker backend.

## Prerequisites

- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) installed and authenticated
- A Cloudflare account

## Project Structure

```
backend/
  src/
    index.ts          # Worker entry point with all auth endpoints
  wrangler.toml       # Wrangler configuration
```

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Configure ALLOWED_ORIGIN

Open `wrangler.toml` and set `ALLOWED_ORIGIN` to your Framer site's domain:

```toml
[vars]
ALLOWED_ORIGIN = "https://your-framer-site.com"
```

This controls the CORS `Access-Control-Allow-Origin` header. It must match your Framer site's URL exactly (no trailing slash).

## Step 3: Set Secrets

Use `wrangler secret put` to securely store your credentials:

```bash
wrangler secret put SUPABASE_URL
# Paste your Supabase project URL (https://xxxx.supabase.co)

wrangler secret put SUPABASE_ANON_KEY
# Paste your Supabase anon key

wrangler secret put RESEND_API_KEY
# Paste your Resend API key
```

These secrets are encrypted at rest and injected into the Worker at runtime.

## Step 4: Deploy

```bash
wrangler deploy
```

Wrangler will output the Worker URL, for example:

```
https://framer-auth-worker.<your-account>.workers.dev
```

Use this URL as `BACKEND_URL` in your Framer overrides.

## Endpoints

| Method | Path               | Description                  |
|--------|--------------------|------------------------------|
| POST   | `/auth/send-otp`   | Send an OTP code to an email |
| POST   | `/auth/verify-otp` | Verify OTP and set cookies   |
| GET    | `/auth/session`    | Check current session        |
| POST   | `/auth/logout`     | Clear session cookies        |

## Testing with curl

**Send OTP:**

```bash
curl -X POST https://your-worker.workers.dev/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Verify OTP:**

```bash
curl -X POST https://your-worker.workers.dev/auth/verify-otp \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "user@example.com", "token": "123456"}'
```

**Check session:**

```bash
curl https://your-worker.workers.dev/auth/session \
  -b cookies.txt
```

**Logout:**

```bash
curl -X POST https://your-worker.workers.dev/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

## Troubleshooting

- **CORS errors**: Verify `ALLOWED_ORIGIN` matches your Framer site URL exactly.
- **401 or empty session**: Make sure cookies are being sent. The Worker uses `SameSite=None; Secure` cookies, which require HTTPS on both the Worker and the Framer site.
- **OTP not arriving**: Check that Resend is configured as the SMTP provider in Supabase (see [Supabase Schema](./supabase-schema.md)).
