import type { ProjectConfig } from "../prompts.js";
import { writeProjectFile } from "../utils/files.js";

export async function generateFramer(config: ProjectConfig): Promise<void> {
  const { supabaseUrl, supabaseAnonKey, outputDir } = config;

  // --- authStore.ts ---
  await writeProjectFile(
    outputDir,
    "framer-overrides/authStore.ts",
    `// framer-auth-kit: Auth Store
// Shared state for authentication across Framer overrides

const SUPABASE_URL = "${supabaseUrl}";
const SUPABASE_ANON_KEY = "${supabaseAnonKey}";

// Determine the API base URL from your deployed backend
// Update this to your actual deployed worker/API URL
const API_BASE = "https://your-auth-api.workers.dev";

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  metadata: Record<string, unknown>;
}

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
}

type Listener = (state: AuthState) => void;

let state: AuthState = {
  user: null,
  loading: true,
  initialized: false,
};

const listeners: Set<Listener> = new Set();

function notify() {
  listeners.forEach((fn) => fn({ ...state }));
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function getAuthState(): AuthState {
  return { ...state };
}

export async function checkSession(): Promise<void> {
  state = { ...state, loading: true };
  notify();

  try {
    const res = await fetch(\`\${API_BASE}/auth/session\`, {
      credentials: "include",
    });
    const data = await res.json();
    state = { user: data.user || null, loading: false, initialized: true };
  } catch {
    state = { user: null, loading: false, initialized: true };
  }

  notify();
}

export async function sendOtp(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(\`\${API_BASE}/auth/send-otp\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email }),
    });
    return await res.json();
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function verifyOtp(
  email: string,
  token: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await fetch(\`\${API_BASE}/auth/verify-otp\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, token }),
    });
    const data = await res.json();

    if (data.success && data.user) {
      state = { user: data.user, loading: false, initialized: true };
      notify();
    }

    return data;
  } catch {
    return { success: false, error: "Network error" };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch(\`\${API_BASE}/auth/logout\`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Ignore errors during logout
  }

  state = { user: null, loading: false, initialized: true };
  notify();
}

// Auto-check session on load
checkSession();
`
  );

  // --- withAuth.ts ---
  await writeProjectFile(
    outputDir,
    "framer-overrides/withAuth.ts",
    `// framer-auth-kit: withAuth Override
// Apply this override to any Framer component/page to protect it.
// If the user is not authenticated, the component will be hidden.

import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import { subscribe, type AuthUser } from "./authStore";

export function withAuth(Component: ComponentType<any>): ComponentType<any> {
  return function AuthGuard(props: any) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
      const unsubscribe = subscribe((state) => {
        setUser(state.user);
        setLoading(state.loading);
      });
      return unsubscribe;
    }, []);

    if (loading) {
      return null; // or a loading spinner
    }

    if (!user) {
      return null; // hidden when not authenticated
    }

    return <Component {...props} />;
  };
}

export default withAuth;
`
  );

  // --- userDisplay.ts ---
  await writeProjectFile(
    outputDir,
    "framer-overrides/userDisplay.ts",
    `// framer-auth-kit: User Display Override
// Apply to a text element to show the current user's email or a fallback.

import type { ComponentType } from "react";
import { useState, useEffect } from "react";
import { subscribe, type AuthUser } from "./authStore";

export function withUserEmail(Component: ComponentType<any>): ComponentType<any> {
  return function UserEmailDisplay(props: any) {
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
      const unsubscribe = subscribe((state) => {
        setUser(state.user);
      });
      return unsubscribe;
    }, []);

    return <Component {...props} text={user?.email ?? "Not signed in"} />;
  };
}

export function withUserName(Component: ComponentType<any>): ComponentType<any> {
  return function UserNameDisplay(props: any) {
    const [user, setUser] = useState<AuthUser | null>(null);

    useEffect(() => {
      const unsubscribe = subscribe((state) => {
        setUser(state.user);
      });
      return unsubscribe;
    }, []);

    const name =
      (user?.metadata as any)?.full_name ||
      user?.email ||
      "Guest";

    return <Component {...props} text={name} />;
  };
}

export default withUserEmail;
`
  );

  // --- authRedirect.ts ---
  await writeProjectFile(
    outputDir,
    "framer-overrides/authRedirect.ts",
    `// framer-auth-kit: Auth Redirect Override
// Redirects unauthenticated users to a login page.
// Apply this to a hidden element on any protected page.

import type { ComponentType } from "react";
import { useEffect } from "react";
import { subscribe } from "./authStore";

const LOGIN_PATH = "/login"; // Update this to your Framer login page path

export function withAuthRedirect(Component: ComponentType<any>): ComponentType<any> {
  return function AuthRedirectGuard(props: any) {
    useEffect(() => {
      const unsubscribe = subscribe((state) => {
        if (state.initialized && !state.loading && !state.user) {
          window.location.href = LOGIN_PATH;
        }
      });
      return unsubscribe;
    }, []);

    return <Component {...props} />;
  };
}

export function withLogoutRedirect(Component: ComponentType<any>): ComponentType<any> {
  return function LogoutRedirectGuard(props: any) {
    useEffect(() => {
      const unsubscribe = subscribe((state) => {
        if (state.initialized && !state.loading && state.user) {
          window.location.href = "/"; // Redirect logged-in users away from login
        }
      });
      return unsubscribe;
    }, []);

    return <Component {...props} />;
  };
}

export default withAuthRedirect;
`
  );
}
