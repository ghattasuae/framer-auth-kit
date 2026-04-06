import type { ProjectConfig } from "../prompts.js";
import { writeProjectFile } from "../utils/files.js";

export async function generateCloudflare(config: ProjectConfig): Promise<void> {
  const { projectName, supabaseUrl, supabaseAnonKey, resendApiKey, outputDir } =
    config;

  // --- wrangler.toml ---
  await writeProjectFile(
    outputDir,
    "wrangler.toml",
    `name = "${projectName}"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
SUPABASE_URL = "${supabaseUrl}"
SUPABASE_ANON_KEY = "${supabaseAnonKey}"
RESEND_API_KEY = "${resendApiKey}"
ALLOWED_ORIGIN = "https://your-framer-site.framer.app"
COOKIE_DOMAIN = "your-framer-site.framer.app"
`
  );

  // --- package.json ---
  await writeProjectFile(
    outputDir,
    "package.json",
    JSON.stringify(
      {
        name: projectName,
        version: "1.0.0",
        private: true,
        scripts: {
          dev: "wrangler dev",
          deploy: "wrangler deploy",
        },
        dependencies: {
          "@supabase/supabase-js": "^2.39.0",
        },
        devDependencies: {
          "@cloudflare/workers-types": "^4.20240117.0",
          wrangler: "^3.24.0",
          typescript: "^5.3.0",
        },
      },
      null,
      2
    ) + "\n"
  );

  // --- tsconfig.json ---
  await writeProjectFile(
    outputDir,
    "tsconfig.json",
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "ES2022",
          moduleResolution: "bundler",
          lib: ["ES2022"],
          types: ["@cloudflare/workers-types"],
          strict: true,
          esModuleInterop: true,
          skipLibCheck: true,
          forceConsistentCasingInFileNames: true,
          outDir: "dist",
          rootDir: "src",
        },
        include: ["src"],
      },
      null,
      2
    ) + "\n"
  );

  // --- src/index.ts ---
  await writeProjectFile(
    outputDir,
    "src/index.ts",
    `import { createClient, SupabaseClient } from "@supabase/supabase-js";

interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  RESEND_API_KEY: string;
  ALLOWED_ORIGIN: string;
  COOKIE_DOMAIN: string;
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
  body: Record<string, unknown>,
  status: number,
  origin: string
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(origin),
    },
  });
}

function getSupabase(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
}

function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    })
  );
}

function setAuthCookies(
  headers: Headers,
  accessToken: string,
  refreshToken: string,
  domain: string
): void {
  const cookieOptions = \`; HttpOnly; Secure; SameSite=None; Path=/; Domain=\${domain}; Max-Age=604800\`;
  headers.append(
    "Set-Cookie",
    \`access_token=\${accessToken}\${cookieOptions}\`
  );
  headers.append(
    "Set-Cookie",
    \`refresh_token=\${refreshToken}\${cookieOptions}\`
  );
}

function clearAuthCookies(headers: Headers, domain: string): void {
  const cookieOptions = \`; HttpOnly; Secure; SameSite=None; Path=/; Domain=\${domain}; Max-Age=0\`;
  headers.append("Set-Cookie", \`access_token=\${cookieOptions}\`);
  headers.append("Set-Cookie", \`refresh_token=\${cookieOptions}\`);
}

async function handleSendOtp(
  request: Request,
  env: Env
): Promise<Response> {
  const { email } = (await request.json()) as { email: string };

  if (!email) {
    return jsonResponse({ error: "Email is required" }, 400, env.ALLOWED_ORIGIN);
  }

  const supabase = getSupabase(env);
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });

  if (error) {
    return jsonResponse({ error: error.message }, 400, env.ALLOWED_ORIGIN);
  }

  return jsonResponse({ success: true }, 200, env.ALLOWED_ORIGIN);
}

async function handleVerifyOtp(
  request: Request,
  env: Env
): Promise<Response> {
  const { email, token } = (await request.json()) as {
    email: string;
    token: string;
  };

  if (!email || !token) {
    return jsonResponse(
      { error: "Email and token are required" },
      400,
      env.ALLOWED_ORIGIN
    );
  }

  const supabase = getSupabase(env);
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: "email",
  });

  if (error) {
    return jsonResponse({ error: error.message }, 400, env.ALLOWED_ORIGIN);
  }

  const responseHeaders = new Headers({
    "Content-Type": "application/json",
    ...corsHeaders(env.ALLOWED_ORIGIN),
  });

  if (data.session) {
    setAuthCookies(
      responseHeaders,
      data.session.access_token,
      data.session.refresh_token,
      env.COOKIE_DOMAIN
    );
  }

  return new Response(
    JSON.stringify({
      success: true,
      user: {
        id: data.user?.id,
        email: data.user?.email,
        role: data.user?.role,
        metadata: data.user?.user_metadata,
      },
    }),
    { status: 200, headers: responseHeaders }
  );
}

async function handleSession(
  request: Request,
  env: Env
): Promise<Response> {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const accessToken = cookies["access_token"];

  if (!accessToken) {
    return jsonResponse({ user: null }, 200, env.ALLOWED_ORIGIN);
  }

  const supabase = getSupabase(env);
  const { data, error } = await supabase.auth.getUser(accessToken);

  if (error || !data.user) {
    return jsonResponse({ user: null }, 200, env.ALLOWED_ORIGIN);
  }

  return jsonResponse(
    {
      user: {
        id: data.user.id,
        email: data.user.email,
        role: data.user.role,
        metadata: data.user.user_metadata,
      },
    },
    200,
    env.ALLOWED_ORIGIN
  );
}

async function handleLogout(
  request: Request,
  env: Env
): Promise<Response> {
  const cookieHeader = request.headers.get("Cookie");
  const cookies = parseCookies(cookieHeader);
  const accessToken = cookies["access_token"];

  if (accessToken) {
    const supabase = getSupabase(env);
    await supabase.auth.signOut();
  }

  const responseHeaders = new Headers({
    "Content-Type": "application/json",
    ...corsHeaders(env.ALLOWED_ORIGIN),
  });

  clearAuthCookies(responseHeaders, env.COOKIE_DOMAIN);

  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: responseHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
        return await handleSendOtp(request, env);
      }

      if (pathname === "/auth/verify-otp" && request.method === "POST") {
        return await handleVerifyOtp(request, env);
      }

      if (pathname === "/auth/session" && request.method === "GET") {
        return await handleSession(request, env);
      }

      if (pathname === "/auth/logout" && request.method === "POST") {
        return await handleLogout(request, env);
      }

      return jsonResponse({ error: "Not found" }, 404, env.ALLOWED_ORIGIN);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      return jsonResponse({ error: message }, 500, env.ALLOWED_ORIGIN);
    }
  },
};
`
  );
}
