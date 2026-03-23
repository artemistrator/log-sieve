import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
export async function writeOutput(path, content) {
    const parentDir = dirname(path);
    if (parentDir !== ".") {
        await mkdir(parentDir, { recursive: true });
    }
    await writeFile(path, content, "utf8");
}
