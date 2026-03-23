import { readFile } from "node:fs/promises";
import { stdin } from "node:process";

import { runCommand } from "./runCommand.js";
import type { CliOptions } from "../types.js";

export async function readInput(options: CliOptions) {
  if (options.file) {
    return {
      rawInput: await readFile(options.file, "utf8"),
      exitCode: 0,
      source: "file" as const
    };
  }

  if (options.run) {
    return runCommand(options.run);
  }

  if (stdin.isTTY) {
    return {
      rawInput: "",
      exitCode: 0
    };
  }

  return {
    rawInput: await readStdin(),
    exitCode: 0,
    source: "stdin" as const
  };
}

async function readStdin(): Promise<string> {
  let result = "";

  for await (const chunk of stdin) {
    result += String(chunk);
  }

  return result;
}
