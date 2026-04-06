import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createSupabaseClient() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    }
  );
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": process.env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function POST(request: NextRequest) {
  const { email, token } = (await request.json()) as {
    email?: string;
    token?: string;
  };

  if (!email || !token) {
    return NextResponse.json(
      { error: "Email and token are required" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const supabase = createSupabaseClient();
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

  const session = data.session;
  if (!session) {
    return NextResponse.json(
      { error: "No session returned" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const response = NextResponse.json(
    { user: data.user },
    { headers: corsHeaders() }
  );

  response.cookies.set("access_token", session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: session.expires_in,
  });

  response.cookies.set("refresh_token", session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
