import { getIssueBlockerRank } from "./diagnoseIssues.js";
import type { Issue, IssueCluster } from "../types.js";

const assignmentPattern = /^Type '(.+)' is not assignable to type '(.+)'\.?$/;
const missingPropertyPattern = /^Property '(.+)' is missing in type '(.+)' but required in type '(.+)'\.?$/;
const missingPropertiesPattern = /^Type '(.+)' is missing the following properties from type '(.+)': .+$/;
const modulePattern =
  /cannot find module ['"](.+?)['"]|module not found.*['"](.+?)['"]|failed to resolve import ['"](.+?)['"]|could not resolve ['"](.+?)['"]/i;

export function clusterIssues(issues: Issue[]): IssueCluster[] {
  const groups = new Map<string, Issue[]>();

  for (const issue of issues) {
    const descriptor = getClusterDescriptor(issue);
    if (!descriptor) {
      continue;
    }

    const bucket = groups.get(descriptor.key) ?? [];
    bucket.push(issue);
    groups.set(descriptor.key, bucket);
  }

  return [...groups.entries()]
    .map(([key, members]) => buildCluster(key, members))
    .filter((cluster): cluster is IssueCluster => cluster !== undefined)
    .sort(compareClusters);
}

export function getIssueClusterKey(issue: Issue): string | undefined {
  return getClusterDescriptor(issue)?.key;
}

function buildCluster(key: string, members: Issue[]): IssueCluster | undefined {
  if (members.length < 2) {
    return undefined;
  }

  const first = members[0];
  if (!first) {
    return undefined;
  }

  const descriptor = getClusterDescriptor(first);
  if (!descriptor) {
    return undefined;
  }

  const files = [...new Set(members.map((issue) => issue.file).filter((file): file is string => Boolean(file)))];

  const cluster: IssueCluster = {
    tool: first.tool,
    category: first.category,
    label: descriptor.label,
    count: members.length,
    fileCount: files.length,
    files,
    representativeIssues: members.slice(0, 1)
  };

  if (first.priority) {
    cluster.priority = first.priority;
  }

  if (first.ruleOrCode) {
    cluster.ruleOrCode = first.ruleOrCode;
  }

  return cluster;
}

function compareClusters(left: IssueCluster, right: IssueCluster): number {
  const blockerDifference = getRepresentativeRank(right) - getRepresentativeRank(left);
  if (blockerDifference !== 0) {
    return blockerDifference;
  }

  if (right.count !== left.count) {
    return right.count - left.count;
  }

  if (right.fileCount !== left.fileCount) {
    return right.fileCount - left.fileCount;
  }

  return left.label.localeCompare(right.label);
}

function getRepresentativeRank(cluster: IssueCluster): number {
  const representative = cluster.representativeIssues[0];
  return representative ? getIssueBlockerRank(representative) : 0;
}

function getClusterDescriptor(issue: Issue): { key: string; label: string } | undefined {
  const moduleMatch = issue.message.match(modulePattern);
  if (moduleMatch) {
    const moduleName = moduleMatch.slice(1).find(Boolean) ?? "<module>";
    return {
      key: `${issue.tool}|module|${moduleName.toLowerCase()}`,
      label: `Module resolution failure for '${moduleName}'`
    };
  }

  const assignmentMatch = issue.message.match(assignmentPattern);
  if (assignmentMatch) {
    const targetType = assignmentMatch[2];
    if (targetType) {
      return {
        key: `${issue.tool}|${issue.ruleOrCode ?? ""}|assign|${targetType.toLowerCase()}`,
        label: `Type is not assignable to type '${targetType}'`
      };
    }
  }

  const missingPropertyMatch = issue.message.match(missingPropertyPattern);
  if (missingPropertyMatch) {
    const targetType = missingPropertyMatch[3];
    if (targetType) {
      return {
        key: `${issue.tool}|missing-required|${targetType.toLowerCase()}`,
        label: `Missing required properties for type '${targetType}'`
      };
    }
  }

  const missingPropertiesMatch = issue.message.match(missingPropertiesPattern);
  if (missingPropertiesMatch) {
    const targetType = missingPropertiesMatch[2];
    if (targetType) {
      return {
        key: `${issue.tool}|missing-required|${targetType.toLowerCase()}`,
        label: `Missing required properties for type '${targetType}'`
      };
    }
  }

  const normalizedMessage = normalizeMessagePattern(issue.message);

  return {
    key: `${issue.tool}|${issue.ruleOrCode ?? ""}|${issue.category}|${normalizedMessage.toLowerCase()}`,
    label: normalizedMessage
  };
}

function normalizeMessagePattern(message: string): string {
  return message
    .replace(/'[^']+'/g, "'<value>'")
    .replace(/"[^"]+"/g, "\"<value>\"")
    .replace(/\b\d+(?:\.\d+)?\b/g, "<n>")
    .replace(/\btrue\b|\bfalse\b/gi, "<value>")
    .replace(/\s+/g, " ")
    .trim();
}
