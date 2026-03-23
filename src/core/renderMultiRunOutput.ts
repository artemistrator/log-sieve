import { createReportView } from "./reportView.js";
import type { MultiRunSummary, RenderOptions, ReportView, RunSummary, Summary } from "../types.js";

export function renderMultiRunOutput(summary: MultiRunSummary, options: RenderOptions): string {
  if (options.format === "json") {
    return JSON.stringify(toJsonPayload(summary), null, options.maxChars ? 0 : 2);
  }

  const output = options.ci
    ? renderCiText(summary, options)
    : options.format === "md"
    ? renderMarkdown(summary, options)
    : renderText(summary, options);
  return fitTextToMaxChars(output, options.maxChars, options.format);
}

function renderText(summary: MultiRunSummary, options: RenderOptions): string {
  const aggregateView = createReportView(summary.aggregateSummary, options);
  const lines = [
    "Detected: multi-run",
    `Runs: ${summary.runs.length}`
  ];

  const informativeRun = summary.runs[summary.mostInformativeRunIndex];
  if (informativeRun) {
    lines.push(`Most informative run: ${informativeRun.command}`);
  }

  if (aggregateView.primaryBlocker) {
    lines.push(`Primary blocker: ${aggregateView.primaryBlocker}`);
  }

  if (summary.downstreamRunIndexes.length > 0) {
    lines.push(`Downstream runs: ${summary.downstreamRunIndexes.map((index) => summary.runs[index]?.command).filter(Boolean).join(", ")}`);
  }

  if (summary.bestFirstFixTarget) {
    lines.push(`Best first fix target: ${summary.bestFirstFixTarget}`);
  }

  lines.push("", "Run summaries:");
  summary.runs.forEach((run, index) => {
    lines.push(...formatRunText(run, index + 1, summary.downstreamRunIndexes.includes(index), options));
  });

  lines.push("", "Cross-run diagnosis:");
  lines.push(formatPrimarySignal(aggregateView));
  lines.push("", "Next step:", summary.nextStep);
  return lines.join("\n");
}

function renderMarkdown(summary: MultiRunSummary, options: RenderOptions): string {
  const aggregateView = createReportView(summary.aggregateSummary, options);
  const lines = [
    "# log-sieve report",
    "",
    "- Detected tool: multi-run",
    `- Runs: ${summary.runs.length}`
  ];

  const informativeRun = summary.runs[summary.mostInformativeRunIndex];
  if (informativeRun) {
    lines.push(`- Most informative run: \`${escapeInline(informativeRun.command)}\``);
  }

  if (aggregateView.primaryBlocker) {
    lines.push(`- Primary blocker: ${escapeInline(aggregateView.primaryBlocker)}`);
  }

  if (summary.downstreamRunIndexes.length > 0) {
    lines.push(
      `- Downstream runs: ${summary.downstreamRunIndexes
        .map((index) => summary.runs[index]?.command)
        .filter(Boolean)
        .map((command) => `\`${escapeInline(command as string)}\``)
        .join(", ")}`
    );
  }

  if (summary.bestFirstFixTarget) {
    lines.push(`- Best first fix target: \`${escapeInline(summary.bestFirstFixTarget)}\``);
  }

  lines.push("", "## Runs");
  summary.runs.forEach((run, index) => {
    lines.push(...formatRunMarkdown(run, index + 1, summary.downstreamRunIndexes.includes(index), options));
  });

  lines.push("", "## Cross-run diagnosis", escapeInline(formatPrimarySignal(aggregateView)));
  lines.push("", "## Suggested next step", escapeInline(summary.nextStep));
  return lines.join("\n");
}

function renderCiText(summary: MultiRunSummary, options: RenderOptions): string {
  const aggregateView = createReportView(summary.aggregateSummary, options);
  const lines = [`Runs: ${summary.runs.length}`];
  const informativeRun = summary.runs[summary.mostInformativeRunIndex];

  if (informativeRun) {
    lines.push(`Most informative: ${informativeRun.command}`);
  }

  if (aggregateView.primaryBlocker) {
    lines.push(`Primary blocker: ${aggregateView.primaryBlocker}`);
  }

  lines.push("Run signals:");
  summary.runs.slice(0, 2).forEach((run, index) => {
    const view = createReportView(run.summary, { ...options, maxIssues: 1 });
    const label = summary.downstreamRunIndexes.includes(index) ? "downstream" : run.summary.detectedTool;
    lines.push(`${index + 1}. ${run.command} -> ${label}: ${formatPrimarySignal(view)}`);
  });
  lines.push(`Next step: ${summary.nextStep}`);
  return lines.join("\n");
}

function formatRunText(run: RunSummary, index: number, downstream: boolean, options: RenderOptions): string[] {
  const view = createReportView(run.summary, { ...options, maxIssues: 2 });
  const lines = [`${index}. ${run.command} (exit ${run.exitCode})`];
  lines.push(`   Detected: ${run.summary.detectedTool}`);
  if (downstream) {
    lines.push("   Classification: likely downstream symptoms");
  } else if (run.summary.primaryBlocker) {
    lines.push(`   Primary blocker: ${run.summary.primaryBlocker}`);
  }
  lines.push(`   Signal: ${formatPrimarySignal(view)}`);
  return lines;
}

function formatRunMarkdown(run: RunSummary, index: number, downstream: boolean, options: RenderOptions): string[] {
  const view = createReportView(run.summary, { ...options, maxIssues: 2 });
  const lines = [`${index}. \`${escapeInline(run.command)}\` (exit ${run.exitCode})`];
  lines.push(`   - Detected: ${escapeInline(run.summary.detectedTool)}`);
  if (downstream) {
    lines.push("   - Classification: likely downstream symptoms");
  } else if (run.summary.primaryBlocker) {
    lines.push(`   - Primary blocker: ${escapeInline(run.summary.primaryBlocker)}`);
  }
  lines.push(`   - Signal: ${escapeInline(formatPrimarySignal(view))}`);
  return lines;
}

function formatPrimarySignal(view: Pick<ReportView, "clusters" | "issues">): string {
  const firstCluster = view.clusters[0];
  if (firstCluster) {
    const representative = firstCluster.representativeIssues[0];
    const example = representative ? `; example: ${formatIssue(representative)}` : "";
    return `${firstCluster.count} issue(s) match: ${firstCluster.label}${example}`;
  }

  const firstIssue = view.issues[0];
  return firstIssue ? formatIssue(firstIssue) : "No structured issues found.";
}

function formatIssue(issue: Summary["issues"][number]): string {
  const location = [issue.file, formatPosition(issue.line, issue.column)].filter(Boolean).join(":");
  const parts: string[] = [];

  if (location) {
    parts.push(location);
  }

  if (issue.ruleOrCode) {
    parts.push(`[${issue.ruleOrCode}]`);
  }

  if (!location && !issue.ruleOrCode) {
    parts.push(`[${issue.tool}:${issue.category}]`);
  }

  parts.push(issue.message);
  return parts.join(" ");
}

function formatPosition(line?: number, column?: number): string | undefined {
  if (line === undefined) {
    return undefined;
  }

  return column === undefined ? `${line}` : `${line}:${column}`;
}

function toJsonPayload(summary: MultiRunSummary) {
  return {
    mode: "multi-run",
    runs: summary.runs.map((run, index) => ({
      index,
      command: run.command,
      exitCode: run.exitCode,
      summary: run.summary,
      downstream: summary.downstreamRunIndexes.includes(index)
    })),
    mostInformativeRunIndex: summary.mostInformativeRunIndex,
    primaryBlocker: summary.aggregateSummary.primaryBlocker,
    downstreamRunIndexes: summary.downstreamRunIndexes,
    bestFirstFixTarget: summary.bestFirstFixTarget,
    nextStep: summary.nextStep,
    aggregate: summary.aggregateSummary
  };
}

function escapeInline(value: string): string {
  return value.replace(/`/g, "\\`");
}

function fitTextToMaxChars(
  output: string,
  maxChars: number | undefined,
  format: RenderOptions["format"]
): string {
  if (!maxChars || output.length <= maxChars) {
    return output;
  }

  const suffix = format === "md" ? "\n\n_Truncated due to --max-chars._" : "\n\nTruncated due to --max-chars.";
  const budget = Math.max(maxChars - suffix.length, 0);
  return `${output.slice(0, budget).trimEnd()}${suffix}`;
}
