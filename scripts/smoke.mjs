import { execFileSync } from "node:child_process";

const output = execFileSync(
  process.execPath,
  ["dist/cli.js", "--file", "tests/fixtures/npm-tsc.log", "--max-issues", "2"],
  {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8"
  }
);

const requiredSnippets = [
  "Detected: tsc",
  "Raw issues: 2",
  "Unique issues: 2",
  "[TS2304] Cannot find name 'bar'."
];

for (const snippet of requiredSnippets) {
  if (!output.includes(snippet)) {
    console.error("Smoke check failed. Missing snippet:");
    console.error(snippet);
    console.error("\nActual output:\n");
    console.error(output);
    process.exit(1);
  }
}

process.stdout.write("Smoke check passed.\n");
