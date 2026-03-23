import type { Issue, IssueCluster, ReportView } from "../types.js";

export function formatMarkdown(view: ReportView, forLlm: boolean): string {
  const lines = [
    "# log-sieve report",
    "",
    `- Detected tool: ${formatDetectedTool(view)}`,
    `- Raw issues: ${view.totalIssues}`,
    `- Unique issues: ${view.uniqueIssues}`
  ];

  if (view.primaryBlocker) {
    lines.push(`- Primary blocker: ${escapeInline(view.primaryBlocker)}`);
  }

  if (view.downstreamSummary) {
    lines.push(`- Downstream symptoms: ${escapeInline(view.downstreamSummary)}`);
  } else if (view.rootCauseHint) {
    lines.push(`- Root cause hint: ${escapeInline(view.rootCauseHint)}`);
  }

  if (view.issues.length > 0) {
    if (view.clusters.length > 0) {
      lines.push("", "## Top patterns");
      view.clusters.forEach((cluster, index) => {
        lines.push(`${index + 1}. ${formatMarkdownCluster(cluster)}`);
      });
    }

    lines.push("", view.clusters.length > 0 ? "## Representative issues" : "## Top issues");
    view.issues.forEach((issue, index) => {
      lines.push(`${index + 1}. ${formatMarkdownIssue(issue)}`);
    });

    lines.push("", `## ${view.groupedTitle}`);
    for (const item of view.groupedItems) {
      lines.push(`- \`${escapeInline(item.label)}\` (${item.count})`);
    }
  } else {
    lines.push("", "## Top issues", "No structured issues found.");
  }

  if (forLlm) {
    lines.push("", "## Recommended fix order");
    if (view.likelyFirstFixTarget) {
      lines.push(`- Likely first fix target: \`${escapeInline(view.likelyFirstFixTarget)}\``);
    }

    view.recommendedFixOrder.forEach((step) => {
      lines.push(`- ${escapeInline(step)}`);
    });
  }

  lines.push("", "## Suggested next step", escapeInline(view.nextStep));

  if (view.truncated) {
    lines.push("", `_Truncated: omitted ${view.omittedIssues} lower-priority issue(s)._`);
  }

  return lines.join("\n");
}

function formatMarkdownIssue(issue: Issue): string {
  const location = formatLocation(issue);
  const code = issue.ruleOrCode ? ` \`[${escapeInline(issue.ruleOrCode)}]\`` : "";
  return `${location}${code} ${escapeInline(issue.message)}`.trim();
}

function formatMarkdownCluster(cluster: IssueCluster): string {
  const example = cluster.representativeIssues[0];
  const filesLabel = cluster.fileCount === 1 ? "1 file" : `${cluster.fileCount} files`;
  const base = `${cluster.count} issue(s) match: ${escapeInline(cluster.label)} (${filesLabel})`;

  if (!example) {
    return base;
  }

  return `${base}; example: ${formatMarkdownIssue(example)}`;
}

function formatLocation(issue: Issue): string {
  const position =
    issue.line === undefined
      ? undefined
      : issue.column === undefined
        ? `${issue.line}`
        : `${issue.line}:${issue.column}`;
  const location = [issue.file, position].filter(Boolean).join(":");

  if (location) {
    return `\`${escapeInline(location)}\``;
  }

  return `\`[${escapeInline(`${issue.tool}:${issue.category}`)}]\``;
}

function escapeInline(value: string): string {
  return value.replace(/`/g, "\\`");
}

function formatDetectedTool(view: ReportView): string {
  return view.uniqueIssues === 0 && view.detectedTool === "generic"
    ? "no structured issues"
    : view.detectedTool;
}
