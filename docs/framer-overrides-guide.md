# Framer Overrides Guide

This guide explains how to use the generated Framer override files to add authentication to your Framer site.

## Overview

framer-auth-kit generates four override files:

| File               | Purpose                                          |
|--------------------|--------------------------------------------------|
| `authStore.ts`     | Shared auth state and session checking            |
| `withAuth.ts`      | Protect pages by redirecting unauthenticated users|
| `userDisplay.ts`   | Display user info (email, name, role) in text     |
| `authRedirect.ts`  | Redirect already-logged-in users away from login  |

## Adding Override Files to Framer

1. Open your Framer project.
2. Go to **Assets** in the left sidebar.
3. Click the **+** button and select **Code File**.
4. For each override file, create a new code file with the same name and paste in the contents.

Make sure the import paths between files are correct. In Framer, override files in the same assets folder can import each other using relative paths like `./authStore`.

## Configuring BACKEND_URL

In `authStore.ts`, update the `BACKEND_URL` constant to point to your deployed backend:

```ts
const BACKEND_URL = "https://your-worker.workers.dev"
// or for Next.js:
const BACKEND_URL = "https://your-app.vercel.app"
```

This URL must match the backend you deployed. Do not include a trailing slash.

## authStore.ts

The auth store is the central piece. It holds the shared authentication state:

```ts
export const authStore = Data<AuthState>({
    user: null,
    isLoggedIn: false,
    isLoading: true,
})
```

It also exports:

- `checkSession()` - Calls the `/auth/session` endpoint to check if the user is logged in.
- `AuthProvider` - An override you should apply to a top-level element on every page (such as the page wrapper or a hidden element). This triggers `checkSession()` on mount.

**Usage:** Apply the `AuthProvider` override to an element that exists on every page (e.g., your navbar or a shared layout component). This ensures the auth state is checked on every page load.

## withAuth.ts

Protects pages by redirecting unauthenticated users to the login page.

```ts
const LOGIN_PATH = "/login"
```

Change `LOGIN_PATH` to match your Framer login page path.

**Usage:** Apply the `withAuth` override to the outermost element on any page you want to protect. While the auth state is loading, the element will be invisible (opacity 0) to prevent a flash of protected content.

**How it works:**
1. Reads `isLoggedIn` and `isLoading` from the auth store.
2. If not logged in and not loading, redirects to `LOGIN_PATH`.
3. Fades in the content once auth state is confirmed.

## userDisplay.ts

Displays user information in text elements. Exports three overrides:

- `DisplayEmail` - Shows the user's email address
- `DisplayName` - Shows the user's name
- `DisplayRole` - Shows the user's role

**Usage:** Apply any of these overrides to a text element in Framer. The text content will be replaced with the corresponding user field.

```
Text element with DisplayEmail override -> "user@example.com"
Text element with DisplayName override  -> "Jane Smith"
Text element with DisplayRole override  -> "member"
```

## authRedirect.ts

Redirects already-authenticated users away from the login page (e.g., to a dashboard).

```ts
const DASHBOARD_PATH = "/dashboard"
```

Change `DASHBOARD_PATH` to match where you want logged-in users to go.

**Usage:** Apply the `authRedirect` override to an element on your login page. If a user who is already logged in visits the login page, they will be redirected to `DASHBOARD_PATH`.

## Putting It All Together

A typical setup:

1. **Every page**: Apply `AuthProvider` to a shared element (navbar, footer, etc.)
2. **Login page**: Apply `authRedirect` to the page wrapper
3. **Protected pages** (dashboard, settings, etc.): Apply `withAuth` to the page wrapper
4. **User info display**: Apply `DisplayEmail`, `DisplayName`, or `DisplayRole` to text elements

## Example Flow

1. User visits `/dashboard`.
2. `AuthProvider` fires `checkSession()` to check cookies.
3. `withAuth` sees `isLoggedIn = false` and redirects to `/login`.
4. User enters email, receives OTP, and verifies it.
5. Backend sets session cookies and returns user data.
6. User is redirected to `/dashboard`.
7. `withAuth` sees `isLoggedIn = true` and shows the page.
8. `DisplayEmail` shows the user's email in a text element.
