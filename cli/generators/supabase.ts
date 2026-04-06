import type { ProjectConfig } from "../prompts.js";
import { writeProjectFile } from "../utils/files.js";

export async function generateSupabase(config: ProjectConfig): Promise<void> {
  const { supabaseUrl, supabaseAnonKey, resendApiKey, outputDir } = config;

  // --- SQL migration ---
  await writeProjectFile(
    outputDir,
    "supabase/migration.sql",
    `-- framer-auth-kit: Supabase migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Enable the required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create a profiles table that mirrors auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Trigger: Automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Trigger: Update updated_at on profile changes
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER on_profile_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();
`
  );

  // --- .env template ---
  await writeProjectFile(
    outputDir,
    ".env.template",
    `# framer-auth-kit environment variables
# Copy this to .env.local (Next.js) or set in wrangler.toml (Cloudflare)

SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseAnonKey}
RESEND_API_KEY=${resendApiKey}
ALLOWED_ORIGIN=https://your-framer-site.framer.app
COOKIE_DOMAIN=your-framer-site.framer.app
`
  );
}
