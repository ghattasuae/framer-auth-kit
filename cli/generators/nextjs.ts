import type { ProjectConfig } from "../prompts.js";
import { writeProjectFile } from "../utils/files.js";

export async function generateNextjs(config: ProjectConfig): Promise<void> {
  const { projectName, supabaseUrl, supabaseAnonKey, resendApiKey, outputDir } =
    config;

  // --- .env.local ---
  await writeProjectFile(
    outputDir,
    ".env.local",
    `SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseAnonKey}
RESEND_API_KEY=${resendApiKey}
ALLOWED_ORIGIN=https://your-framer-site.framer.app
COOKIE_DOMAIN=your-framer-site.framer.app
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
          dev: "next dev",
          build: "next build",
          start: "next start",
        },
        dependencies: {
          next: "^14.1.0",
          react: "^18.2.0",
          "react-dom": "^18.2.0",
          "@supabase/supabase-js": "^2.39.0",
        },
        devDependencies: {
          typescript: "^5.3.0",
          "@types/node": "^20.11.0",
          "@types/react": "^18.2.0",
        },
      },
      null,
      2
    ) + "\n"
  );

  // --- Shared helpers: lib/supabase.ts ---
  await writeProjectFile(
    outputDir,
    "lib/supabase.ts",
    `import { createClient } from "@supabase/supabase-js";

export function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );
}
`
  );

  // --- Shared helpers: lib/cookies.ts ---
  await writeProjectFile(
    outputDir,
    "lib/cookies.ts",
    `export function parseCookies(cookieHeader: string | null): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [key, ...rest] = c.trim().split("=");
      return [key, rest.join("=")];
    })
  );
}

export function authCookieOptions(): string {
  const domain = process.env.COOKIE_DOMAIN || "";
  return \`; HttpOnly; Secure; SameSite=None; Path=/; Domain=\${domain}; Max-Age=604800\`;
}

export function expiredCookieOptions(): string {
  const domain = process.env.COOKIE_DOMAIN || "";
  return \`; HttpOnly; Secure; SameSite=None; Path=/; Domain=\${domain}; Max-Age=0\`;
}
`
  );

  // --- Shared helpers: lib/cors.ts ---
  await writeProjectFile(
    outputDir,
    "lib/cors.ts",
    `export function corsHeaders(): Record<string, string> {
  const origin = process.env.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}
`
  );

  // --- POST /auth/send-otp ---
  await writeProjectFile(
    outputDir,
    "app/api/auth/send-otp/route.ts",
    `import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { corsHeaders } from "../../../../lib/cors";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      { success: true },
      { status: 200, headers: corsHeaders() }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
`
  );

  // --- POST /auth/verify-otp ---
  await writeProjectFile(
    outputDir,
    "app/api/auth/verify-otp/route.ts",
    `import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { corsHeaders } from "../../../../lib/cors";
import { authCookieOptions } from "../../../../lib/cookies";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const { email, token } = await request.json();

    if (!email || !token) {
      return NextResponse.json(
        { error: "Email and token are required" },
        { status: 400, headers: corsHeaders() }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: corsHeaders() }
      );
    }

    const response = NextResponse.json(
      {
        success: true,
        user: {
          id: data.user?.id,
          email: data.user?.email,
          role: data.user?.role,
          metadata: data.user?.user_metadata,
        },
      },
      { status: 200, headers: corsHeaders() }
    );

    if (data.session) {
      const opts = authCookieOptions();
      response.headers.append(
        "Set-Cookie",
        \`access_token=\${data.session.access_token}\${opts}\`
      );
      response.headers.append(
        "Set-Cookie",
        \`refresh_token=\${data.session.refresh_token}\${opts}\`
      );
    }

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
`
  );

  // --- GET /auth/session ---
  await writeProjectFile(
    outputDir,
    "app/api/auth/session/route.ts",
    `import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { corsHeaders } from "../../../../lib/cors";
import { parseCookies } from "../../../../lib/cookies";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("Cookie");
    const cookies = parseCookies(cookieHeader);
    const accessToken = cookies["access_token"];

    if (!accessToken) {
      return NextResponse.json(
        { user: null },
        { status: 200, headers: corsHeaders() }
      );
    }

    const supabase = getSupabase();
    const { data, error } = await supabase.auth.getUser(accessToken);

    if (error || !data.user) {
      return NextResponse.json(
        { user: null },
        { status: 200, headers: corsHeaders() }
      );
    }

    return NextResponse.json(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
          role: data.user.role,
          metadata: data.user.user_metadata,
        },
      },
      { status: 200, headers: corsHeaders() }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
`
  );

  // --- POST /auth/logout ---
  await writeProjectFile(
    outputDir,
    "app/api/auth/logout/route.ts",
    `import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "../../../../lib/supabase";
import { corsHeaders } from "../../../../lib/cors";
import { parseCookies, expiredCookieOptions } from "../../../../lib/cookies";

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  try {
    const cookieHeader = request.headers.get("Cookie");
    const cookies = parseCookies(cookieHeader);
    const accessToken = cookies["access_token"];

    if (accessToken) {
      const supabase = getSupabase();
      await supabase.auth.signOut();
    }

    const response = NextResponse.json(
      { success: true },
      { status: 200, headers: corsHeaders() }
    );

    const opts = expiredCookieOptions();
    response.headers.append("Set-Cookie", \`access_token=\${opts}\`);
    response.headers.append("Set-Cookie", \`refresh_token=\${opts}\`);

    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500, headers: corsHeaders() }
    );
  }
}
`
  );
}
