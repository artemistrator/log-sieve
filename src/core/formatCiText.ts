import type { Issue, IssueCluster, ReportView } from "../types.js";

export function formatCiText(view: ReportView): string {
  const lines = [
    `Detected: ${formatDetectedTool(view)}`,
    `Raw issues: ${view.totalIssues}`,
    `Unique issues: ${view.uniqueIssues}`
  ];

  if (view.primaryBlocker) {
    lines.push(`Primary blocker: ${view.primaryBlocker}`);
  }

  if (view.downstreamSummary) {
    lines.push(`Downstream: ${view.downstreamSummary}`);
  }

  if (view.clusters.length > 0) {
    lines.push("Top patterns:");
    view.clusters.slice(0, 3).forEach((cluster, index) => {
      lines.push(`${index + 1}. ${formatCluster(cluster)}`);
    });

    const remainingSlots = Math.max(3 - Math.min(view.clusters.length, 3), 0);
    const remainingIssues = view.issues.filter(
      (issue) => !view.clusters.some((cluster) => cluster.representativeIssues.some((candidate) => sameIssue(candidate, issue)))
    );

    remainingIssues.slice(0, remainingSlots).forEach((issue, index) => {
      lines.push(`${view.clusters.length + index + 1}. ${formatIssue(issue)}`);
    });
  } else if (view.issues.length > 0) {
    lines.push("Top issues:");
    view.issues.slice(0, 3).forEach((issue, index) => {
      lines.push(`${index + 1}. ${formatIssue(issue)}`);
    });
  } else {
    lines.push("Top issues: none");
  }

  lines.push(`Next step: ${view.nextStep}`);
  return lines.join("\n");
}

function formatIssue(issue: Issue): string {
  const location = [issue.file, formatPosition(issue.line, issue.column)].filter(Boolean).join(":");
  const code = issue.ruleOrCode ? ` [${issue.ruleOrCode}]` : "";
  const prefix = location || `[${issue.tool}:${issue.category}]`;
  return `${prefix}${code} ${issue.message}`;
}

function formatCluster(cluster: IssueCluster): string {
  const filesLabel = cluster.fileCount === 1 ? "1 file" : `${cluster.fileCount} files`;
  return `${cluster.count}x ${cluster.label} (${filesLabel})`;
}

function sameIssue(left: Issue, right: Issue): boolean {
  return (
    left.tool === right.tool &&
    left.category === right.category &&
    left.file === right.file &&
    left.line === right.line &&
    left.column === right.column &&
    left.ruleOrCode === right.ruleOrCode &&
    left.message === right.message
  );
}

function formatPosition(line?: number, column?: number): string | undefined {
  if (line === undefined) {
    return undefined;
  }

  return column === undefined ? `${line}` : `${line}:${column}`;
}

function formatDetectedTool(view: ReportView): string {
  return view.uniqueIssues === 0 && view.detectedTool === "generic"
    ? "no structured issues"
    : view.detectedTool;
}
