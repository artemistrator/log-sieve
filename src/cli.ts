#!/usr/bin/env node

import { executeCli } from "./core/executeCli.js";

async function main(): Promise<void> {
  process.exitCode = await executeCli(process.argv.slice(2));
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exitCode = 2;
});
