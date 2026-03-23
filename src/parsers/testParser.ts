import type { Issue } from "../types.js";

const failHeaderPattern = /^\s*FAIL(?:\s+\[[^\]]+\])?\s+(?<file>.+?)(?:\s+>\s+.+)?$/;
const suitePattern = /^\s*(?:●|×)\s+(?<message>.+)$/;
const locationPattern =
  /^\s*(?:at|❯|›)\s+(?:.+?\()?(?<file>[^():]+(?:\.[^():]+)?):(?<line>\d+):(?<column>\d+)\)?/;
const assertionPattern =
  /^\s*(?<message>(?:AssertionError|TypeError|ReferenceError|RangeError|SyntaxError|Error):.+|expected .+ to .+)$/i;

export function parseTest(input: string): Issue[] {
  const issues: Issue[] = [];
  let currentFile: string | undefined;
  let currentIssue: Issue | undefined;

  for (const line of input.split("\n")) {
    const failMatch = line.match(failHeaderPattern);
    if (failMatch?.groups?.file) {
      currentFile = sanitizeTestFile(failMatch.groups.file);
      currentIssue = undefined;
      continue;
    }

    const suiteMatch = line.match(suitePattern);
    if (suiteMatch?.groups?.message) {
      currentIssue = {
        tool: "test",
        category: "failure",
        message: suiteMatch.groups.message.trim()
      };

      if (currentFile) {
        currentIssue.file = currentFile;
      }

      issues.push(currentIssue);
      continue;
    }

    const assertionMatch = line.match(assertionPattern);
    if (assertionMatch?.groups?.message) {
      const message = assertionMatch.groups.message.trim();
      if (!currentFile && !currentIssue && !isClearlyTestAssertion(message)) {
        continue;
      }

      if (!currentIssue) {
        currentIssue = {
          tool: "test",
          category: getTestCategory(message),
          message
        };

        if (currentFile) {
          currentIssue.file = currentFile;
        }

        issues.push(currentIssue);
      } else {
        currentIssue.category = getTestCategory(message);
        currentIssue.message = message;
      }
      continue;
    }

    const locationMatch = line.match(locationPattern);
    if (!locationMatch?.groups || !currentIssue) {
      continue;
    }

    const file = locationMatch.groups.file;
    if (!file) {
      continue;
    }

    currentIssue.file = file.trim();
    currentIssue.line = Number(locationMatch.groups.line);
    currentIssue.column = Number(locationMatch.groups.column);
  }

  return issues;
}

function getTestCategory(message: string): string {
  return /assertionerror|expected .+ to .+/i.test(message) ? "assertion" : "failure";
}

function sanitizeTestFile(value: string): string {
  return value
    .trim()
    .replace(/\s+\(\d+(?:\.\d+)?\s*(?:ms|s)\)\s*$/, "")
    .replace(/\s+\[\s*.+\s*\]\s*$/, "");
}

function isClearlyTestAssertion(message: string): boolean {
  return /assertionerror|expected .+ to .+/i.test(message);
}
