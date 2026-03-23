import { formatCiText } from "./formatCiText.js";
import { formatJson } from "./formatJson.js";
import { formatMarkdown } from "./formatMarkdown.js";
import { formatText } from "./formatText.js";
import { createReportView } from "./reportView.js";
import type { RenderOptions, Summary } from "../types.js";

export function renderOutput(summary: Summary, options: RenderOptions): string {
  if (options.format === "json") {
    return renderJson(summary, options);
  }

  return renderTextual(summary, options);
}

function renderTextual(summary: Summary, options: RenderOptions): string {
  let issueLimit = options.maxIssues;

  while (true) {
    const view = createReportView(summary, withIssueLimit(options, issueLimit));
    const output =
      options.ci
        ? formatCiText(view)
        : options.format === "md"
        ? formatMarkdown(view, options.forLlm)
        : formatText(view, options.forLlm);

    if (!options.maxChars || output.length <= options.maxChars || view.issues.length === 0) {
      return fitTextToMaxChars(output, options.maxChars, options.format);
    }

    issueLimit = Math.max(view.issues.length - 1, 0);
  }
}

function renderJson(summary: Summary, options: RenderOptions): string {
  let issueLimit = options.maxIssues ?? summary.issues.length;
  let issues = summary.issues.slice(0, issueLimit);
  let omittedIssues = Math.max(summary.issues.length - issues.length, 0);
  let output = formatJson(summary, issues, omittedIssues > 0, omittedIssues, !options.maxChars);

  while (options.maxChars && output.length > options.maxChars && issues.length > 0) {
    issueLimit = Math.max(issues.length - 1, 0);
    issues = summary.issues.slice(0, issueLimit);
    omittedIssues = Math.max(summary.issues.length - issues.length, 0);
    output = formatJson(summary, issues, omittedIssues > 0, omittedIssues, false);
  }

  return output;
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

function withIssueLimit(options: RenderOptions, maxIssues: number | undefined): RenderOptions {
  if (maxIssues === undefined) {
    return options;
  }

  return {
    ...options,
    maxIssues
  };
}
