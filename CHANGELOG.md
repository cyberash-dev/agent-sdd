# Changelog

All notable changes to `@cyberash/sdd-cli` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

The full normative specification is `spec/spec.md`. Each release section
lists the user-visible Surfaces (`SUR-*`) and Behaviors (`BEH-*`) that
landed.

## [Unreleased]

## [0.2.0] — 2026-04-30

### Added

- **`sdd lint`** subcommand. Runs SDD spec-lint rules over every file
  matched by `lint.spec_files` (falling back to `spec_file` when the
  `lint` block is absent). Implemented rules: `sdd:section-presence`,
  `sdd:section-order`, `sdd:weasel-word`, `sdd:lifecycle-status-present`,
  `sdd:lifecycle-status-valid`, `sdd:approval-record-required`,
  `sdd:approval-record-forbidden`, `sdd:test-obligation-required`,
  `sdd:type-version-int`, `sdd:type-invariant-evidence`,
  `sdd:type-invariant-stability`, `sdd:type-data-scope`,
  `sdd:type-nfr-stage`, `sdd:type-migration-runtime-state`,
  `sdd:type-migration-direction`, `sdd:type-migration-mode`,
  `sdd:type-surface-boundary-type`. Read-only on the spec
  (`INV-006`).
  Spec: `BEH-011`, `BEH-012`, `CTR-008`, `CTR-009`, `SUR-006`.
- **`sdd approve`** subcommand. Atomically flips `lifecycle.status` to
  `approved`/`deprecated`/`removed` and writes a typed
  `approval_record` block with caller-supplied `--owner-role`,
  `--approver`, `--change-request`, `--scope`, optional
  `--reviewed-test-oracle`. Refuses agent identities case-insensitively
  via `BUILTIN_AGENT_BLOCKLIST` and the `bot:` prefix
  (`SDD §7.5`, `INV-005`). Refuses unknown owner-roles outside the
  closed enum `{tech-lead, architect, security-owner,
  platform-runtime-lead, product-owner, compliance}` (`BEH-015`).
  Refuses globs that match no records (`BEH-016`).
  Spec: `BEH-013..016`, `CTR-010`, `CTR-011`, `INV-005`, `INV-007`,
  `SUR-007`.
- `.sdd/config.json#lint` block (optional): `lint.spec_files`
  (glob patterns) and `lint.approver_blocklist` (extra agent
  identities to refuse). Spec: `CTR-012`.

### Changed

- Internal git invocation set narrowed to the `EXT-001` allowlist:
  `rev-parse --is-inside-work-tree`/`HEAD`, `ls-tree HEAD`, `diff
  --quiet`, `diff --name-only baseline..HEAD`, `status --porcelain`.
  No more `--show-toplevel` or `cat-file -e`. Repo root is now resolved
  by walking up the filesystem in pure Node.js. Unresolvable
  `baseline_commit_sha` now classifies as `config-invalid` (exit 2)
  instead of an environment error.
- Test coverage expanded from 20 to 127 tests across unit + integration
  (token boundary classes, check add/delete/modify, refresh
  uncommitted-in-IMP, BEH-009 config-error variants, BEH-010 PATH-lacks-git
  + unborn HEAD, ASM-001 zero-match glob, ASM-005 human-format omits
  emitted_at, POL-001 fs-readonly probe, POL-002 git-shim allowlist
  recorder, CTR-007 npm pack tarball install).

### Fixed

- Lint parser: `pickApprovalRecord` now accepts both the top-level
  `approval_record:` form and the `lifecycle.approval_record:` nested
  form (Regression: SUR-001..007 in own spec falsely tripped
  `sdd:approval-record-required`).
- Lint parser: singular `test_obligation:` (object with
  `predicate`/`test_template`/...) is now treated as discharging
  SDD §4 alongside the plural `test_obligations: [to:...]` array
  form. (Regression: BEH/CTR/INV records using the canonical singular
  form falsely tripped `sdd:test-obligation-required`.)
- Lint rule: `sdd:type-version-int` no longer fires on `Surface`
  records (Surface uses semver per `consumer_compat_policy:
  semver_per_surface`).
- Lint section list: `REQUIRED_PARTITION_SECTIONS` now includes
  `"8. Invariants"` and renumbers everything below to match the
  canonical 19-section partition layout in `spec/spec.md` Appendix B.

### Spec hygiene (in this release)

- Added `test_obligation:` blocks to `CST-001..005` with mechanical
  verification in `tests/unit/constraints.test.ts`. `CST-003` cross-
  references `INV-004` via `to:` reference.
- Tightened CST-006 wording to remove banned weasel phrases (`etc.`,
  `may be`).

## [0.1.0] — 2026-04-29

### Added

- Initial release.
- **`sdd token`** — print `{ token, commit_sha, mechanism, scope }` for
  the current `HEAD`. Token is `sha256(git ls-tree HEAD -- <scope>)`
  (mechanism: `git_tree_hash_v1`). Refuses to run on a scope-dirty
  working tree (`baseline-dirty`).
- **`sdd check`** — compare the current token against the value
  recorded in the spec's Brownfield-baseline block. Exit 0 on match,
  exit 1 with reason `baseline-stale` or `baseline-dirty`.
- **`sdd refresh`** — diff scope state since the recorded baseline,
  emit one `Delta` stub per path inside an `IMP-*` footprint, one
  `Open-Q` stub per path outside every footprint. Output formats:
  `yaml` (default), `json`, `human`. The CLI never writes to spec.md
  (`INV-002`).
- `.sdd/config.json` schema with `spec_file`, `baseline_id`,
  `discovery_scope`, `mechanism`, optional `footprint`.
  JSON Schema published as `schema/sdd.config.schema.json`.
- Vertical Slice + Hexagonal source layout enforced by a static-import
  test (`INV-004` / `CST-003`).
- Stable JSON output schemas (`format_version: 1`) for token, check,
  refresh.
- Shipped via `npm pack` tarball (`@cyberash/sdd-cli@0.1.0.tgz`); npm
  registry publication intentionally out of scope.

[Unreleased]: https://github.com/cyberash-dev/sdd-cli/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/cyberash-dev/sdd-cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/cyberash-dev/sdd-cli/releases/tag/v0.1.0
