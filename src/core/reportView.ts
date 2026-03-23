import { clusterIssues, getIssueClusterKey } from "./clusterIssues.js";
import { cwd } from "node:process";
import { isAbsolute, relative } from "node:path";

import type { GroupedCount, Issue, IssueCluster, RenderOptions, ReportView, Summary } from "../types.js";

const defaultTextIssueCount = 5;
const defaultLlmIssueCount = 3;
const defaultCiIssueCount = 3;

export function createReportView(summary: Summary, options: RenderOptions): ReportView {
  const llmIssues = options.forLlm ? selectLlmIssues(summary) : summary.issues;
  const rawClusters = clusterIssues(llmIssues);
  const clusters = toDisplayClusters(rawClusters);
  const displayIssues = toDisplayIssues(compactIssuesForDisplay(selectRepresentativeIssues(llmIssues, rawClusters)));
  const issueLimit =
    options.maxIssues ??
    (options.ci ? defaultCiIssueCount : options.forLlm ? defaultLlmIssueCount : defaultTextIssueCount);
  const issues = displayIssues.slice(0, issueLimit);
  const limitedClusters = clusters.slice(0, issueLimit);
  const omittedIssues = Math.max(displayIssues.length - issues.length, 0);
  const grouped = groupIssues(issues);

  const view: ReportView = {
    detectedTool: summary.detectedTool,
    totalIssues: summary.totalIssues,
    uniqueIssues: summary.uniqueIssues,
    issues,
    clusters: limitedClusters,
    groupedTitle: grouped.title,
    groupedItems: grouped.items.slice(0, 5),
    nextStep: summary.nextStep,
    recommendedFixOrder: getRecommendedFixOrder(issues),
    truncated: omittedIssues > 0,
    omittedIssues
  };

  if (summary.rootCauseHint) {
    view.rootCauseHint = summary.rootCauseHint;
  }

  if (summary.primaryBlocker) {
    view.primaryBlocker = summary.primaryBlocker;
  }

  if (summary.downstreamSummary) {
    view.downstreamSummary = summary.downstreamSummary;
  }

  const likelyFirstFixTarget = getLikelyFirstFixTarget((summary.primaryIssues ?? issues)[0] ?? issues[0]);
  if (likelyFirstFixTarget) {
    view.likelyFirstFixTarget = likelyFirstFixTarget;
  }

  return view;
}

function selectLlmIssues(summary: Summary): Issue[] {
  const primaryIssues = summary.primaryIssues ?? [];
  if (primaryIssues.length > 0) {
    const supportingIssues = [...(summary.downstreamIssues ?? []), ...(summary.secondaryIssues ?? [])].filter(
      (issue) => issue.priority === "high" || issue.priority === "medium"
    );
    return [...primaryIssues, ...supportingIssues];
  }

  const issues = summary.issues;
  const actionable = issues.filter((issue) => issue.priority === "high" || issue.priority === "medium");
  return actionable.length > 0 ? actionable : issues;
}

function compactIssuesForDisplay(issues: Issue[]): Issue[] {
  return issues.filter((issue) => {
    if (issue.tool !== "test" || issue.category !== "failure" || issue.line !== undefined || !issue.file) {
      return true;
    }

    return !issues.some(
      (other) =>
        other !== issue &&
        other.tool === "test" &&
        other.file === issue.file &&
        other.line !== undefined
    );
  });
}

function selectRepresentativeIssues(issues: Issue[], clusters: IssueCluster[]): Issue[] {
  const representativeIssues = new Set<Issue>();

  for (const cluster of clusters) {
    for (const issue of cluster.representativeIssues) {
      representativeIssues.add(issue);
    }
  }

  const clusteredNonRepresentatives = new Set<Issue>();
  for (const cluster of clusters) {
    for (const issue of issues) {
      if (representativeIssues.has(issue)) {
        continue;
      }

      if (clusterMatchesIssue(cluster, issue)) {
        clusteredNonRepresentatives.add(issue);
      }
    }
  }

  return issues.filter((issue) => !clusteredNonRepresentatives.has(issue));
}

function clusterMatchesIssue(cluster: IssueCluster, issue: Issue): boolean {
  const representative = cluster.representativeIssues[0];
  if (!representative) {
    return false;
  }

  return getIssueClusterKey(representative) === getIssueClusterKey(issue);
}

function toDisplayIssues(issues: Issue[]): Issue[] {
  return issues.map((issue) => {
    if (!issue.file) {
      return issue;
    }

    const displayFile = toDisplayPath(issue.file);
    if (displayFile === issue.file) {
      return issue;
    }

    return {
      ...issue,
      file: displayFile
    };
  });
}

function toDisplayClusters(clusters: IssueCluster[]): IssueCluster[] {
  return clusters.map((cluster) => ({
    ...cluster,
    files: cluster.files.map(toDisplayPath),
    representativeIssues: toDisplayIssues(cluster.representativeIssues)
  }));
}


function groupIssues(issues: Issue[]): { title: string; items: GroupedCount[] } {
  const fileCounts = new Map<string, number>();

  for (const issue of issues) {
    if (!issue.file) {
      continue;
    }

    fileCounts.set(issue.file, (fileCounts.get(issue.file) ?? 0) + 1);
  }

  if (fileCounts.size > 0) {
    return {
      title: "Files with most issues",
      items: sortCounts(fileCounts)
    };
  }

  const categoryCounts = new Map<string, number>();
  for (const issue of issues) {
    const label = `${issue.tool}:${issue.category}`;
    categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1);
  }

  return {
    title: "Issue types",
    items: sortCounts(categoryCounts)
  };
}

function sortCounts(input: Map<string, number>): GroupedCount[] {
  return [...input.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => ({ label, count }));
}

function toDisplayPath(value: string): string {
  if (!isAbsolute(value)) {
    return value;
  }

  const relativePath = relative(cwd(), value);
  if (relativePath === "" || relativePath.startsWith("..")) {
    return value;
  }

  return relativePath.replace(/\\/g, "/");
}

function getLikelyFirstFixTarget(issue: Issue | undefined): string | undefined {
  if (!issue) {
    return undefined;
  }

  if (issue.file && issue.line !== undefined) {
    return issue.column !== undefined
      ? `${issue.file}:${issue.line}:${issue.column}`
      : `${issue.file}:${issue.line}`;
  }

  if (issue.file) {
    return issue.file;
  }

  if (issue.ruleOrCode) {
    return issue.ruleOrCode;
  }

  return issue.message;
}

function getRecommendedFixOrder(issues: Issue[]): string[] {
  const order: string[] = [];
  const seenFiles = new Set<string>();

  for (const issue of issues) {
    if (!issue.file) {
      continue;
    }

    if (seenFiles.has(issue.file)) {
      continue;
    }

    seenFiles.add(issue.file);
    order.push(`Fix issues in ${issue.file}`);
  }

  if (order.length > 0) {
    return order.slice(0, 5);
  }

  return issues.slice(0, 3).map((issue) => `Resolve ${issue.tool}:${issue.category} - ${issue.message}`);
}
