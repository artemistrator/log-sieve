# log-sieve

`log-sieve` is a small CLI that turns noisy JavaScript and TypeScript build, lint, and test logs into short actionable summaries.

If you run `tsc`, ESLint, Jest, Vitest, or npm/pnpm/yarn scripts and end up with walls of output, `log-sieve` keeps the useful failures and drops the wrapper noise.

## Why it exists

Build logs are optimized for terminals, not for fast triage, CI summaries, or pasting into coding agents. `log-sieve` helps by:

- stripping ANSI noise and normalizing messy logs
- extracting actionable issues from common JS/TS tools
- deduplicating repeated sections and stack-heavy output
- rendering compact text, JSON, or Markdown reports

## Before / after

Before:

```text
> demo-app@1.0.0 check
> npm run build && npm run lint && npm run test

> demo-app@1.0.0 build
> tsc --pretty false
src/foo.ts:12:5 - error TS2304: Cannot find name 'bar'.

> demo-app@1.0.0 lint
> eslint . --format stylish
src/foo.ts
  12:5  error  Unexpected any. Specify a different type  @typescript-eslint/no-explicit-any

> demo-app@1.0.0 test
> vitest run
FAIL  tests/foo.test.ts > handles foo
AssertionError: expected 1 to be 2 // Object.is equality
❯ tests/foo.test.ts:9:10

 ELIFECYCLE  Command failed with exit code 1.
```

After:

```text
Detected: tsc
Raw issues: 4
Unique issues: 3
Root cause hint: TypeScript compile errors are blocking downstream checks.

Top issues:
1. src/foo.ts:12:5 [TS2304] Cannot find name 'bar'.
2. tests/foo.test.ts:9:10 AssertionError: expected 1 to be 2 // Object.is equality
3. src/foo.ts:12:5 [@typescript-eslint/no-explicit-any] Unexpected any. Specify a different type
```

## Installation

Local install from this repo:

```bash
npm install
npm run build
npm install -g .
```

Then run:

```bash
log-sieve --help
```

If you do not want a global install, you can also run the built CLI directly:

```bash
node dist/cli.js --help
```

For a tarball-based local install flow, see [DOGFOODING.md](/Users/artem/Desktop/log-sieve/DOGFOODING.md).

## Quick start

Read from stdin:

```bash
npm test 2>&1 | log-sieve
```

Read from a file:

```bash
log-sieve --file ./build.log
```

Run a command and summarize it:

```bash
log-sieve --run "pnpm test"
```

## Try it on a real TypeScript project

Build failure:

```bash
log-sieve --run "npm run build"
```

Lint failure:

```bash
log-sieve --run "pnpm lint"
```

Test failure:

```bash
log-sieve --run "npm test"
```

Copy-paste for an agent:

```bash
log-sieve --run "pnpm test" --format md --for-llm
```

## Common examples

Save a Markdown report:

```bash
log-sieve --run "pnpm test" --format md --output ./report.md
```

Save a report under nested directories:

```bash
log-sieve --run "npm run build" --format md --output reports/build/report.md
```

Write JSON for scripts:

```bash
log-sieve --run "pnpm build" --format json --output ./report.json --quiet
```

Use exit code only:

```bash
log-sieve --run "npm run build" --quiet --fail-on high
```

Print a compact CI summary:

```bash
log-sieve --run "pnpm lint" --ci --fail-on any
```

Limit report size:

```bash
log-sieve --file ./build.log --max-issues 3 --max-chars 800
```

## Output modes

Text, default:

```bash
log-sieve --file ./build.log --format text
```

JSON:

```bash
log-sieve --file ./build.log --format json
log-sieve --file ./build.log --json
```

Markdown:

```bash
log-sieve --file ./build.log --format md
```

## CI and script usage

Compact CI-friendly text:

```bash
log-sieve --run "pnpm test" --ci --fail-on any
```

Silent machine-oriented usage:

```bash
log-sieve --run "pnpm build" --format json --output ./build-report.json --quiet
```

Exit code policy:

- `0`: no failure condition triggered
- `1`: `--fail-on any` or `--fail-on high` triggered while the base exit code was `0`
- `2`: argument validation failed, input could not be read, the command could not be executed, or the output file could not be written
- any other non-zero code: preserved child process exit code from `--run`

## LLM mode

Use `--for-llm` when you want a smaller copy-paste summary for coding agents:

```bash
log-sieve --file ./build.log --format md --for-llm
```

LLM mode works with text and Markdown output. It keeps higher-value issues first, adds a recommended fix order, and suppresses lower-priority noise.

## Supported input

`log-sieve` is currently tuned for:

- raw `tsc` output
- ESLint stylish-like output
- Jest failures
- Vitest failures
- npm / pnpm / yarn script logs
- mixed JS/TS command output such as build + lint + test chains

## Current limitations

- command mode captures output after the command exits; it does not stream interactive logs
- `--output` overwrites files directly
- `--ci` is a compact summary mode only; it does not emit annotations
- mixed logs are combined only across the built-in JS/TS parsers
- unsupported tools still fall back to the generic parser
- parser coverage is intentionally focused on common actionable failures, not every output variant

## Development

Install dependencies:

```bash
npm install
```

Run checks:

```bash
npm test
npm run build
npm run smoke
```

Create a publish tarball locally:

```bash
npm pack
```

For a short manual release checklist, see [RELEASE.md](/Users/artem/Desktop/log-sieve/RELEASE.md).
