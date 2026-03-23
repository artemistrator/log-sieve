import { spawn } from "node:child_process";

import type { InputResult } from "../types.js";

export async function runCommand(command: string): Promise<InputResult> {
  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const child = spawn(command, {
      shell: true,
      stdio: ["ignore", "pipe", "pipe"]
    });

    child.stdout?.on("data", (chunk) => {
      chunks.push(String(chunk));
    });

    child.stderr?.on("data", (chunk) => {
      chunks.push(String(chunk));
    });

    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        rawInput: chunks.join(""),
        exitCode: code ?? (signal ? 1 : 0),
        source: "run"
      });
    });
  });
}
