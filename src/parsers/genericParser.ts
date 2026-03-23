import type { Issue } from "../types.js";
import { isWrapperNoiseLine } from "../core/logNormalization.js";

const genericPattern =
  /^(?<file>[^( \n][^:\n]*):(?<line>\d+):(?<column>\d+):?\s*(?<category>error|warning|fail(?:ure)?|fatal)?\s*:?\s*(?<message>.+)$/i;

export function parseGeneric(input: string): Issue[] {
  const issues: Issue[] = [];

  for (const line of input.split("\n")) {
    if (isWrapperNoiseLine(line)) {
      continue;
    }

    const match = line.match(genericPattern);
    if (!match?.groups?.message) {
      continue;
    }

    const issue: Issue = {
      tool: "generic",
      category: (match.groups.category ?? "issue").toLowerCase(),
      line: Number(match.groups.line),
      column: Number(match.groups.column),
      message: match.groups.message.trim(),
      rawSnippet: line.trim()
    };

    if (match.groups.file) {
      issue.file = match.groups.file;
    }

    issues.push(issue);
  }

  if (issues.length > 0) {
    return issues;
  }

  const fallbackMessages = input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "")
    .filter((line) => !isWrapperNoiseLine(line))
    .filter((line) => /(error|warning|fail|exception)/i.test(line))
    .slice(0, 10);

  return fallbackMessages.map((message) => ({
    tool: "generic",
    category: "issue",
    message,
    rawSnippet: message
  }));
}
