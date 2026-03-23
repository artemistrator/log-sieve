const wrapperNoisePatterns = [
  /^\s*>\s+[^/].*$/,
  /^\s*(?:npm|pnpm|yarn)(?:\s+(?:run|exec))?\s+v?\d/i,
  /^\s*(?:npm\s+)?(?:ERR!|error)\s+(?:code|errno|path|command|command failed|lifecycle|a complete log)/i,
  /^\s*(?:ELIFECYCLE|ERR_PNPM_[A-Z_]+)\b/i,
  /^\s*error Command failed with exit code \d+/i,
  /^\s*Command failed with exit code \d+/i,
  /^\s*info Visit https:\/\/yarnpkg\.com/i,
  /^\s*Done in \d/i,
  /^\s*Scope:\s+/,
  /^\s*Packages:\s+/,
  /^\s*Progress:\s+/,
  /^\s*Resolved \d+/,
  /^\s*Test Files\s+\d+/,
  /^\s*Tests\s+\d+/,
  /^\s*Snapshots\s+\d+/,
  /^\s*Start at\s+/,
  /^\s*Duration\s+\d+/,
  /^\s*Failed Suites?\s+\d+/i,
  /^\s*Failed Tests?\s+\d+/i,
  /^\s*Test Suites:\s+\d+\s+failed/i
];

const stackLinePattern = /^\s*(?:at |❯ |› )/;

const pathAnchors = ["/src/", "/tests/", "/test/", "/packages/", "/apps/", "/libs/", "/node_modules/"];

export function isWrapperNoiseLine(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed === "") {
    return false;
  }

  return wrapperNoisePatterns.some((pattern) => pattern.test(trimmed));
}

export function normalizeComparisonPath(value: string): string {
  let normalized = value.trim().replace(/\\/g, "/").replace(/\/+/g, "/");
  normalized = normalized.replace(/^file:\/\//i, "");
  normalized = normalized.replace(/^[A-Za-z]:/, "");
  normalized = normalized.replace(/^\.\/+/, "");

  const lowerCase = normalized.toLowerCase();
  for (const anchor of pathAnchors) {
    const index = lowerCase.lastIndexOf(anchor);
    if (index >= 0) {
      return lowerCase.slice(index + 1);
    }
  }

  return lowerCase.replace(/^\/+/, "");
}

export function normalizeIssueText(value: string): string {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !isWrapperNoiseLine(line) && !stackLinePattern.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
