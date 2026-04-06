# Next.js Backend Setup

This guide covers deploying the generated Next.js App Router backend.

## Prerequisites

- Node.js 18+
- A Vercel account (for deployment) or any Node.js hosting platform

## Project Structure

```
backend/
  app/
    api/
      auth/
        send-otp/route.ts
        verify-otp/route.ts
        session/route.ts
        logout/route.ts
```

## Step 1: Install Dependencies

```bash
cd backend
npm install
```

## Step 2: Set Up Environment Variables

Create a `.env.local` file in the backend root:

```env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhb...
RESEND_API_KEY=re_...
ALLOWED_ORIGIN=https://your-framer-site.com
```

| Variable            | Description                                   |
|---------------------|-----------------------------------------------|
| `SUPABASE_URL`      | Your Supabase project URL                     |
| `SUPABASE_ANON_KEY` | The public anon key from Supabase             |
| `RESEND_API_KEY`    | Your Resend API key                           |
| `ALLOWED_ORIGIN`    | Your Framer site URL (for CORS)               |

## Step 3: Run Locally

```bash
npm run dev
```

The API will be available at `http://localhost:3000/api/auth/...`.

## Deploying to Vercel

1. Push the backend directory to a Git repository.
2. Import the repository in the [Vercel dashboard](https://vercel.com/new).
3. Add the environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `RESEND_API_KEY`, `ALLOWED_ORIGIN`) in the Vercel project settings under **Settings > Environment Variables**.
4. Deploy.

Use the production URL as `BACKEND_URL` in your Framer overrides.

## Self-Hosted Deployment

You can also deploy the Next.js backend anywhere that supports Node.js:

```bash
npm run build
npm start
```

Make sure to set the environment variables on your hosting platform.

## Endpoints

| Method | Path                      | Description                  |
|--------|---------------------------|------------------------------|
| POST   | `/api/auth/send-otp`      | Send an OTP code to an email |
| POST   | `/api/auth/verify-otp`    | Verify OTP and set cookies   |
| GET    | `/api/auth/session`       | Check current session        |
| POST   | `/api/auth/logout`        | Clear session cookies        |

## Testing with curl

**Send OTP:**

```bash
curl -X POST http://localhost:3000/api/auth/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

**Verify OTP:**

```bash
curl -X POST http://localhost:3000/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{"email": "user@example.com", "token": "123456"}'
```

**Check session:**

```bash
curl http://localhost:3000/api/auth/session \
  -b cookies.txt
```

**Logout:**

```bash
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt \
  -c cookies.txt
```

## Troubleshooting

- **CORS errors**: Verify `ALLOWED_ORIGIN` in your environment variables matches your Framer site URL exactly.
- **OTP not arriving**: Check that Resend is configured as the SMTP provider in Supabase (see [Supabase Schema](./supabase-schema.md)).
- **Environment variables not loading**: Make sure `.env.local` is in the project root and restart the dev server after changes.
