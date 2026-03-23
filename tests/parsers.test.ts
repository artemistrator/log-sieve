import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { cleanLog } from "../src/core/cleanLog.js";
import { dedupeIssues } from "../src/core/dedupeIssues.js";
import { detectFormat } from "../src/core/detectFormat.js";
import { summarizeLog } from "../src/core/summarizeLog.js";

function loadFixture(name: string): string {
  return readFileSync(resolve(import.meta.dirname, "fixtures", name), "utf8");
}

describe("fixture-based parsing", () => {
  it("ignores npm wrapper noise around tsc output", () => {
    const summary = summarizeLog(loadFixture("npm-tsc.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.totalIssues).toBe(2);
    expect(summary.uniqueIssues).toBe(2);
    expect(summary.issues.every((issue) => issue.tool === "tsc")).toBe(true);
  });

  it("parses and deduplicates TypeScript compiler output", () => {
    const summary = summarizeLog(loadFixture("tsc.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.totalIssues).toBe(3);
    expect(summary.uniqueIssues).toBe(2);
    expect(summary.issues[0]).toMatchObject({
      tool: "tsc",
      priority: "high"
    });
    expect(summary.rootCauseHint).toBe("TypeScript compile errors are blocking downstream checks.");
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        file: "src/foo.ts",
        line: 12,
        column: 5,
        ruleOrCode: "TS2304"
      })
    );
  });

  it("parses realistic eslint stylish output", () => {
    const summary = summarizeLog(loadFixture("eslint.log"));

    expect(summary.detectedTool).toBe("eslint");
    expect(summary.totalIssues).toBe(3);
    expect(summary.uniqueIssues).toBe(3);
    expect(summary.issues[0]).toMatchObject({
      tool: "eslint",
      file: "/repo/src/app.ts",
      line: 44,
      column: 10,
      priority: "medium"
    });
  });

  it("ignores pnpm wrapper noise around eslint output", () => {
    const summary = summarizeLog(loadFixture("pnpm-eslint.log"));

    expect(summary.detectedTool).toBe("eslint");
    expect(summary.totalIssues).toBe(3);
    expect(summary.uniqueIssues).toBe(3);
    expect(summary.issues.some((issue) => issue.message.includes("ELIFECYCLE"))).toBe(false);
  });

  it("parses vitest or jest failures with assertion detail", () => {
    const summary = summarizeLog(loadFixture("vitest.log"));

    expect(summary.detectedTool).toBe("test");
    expect(summary.totalIssues).toBe(3);
    expect(summary.uniqueIssues).toBe(2);
    expect(summary.issues[0]).toMatchObject({
      tool: "test",
      category: "assertion",
      file: "tests/auth.test.ts",
      line: 18,
      column: 12,
      priority: "high"
    });
    expect(summary.rootCauseHint).toBe("Test failures appear to be the main blocker.");
    expect(summary.primaryBlocker).toBe("Test failures");
    expect(summary.downstreamSummary).toBeUndefined();
  });

  it("parses longer vitest output with repeated failed-tests sections", () => {
    const summary = summarizeLog(loadFixture("vitest-long.log"));

    expect(summary.detectedTool).toBe("test");
    expect(summary.totalIssues).toBe(3);
    expect(summary.uniqueIssues).toBe(2);
    expect(summary.issues[0]).toMatchObject({
      tool: "test",
      file: "tests/auth.test.ts",
      line: 18,
      column: 12
    });
  });

  it("parses longer jest output with stack locations", () => {
    const summary = summarizeLog(loadFixture("jest-long.log"));

    expect(summary.detectedTool).toBe("test");
    expect(summary.totalIssues).toBe(2);
    expect(summary.uniqueIssues).toBe(2);
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        tool: "test",
        file: "tests/math.test.ts",
        line: 8,
        column: 12
      })
    );
  });

  it("falls back to generic parsing and dedupes repeated lines", () => {
    const summary = summarizeLog(loadFixture("generic.log"));

    expect(summary.detectedTool).toBe("generic");
    expect(summary.totalIssues).toBe(3);
    expect(summary.uniqueIssues).toBe(2);
    expect(summary.issues[0]).toMatchObject({
      tool: "generic",
      file: "tools/build.log",
      line: 17,
      column: 9,
      priority: "low"
    });
  });

  it("prefers the most structured parser for mixed logs", () => {
    const summary = summarizeLog(loadFixture("mixed.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.totalIssues).toBe(2);
    expect(summary.uniqueIssues).toBe(1);
  });

  it("combines structured issues from mixed build and test logs", () => {
    const summary = summarizeLog(loadFixture("mixed-build-test.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.totalIssues).toBe(2);
    expect(summary.uniqueIssues).toBe(2);
    expect(summary.issues.map((issue) => issue.tool)).toEqual(["tsc", "test"]);
    expect(summary.rootCauseHint).toBe("TypeScript compile errors are blocking downstream checks.");
    expect(summary.primaryBlocker).toBe("TypeScript compile/typecheck errors");
    expect(summary.downstreamSummary).toBe("Test runner failures likely caused by compile/typecheck issues.");
    expect(summary.primaryIssues?.every((issue) => issue.tool === "tsc")).toBe(true);
    expect(summary.downstreamIssues?.every((issue) => issue.tool === "test")).toBe(true);
  });

  it("deduplicates across chained scripts with repeated sections and path variants", () => {
    const summary = summarizeLog(loadFixture("chained-scripts.log"));

    expect(summary.uniqueIssues).toBe(3);
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        tool: "tsc",
        file: "/Users/example/demo-app/src/foo.ts"
      })
    );
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        tool: "eslint",
        file: "/Users/example/demo-app/src/foo.ts"
      })
    );
    expect(summary.issues).toContainEqual(
      expect.objectContaining({
        tool: "test",
        file: "/Users/example/demo-app/tests/foo.test.ts"
      })
    );
  });

  it("prioritizes TypeScript blockers over downstream test failures", () => {
    const summary = summarizeLog(loadFixture("compile-test-downstream.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.issues[0]).toMatchObject({
      tool: "tsc",
      priority: "high"
    });
    expect(summary.primaryBlocker).toBe("TypeScript compile/typecheck errors");
    expect(summary.downstreamSummary).toBe("Test runner failures likely caused by compile/typecheck issues.");
    expect(summary.nextStep).toBe("Fix compile/typecheck issues first before trusting test failures.");
  });

  it("prioritizes module resolution blockers over downstream test failures", () => {
    const summary = summarizeLog(loadFixture("import-test-downstream.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.issues[0]).toMatchObject({
      tool: "tsc",
      ruleOrCode: "TS2307",
      priority: "high"
    });
    expect(summary.primaryBlocker).toBe("TypeScript compile/typecheck errors");
    expect(summary.downstreamSummary).toBe("Test runner failures likely caused by compile/typecheck issues.");
  });

  it("keeps compile blockers above lint issues when both are present", () => {
    const summary = summarizeLog([
      "src/foo.ts:12:5 - error TS2304: Cannot find name 'bar'.",
      "",
      "/repo/src/foo.ts",
      "  12:5  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any"
    ].join("\n"));

    expect(summary.issues[0]).toMatchObject({
      tool: "tsc",
      priority: "high"
    });
    expect(summary.primaryBlocker).toBe("TypeScript compile/typecheck errors");
  });

  it("clusters repeated TypeScript assignment errors by target type", () => {
    const summary = summarizeLog(loadFixture("cluster-ts-assignments.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.uniqueIssues).toBe(4);
  });

  it("clusters repeated missing-property errors by target type without merging unrelated targets", () => {
    const summary = summarizeLog(loadFixture("cluster-ts-missing-properties.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.uniqueIssues).toBe(4);
  });

  it("clusters repeated module resolution failures by missing module", () => {
    const summary = summarizeLog(loadFixture("cluster-ts-imports.log"));

    expect(summary.detectedTool).toBe("tsc");
    expect(summary.issues[0]).toMatchObject({
      ruleOrCode: "TS2307",
      priority: "high"
    });
  });
});

describe("core helpers", () => {
  it("strips ansi codes and normalizes line endings", () => {
    const input = "\u001b[31merror\u001b[0m\r\nnext line\r";

    expect(cleanLog(input)).toBe("error\nnext line");
  });

  it("detects formats heuristically from fixtures", () => {
    expect(detectFormat(loadFixture("tsc.log"))).toBe("tsc");
    expect(detectFormat(loadFixture("eslint.log"))).toBe("eslint");
    expect(detectFormat(loadFixture("vitest.log"))).toBe("test");
    expect(detectFormat(loadFixture("mixed.log"))).toBe("tsc");
    expect(detectFormat(loadFixture("mixed-build-test.log"))).toBe("tsc");
  });

  it("deduplicates repeated generic and stack-like issues deterministically", () => {
    const unique = dedupeIssues([
      {
        tool: "generic",
        category: "issue",
        message: "Error: Broken pipeline",
        rawSnippet: "Error: Broken pipeline\n    at run (/tmp/tool.js:10:2)"
      },
      {
        tool: "generic",
        category: "issue",
        message: "Error: Broken pipeline",
        rawSnippet: "Error: Broken pipeline\n    at main (/tmp/tool.js:20:1)"
      },
      {
        tool: "test",
        category: "assertion",
        file: "tests/auth.test.ts",
        line: 18,
        column: 12,
        message: "AssertionError: expected true to be false"
      },
      {
        tool: "test",
        category: "assertion",
        file: "tests/auth.test.ts",
        line: 18,
        column: 12,
        message: "AssertionError: expected true to be false"
      }
    ]);

    expect(unique).toHaveLength(2);
  });

  it("deduplicates absolute and relative path variants", () => {
    const unique = dedupeIssues([
      {
        tool: "test",
        category: "assertion",
        file: "/Users/example/demo-app/tests/foo.test.ts",
        line: 9,
        column: 10,
        message: "AssertionError: expected 1 to be 2"
      },
      {
        tool: "test",
        category: "assertion",
        file: "tests/foo.test.ts",
        line: 9,
        column: 10,
        message: "AssertionError: expected 1 to be 2"
      }
    ]);

    expect(unique).toHaveLength(1);
  });
});
