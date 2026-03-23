import type { Issue } from "../types.js";

const issuePattern =
  /^(?<file>[^( \n][^\n]*?)\((?<line>\d+),(?<column>\d+)\): error (?<code>TS\d+): (?<message>.+)$|^(?<fileAlt>[^( \n][^\n]*?):(?<lineAlt>\d+):(?<columnAlt>\d+) - error (?<codeAlt>TS\d+): (?<messageAlt>.+)$/gm;

export function parseTsc(input: string): Issue[] {
  const issues: Issue[] = [];

  for (const match of input.matchAll(issuePattern)) {
    const file = match.groups?.file ?? match.groups?.fileAlt;
    const line = match.groups?.line ?? match.groups?.lineAlt;
    const column = match.groups?.column ?? match.groups?.columnAlt;
    const ruleOrCode = match.groups?.code ?? match.groups?.codeAlt;
    const message = match.groups?.message ?? match.groups?.messageAlt;

    if (!file || !message) {
      continue;
    }

    const issue: Issue = {
      tool: "tsc",
      category: "error",
      file,
      line: Number(line),
      column: Number(column),
      message: message.trim()
    };

    if (ruleOrCode) {
      issue.ruleOrCode = ruleOrCode;
    }

    issues.push(issue);
  }

  return issues;
}
