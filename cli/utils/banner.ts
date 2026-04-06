import chalk from "chalk";

export function printBanner(): void {
  const banner = `
${chalk.cyan.bold(`
  ╔═══════════════════════════════════════════════╗
  ║                                               ║
  ║   ┌─┐┬─┐┌─┐┌┬┐┌─┐┬─┐   ┌─┐┬ ┬┌┬┐┬ ┬       ║
  ║   ├┤ ├┬┘├─┤│││├┤ ├┬┘───├─┤│ │ │ ├─┤───┐   ║
  ║   └  ┴└─┴ ┴┴ ┴└─┘┴└─   ┴ ┴└─┘ ┴ ┴ ┴ ┘   ║
  ║             ${chalk.white.bold("k i t")}                           ║
  ║                                               ║
  ║       ${chalk.gray("by")} ${chalk.magenta.bold("Proofly")}                          ║
  ║                                               ║
  ╚═══════════════════════════════════════════════╝
`)}
  ${chalk.gray("Cookie-based auth for Framer + Supabase")}
`;
  console.log(banner);
}

export function printSuccess(outputDir: string): void {
  console.log("");
  console.log(chalk.green.bold("  Success! Your project has been scaffolded."));
  console.log(chalk.gray(`  Output: ${outputDir}`));
  console.log("");
  console.log(chalk.cyan.bold("  Next steps:"));
  console.log("");
  console.log(
    chalk.white(
      "  1. Run the SQL migration in your Supabase dashboard"
    )
  );
  console.log(
    chalk.white(
      "  2. Deploy your backend (instructions in docs/)"
    )
  );
  console.log(
    chalk.white(
      "  3. Copy the framer-overrides/ files into your Framer project assets"
    )
  );
  console.log(
    chalk.white(
      "  4. Add withAuth override to any page you want to protect"
    )
  );
  console.log("");
  console.log(
    chalk.yellow(
      "  Want page-level protection before the page loads?"
    )
  );
  console.log(
    chalk.yellow.bold(
      "  Check out PageLock by Proofly → https://proofly.xyz"
    )
  );
  console.log("");
}
