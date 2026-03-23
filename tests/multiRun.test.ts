import { describe, expect, it } from "vitest";

import { createMultiRunSummary } from "../src/core/multiRun.js";
import { renderMultiRunOutput } from "../src/core/renderMultiRunOutput.js";
import { summarizeLog } from "../src/core/summarizeLog.js";
import type { RunSummary } from "../src/types.js";

function createRun(command: string, exitCode: number, rawInput: string): RunSummary {
  return {
    command,
    exitCode,
    cleanedLog: rawInput,
    summary: summarizeLog(rawInput)
  };
}

describe("multi-run diagnosis", () => {
  it("prefers typecheck over downstream test fallout across runs", () => {
    const runs = [
      createRun(
        "npm run typecheck",
        2,
        "src/app.ts:3:14 - error TS2322: Type 'string' is not assignable to type 'number'."
      ),
      createRun(
        "npm test",
        1,
        [
          "FAIL  tests/auth.test.ts",
          "  ● Test suite failed to run",
          "    Cannot read properties of undefined (reading 'token')"
        ].join("\n")
      )
    ];

    const summary = createMultiRunSummary(runs, {
      format: "text",
      forLlm: false,
      ci: false
    });

    expect(summary.aggregateSummary.primaryBlocker).toBe("TypeScript compile/typecheck errors");
    expect(summary.mostInformativeRunIndex).toBe(0);
    expect(summary.downstreamRunIndexes).toEqual([1]);
    expect(summary.bestFirstFixTarget).toContain("src/app.ts:3:14");
  });

  it("keeps the clearer blocker run even when another run is noisy", () => {
    const runs = [
      createRun("npm test", 1, "Build crashed unexpectedly\nMore detail here"),
      createRun(
        "npm run build",
        2,
        "src/foo.ts:12:5 - error TS2304: Cannot find name 'bar'."
      )
    ];

    const summary = createMultiRunSummary(runs, {
      format: "text",
      forLlm: false,
      ci: false
    });

    expect(summary.aggregateSummary.primaryBlocker).toBe("TypeScript compile/typecheck errors");
    expect(summary.mostInformativeRunIndex).toBe(1);
  });

  it("renders compact cross-run markdown and json output", () => {
    const runs = [
      createRun(
        "npm run build",
        2,
        "src/foo.ts:12:5 - error TS2304: Cannot find name 'bar'."
      ),
      createRun(
        "npm test",
        1,
        "FAIL  tests/auth.test.ts > auth flow > rejects invalid password\nAssertionError: expected true to be false\n    at tests/auth.test.ts:18:12"
      )
    ];

    const summary = createMultiRunSummary(runs, {
      format: "md",
      forLlm: false,
      ci: false
    });

    const markdown = renderMultiRunOutput(summary, {
      format: "md",
      forLlm: false,
      ci: false
    });
    const json = renderMultiRunOutput(summary, {
      format: "json",
      forLlm: false,
      ci: false
    });

    expect(markdown).toContain("- Most informative run: `npm run build`");
    expect(markdown).toContain("## Cross-run diagnosis");

    const parsed = JSON.parse(json) as {
      mode: string;
      mostInformativeRunIndex: number;
      downstreamRunIndexes: number[];
    };
    expect(parsed.mode).toBe("multi-run");
    expect(parsed.mostInformativeRunIndex).toBe(0);
    expect(parsed.downstreamRunIndexes).toEqual([1]);
  });

  it("renders compact cross-run ci output", () => {
    const runs = [
      createRun(
        "npm run build",
        2,
        "src/foo.ts:12:5 - error TS2304: Cannot find name 'bar'."
      ),
      createRun(
        "npm test",
        1,
        "FAIL  tests/auth.test.ts\n  ● Test suite failed to run\n    Cannot read properties of undefined (reading 'token')"
      )
    ];

    const summary = createMultiRunSummary(runs, {
      format: "text",
      forLlm: false,
      ci: true
    });

    const output = renderMultiRunOutput(summary, {
      format: "text",
      forLlm: false,
      ci: true
    });

    expect(output).toContain("Runs: 2");
    expect(output).toContain("Most informative: npm run build");
    expect(output).toContain("Run signals:");
    expect(output.split("\n").length).toBeLessThanOrEqual(7);
  });
});
