import type { Issue, IssuePriority } from "../types.js";

type BlockerKind = "compile" | "module" | "test" | "lint" | "generic";

const moduleResolutionPattern =
  /cannot find module|module not found|failed to resolve import|cannot resolve module|could not resolve/i;
const testRunnerSymptomPattern =
  /test suite failed to run|no test suite found|no tests found|failed to load/i;

export interface IssueDiagnosis {
  primaryIssues: Issue[];
  downstreamIssues: Issue[];
  secondaryIssues: Issue[];
  primaryBlocker?: string;
  downstreamSummary?: string;
  rootCauseHint?: string;
  primaryKind?: BlockerKind;
}

export function getIssuePriority(issue: Issue): IssuePriority {
  if (issue.tool === "tsc" || isModuleResolutionIssue(issue)) {
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

export function getIssueBlockerRank(issue: Issue): number {
  if (issue.tool === "tsc") {
    return isModuleResolutionIssue(issue) ? 650 : 600;
  }

  if (isModuleResolutionIssue(issue)) {
    return 560;
  }

  if (issue.tool === "test") {
    if (issue.category === "assertion") {
      return 420;
    }

    return isTestRunnerSymptom(issue) ? 320 : 380;
  }

  if (issue.tool === "eslint") {
    return issue.category === "error" ? 260 : 160;
  }

  return 80;
}

export function diagnoseIssues(issues: Issue[]): IssueDiagnosis {
  if (issues.length === 0) {
    return {
      primaryIssues: [],
      downstreamIssues: [],
      secondaryIssues: []
    };
  }

  const highestRank = Math.max(...issues.map(getIssueBlockerRank));
  const primaryIssues = issues.filter((issue) => getIssueBlockerRank(issue) === highestRank);
  const primaryKind = getPrimaryKind(primaryIssues);
  const downstreamIssues = issues.filter(
    (issue) => !primaryIssues.includes(issue) && isDownstreamForPrimary(primaryKind, issue)
  );
  const secondaryIssues = issues.filter(
    (issue) => !primaryIssues.includes(issue) && !downstreamIssues.includes(issue)
  );

  const diagnosis: IssueDiagnosis = {
    primaryIssues,
    downstreamIssues,
    secondaryIssues,
    primaryKind
  };

  const primaryBlocker = describePrimaryBlocker(primaryKind);
  if (primaryBlocker) {
    diagnosis.primaryBlocker = primaryBlocker;
  }

  const downstreamSummary = describeDownstream(primaryKind, downstreamIssues);
  if (downstreamSummary) {
    diagnosis.downstreamSummary = downstreamSummary;
  }

  const rootCauseHint = describeRootCauseHint(primaryKind);
  if (rootCauseHint) {
    diagnosis.rootCauseHint = rootCauseHint;
  }

  return diagnosis;
}

export function isModuleResolutionIssue(issue: Issue): boolean {
  if (issue.ruleOrCode && /^TS2307$/i.test(issue.ruleOrCode)) {
    return true;
  }

  return moduleResolutionPattern.test(issue.message);
}

function isTestRunnerSymptom(issue: Issue): boolean {
  return issue.tool === "test" && testRunnerSymptomPattern.test(issue.message);
}

function getPrimaryKind(issues: Issue[]): BlockerKind {
  if (issues.some((issue) => issue.tool === "tsc")) {
    return "compile";
  }

  if (issues.some(isModuleResolutionIssue)) {
    return "module";
  }

  if (issues.some((issue) => issue.tool === "test")) {
    return "test";
  }

  if (issues.some((issue) => issue.tool === "eslint")) {
    return "lint";
  }

  return "generic";
}

function isDownstreamForPrimary(primaryKind: BlockerKind, issue: Issue): boolean {
  if (primaryKind === "compile" || primaryKind === "module") {
    return issue.tool === "test";
  }

  return false;
}

function describePrimaryBlocker(primaryKind: BlockerKind): string | undefined {
  switch (primaryKind) {
    case "compile":
      return "TypeScript compile/typecheck errors";
    case "module":
      return "Module or import resolution errors";
    case "test":
      return "Test failures";
    case "lint":
      return "Lint violations";
    default:
      return undefined;
  }
}

function describeDownstream(primaryKind: BlockerKind, issues: Issue[]): string | undefined {
  if (issues.length === 0) {
    return undefined;
  }

  if (primaryKind === "compile") {
    return "Test runner failures likely caused by compile/typecheck issues.";
  }

  if (primaryKind === "module") {
    return "Test runner failures likely caused by module or import resolution issues.";
  }

  return undefined;
}

function describeRootCauseHint(primaryKind: BlockerKind): string | undefined {
  switch (primaryKind) {
    case "compile":
      return "TypeScript compile errors are blocking downstream checks.";
    case "module":
      return "Module or import resolution errors are likely blocking downstream checks.";
    case "test":
      return "Test failures appear to be the main blocker.";
    case "lint":
      return "Lint violations are the primary issue in this run.";
    default:
      return undefined;
  }
}
