import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function writeOutput(path: string, content: string): Promise<void> {
  const parentDir = dirname(path);

  if (parentDir !== ".") {
    await mkdir(parentDir, { recursive: true });
  }

  await writeFile(path, content, "utf8");
}
