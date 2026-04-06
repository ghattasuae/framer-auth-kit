import { ensureDir, writeFile } from "fs-extra";
import path from "path";

/**
 * Write a file to disk, creating parent directories as needed.
 */
export async function writeProjectFile(
  outputDir: string,
  filePath: string,
  content: string
): Promise<void> {
  const fullPath = path.join(outputDir, filePath);
  await ensureDir(path.dirname(fullPath));
  await writeFile(fullPath, content, "utf-8");
}
