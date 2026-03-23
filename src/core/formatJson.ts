import type { Issue, Summary } from "../types.js";

export function formatJson(
  summary: Summary,
  issues: Issue[],
  truncated: boolean,
  omittedIssues: number,
  pretty: boolean
): string {
  const payload = {
    detectedTool: summary.detectedTool,
    totalIssues: summary.totalIssues,
    uniqueIssues: summary.uniqueIssues,
    issues,
    nextStep: summary.nextStep,
    rootCauseHint: summary.rootCauseHint,
    truncated,
    omittedIssues
  };

  return JSON.stringify(payload, null, pretty ? 2 : 0);
}
