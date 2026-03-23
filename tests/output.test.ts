import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { renderOutput } from "../src/core/renderOutput.js";
import { summarizeLog } from "../src/core/summarizeLog.js";

function loadFixture(name: string): string {
  return readFileSync(resolve(import.meta.dirname, "fixtures", name), "utf8");
}

describe("output formats", () => {
  it("renders compact markdown output", () => {
    const summary = summarizeLog(loadFixture("tsc.log"));
    const output = renderOutput(summary, {
      format: "md",
      forLlm: false,
      ci: false
    });

    expect(output).toContain("# log-sieve report");
    expect(output).toContain("## Top issues");
    expect(output).toContain("`src/foo.ts:12:5` `[TS2304]` Cannot find name 'bar'.");
    expect(output).toContain("## Suggested next step");
  });

  it("renders llm-focused text output with fix ordering", () => {
    const summary = summarizeLog(loadFixture("eslint.log"));
    const output = renderOutput(summary, {
      format: "text",
      forLlm: true,
      ci: false
    });

    expect(output).toContain("Likely first fix target:");
    expect(output).toContain("Recommended fix order:");
    expect(output).toContain("1. Fix issues in /repo/src/app.ts");
    expect(output).not.toContain("Unexpected console statement");
  });

  it("trims issues using max-issues", () => {
    const summary = summarizeLog(loadFixture("eslint.log"));
    const output = renderOutput(summary, {
      format: "text",
      forLlm: false,
      ci: false,
      maxIssues: 1
    });

    expect(output).toContain("1. /repo/src/app.ts:44:10");
    expect(output).toContain("Truncated: omitted 2 lower-priority issue(s).");
    expect(output).not.toContain("2.");
  });

  it("trims text output using max-chars", () => {
    const summary = summarizeLog(loadFixture("tsc.log"));
    const output = renderOutput(summary, {
      format: "text",
      forLlm: false,
      ci: false,
      maxChars: 180
    });

    expect(output.length).toBeLessThanOrEqual(180);
    expect(output).toContain("Truncated");
  });

  it("keeps json valid while trimming", () => {
    const summary = summarizeLog(loadFixture("eslint.log"));
    const output = renderOutput(summary, {
      format: "json",
      forLlm: false,
      ci: false,
      maxIssues: 1,
      maxChars: 320
    });

    const parsed = JSON.parse(output) as { issues: unknown[]; truncated: boolean; omittedIssues: number };
    expect(parsed.issues.length).toBeLessThanOrEqual(1);
    expect(parsed.truncated).toBe(true);
    expect(parsed.omittedIssues).toBeGreaterThanOrEqual(2);
  });

  it("renders compact ci output", () => {
    const summary = summarizeLog(loadFixture("tsc.log"));
    const output = renderOutput(summary, {
      format: "text",
      forLlm: false,
      ci: true
    });

    expect(output).toContain("Detected: tsc");
    expect(output).toContain("Raw issues: 3");
    expect(output).toContain("Unique issues: 2");
    expect(output).toContain("Top issues:");
    expect(output).toContain("Next step: Fix the TypeScript compile errors first, then rerun the command.");
    expect(output).not.toContain("Files with most issues:");
  });

  it("uses clearer wording when no structured issues are found", () => {
    const summary = summarizeLog("all good");
    const output = renderOutput(summary, {
      format: "text",
      forLlm: false,
      ci: false
    });

    expect(output).toContain("Detected: no structured issues");
    expect(output).toContain("No structured issues found.");
    expect(output).toContain("If the command still failed, rerun with --print-raw-on-error");
  });

  it("renders paths relative to the current working directory when possible", () => {
    const summary = {
      detectedTool: "tsc" as const,
      totalIssues: 1,
      uniqueIssues: 1,
      issues: [
        {
          tool: "tsc",
          category: "error",
          file: resolve(process.cwd(), "src/logger.ts"),
          line: 12,
          column: 5,
          ruleOrCode: "TS2304",
          message: "Cannot find name 'logger'.",
          priority: "high" as const
        }
      ],
      nextStep: "Fix the TypeScript compile errors first, then rerun the command.",
      rootCauseHint: "TypeScript compile errors are blocking downstream checks."
    };

    const output = renderOutput(summary, {
      format: "text",
      forLlm: false,
      ci: false
    });

    expect(output).toContain("src/logger.ts:12:5 [TS2304]");
    expect(output).not.toContain(process.cwd());
  });

  it("hides less-actionable duplicate-feeling test titles in rendered top issues", () => {
    const summary = {
      detectedTool: "test" as const,
      totalIssues: 2,
      uniqueIssues: 2,
      issues: [
        {
          tool: "test",
          category: "failure",
          file: resolve(process.cwd(), "tests/auth.test.ts"),
          message: "auth flow rejects invalid password",
          priority: "high" as const
        },
        {
          tool: "test",
          category: "assertion",
          file: resolve(process.cwd(), "tests/auth.test.ts"),
          line: 18,
          column: 12,
          message: "AssertionError: expected true to be false",
          priority: "high" as const
        }
      ],
      nextStep: "Fix the failing test assertion or error first, then rerun the command.",
      rootCauseHint: "Test failures appear to be the main blocker."
    };

    const output = renderOutput(summary, {
      format: "text",
      forLlm: false,
      ci: false
    });

    expect(output).toContain("tests/auth.test.ts:18:12 AssertionError: expected true to be false");
    expect(output).not.toContain("auth flow rejects invalid password");
  });

  it("renders mixed-log markdown with issues from multiple tools", () => {
    const summary = summarizeLog(loadFixture("mixed-build-test.log"));
    const output = renderOutput(summary, {
      format: "md",
      forLlm: false,
      ci: false
    });

    expect(output).toContain("# log-sieve report");
    expect(output).toContain("`src/foo.ts:12:5` `[TS2304]` Cannot find name 'bar'.");
    expect(output).toContain("`tests/auth.test.ts:18:12` AssertionError: expected true to be false // Object.is equality");
  });

  it("renders mixed-log ci output compactly", () => {
    const summary = summarizeLog(loadFixture("chained-scripts.log"));
    const output = renderOutput(summary, {
      format: "text",
      forLlm: false,
      ci: true
    });

    expect(output).toContain("Detected: tsc");
    expect(output).toContain("Top issues:");
    expect(output).toContain("[TS2304]");
    expect(output).toContain("AssertionError: expected 1 to be 2");
    expect(output.split("\n").length).toBeLessThanOrEqual(8);
  });
});
