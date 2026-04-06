# Next.js Backend Setup

## Overview

The Next.js backend uses the App Router's route handlers to implement four authentication endpoints for your Framer site. Each endpoint lives in its own file under `app/api/auth/`, following Next.js conventions.

The backend handles:

- **POST /api/auth/send-otp** -- sends a one-time password to the user's email via Supabase (which delegates to Resend SMTP)
- **POST /api/auth/verify-otp** -- verifies the OTP, creates a Supabase session, and sets HttpOnly cookies
- **GET /api/auth/session** -- reads the session cookies and returns the current user (or null)
- **POST /api/auth/logout** -- clears the session cookies and signs the user out of Supabase

All session state is stored in HttpOnly, Secure cookies. The server uses the Supabase JS client for all auth operations.

This backend is deployable to Vercel, Netlify, Railway, Render, DigitalOcean App Platform, or any other platform that supports Node.js.

**Key files:**

| File | Purpose |
|------|---------|
| `app/api/auth/send-otp/route.ts` | Send OTP endpoint |
| `app/api/auth/verify-otp/route.ts` | Verify OTP endpoint, sets session cookies |
| `app/api/auth/session/route.ts` | Session check endpoint |
| `app/api/auth/logout/route.ts` | Logout endpoint, clears cookies |
| `lib/supabase.ts` | Supabase client factory |
| `lib/cookies.ts` | Cookie parsing and formatting helpers |
| `lib/cors.ts` | CORS header configuration |
| `.env.local` | Environment variables (not committed to git) |
| `package.json` | Dependencies and scripts |

---

## Prerequisites

1. **Node.js 18+** -- required for Next.js and the Supabase client.
2. **A hosting platform** -- Vercel (recommended), Netlify, Railway, Render, or any Node.js host.
3. **Generated project** -- you have already run `npx framer-auth-kit` and selected **Next.js** as the backend type. This guide assumes you are working inside the output directory.

---

## Step 1: Install Dependencies

Navigate to the generated project directory and install dependencies:

```bash
cd your-output-dir
npm install
```

This installs Next.js, React, the Supabase JS client (`@supabase/supabase-js`), and TypeScript.

---

## Step 2: Configure Environment Variables

The CLI generates a `.env.local` file with your Supabase and Resend credentials pre-filled. Open it and verify the values, and set `ALLOWED_ORIGIN` and `COOKIE_DOMAIN`:

```env
SUPABASE_URL=https://abcdefg.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOi...
RESEND_API_KEY=re_abc123...
ALLOWED_ORIGIN=https://your-framer-site.framer.app
COOKIE_DOMAIN=your-framer-site.framer.app
```

### Variable reference

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SUPABASE_URL` | Yes | Your Supabase project URL. Found in the Supabase dashboard under **Settings > API**. | `https://abcdefg.supabase.co` |
| `SUPABASE_ANON_KEY` | Yes | The public anon key from Supabase. Found in the same location. | `eyJhbGciOi...` |
| `RESEND_API_KEY` | Yes | Your Resend API key. Supabase uses Resend as the SMTP provider for sending OTP emails. Found in the [Resend dashboard](https://resend.com/api-keys). | `re_abc123...` |
| `ALLOWED_ORIGIN` | Yes | The exact URL of your Framer site. Used for CORS headers. Must include `https://` and must **not** have a trailing slash. | `https://mysite.framer.app` |
| `COOKIE_DOMAIN` | Yes | The domain for the `Domain` attribute on session cookies. Must be a parent domain accessible from both your Next.js backend and Framer site. | `.example.com` |

### Understanding ALLOWED_ORIGIN

The `ALLOWED_ORIGIN` value is set as the `Access-Control-Allow-Origin` response header. The browser enforces this -- if the origin of the request (your Framer site) does not match exactly, the browser blocks the response. This must be the full URL with protocol and no trailing slash. During local development, set this to the URL of your local Framer preview (e.g., `http://localhost:5173`).

### Understanding COOKIE_DOMAIN

Cookies are scoped by domain. For the browser to send session cookies (set by your backend) back on subsequent requests from your Framer site, the cookie's `Domain` attribute must cover both domains:

- Backend at `auth.example.com`, Framer site at `www.example.com` -- set `COOKIE_DOMAIN` to `.example.com`
- Backend at `your-app.vercel.app`, Framer site at `mysite.framer.app` -- these are on different root domains. You'll need a custom domain on one or both (see Step 6)

### Important: .env.local is gitignored

The `.env.local` file is listed in `.gitignore` and will not be committed. This is intentional -- never commit credentials to source control. When deploying, you'll set these variables via your hosting platform's environment variable settings.

---

## Step 3: Local Development

Start the Next.js development server:

```bash
npm run dev
```

The API will be available at **http://localhost:3000**. Auth routes are at `/api/auth/*`.

Test with curl against all four endpoints:

**Send OTP:**

```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -d '{"email": "user@example.com"}'
```

Expected response:

```json
{ "success": true }
```

**Verify OTP:**

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:5173" \
  -c cookies.txt \
  -d '{"email": "user@example.com", "token": "123456"}'
```

The `-c cookies.txt` flag saves the session cookies to a file. Expected response:

```json
{
  "success": true,
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "role": "authenticated",
    "metadata": {}
  }
}
```

**Check session:**

```bash
curl http://localhost:3000/api/auth/session \
  -H "Origin: http://localhost:5173" \
  -b cookies.txt
```

The `-b cookies.txt` flag sends the saved cookies. Expected response:

```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "role": "authenticated",
    "metadata": {}
  }
}
```

**Logout:**

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -H "Origin: http://localhost:5173" \
  -b cookies.txt \
  -c cookies.txt
```

Both `-b` and `-c` are used: `-b` sends the session cookies, `-c` saves the cleared cookies. Expected response:

```json
{ "success": true }
```

---

## Step 4: Deploy to Vercel

Vercel is the recommended hosting platform for Next.js:

1. **Push your project to a Git repository** (GitHub, GitLab, or Bitbucket). Make sure `.env.local` is in your `.gitignore` and is not committed.

2. **Import in the Vercel dashboard:**
   - Go to [vercel.com/new](https://vercel.com/new)
   - Select your repository
   - Vercel auto-detects Next.js and configures the build settings

3. **Add environment variables:**
   - Go to your project in Vercel > **Settings > Environment Variables**
   - Add all five variables:

   | Variable | Value |
   |----------|-------|
   | `SUPABASE_URL` | `https://abcdefg.supabase.co` |
   | `SUPABASE_ANON_KEY` | `eyJhbGciOi...` |
   | `RESEND_API_KEY` | `re_abc123...` |
   | `ALLOWED_ORIGIN` | `https://your-framer-site.framer.app` |
   | `COOKIE_DOMAIN` | `.your-domain.com` |

   > Select the environments where each variable should be available (Production, Preview, Development). For `ALLOWED_ORIGIN`, you may want different values for Preview and Production deployments.

4. **Deploy:**
   - Click **Deploy** or push a new commit to trigger a build
   - Vercel will output the production URL (e.g., `https://your-app.vercel.app`)

5. **Note the production URL.** This is your **BACKEND_URL** for the Framer overrides. All four auth endpoints are available under this base URL (e.g., `https://your-app.vercel.app/api/auth/send-otp`).

---

## Step 5: Self-Hosted Deployment (Alternative)

You can deploy the Next.js backend on any platform that supports Node.js:

```bash
# Build for production
npm run build

# Start the production server
npm start
```

The server runs on port 3000 by default. Set the `PORT` environment variable to change it.

Set all five environment variables on your hosting platform (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `ALLOWED_ORIGIN`, `COOKIE_DOMAIN`). The method varies by platform:

| Platform | Setup |
|----------|-------|
| **Railway** | Connect your repo, add env vars in the dashboard. Railway auto-detects Next.js. |
| **Render** | Create a Web Service, set build command to `npm run build`, start command to `npm start`. Add env vars. |
| **DigitalOcean App Platform** | Create an app from your repo, add env vars. Supports Next.js natively. |
| **Docker** | Use the official [Next.js Docker example](https://github.com/vercel/next.js/tree/canary/examples/with-docker). Set env vars at runtime. |
| **Fly.io** | Use `flyctl launch`, add secrets with `flyctl secrets set`. |

Regardless of platform, make sure all five environment variables are set. The production URL of your deployed server is your **BACKEND_URL** for Framer overrides.

---

## Step 6: Custom Domain (Optional)

For cookies to work across your backend and Framer site, they should share a parent domain. Setting up a custom domain solves this. If your Framer site is at `www.example.com`, your backend should be at something like `auth.example.com` so you can set `COOKIE_DOMAIN` to `.example.com` and share cookies across both.

**On Vercel:**

1. Go to your project > **Settings > Domains**.
2. Add your custom domain (e.g., `auth.example.com`).
3. Follow the DNS configuration instructions Vercel provides (usually a CNAME record).
4. Vercel automatically provisions a TLS certificate.
5. Update `ALLOWED_ORIGIN` and `COOKIE_DOMAIN` accordingly.

**Example configuration with custom domain:**

| Setting | Value |
|---------|-------|
| Backend URL | `https://auth.yourdomain.com` |
| Framer site | `https://www.yourdomain.com` |
| `ALLOWED_ORIGIN` | `https://www.yourdomain.com` |
| `COOKIE_DOMAIN` | `.yourdomain.com` |
| `BACKEND_URL` in Framer overrides | `https://auth.yourdomain.com` |

**On other platforms:**

Most Node.js hosting platforms support custom domains through their dashboard. Add the domain and configure your DNS (typically a CNAME or A record) as instructed by your provider.

After adding the custom domain:

- Update `COOKIE_DOMAIN` to the shared parent domain (e.g., `.example.com`)
- Update `ALLOWED_ORIGIN` to your Framer site URL if it changed
- Redeploy

---

## Endpoint Reference

### POST /api/auth/send-otp

Sends a 6-digit OTP code to the provided email address.

| Field | Details |
|-------|---------|
| **Method** | `POST` |
| **Path** | `/api/auth/send-otp` |
| **Request body** | `{ "email": "user@example.com" }` |
| **Success response** | `200 { "success": true }` |
| **Error response** | `400 { "error": "Email is required" }` or `400 { "error": "..." }` (Supabase error) |

### POST /api/auth/verify-otp

Verifies the OTP code and sets session cookies on success.

| Field | Details |
|-------|---------|
| **Method** | `POST` |
| **Path** | `/api/auth/verify-otp` |
| **Request body** | `{ "email": "user@example.com", "token": "123456" }` |
| **Success response** | `200 { "success": true, "user": { "id": "...", "email": "...", "role": "...", "metadata": {...} } }` |
| **Cookies set** | `access_token` (HttpOnly, Secure, 7-day expiry), `refresh_token` (HttpOnly, Secure, 7-day expiry) |
| **Error response** | `400 { "error": "Email and token are required" }` or `401 { "error": "..." }` |

### GET /api/auth/session

Checks the current session by reading cookies.

| Field | Details |
|-------|---------|
| **Method** | `GET` |
| **Path** | `/api/auth/session` |
| **Cookies required** | `access_token` |
| **Authenticated response** | `200 { "user": { "id": "...", "email": "...", "role": "...", "metadata": {...} } }` |
| **Unauthenticated response** | `200 { "user": null }` |

### POST /api/auth/logout

Clears session cookies and signs out from Supabase.

| Field | Details |
|-------|---------|
| **Method** | `POST` |
| **Path** | `/api/auth/logout` |
| **Cookies cleared** | `access_token`, `refresh_token` (set to Max-Age=0) |
| **Response** | `200 { "success": true }` |

All endpoints also respond to `OPTIONS` requests for CORS preflight.

All endpoints return `Content-Type: application/json` and include CORS headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`).

All error responses follow the shape `{ "error": "Description of the problem" }` with an appropriate HTTP status code (400, 401, or 500).

> **Note:** Next.js routes use the `/api/auth/` prefix, unlike the Cloudflare Worker which uses `/auth/`. Make sure your Framer overrides use the correct base URL.

---

## Project Structure

The generated project has a shared `lib/` directory to keep the route handlers clean:

```
your-project/
  app/
    api/
      auth/
        send-otp/route.ts      # POST handler
        verify-otp/route.ts    # POST handler
        session/route.ts       # GET handler
        logout/route.ts        # POST handler
  lib/
    supabase.ts               # Supabase client factory
    cookies.ts                # Cookie parsing and formatting
    cors.ts                   # CORS header generation
  .env.local                  # Environment variables (gitignored)
  next.config.js              # Next.js configuration
  package.json                # Dependencies and scripts
  tsconfig.json               # TypeScript configuration
```

### lib/supabase.ts

Creates a Supabase client configured for server-side use (no auto-refresh, no session persistence). Each request gets its own client instance to avoid shared state between requests.

```ts
import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
}
```

### lib/cookies.ts

Utilities for parsing cookie headers and generating cookie option strings:

- `parseCookies(header)` -- parses a `Cookie` header into a key-value object
- `authCookieOptions()` -- returns the cookie attribute string for setting session cookies (HttpOnly, Secure, SameSite=None, Domain from `COOKIE_DOMAIN`, 7-day expiry)
- `expiredCookieOptions()` -- returns the cookie attribute string for clearing cookies (Max-Age=0)

### lib/cors.ts

Generates CORS headers using the `ALLOWED_ORIGIN` environment variable:

```ts
export function corsHeaders(): Record<string, string> {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}
```

> **Note:** The fallback to `"*"` is only for local development convenience. In production, always set `ALLOWED_ORIGIN` to your exact Framer site URL. Browsers reject `Access-Control-Allow-Origin: *` when `credentials: "include"` is used.

---

## Troubleshooting

### CORS errors

**Symptom:** The browser console shows "Access to fetch has been blocked by CORS policy."

**Fix:** Verify that `ALLOWED_ORIGIN` in your environment variables matches your Framer site URL exactly. Common mistakes:
- Trailing slash: `https://mysite.framer.app/` should be `https://mysite.framer.app`
- Wrong protocol: `http://` instead of `https://`
- Wrong subdomain: `mysite.framer.app` vs `www.mysite.com`

Also ensure your Framer-side fetch calls include `credentials: "include"` so the browser sends cookies cross-origin.

### Cookies not being set

**Symptom:** `/api/auth/verify-otp` returns a user object, but `/api/auth/session` returns `null`.

**Fix:**
- Both the backend and the Framer site must be served over **HTTPS**. The cookies use `Secure` and `SameSite=None`, which browsers reject over HTTP.
- Check `COOKIE_DOMAIN`. It must be a parent domain of both the backend and the Framer site. If they are on completely different root domains (e.g., `vercel.app` and `framer.app`), you need a custom domain (Step 6).
- In Chrome DevTools, go to **Application > Cookies** to inspect whether cookies are present and what domain they are set on.

### OTP email not arriving

**Symptom:** `/api/auth/send-otp` returns `{ "success": true }` but no email is received.

**Fix:**
- Verify that Resend is configured as the SMTP provider in your Supabase project. Go to **Supabase Dashboard > Authentication > Email Templates > SMTP Settings**.
- Check your Resend dashboard for delivery logs and bounces.
- Make sure the sender domain is verified in Resend.
- Check spam/junk folders.

### Environment variables not loading

**Symptom:** Endpoints return 500 errors or behave as if variables are undefined.

**Fix:**
- Make sure `.env.local` is in the **project root** (the same directory as `package.json`), not inside `app/` or `lib/`.
- **Restart the dev server** after creating or modifying `.env.local`. Next.js only reads environment files at startup.
- Variable names must not have the `NEXT_PUBLIC_` prefix. These are server-side variables and should be accessed with `process.env.VARIABLE_NAME` inside route handlers.
- On Vercel, ensure the variables are added in **Settings > Environment Variables** and that the deployment was triggered after adding them.

### Module resolution issues

**Symptom:** Import errors or "Module not found" during `npm run dev` or `npm run build`.

**Fix:**
- Run `npm install` to ensure all dependencies are installed.
- Check that `tsconfig.json` includes the correct `paths` and `baseUrl` settings for the `lib/` imports.
- Delete `.next/` and `node_modules/`, then run `npm install` and `npm run dev` again.

### 500 Internal Server Error

**Symptom:** Endpoints return a 500 status with no useful error message.

**Fix:** Check the terminal running `npm run dev` for stack traces and error messages. In production on Vercel, check **Deployments > Functions > Logs** in the Vercel dashboard. Common causes:
- Invalid or missing `SUPABASE_URL` or `SUPABASE_ANON_KEY`
- Network errors connecting to Supabase
- Malformed request bodies

### Session returns null after verify succeeds

**Symptom:** `/api/auth/verify-otp` returns a user object, but subsequent calls to `/api/auth/session` always return `{ "user": null }`.

**Fix:** This is almost always a cookie domain mismatch. The session endpoint reads cookies set by the verify endpoint. If the cookies were not stored by the browser (due to domain restrictions), the session endpoint has no tokens to work with. Check `COOKIE_DOMAIN` and ensure both your backend and Framer site share a parent domain. Use Chrome DevTools **Application > Cookies** to confirm whether the cookies exist.
