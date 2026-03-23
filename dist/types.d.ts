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
}
export interface CliOptions {
    file?: string;
    run?: string;
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
export interface ReportView {
    detectedTool: ToolName;
    totalIssues: number;
    uniqueIssues: number;
    issues: Issue[];
    groupedTitle: string;
    groupedItems: GroupedCount[];
    nextStep: string;
    rootCauseHint?: string;
    recommendedFixOrder: string[];
    likelyFirstFixTarget?: string;
    truncated: boolean;
    omittedIssues: number;
}
export interface ExecuteCliIo {
    writeStdout: (text: string) => void;
    writeStderr: (text: string) => void;
}
