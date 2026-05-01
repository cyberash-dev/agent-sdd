# Releasing

`@cyberash/sdd-cli` ships to npm via a tag-driven GitHub Actions workflow
(`.github/workflows/publish.yml`). The local steps below assume the
working tree is clean and on `main`.

## One-time setup

1. Create an automation token on https://www.npmjs.com — `Access Tokens →
   Generate New Token → Granular Access Token`. Scope it to **Publish**
   for `@cyberash/sdd-cli` and to the `@cyberash` organisation.
2. Store it in the GitHub repository as the secret `NPM_TOKEN`
   (`Settings → Secrets and variables → Actions → New repository
   secret`).
3. Confirm the npm scope `@cyberash` exists and your account is a
   member; scoped public packages require the scope to exist before the
   first publish.

## Cutting a release

1. **Spec & tests green** — `npm run tsc && npm test && npm run build &&
   node dist/cli.js lint && node dist/cli.js ready` all exit 0.
2. **Bump the version** — edit `package.json#version` and add a matching
   section to `CHANGELOG.md`. Major/minor/patch follow the rules in
   `spec/spec.md` (Surfaces are the unit of semver).
3. **Refresh the baseline token** if any file in `discovery_scope`
   changed (including `package.json`):
   ```sh
   npm run build
   node dist/cli.js token --format=json
   # paste the printed token + commit_sha into the BL block of spec/spec.md
   ```
4. **Commit** — one commit on `main` per release:
   ```sh
   git add package.json CHANGELOG.md spec/spec.md
   git commit -m "release vX.Y.Z"
   git push origin main
   ```
5. **Tag & push** — the tag drives the publish workflow:
   ```sh
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
6. **Watch the workflow** — `.github/workflows/publish.yml` runs lint,
   tsc, unit + integration tests, build, spec-lint, then `npm publish`
   with provenance. The `Verify tag matches package.json version` step
   refuses tags that disagree with `package.json#version`.
7. **Create a GitHub release** — `gh release create vX.Y.Z --notes-file
   CHANGELOG.md` (or via the GitHub UI) so consumers can find release
   notes alongside the tag.

## Manual publish (fallback)

Only when the GitHub workflow is unavailable:

```sh
npm login                    # authenticate against registry.npmjs.org
npm run tsc && npm test
npm run build
npm publish                  # uses publishConfig.access=public + provenance
```

`prepublishOnly` re-runs `tsc`, the test suite, and `build` before the
upload, so a stale `dist/` cannot ship.

## What lands in the tarball

The `files` whitelist in `package.json` ships exactly:

- `dist/` — compiled JS + `.d.ts`
- `schema/sdd.config.schema.json`
- `README.md`
- `LICENSE`
- `package.json` (added automatically by npm)

`spec/`, `tests/`, `.sdd/`, `.github/`, `AGENTS.md`, `CLAUDE.md`,
`CHANGELOG.md`, `tsconfig.json`, and `*.tgz` are excluded. Confirm with
`npm pack --dry-run` before tagging.
