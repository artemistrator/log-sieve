import { cleanLog } from "./cleanLog.js";
import { dedupeIssues } from "./dedupeIssues.js";
import { selectBestFormat } from "./detectFormat.js";
import { diagnoseIssues } from "./diagnoseIssues.js";
import { prioritizeIssues } from "./prioritizeIssues.js";
import type { Issue, Summary, ToolName } from "../types.js";

export function summarizeLog(rawInput: string): Summary {
  const cleaned = cleanLog(rawInput);
  const { tool: detectedTool, issues } = selectBestFormat(cleaned);
  const uniqueIssues = prioritizeIssues(dedupeIssues(issues));
  return createSummaryFromIssues(detectedTool, issues.length, uniqueIssues);
}

export function createSummaryFromIssues(
  detectedTool: ToolName,
  totalIssues: number,
  issues: Issue[]
): Summary {
  const diagnosis = diagnoseIssues(issues);

  const summary: Summary = {
    detectedTool,
    totalIssues,
    uniqueIssues: issues.length,
    issues,
    nextStep: getNextStepHint(
      detectedTool,
      issues,
      diagnosis.primaryBlocker,
      diagnosis.downstreamSummary
    ),
    primaryIssues: diagnosis.primaryIssues,
    downstreamIssues: diagnosis.downstreamIssues,
    secondaryIssues: diagnosis.secondaryIssues
  };

  if (diagnosis.primaryBlocker) {
    summary.primaryBlocker = diagnosis.primaryBlocker;
  }

  if (diagnosis.downstreamSummary) {
    summary.downstreamSummary = diagnosis.downstreamSummary;
  }

  if (diagnosis.rootCauseHint) {
    summary.rootCauseHint = diagnosis.rootCauseHint;
  }

  return summary;
}

function getNextStepHint(
  detectedTool: Summary["detectedTool"],
  issues: Issue[],
  primaryBlocker: string | undefined,
  downstreamSummary: string | undefined
): string {
  if (issues.length === 0) {
    return "If the command still failed, rerun with --print-raw-on-error to inspect the cleaned log.";
  }

  if (primaryBlocker === "TypeScript compile/typecheck errors") {
    return downstreamSummary
      ? "Fix compile/typecheck issues first before trusting test failures."
      : "Fix the TypeScript compile errors first, then rerun the command.";
  }

  if (primaryBlocker === "Module or import resolution errors") {
    return downstreamSummary
      ? "Fix module/import resolution errors first before trusting test failures."
      : "Fix the module/import resolution errors first, then rerun the command.";
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
