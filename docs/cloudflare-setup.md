# Cloudflare Worker Backend Setup

## Overview

The Cloudflare Worker backend handles all authentication API requests for your Framer site at the edge. Cloudflare Workers run on a globally distributed network with data centers in over 300 cities, meaning your auth endpoints respond with minimal latency regardless of where your users are.

The worker exposes four endpoints:

- **POST /auth/send-otp** -- sends a one-time password to the user's email via Supabase (which delegates to Resend SMTP)
- **POST /auth/verify-otp** -- verifies the OTP, creates a Supabase session, and sets HttpOnly cookies
- **GET /auth/session** -- reads the session cookies and returns the current user (or null)
- **POST /auth/logout** -- clears the session cookies and signs the user out of Supabase

All session state is stored in HttpOnly, Secure cookies. The worker uses the Supabase JS client for all auth operations.

**Key files:**

| File | Purpose |
|------|---------|
| `src/index.ts` | Worker entry point -- routing, CORS, and all endpoint handlers |
| `wrangler.toml` | Wrangler configuration -- bindings, environment variables, deployment settings |
| `package.json` | Dependencies and scripts |

---

## Prerequisites

1. **Cloudflare account** -- a free tier account is sufficient. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com).
2. **Wrangler CLI** installed and authenticated:
   ```bash
   npm install -g wrangler
   wrangler login
   ```
   This opens a browser window to authenticate with your Cloudflare account.
3. **Node.js 18+** -- required for local development and dependency installation.
4. **Generated project** -- you have already run `npx framer-auth-kit` and selected **Cloudflare Worker** as the backend type. This guide assumes you are working inside the output directory.

---

## Step 1: Install Dependencies

Navigate to the generated project directory and install dependencies:

```bash
cd your-output-dir
npm install
```

This installs the Supabase JS client (`@supabase/supabase-js`), the Resend SDK if used directly, and any other dependencies declared in `package.json`.

---

## Step 2: Configure wrangler.toml

Open `wrangler.toml` in your editor. You will see a `[vars]` section with placeholder values:

```toml
[vars]
SUPABASE_URL = "https://xxxx.supabase.co"
SUPABASE_ANON_KEY = "eyJhb..."
RESEND_API_KEY = "re_..."
ALLOWED_ORIGIN = "https://your-framer-site.com"
COOKIE_DOMAIN = "your-domain.com"
```

Here is what each variable does:

| Variable | Description | Example |
|----------|-------------|---------|
| `SUPABASE_URL` | Your Supabase project URL. Found in the Supabase dashboard under **Settings > API**. | `https://abcdefg.supabase.co` |
| `SUPABASE_ANON_KEY` | The public anon/service key from Supabase. Found in the same location as the URL. This is safe to use on the server but should still be kept as a secret in production. | `eyJhbGciOi...` |
| `RESEND_API_KEY` | Your Resend API key. Supabase uses Resend as the SMTP provider for sending OTP emails. Found in the [Resend dashboard](https://resend.com/api-keys). | `re_abc123...` |
| `ALLOWED_ORIGIN` | The exact URL of your Framer site. Used for CORS headers (`Access-Control-Allow-Origin`). Must include the protocol (`https://`) and must **not** have a trailing slash. | `https://mysite.framer.app` |
| `COOKIE_DOMAIN` | The domain used for the `Domain` attribute on session cookies. Must be a parent domain that covers both your worker's domain and your Framer site. See the explanation below. | `.example.com` |

**Understanding COOKIE_DOMAIN:**

Cookies are scoped by domain. For the browser to send session cookies (set by the worker) back to the worker on requests originating from your Framer site, the cookie's `Domain` attribute must cover both domains. For example:

- Worker at `auth.example.com`, Framer site at `www.example.com` -- set `COOKIE_DOMAIN` to `.example.com`
- Worker at `auth-worker.your-account.workers.dev`, Framer site at `mysite.framer.app` -- these are on different root domains, so cookie sharing will not work. You need a custom domain (see Step 6)

**IMPORTANT:** The `[vars]` section in `wrangler.toml` stores values in plain text and they are visible to anyone with access to the repository. For production deployments, move `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `RESEND_API_KEY` to secrets (Step 3) and remove them from `[vars]`. Keep only `ALLOWED_ORIGIN` and `COOKIE_DOMAIN` in `[vars]` since these are not sensitive.

After moving secrets, your `[vars]` section should look like:

```toml
[vars]
ALLOWED_ORIGIN = "https://your-framer-site.com"
COOKIE_DOMAIN = ".your-domain.com"
```

---

## Step 3: Set Secrets

Secrets are encrypted at rest and injected into the Worker at runtime. They never appear in logs, source code, or the Cloudflare dashboard after being set.

Run each command and paste the value when prompted:

```bash
wrangler secret put SUPABASE_URL
# Paste your Supabase project URL, e.g. https://abcdefg.supabase.co

wrangler secret put SUPABASE_ANON_KEY
# Paste your Supabase anon key

wrangler secret put RESEND_API_KEY
# Paste your Resend API key, e.g. re_abc123...
```

After setting secrets, **remove those three variables from the `[vars]` section** in `wrangler.toml` to avoid confusion. Secrets take precedence over `[vars]` at runtime, but having both is misleading and risks accidentally committing real credentials.

You can verify your secrets are set with:

```bash
wrangler secret list
```

---

## Step 4: Local Development

Start the local development server:

```bash
npm run dev
```

This runs `wrangler dev` under the hood. The worker will be available at **http://localhost:8787**.

During local development, the `[vars]` values from `wrangler.toml` are used (secrets are not available locally unless you create a `.dev.vars` file). Create a `.dev.vars` file in the project root for local secrets:

```
SUPABASE_URL=https://abcdefg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
RESEND_API_KEY=re_abc123...
```

> **Note:** Add `.dev.vars` to your `.gitignore` to avoid committing credentials.

Test with curl against all four endpoints:

**Send OTP:**

```bash
curl -X POST http://localhost:8787/auth/send-otp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email": "user@example.com"}'
```

**Verify OTP:**

```bash
curl -X POST http://localhost:8787/auth/verify-otp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -c cookies.txt \
  -d '{"email": "user@example.com", "token": "123456"}'
```

The `-c cookies.txt` flag tells curl to save cookies returned by the server into `cookies.txt`.

**Check session:**

```bash
curl http://localhost:8787/auth/session \
  -H "Origin: http://localhost:5173" \
  -b cookies.txt
```

The `-b cookies.txt` flag sends the saved cookies with the request.

**Logout:**

```bash
curl -X POST http://localhost:8787/auth/logout \
  -H "Origin: http://localhost:5173" \
  -b cookies.txt \
  -c cookies.txt
```

Both `-b` and `-c` are used here: `-b` sends the session cookies, and `-c` saves the cleared cookies (so `cookies.txt` reflects the logged-out state).

---

## Step 5: Deploy

Deploy the worker to Cloudflare's edge network:

```bash
npm run deploy
# or directly:
wrangler deploy
```

Wrangler will output the live URL, for example:

```
Published framer-auth-worker (1.2 sec)
  https://framer-auth-worker.your-subdomain.workers.dev
```

This URL is your **BACKEND_URL**. Use it when configuring the Framer overrides in your Framer site. All four auth endpoints are available under this base URL (e.g., `https://framer-auth-worker.your-subdomain.workers.dev/auth/send-otp`).

---

## Step 6: Custom Domain (Optional)

By default, your worker is served from a `*.workers.dev` subdomain. For production use, you should add a custom domain. This is especially important for cookies -- if your Framer site is at `www.example.com`, your worker should be on a subdomain like `auth.example.com` so you can set `COOKIE_DOMAIN` to `.example.com` and share cookies across both.

**To add a custom domain:**

1. Go to the [Cloudflare dashboard](https://dash.cloudflare.com).
2. Navigate to **Workers & Pages > your worker > Settings > Domains & Routes**.
3. Click **Add Custom Domain**.
4. Enter your desired subdomain (e.g., `auth.example.com`). The parent domain must already be on Cloudflare (either as a full DNS setup or a CNAME setup).
5. Cloudflare automatically provisions a DNS record and TLS certificate.
6. Update your `ALLOWED_ORIGIN` and `COOKIE_DOMAIN` if needed.

After adding the custom domain:

- Update `COOKIE_DOMAIN` to the shared parent domain (e.g., `.example.com`)
- Update `ALLOWED_ORIGIN` to your Framer site URL if it changed
- Redeploy with `npm run deploy`

---

## Endpoint Reference

| Method | Path | Request Body | Response (200) | Notes |
|--------|------|-------------|-----------------|-------|
| POST | `/auth/send-otp` | `{ "email": "user@example.com" }` | `{ "success": true }` | Triggers Supabase OTP email via Resend SMTP. Returns 200 even if the email does not exist (to prevent enumeration). |
| POST | `/auth/verify-otp` | `{ "email": "user@example.com", "token": "123456" }` | `{ "user": { "id": "...", "email": "..." } }` | On success, sets `sb-access-token` and `sb-refresh-token` as HttpOnly, Secure, SameSite=None cookies. Returns 401 if the token is invalid or expired. |
| GET | `/auth/session` | None (cookies sent automatically) | `{ "user": { "id": "...", "email": "..." } }` or `{ "user": null }` | Reads the session from cookies. Returns `null` user if no valid session exists. |
| POST | `/auth/logout` | None (cookies sent automatically) | `{ "success": true }` | Clears session cookies and calls `supabase.auth.signOut()`. |

All endpoints return `Content-Type: application/json` and include CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`).

All error responses follow the shape `{ "error": "Description of the problem" }` with an appropriate HTTP status code (400, 401, or 500).

---

## Troubleshooting

### CORS errors

**Symptom:** The browser console shows "Access to fetch has been blocked by CORS policy."

**Fix:** Verify that `ALLOWED_ORIGIN` matches your Framer site URL exactly. Common mistakes:
- Trailing slash: `https://mysite.framer.app/` should be `https://mysite.framer.app`
- Wrong protocol: `http://` instead of `https://`
- Wrong subdomain: `mysite.framer.app` vs `www.mysite.com`

Also ensure your Framer-side fetch calls include `credentials: "include"` so the browser sends cookies cross-origin.

### Cookies not being set

**Symptom:** `/auth/verify-otp` returns a user object, but `/auth/session` returns `null`.

**Fix:**
- Both the worker and the Framer site must be served over **HTTPS**. The cookies use `Secure` and `SameSite=None`, which browsers reject over HTTP.
- Check `COOKIE_DOMAIN`. It must be a parent domain of both the worker and the Framer site. If they are on completely different root domains (e.g., `workers.dev` and `framer.app`), you need a custom domain (Step 6).
- In Chrome DevTools, go to **Application > Cookies** to inspect whether cookies are present and what domain they are set on.

### OTP email not arriving

**Symptom:** `/auth/send-otp` returns `{ "success": true }` but no email is received.

**Fix:**
- Verify that Resend is configured as the SMTP provider in your Supabase project. Go to **Supabase Dashboard > Authentication > Email Templates > SMTP Settings**.
- Check your Resend dashboard for delivery logs and bounces.
- Make sure the sender domain is verified in Resend.
- Check spam/junk folders.

### 500 Internal Server Error

**Symptom:** Endpoints return a 500 status.

**Fix:** Use `wrangler tail` to stream live logs from your deployed worker:

```bash
wrangler tail
```

This shows all `console.log`, `console.error`, and uncaught exception output in real time. Common causes:
- Invalid or missing `SUPABASE_URL` or `SUPABASE_ANON_KEY`
- Network errors connecting to Supabase
- Malformed request bodies

### Worker not updating after deploy

**Symptom:** You deployed changes but the worker still serves old code.

**Fix:** Workers deploy globally within seconds, but browsers may cache responses. Try:
- Hard refresh (Ctrl+Shift+R)
- Clear the browser cache
- Test with curl to bypass browser caching
- Verify the deploy succeeded by checking the output of `wrangler deploy`
