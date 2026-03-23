import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const repoRoot = resolve(new URL("..", import.meta.url).pathname);
const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const packageName = packageJson.name;
const packageVersion = packageJson.version;
const tarballName = `${packageName}-${packageVersion}.tgz`;

const baseDir = mkdtempSync(join(tmpdir(), "log-sieve-smoke-install-"));
const cacheDir = join(baseDir, "npm-cache");
const prefixDir = join(baseDir, "prefix");

try {
  execFileSync("npm", ["pack", "--cache", cacheDir], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8"
  });

  execFileSync(
    "npm",
    ["install", "-g", join(repoRoot, tarballName), "--prefix", prefixDir, "--cache", cacheDir],
    {
      cwd: repoRoot,
      stdio: "pipe",
      encoding: "utf8"
    }
  );

  const binaryPath = join(prefixDir, "bin", "log-sieve");
  const output = execFileSync(binaryPath, ["--file", "tests/fixtures/npm-tsc.log", "--max-issues", "1"], {
    cwd: repoRoot,
    stdio: "pipe",
    encoding: "utf8"
  });

  const requiredSnippets = [
    "Detected: tsc",
    "Raw issues: 2",
    "Unique issues: 2",
    "[TS2339] Property 'x' does not exist on type 'User'."
  ];

  for (const snippet of requiredSnippets) {
    if (!output.includes(snippet)) {
      console.error("Installed-binary smoke check failed. Missing snippet:");
      console.error(snippet);
      console.error("\nActual output:\n");
      console.error(output);
      process.exit(1);
    }
  }

  process.stdout.write("Installed-binary smoke check passed.\n");
} finally {
  rmSync(join(repoRoot, tarballName), { force: true });
  rmSync(baseDir, { recursive: true, force: true });
}
