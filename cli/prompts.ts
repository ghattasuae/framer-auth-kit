import * as p from "@clack/prompts";
import chalk from "chalk";

export interface ProjectConfig {
  projectName: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  resendApiKey: string;
  backend: "cloudflare" | "nextjs";
  outputDir: string;
}

export async function runPrompts(): Promise<ProjectConfig> {
  p.intro(chalk.cyan("Let's set up your auth backend"));

  const answers = await p.group(
    {
      projectName: () =>
        p.text({
          message: "What is your project name?",
          placeholder: "my-app",
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return "Project name is required";
            }
            if (!/^[a-z0-9-]+$/.test(value.trim())) {
              return "Project name must be lowercase alphanumeric with hyphens only";
            }
          },
        }),

      supabaseUrl: () =>
        p.text({
          message: "Supabase project URL",
          placeholder: "https://xxxx.supabase.co",
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return "Supabase URL is required";
            }
            if (!value.includes("supabase.co")) {
              return "Must be a valid Supabase URL";
            }
          },
        }),

      supabaseAnonKey: () =>
        p.text({
          message: "Supabase anon key",
          placeholder: "eyJhb...",
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return "Supabase anon key is required";
            }
          },
        }),

      resendApiKey: () =>
        p.text({
          message: "Resend API key",
          placeholder: "re_...",
          validate: (value) => {
            if (!value || value.trim().length === 0) {
              return "Resend API key is required";
            }
          },
        }),

      backend: () =>
        p.select({
          message: "Choose your backend",
          options: [
            {
              value: "cloudflare" as const,
              label: "Cloudflare Worker",
              hint: "Edge-first, globally distributed",
            },
            {
              value: "nextjs" as const,
              label: "Next.js",
              hint: "App Router route handlers",
            },
          ],
        }),

      outputDir: ({ results }) =>
        p.text({
          message: "Output directory",
          defaultValue: `./framer-auth-${results.projectName}`,
          placeholder: `./framer-auth-${results.projectName}`,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Setup cancelled.");
        process.exit(0);
      },
    }
  );

  p.outro(chalk.green("Configuration complete!"));

  return {
    projectName: answers.projectName.trim(),
    supabaseUrl: answers.supabaseUrl.trim(),
    supabaseAnonKey: answers.supabaseAnonKey.trim(),
    resendApiKey: answers.resendApiKey.trim(),
    backend: answers.backend,
    outputDir: answers.outputDir.trim(),
  };
}
