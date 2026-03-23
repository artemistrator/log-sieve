# Release Checklist

## Local verification

```bash
npm install
npm test
npm run build
npm run smoke
```

## Package inspection

```bash
npm pack
tar -tf log-sieve-*.tgz
```

Check that the tarball only contains the built CLI, README, release notes, and license.

## Local install test

```bash
npm install -g ./log-sieve-*.tgz
log-sieve --help
log-sieve --file ./tests/fixtures/npm-tsc.log
```

## Publish

```bash
npm login
npm publish
```

Before publishing publicly, make sure `package.json` repository metadata points at the real repo URL.
