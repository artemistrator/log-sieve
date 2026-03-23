import type { CliOptions, FailOnMode, OutputFormat } from "../types.js";

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    format: "text",
    forLlm: false,
    quiet: false,
    failOn: "none",
    ci: false,
    printRawOnError: false,
    help: false
  };
  let usedJsonFlag = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--json") {
      usedJsonFlag = true;
      options.format = "json";
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (arg === "--file") {
      const file = args[index + 1];
      if (!file) {
        throw new Error("Missing value for --file");
      }

      options.file = file;
      index += 1;
      continue;
    }

    if (arg === "--run") {
      const command = args[index + 1];
      if (!command) {
        throw new Error("Missing value for --run");
      }

      options.runs = [...(options.runs ?? []), command];
      index += 1;
      continue;
    }

    if (arg === "--format") {
      const format = args[index + 1];
      if (!isOutputFormat(format)) {
        throw new Error("Invalid value for --format. Use text, json, or md.");
      }

      options.format = format;
      index += 1;
      continue;
    }

    if (arg === "--for-llm") {
      options.forLlm = true;
      continue;
    }

    if (arg === "--output") {
      const output = args[index + 1];
      if (!output) {
        throw new Error("Missing value for --output");
      }

      options.output = output;
      index += 1;
      continue;
    }

    if (arg === "--quiet") {
      options.quiet = true;
      continue;
    }

    if (arg === "--fail-on") {
      const mode = args[index + 1];
      if (!isFailOnMode(mode)) {
        throw new Error("Invalid value for --fail-on. Use none, any, or high.");
      }

      options.failOn = mode;
      index += 1;
      continue;
    }

    if (arg === "--ci") {
      options.ci = true;
      continue;
    }

    if (arg === "--print-raw-on-error") {
      options.printRawOnError = true;
      continue;
    }

    if (arg === "--max-issues") {
      options.maxIssues = parsePositiveInteger(args[index + 1], "--max-issues");
      index += 1;
      continue;
    }

    if (arg === "--max-chars") {
      options.maxChars = parsePositiveInteger(args[index + 1], "--max-chars");
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  const singleRun = options.runs?.length === 1 ? options.runs[0] : undefined;
  if (singleRun) {
    options.run = singleRun;
  }

  if (options.file && options.runs && options.runs.length > 0) {
    throw new Error("Choose one input source: use either --file <path> or --run \"<command>\".");
  }

  if (usedJsonFlag && options.format !== "json") {
    throw new Error("Do not combine --json with a different --format. Use either --json or --format json.");
  }

  if (options.forLlm && options.format === "json") {
    throw new Error("--for-llm supports text and md output only.");
  }

  if (options.ci && options.format !== "text") {
    throw new Error("--ci supports text output only.");
  }

  if (options.ci && options.forLlm) {
    throw new Error("Do not combine --ci with --for-llm.");
  }

  return options;
}

export function getHelpText(): string {
  return [
    "Usage: log-sieve [--file <path> | --run \"<command>\"] [--format text|json|md]",
    "",
    "Input:",
    "  --file <path>   Read logs from a file",
    "  --run <command> Run a shell command and summarize its combined output (repeatable)",
    "  stdin           Read piped input when no explicit source is passed",
    "",
    "Output:",
    "  --format <fmt>  Choose text, json, or md output",
    "  --json          Backward-compatible alias for --format json",
    "  --output <file> Write the rendered report to a file",
    "  --quiet         Suppress normal stdout output",
    "  --fail-on <m>   Fail on none, any, or high-priority parsed issues",
    "  --ci            Print a compact CI-friendly text summary",
    "  --for-llm       Produce a concise copy-paste summary for coding agents",
    "  --print-raw-on-error  Print the cleaned raw log when a failed command has no useful parsed issues",
    "  --max-issues N  Limit the number of reported issues",
    "  --max-chars N   Limit output length; trims lower-priority content first",
    "  -h, --help      Show this help",
    "",
    "Common examples:",
    "  log-sieve --run \"npm run build\"",
    "  log-sieve --run \"pnpm test\" --for-llm",
    "  npm test 2>&1 | log-sieve",
    "  log-sieve --file ./build.log --format md --output report.md"
  ].join("\n");
}

function isOutputFormat(value: string | undefined): value is OutputFormat {
  return value === "text" || value === "json" || value === "md";
}

function isFailOnMode(value: string | undefined): value is FailOnMode {
  return value === "none" || value === "any" || value === "high";
}

function parsePositiveInteger(value: string | undefined, flag: string): number {
  if (!value) {
    throw new Error(`Missing value for ${flag}`);
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}
