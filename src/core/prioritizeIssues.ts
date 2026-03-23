import type { Issue, IssuePriority } from "../types.js";

const priorityOrder: Record<IssuePriority, number> = {
  high: 3,
  medium: 2,
  low: 1
};

export function prioritizeIssues(issues: Issue[]): Issue[] {
  return issues
    .map((issue) => ({
      ...issue,
      priority: getIssuePriority(issue)
    }))
    .sort(compareIssues);
}

export function getIssuePriority(issue: Issue): IssuePriority {
  if (issue.tool === "tsc") {
    return "high";
  }

  if (issue.tool === "test" && (issue.category === "failure" || issue.category === "assertion")) {
    return "high";
  }

  if (issue.tool === "eslint") {
    return issue.category === "error" ? "medium" : "low";
  }

  return "low";
}

function compareIssues(left: Issue, right: Issue): number {
  const priorityDifference =
    priorityOrder[right.priority ?? "low"] - priorityOrder[left.priority ?? "low"];

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  const fileDifference = (left.file ?? "~").localeCompare(right.file ?? "~");
  if (fileDifference !== 0) {
    return fileDifference;
  }

  const lineDifference = (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER);
  if (lineDifference !== 0) {
    return lineDifference;
  }

  const columnDifference =
    (left.column ?? Number.MAX_SAFE_INTEGER) - (right.column ?? Number.MAX_SAFE_INTEGER);
  if (columnDifference !== 0) {
    return columnDifference;
  }

  const codeDifference = (left.ruleOrCode ?? "").localeCompare(right.ruleOrCode ?? "");
  if (codeDifference !== 0) {
    return codeDifference;
  }

  return left.message.localeCompare(right.message);
}
