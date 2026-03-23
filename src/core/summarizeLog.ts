import { cleanLog } from "./cleanLog.js";
import { dedupeIssues } from "./dedupeIssues.js";
import { selectBestFormat } from "./detectFormat.js";
import { prioritizeIssues } from "./prioritizeIssues.js";
import type { Issue, Summary } from "../types.js";

export function summarizeLog(rawInput: string): Summary {
  const cleaned = cleanLog(rawInput);
  const { tool: detectedTool, issues } = selectBestFormat(cleaned);
  const uniqueIssues = prioritizeIssues(dedupeIssues(issues));

  const summary: Summary = {
    detectedTool,
    totalIssues: issues.length,
    uniqueIssues: uniqueIssues.length,
    issues: uniqueIssues,
    nextStep: getNextStepHint(detectedTool, uniqueIssues)
  };

  const rootCauseHint = getRootCauseHint(uniqueIssues);
  if (rootCauseHint) {
    summary.rootCauseHint = rootCauseHint;
  }

  return summary;
}

function getNextStepHint(detectedTool: Summary["detectedTool"], issues: Issue[]): string {
  if (issues.length === 0) {
    return "If the command still failed, rerun with --print-raw-on-error to inspect the cleaned log.";
  }

  if (detectedTool === "tsc") {
    return "Fix the TypeScript compile errors first, then rerun the command.";
  }

  if (detectedTool === "test") {
    return "Fix the failing test assertion or error first, then rerun the command.";
  }

  if (detectedTool === "eslint") {
    return issues.some((issue) => issue.category === "error")
      ? "Fix the ESLint errors first, then rerun the command."
      : "Clean up the warnings next, then rerun lint.";
  }

  return "Start with the highest-priority issue above, then rerun the command.";
}

function getRootCauseHint(issues: Issue[]): string | undefined {
  if (issues.length === 0) {
    return undefined;
  }

  const tscCount = issues.filter((issue) => issue.tool === "tsc").length;
  const testCount = issues.filter((issue) => issue.tool === "test").length;
  const eslintCount = issues.filter((issue) => issue.tool === "eslint").length;
  const largest = Math.max(tscCount, testCount, eslintCount);

  if (largest === 0) {
    return undefined;
  }

  if (tscCount === largest) {
    return "TypeScript compile errors are blocking downstream checks.";
  }

  if (testCount === largest) {
    return "Test failures appear to be the main blocker.";
  }

  if (eslintCount === largest) {
    return "Lint violations are the primary issue in this run.";
  }

  return undefined;
}
