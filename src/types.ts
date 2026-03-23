export type ToolName = "tsc" | "eslint" | "test" | "generic";
export type IssuePriority = "high" | "medium" | "low";
export type InputSource = "stdin" | "file" | "run";
export type OutputFormat = "text" | "json" | "md";
export type FailOnMode = "none" | "any" | "high";

export interface Issue {
  tool: string;
  category: string;
  file?: string;
  line?: number;
  column?: number;
  ruleOrCode?: string;
  message: string;
  rawSnippet?: string;
  priority?: IssuePriority;
}

export interface Summary {
  detectedTool: ToolName;
  totalIssues: number;
  uniqueIssues: number;
  issues: Issue[];
  nextStep: string;
  rootCauseHint?: string;
  primaryBlocker?: string;
  downstreamSummary?: string;
  primaryIssues?: Issue[];
  downstreamIssues?: Issue[];
  secondaryIssues?: Issue[];
}

export interface CliOptions {
  file?: string;
  run?: string;
  runs?: string[];
  output?: string;
  format: OutputFormat;
  forLlm: boolean;
  quiet: boolean;
  failOn: FailOnMode;
  ci: boolean;
  printRawOnError: boolean;
  maxIssues?: number;
  maxChars?: number;
  help: boolean;
}

export interface InputResult {
  rawInput: string;
  exitCode: number;
  source?: InputSource;
}

export interface RenderOptions {
  format: OutputFormat;
  forLlm: boolean;
  ci: boolean;
  maxIssues?: number;
  maxChars?: number;
}

export interface GroupedCount {
  label: string;
  count: number;
}

export interface IssueCluster {
  tool: string;
  category: string;
  label: string;
  count: number;
  fileCount: number;
  files: string[];
  representativeIssues: Issue[];
  priority?: IssuePriority;
  ruleOrCode?: string;
}

export interface ReportView {
  detectedTool: ToolName;
  totalIssues: number;
  uniqueIssues: number;
  issues: Issue[];
  clusters: IssueCluster[];
  groupedTitle: string;
  groupedItems: GroupedCount[];
  nextStep: string;
  rootCauseHint?: string;
  primaryBlocker?: string;
  downstreamSummary?: string;
  recommendedFixOrder: string[];
  likelyFirstFixTarget?: string;
  truncated: boolean;
  omittedIssues: number;
}

export interface ExecuteCliIo {
  writeStdout: (text: string) => void;
  writeStderr: (text: string) => void;
}

export interface RunSummary {
  command: string;
  exitCode: number;
  summary: Summary;
  cleanedLog: string;
}

export interface MultiRunSummary {
  runs: RunSummary[];
  aggregateSummary: Summary;
  mostInformativeRunIndex: number;
  downstreamRunIndexes: number[];
  bestFirstFixTarget?: string;
  nextStep: string;
}
