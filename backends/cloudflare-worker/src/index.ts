import { createClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RESEND_API_KEY: string;
  ALLOWED_ORIGIN: string;
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

function jsonResponse(
  body: unknown,
  env: Env,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(env.ALLOWED_ORIGIN),
    },
  });
}

function errorResponse(message: string, env: Env, status = 400): Response {
  return jsonResponse({ error: message }, env, status);
}

function setCookie(name: string, value: string, maxAge: number): string {
  return `${name}=${value}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${maxAge}`;
}

function clearCookie(name: string): string {
  return `${name}=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0`;
}

function getCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : null;
}

function createSupabaseClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

async function handleSendOtp(request: Request, env: Env): Promise<Response> {
  const { email } = (await request.json()) as { email?: string };
  if (!email) {
    return errorResponse("Email is required", env);
  }

  const supabase = createSupabaseClient(env);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return errorResponse(error.message, env);
  }

  return jsonResponse({ success: true }, env);
}

async function handleVerifyOtp(request: Request, env: Env): Promise<Response> {
  const { email, token } = (await request.json()) as {
    email?: string;
    token?: string;
  };
  if (!email || !token) {
    return errorResponse("Email and token are required", env);
  }

  const supabase = createSupabaseClient(env);
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return errorResponse(error.message, env);
  }

  const session = data.session;
  if (!session) {
    return errorResponse("No session returned", env);
  }

  const response = jsonResponse({ user: data.user }, env);
  response.headers.append(
    "Set-Cookie",
    setCookie("access_token", session.access_token, session.expires_in)
  );
  response.headers.append(
    "Set-Cookie",
    setCookie("refresh_token", session.refresh_token, 60 * 60 * 24 * 30)
  );
  return response;
}

async function handleSession(request: Request, env: Env): Promise<Response> {
  const accessToken = getCookie(request, "access_token");
  if (!accessToken) {
    return jsonResponse({ user: null }, env);
  }

  const supabase = createSupabaseClient(env);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    return jsonResponse({ user: null }, env);
  }

  return jsonResponse({ user }, env);
}

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const accessToken = getCookie(request, "access_token");

  if (accessToken) {
    const supabase = createSupabaseClient(env);
    await supabase.auth.signOut();
  }

  const response = jsonResponse({ success: true }, env);
  response.headers.append("Set-Cookie", clearCookie("access_token"));
  response.headers.append("Set-Cookie", clearCookie("refresh_token"));
  return response;
}

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionContext
  ): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(env.ALLOWED_ORIGIN),
      });
    }

    try {
      if (pathname === "/auth/send-otp" && request.method === "POST") {
        return handleSendOtp(request, env);
      }
      if (pathname === "/auth/verify-otp" && request.method === "POST") {
        return handleVerifyOtp(request, env);
      }
      if (pathname === "/auth/session" && request.method === "GET") {
        return handleSession(request, env);
      }
      if (pathname === "/auth/logout" && request.method === "POST") {
        return handleLogout(request, env);
      }

      return errorResponse("Not found", env, 404);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal error";
      return errorResponse(message, env, 500);
    }
  },
};
