# Framer Overrides Guide

This guide explains how to use the generated override files to add authentication to your Framer site. It covers setup, configuration, and usage of each override with practical examples.

---

## What Are Framer Code Overrides?

Framer's **code overrides** let you attach custom logic to any element on the canvas. An override is a function that wraps a component, giving you control over its props, lifecycle, and behavior. framer-auth-kit uses overrides to:

- Check if a user is logged in
- Protect pages from unauthenticated access
- Display user information in text elements
- Redirect users based on auth state

The generated override files use a **Higher-Order Component (HOC)** pattern with a shared pub/sub auth store. All overrides subscribe to the same global state, so they stay in sync automatically.

---

## Overview of Generated Files

The CLI generates four files in the `framer-overrides/` directory:

| File | Exports | Purpose |
|------|---------|---------|
| `authStore.ts` | `subscribe`, `getAuthState`, `checkSession`, `sendOtp`, `verifyOtp`, `logout` | Central auth state management + API functions. All other overrides import from this. |
| `withAuth.ts` | `withAuth` | Hides a component if the user is not authenticated. Apply to protected page frames. |
| `userDisplay.ts` | `withUserEmail`, `withUserName` | Replaces text content with the user's email or display name. Apply to text elements. |
| `authRedirect.ts` | `withAuthRedirect`, `withLogoutRedirect` | Redirects based on auth state. `withAuthRedirect` sends unauthenticated users to login. `withLogoutRedirect` sends authenticated users away from login. |

---

## Adding Override Files to Framer

### Step 1: Open your Framer project

Go to your Framer project in the browser or desktop app.

### Step 2: Navigate to the Code section

In the left sidebar, click **Assets** (the icon that looks like a grid or puzzle piece), then find the **Code** tab. This is where you add custom code files.

### Step 3: Create code files for each override

For each of the four override files:

1. Click the **+** button in the Code section
2. Select **New Override** (or **New File** depending on your Framer version)
3. Name the file to match the source file:
   - `authStore`
   - `withAuth`
   - `userDisplay`
   - `authRedirect`
4. Delete the default template code
5. Paste the contents of the corresponding generated file

### Step 4: Verify imports

The override files import from each other. In Framer's code editor, imports use relative paths:

```ts
import { subscribe, type AuthUser } from "./authStore";
```

Make sure all four files are in the same directory level in Framer's code section. If Framer shows import errors, check that the file names match exactly (case-sensitive).

---

## Configuration

Before the overrides will work, you need to set two values:

### 1. Backend URL (required)

Open `authStore.ts` and find this line near the top:

```ts
const API_BASE = "https://your-auth-api.workers.dev";
```

Replace the URL with your deployed backend:

```ts
// Cloudflare Worker example:
const API_BASE = "https://framer-auth-worker.your-account.workers.dev";

// Next.js on Vercel example:
const API_BASE = "https://your-app.vercel.app/api";

// Custom domain example:
const API_BASE = "https://auth.yourdomain.com";
```

**Important:** Do not include a trailing slash. The overrides append paths like `/auth/session` to this base URL.

**Important for Next.js:** If your Next.js routes are at `/api/auth/*`, your `API_BASE` should end with `/api` (e.g., `https://your-app.vercel.app/api`). The override will then call `https://your-app.vercel.app/api/auth/session`, etc.

### 2. Login path (optional)

Open `authRedirect.ts` and find:

```ts
const LOGIN_PATH = "/login";
```

Change this to match your Framer login page's URL path. If your login page is at `/sign-in`, update accordingly.

### 3. Post-login redirect (optional)

In `authRedirect.ts`, the `withLogoutRedirect` function redirects authenticated users to `"/"`. Change this to your dashboard or home page path:

```ts
window.location.href = "/dashboard"; // or wherever you want
```

---

## authStore.ts -- Detailed Reference

The auth store is the foundation of the override system. It manages global authentication state and provides functions for interacting with your backend API.

### How it works

1. On page load, the store automatically calls `checkSession()` to check for an existing session cookie
2. The backend returns the current user (or null)
3. All subscribed overrides update reactively

### State shape

```ts
interface AuthState {
  user: AuthUser | null;  // Current user or null
  loading: boolean;       // True while checking session
  initialized: boolean;   // True after first session check completes
}

interface AuthUser {
  id: string;                      // Supabase user ID (UUID)
  email: string;                   // User's email address
  role: string;                    // Supabase auth role
  metadata: Record<string, unknown>; // User metadata (includes full_name, etc.)
}
```

### Exported functions

#### `subscribe(listener): unsubscribe`

Subscribe to auth state changes. The listener is called immediately with the current state, then again whenever state changes.

```ts
import { subscribe } from "./authStore";

const unsubscribe = subscribe((state) => {
  console.log("User:", state.user);
  console.log("Loading:", state.loading);
});

// Later, to stop listening:
unsubscribe();
```

#### `getAuthState(): AuthState`

Get the current auth state synchronously (no async, no subscription).

```ts
import { getAuthState } from "./authStore";

const { user, loading } = getAuthState();
if (user) {
  console.log("Logged in as", user.email);
}
```

#### `checkSession(): Promise<void>`

Check if the user has an active session by calling `GET /auth/session` on the backend. Updates the global state. Called automatically on page load.

```ts
import { checkSession } from "./authStore";

// Force a session re-check (e.g., after a page transition)
await checkSession();
```

#### `sendOtp(email): Promise<{ success, error? }>`

Send a one-time password to the given email address.

```ts
import { sendOtp } from "./authStore";

const result = await sendOtp("user@example.com");
if (result.success) {
  // Show OTP input form
} else {
  // Show error: result.error
}
```

#### `verifyOtp(email, token): Promise<{ success, user?, error? }>`

Verify the OTP code. On success, updates the global auth state and sets session cookies.

```ts
import { verifyOtp } from "./authStore";

const result = await verifyOtp("user@example.com", "123456");
if (result.success) {
  // User is now logged in
  // result.user contains the user object
  // Redirect to dashboard or let authRedirect handle it
} else {
  // Show error: result.error
}
```

#### `logout(): Promise<void>`

Sign the user out. Clears session cookies and resets auth state to null.

```ts
import { logout } from "./authStore";

await logout();
// User is now logged out
// Redirect to login page or let the page handle it
```

---

## withAuth.ts -- Page Protection

### What it does

Wraps a component and hides it if the user is not authenticated. While the auth state is loading (session check in progress), the component renders nothing (returns `null`) to prevent a flash of protected content.

### Behavior

| Auth State | Result |
|-----------|--------|
| Loading (session check in progress) | Component is hidden (renders null) |
| Not authenticated | Component is hidden (renders null) |
| Authenticated | Component renders normally |

### How to apply in Framer

1. Select the frame or component you want to protect on the Framer canvas
2. In the right sidebar, find the **Code Overrides** section
3. Click the dropdown and select `withAuth`
4. The component will now only be visible to authenticated users

### Important notes

- `withAuth` **hides** content but does **not redirect**. If you want unauthenticated users to be redirected to a login page, use `withAuthRedirect` from `authRedirect.ts` instead (or use both).
- Apply `withAuth` to the outermost frame of a page for best results. If applied to a child element, only that element will be hidden.
- The component re-renders reactively when auth state changes (e.g., after login or logout).

---

## userDisplay.ts -- Showing User Information

### Exports

#### `withUserEmail`

Replaces a text element's content with the user's email address.

- If the user is logged in: displays `user.email` (e.g., `"jane@example.com"`)
- If the user is not logged in: displays `"Not signed in"`

#### `withUserName`

Replaces a text element's content with the user's display name.

- If the user is logged in: displays `user.metadata.full_name` (from the Supabase profiles table)
- If `full_name` is not set: falls back to the user's email
- If the user is not logged in: displays `"Guest"`

### How to apply in Framer

1. Select a **text element** on the Framer canvas
2. In the right sidebar, find **Code Overrides**
3. Select `withUserEmail` or `withUserName`
4. The text content will be replaced dynamically based on auth state

### Examples

| Override | User logged in (full_name = "Jane Smith") | User logged in (no full_name) | User not logged in |
|----------|-------------------------------------------|-------------------------------|-------------------|
| `withUserEmail` | `jane@example.com` | `jane@example.com` | `Not signed in` |
| `withUserName` | `Jane Smith` | `jane@example.com` | `Guest` |

### Setting full_name

The `full_name` field comes from the `profiles` table in Supabase. It's included in the user's `metadata` when returned by the backend. To set it:

```sql
UPDATE public.profiles
SET full_name = 'Jane Smith'
WHERE email = 'jane@example.com';
```

Or allow users to update it via a profile settings page.

---

## authRedirect.ts -- Navigation Guards

### Exports

#### `withAuthRedirect`

Redirects **unauthenticated** users to the login page. Apply this to any protected page.

- Waits for the auth state to be initialized (no redirect during loading)
- If `state.initialized && !state.loading && !state.user` -- redirects to `LOGIN_PATH`
- If the user is authenticated -- does nothing, renders the component normally

#### `withLogoutRedirect`

Redirects **authenticated** users away from the login page. Apply this to your login page.

- Waits for the auth state to be initialized
- If `state.initialized && !state.loading && state.user` -- redirects to `"/"`
- If the user is not authenticated -- does nothing, renders the component normally

### How to apply in Framer

1. Select the page frame (outermost element) on your protected page
2. In **Code Overrides**, select `withAuthRedirect`
3. For the login page, select `withLogoutRedirect` instead

### Avoiding redirect loops

Be careful not to create circular redirects:

- **Login page** should have `withLogoutRedirect` (redirects logged-in users away) but **not** `withAuthRedirect`
- **Protected pages** should have `withAuthRedirect` (redirects to login) but **not** `withLogoutRedirect`
- The **redirect target** (e.g., `/` or `/dashboard`) should not redirect back to login unless intended

---

## Building a Login Form

Here's how to build a complete login flow in Framer using the auth store functions:

### Step 1: Create the login page layout

In Framer, create a page at `/login` with:

- An email input field
- A "Send Code" button
- An OTP input field (initially hidden)
- A "Verify" button (initially hidden)
- A status/error text element

### Step 2: Create a custom code component

In Framer's Code section, create a new component (not an override) for your login form:

```tsx
import { useState } from "react";
import { sendOtp, verifyOtp } from "./authStore";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSendOtp() {
    setLoading(true);
    setError("");
    const result = await sendOtp(email);
    setLoading(false);

    if (result.success) {
      setStep("otp");
    } else {
      setError(result.error || "Failed to send code");
    }
  }

  async function handleVerify() {
    setLoading(true);
    setError("");
    const result = await verifyOtp(email, token);
    setLoading(false);

    if (result.success) {
      // Auth state is updated automatically.
      // withLogoutRedirect on the login page will handle
      // redirecting to the dashboard, or redirect manually:
      window.location.href = "/dashboard";
    } else {
      setError(result.error || "Invalid code");
    }
  }

  if (step === "email") {
    return (
      <div>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button onClick={handleSendOtp} disabled={loading}>
          {loading ? "Sending..." : "Send Code"}
        </button>
        {error && <p style={{ color: "red" }}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p>Enter the code sent to {email}</p>
      <input
        type="text"
        placeholder="6-digit code"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        maxLength={6}
      />
      <button onClick={handleVerify} disabled={loading}>
        {loading ? "Verifying..." : "Verify"}
      </button>
      <button onClick={() => setStep("email")}>Back</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
```

### Step 3: Add the component to your login page

Drag the `LoginForm` code component onto your `/login` page in Framer.

### Step 4: Add withLogoutRedirect

Apply `withLogoutRedirect` to the login page's outermost frame. This ensures that already-authenticated users are redirected away from the login page.

---

## Building a Logout Button

Create a code component for the logout action:

```tsx
import { logout } from "./authStore";

export function LogoutButton() {
  async function handleLogout() {
    await logout();
    window.location.href = "/login";
  }

  return (
    <button onClick={handleLogout}>
      Sign Out
    </button>
  );
}
```

Add this component to your navigation bar, settings page, or wherever you want the logout option.

---

## Putting It All Together

Here's a typical page configuration:

| Page | Overrides Applied | Behavior |
|------|-------------------|----------|
| **Login page** (`/login`) | `withLogoutRedirect` on page frame | If already logged in, redirects to `/`. Contains the LoginForm component. |
| **Dashboard** (`/dashboard`) | `withAuth` on page frame + `withAuthRedirect` on page frame | Hidden + redirects to `/login` if not authenticated. Visible if authenticated. |
| **Profile page** (`/profile`) | `withAuth` + `withAuthRedirect` | Same as dashboard. Use `withUserEmail` or `withUserName` on text elements to show user info. |
| **Public pages** (`/`, `/about`) | None, or only `withUserEmail` on optional text | Accessible to everyone. Optionally show user email if logged in. |
| **Navigation bar** | `withUserEmail` on a text element | Shows user email when logged in, "Not signed in" otherwise. Contains LogoutButton component. |

### Complete example flow

1. **User visits `/dashboard`** -- `withAuth` hides the page. `withAuthRedirect` redirects to `/login`.
2. **User arrives at `/login`** -- `withLogoutRedirect` checks auth state. User is not logged in, so the login form displays.
3. **User enters email, clicks "Send Code"** -- `sendOtp()` is called. Backend sends OTP via Supabase/Resend.
4. **User enters OTP, clicks "Verify"** -- `verifyOtp()` is called. Backend sets cookies. Auth state updates.
5. **Login form redirects to `/dashboard`** -- `withAuth` now sees the user is authenticated and renders the page.
6. **`withUserEmail`** on the nav bar shows the user's email.
7. **User clicks "Sign Out"** -- `logout()` is called. Cookies are cleared. User is redirected to `/login`.

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| **"Not signed in" showing everywhere** | `API_BASE` in `authStore.ts` is incorrect or still the placeholder | Set `API_BASE` to your actual deployed backend URL |
| **Redirect loop between login and dashboard** | `withAuthRedirect` applied to login page instead of `withLogoutRedirect` | Use `withLogoutRedirect` on login, `withAuthRedirect` on protected pages |
| **CORS errors in browser console** | Backend `ALLOWED_ORIGIN` doesn't match Framer site URL | Set `ALLOWED_ORIGIN` to exact Framer URL (with `https://`, no trailing slash) |
| **Cookies not being set / session always null** | Backend and Framer site on different domains, or not using HTTPS | Both must use HTTPS. Set `COOKIE_DOMAIN` to a shared parent domain. Consider adding a custom domain. |
| **Override not appearing in Framer's dropdown** | File not saved, or function not exported | Ensure the function is exported (`export function withAuth...`) and the file is saved |
| **Import errors in Framer** | File names don't match import paths | Check that file names are exactly `authStore`, `withAuth`, `userDisplay`, `authRedirect` (case-sensitive) |
| **Flash of protected content** | `withAuth` applied to a child element instead of the page frame | Apply `withAuth` to the outermost frame of the page |
| **User name shows email instead of name** | `full_name` not set in profiles table | Update the user's profile: `UPDATE profiles SET full_name = 'Name' WHERE email = '...'` |
