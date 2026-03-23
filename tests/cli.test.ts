import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { computeExitCode } from "../src/core/computeExitCode.js";
import { executeCli } from "../src/core/executeCli.js";
import { getHelpText, parseArgs } from "../src/core/parseArgs.js";
import { runCommand } from "../src/core/runCommand.js";
import { summarizeLog } from "../src/core/summarizeLog.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((path) => rm(path, { recursive: true, force: true })));
  tempDirs.length = 0;
});

function fixturePath(name: string): string {
  return resolve(import.meta.dirname, "fixtures", name);
}

function createIo() {
  const stdout: string[] = [];
  const stderr: string[] = [];

  return {
    io: {
      writeStdout: (text: string) => {
        stdout.push(text);
      },
      writeStderr: (text: string) => {
        stderr.push(text);
      }
    },
    getStdout: () => stdout.join(""),
    getStderr: () => stderr.join("")
  };
}

async function createTempDir(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "log-sieve-test-"));
  tempDirs.push(path);
  return path;
}

describe("cli argument parsing", () => {
  it("parses run mode with backward-compatible json", () => {
    expect(parseArgs(["--run", "npm test", "--json"])).toEqual({
      run: "npm test",
      runs: ["npm test"],
      quiet: false,
      failOn: "none",
      ci: false,
      printRawOnError: false,
      format: "json",
      forLlm: false,
      help: false
    });
  });

  it("parses explicit format and trim flags", () => {
    expect(parseArgs(["--format", "md", "--for-llm", "--max-issues", "2", "--max-chars", "500"]))
      .toEqual({
        format: "md",
        forLlm: true,
        quiet: false,
        failOn: "none",
        ci: false,
        printRawOnError: false,
        maxIssues: 2,
        maxChars: 500,
        help: false
      });
  });

  it("rejects conflicting input sources", () => {
    expect(() => parseArgs(["--file", "build.log", "--run", "npm test"])).toThrow(
      "Choose one input source"
    );
  });

  it("parses repeated run flags for multi-run diagnosis", () => {
    expect(parseArgs(["--run", "npm run build", "--run", "npm test"])).toEqual({
      format: "text",
      forLlm: false,
      quiet: false,
      failOn: "none",
      ci: false,
      printRawOnError: false,
      help: false,
      runs: ["npm run build", "npm test"]
    });
  });

  it("rejects ambiguous json and format combinations", () => {
    expect(() => parseArgs(["--json", "--format", "md"])).toThrow(
      "Do not combine --json with a different --format"
    );
  });

  it("allows --json together with --format json", () => {
    expect(parseArgs(["--json", "--format", "json"])).toEqual({
      format: "json",
      forLlm: false,
      quiet: false,
      failOn: "none",
      ci: false,
      printRawOnError: false,
      help: false
    });
  });

  it("rejects --for-llm with json output", () => {
    expect(() => parseArgs(["--format", "json", "--for-llm"])).toThrow(
      "--for-llm supports text and md output only."
    );
  });

  it("rejects --ci with markdown output", () => {
    expect(() => parseArgs(["--ci", "--format", "md"])).toThrow("--ci supports text output only.");
  });

  it("rejects --ci with --for-llm", () => {
    expect(() => parseArgs(["--ci", "--for-llm"])).toThrow("Do not combine --ci with --for-llm.");
  });

  it("renders help text with run mode", () => {
    expect(getHelpText()).toContain("--run <command>");
    expect(getHelpText()).toContain("(repeatable)");
    expect(getHelpText()).toContain("--format <fmt>");
    expect(getHelpText()).toContain("--output <file>");
    expect(getHelpText()).toContain("--fail-on <m>");
    expect(getHelpText()).toContain("Common examples:");
    expect(getHelpText()).toContain("npm test 2>&1 | log-sieve");
  });
});

describe("command execution", () => {
  it("captures combined output and exit code", async () => {
    const result = await runCommand(
      "node -e \"process.stdout.write('out\\\\n'); process.stderr.write('err\\\\n'); process.exit(2)\""
    );

    expect(result.exitCode).toBe(2);
    expect(result.rawInput).toContain("out");
    expect(result.rawInput).toContain("err");
    expect(result.source).toBe("run");
  });
});

describe("exit code policy", () => {
  const summary = summarizeLog("src/app.ts:3:14 - error TS2322: Type 'string' is not assignable to type 'number'.");

  it("does not fail parsed issues when fail-on is none", () => {
    expect(computeExitCode({ baseExitCode: 0, failOn: "none", summary })).toBe(0);
  });

  it("fails when any parsed issue exists", () => {
    expect(computeExitCode({ baseExitCode: 0, failOn: "any", summary })).toBe(1);
  });

  it("fails when a high-priority issue exists", () => {
    expect(computeExitCode({ baseExitCode: 0, failOn: "high", summary })).toBe(1);
  });

  it("preserves non-zero child exit codes", () => {
    expect(computeExitCode({ baseExitCode: 7, failOn: "high", summary })).toBe(7);
  });
});

describe("cli execution", () => {
  it("writes text output to a file and still prints to stdout", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, "report.txt");
    const capture = createIo();

    const exitCode = await executeCli(
      ["--file", fixturePath("tsc.log"), "--output", outputPath],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.getStdout()).toContain("Detected: tsc");
    expect(await readFile(outputPath, "utf8")).toContain("Top issues:");
  });

  it("creates missing parent directories for nested text output paths", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, "reports", "build", "report.txt");
    const capture = createIo();

    const exitCode = await executeCli(
      ["--file", fixturePath("tsc.log"), "--output", outputPath, "--quiet"],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(await readFile(outputPath, "utf8")).toContain("Detected: tsc");
  });

  it("writes markdown output quietly", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, "report.md");
    const capture = createIo();

    const exitCode = await executeCli(
      ["--file", fixturePath("tsc.log"), "--format", "md", "--output", outputPath, "--quiet"],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(capture.getStdout()).toBe("");
    expect(await readFile(outputPath, "utf8")).toContain("# log-sieve report");
  });

  it("creates missing parent directories for nested markdown output paths", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, ".log-sieve", "out", "test-summary.md");
    const capture = createIo();

    const exitCode = await executeCli(
      ["--file", fixturePath("tsc.log"), "--format", "md", "--output", outputPath, "--quiet"],
      capture.io
    );

    expect(exitCode).toBe(0);
    expect(await readFile(outputPath, "utf8")).toContain("# log-sieve report");
  });

  it("writes json output to a file", async () => {
    const dir = await createTempDir();
    const outputPath = join(dir, "report.json");
    const capture = createIo();

    const exitCode = await executeCli(
      ["--file", fixturePath("eslint.log"), "--format", "json", "--output", outputPath, "--quiet"],
      capture.io
    );

    expect(exitCode).toBe(0);
    const json = JSON.parse(await readFile(outputPath, "utf8")) as { detectedTool: string };
    expect(json.detectedTool).toBe("eslint");
  });

  it("writes to a current-directory filename without extra directory handling", async () => {
    const dir = await createTempDir();
    const capture = createIo();
    const previousCwd = process.cwd();

    process.chdir(dir);

    try {
      const exitCode = await executeCli(
        ["--file", fixturePath("eslint.log"), "--format", "json", "--output", "report.json", "--quiet"],
        capture.io
      );

      expect(exitCode).toBe(0);
      const json = JSON.parse(await readFile(join(dir, "report.json"), "utf8")) as {
        detectedTool: string;
      };
      expect(json.detectedTool).toBe("eslint");
    } finally {
      process.chdir(previousCwd);
    }
  });

  it("allows quiet mode without output", async () => {
    const capture = createIo();

    const exitCode = await executeCli(
      ["--file", fixturePath("eslint.log"), "--quiet", "--fail-on", "any"],
      capture.io
    );

    expect(exitCode).toBe(1);
    expect(capture.getStdout()).toBe("");
  });

  it("reports output file write errors when the parent path is not a directory", async () => {
    const dir = await createTempDir();
    const blockingPath = join(dir, "reports");
    await writeFile(blockingPath, "not a directory", "utf8");
    const outputPath = join(blockingPath, "report.txt");
    const capture = createIo();

    const exitCode = await executeCli(
      ["--file", fixturePath("tsc.log"), "--output", outputPath, "--quiet"],
      capture.io
    );

    expect(exitCode).toBe(2);
    expect(capture.getStderr()).not.toBe("");
  });

  it("prints raw cleaned log on unparsed command failure when requested", async () => {
    const capture = createIo();

    const exitCode = await executeCli(
      [
        "--run",
        "node -e \"process.stderr.write('Build crashed unexpectedly\\\\nMore detail here\\\\n'); process.exit(3)\"",
        "--quiet",
        "--print-raw-on-error"
      ],
      capture.io
    );

    expect(exitCode).toBe(3);
    expect(capture.getStderr()).toContain("Raw cleaned log:");
    expect(capture.getStderr()).toContain("Build crashed unexpectedly");
  });

  it("combines child exit codes with fail-on rules predictably", async () => {
    const capture = createIo();

    const exitCode = await executeCli(
      [
        "--run",
        "node -e \"process.stdout.write('src/app.ts:3:14 - error TS2322: Type \\'string\\' is not assignable to type \\'number\\'.\\\\n'); process.exit(5)\"",
        "--fail-on",
        "high",
        "--quiet"
      ],
      capture.io
    );

    expect(exitCode).toBe(5);
  });

  it("executes repeated run flags sequentially and renders a cross-run diagnosis", async () => {
    const capture = createIo();

    const exitCode = await executeCli(
      [
        "--run",
        "node -e \"process.stdout.write('src/app.ts:3:14 - error TS2322: Type \\'string\\' is not assignable to type \\'number\\'.\\\\n'); process.exit(2)\"",
        "--run",
        "node -e \"process.stdout.write('FAIL  tests/auth.test.ts\\\\n  ● Test suite failed to run\\\\n    Cannot read properties of undefined (reading \\'token\\')\\\\n'); process.exit(1)\""
      ],
      capture.io
    );

    expect(exitCode).toBe(2);
    expect(capture.getStdout()).toContain("Detected: multi-run");
    expect(capture.getStdout()).toContain("Most informative run:");
    expect(capture.getStdout()).toContain("Primary blocker: TypeScript compile/typecheck errors");
    expect(capture.getStdout()).toContain("Downstream runs:");
  });

  it("prints raw cleaned log for noisy multi-run failures when requested", async () => {
    const capture = createIo();

    const exitCode = await executeCli(
      [
        "--run",
        "node -e \"process.stderr.write('Build exploded badly\\\\n'); process.exit(3)\"",
        "--run",
        "node -e \"process.stdout.write('src/foo.ts:12:5 - error TS2304: Cannot find name \\'bar\\'.\\\\n'); process.exit(2)\"",
        "--quiet",
        "--print-raw-on-error"
      ],
      capture.io
    );

    expect(exitCode).toBe(3);
    expect(capture.getStderr()).toContain("Raw cleaned log for");
    expect(capture.getStderr()).toContain("Build exploded badly");
  });
});
