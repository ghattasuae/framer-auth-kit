#!/usr/bin/env node

import * as p from "@clack/prompts";
import chalk from "chalk";
import { printBanner, printSuccess } from "./utils/banner.js";
import { runPrompts } from "./prompts.js";
import { generateCloudflare } from "./generators/cloudflare.js";
import { generateNextjs } from "./generators/nextjs.js";
import { generateSupabase } from "./generators/supabase.js";
import { generateFramer } from "./generators/framer.js";

async function main(): Promise<void> {
  printBanner();

  const config = await runPrompts();

  const s = p.spinner();
  s.start("Generating project files...");

  try {
    // Generate Supabase migration and env template (always)
    await generateSupabase(config);

    // Generate backend based on user choice
    if (config.backend === "cloudflare") {
      await generateCloudflare(config);
    } else {
      await generateNextjs(config);
    }

    // Generate Framer overrides (always)
    await generateFramer(config);

    s.stop(chalk.green("Files generated successfully!"));
  } catch (err) {
    s.stop(chalk.red("Failed to generate files."));
    const message = err instanceof Error ? err.message : String(err);
    console.error(chalk.red(`\n  Error: ${message}`));
    process.exit(1);
  }

  printSuccess(config.outputDir);
}

main().catch((err) => {
  console.error(chalk.red("Unexpected error:"), err);
  process.exit(1);
});
