import type { ProjectConfig } from "../prompts.js";
import { writeProjectFile } from "../utils/files.js";

export async function generateSupabase(config: ProjectConfig): Promise<void> {
  const { supabaseUrl, supabaseAnonKey, resendApiKey, outputDir } = config;

  // --- SQL migration ---
  await writeProjectFile(
    outputDir,
    "supabase/migrations/001_auth_setup.sql",
    `-- framer-auth-kit: Supabase migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- Roles
create type public.user_role as enum ('admin', 'member', 'guest');

-- Profiles table (extends auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  role public.user_role default 'member',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- User rules (per-user content access flags)
create table public.user_rules (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  rule_key text not null,
  rule_value boolean default false,
  created_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.user_rules enable row level security;

-- Profiles: users can read and update their own
create policy "Users can view own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- User rules: users can only read their own rules
create policy "Users can view own rules"
  on public.user_rules for select using (auth.uid() = user_id);

-- Admins can do everything
create policy "Admins have full access to profiles"
  on public.profiles for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admins have full access to user_rules"
  on public.user_rules for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );
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
