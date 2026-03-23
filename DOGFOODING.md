# Dogfooding log-sieve

## Build and pack

```bash
npm install
npm run build
npm run pack:local
```

This creates a local tarball like `log-sieve-0.2.0.tgz`.

## Install the tarball locally

```bash
mkdir -p /tmp/log-sieve-local-test
npm install -g ./log-sieve-0.2.0.tgz --prefix /tmp/log-sieve-local-test --cache /tmp/log-sieve-npm-cache
/tmp/log-sieve-local-test/bin/log-sieve --help
```

## Try it on another TypeScript project

From the other project directory, run:

```bash
/tmp/log-sieve-local-test/bin/log-sieve --run "npm run build"
/tmp/log-sieve-local-test/bin/log-sieve --run "pnpm lint"
/tmp/log-sieve-local-test/bin/log-sieve --run "npm test"
/tmp/log-sieve-local-test/bin/log-sieve --run "pnpm test" --format md --for-llm
/tmp/log-sieve-local-test/bin/log-sieve --run "npm run build" --ci --fail-on any
```

## Quick confidence checks

```bash
npm test
npm run smoke
npm run smoke:install
```
