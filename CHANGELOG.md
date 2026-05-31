# Changelog

All notable changes to `@cyberash/sdd-cli` are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/).

The full normative specification is `spec/spec.md`. Each release section
lists the user-visible Surfaces (`SUR-*`) and Behaviors (`BEH-*`) that
landed.

## [Unreleased]

### Added

- **`sdd install --scope user|project`** (`DLT-004`, `BEH-072`, `SUR-016`
  v1.0.0). `--scope project` writes the SDD agent config into the current
  repo — `./CLAUDE.md`, `./AGENTS.md`, and `./.claude/**` + `./.codex/**` —
  instead of the user home, so a repository can carry the SDD setup for the
  whole team. Project-scope `settings.json` hook commands use
  `$CLAUDE_PROJECT_DIR/.claude/sdd/...` so a committed `settings.json` is
  portable across machines. Default `--scope user` is byte-identical to
  before. The install write-boundary records `INV-016` / `POL-003` /
  `POL-001` are now scope-conditioned (project scope writes only that
  agent-config set, never `spec/*.md`, `.sdd/config.json`, `.git`, or
  source); `SUR-016` takes a major bump. `CTR-030` gains an optional
  `scope` field.

## [1.0.3] — 2026-05-30

### Changed

- Renamed the npm package `sdd-cli` → `agent-sdd` (the names `sdd` and
  `sdd-cli` are taken on the registry). The invoked binary is unchanged:
  it is still `sdd`. SDD partition, surface names, and `@covers` markers
  remain `sdd-cli`.

## [1.0.2] — 2026-05-29

### Fixed

- **Approval rewriter no longer truncates a record at a nested `- id:`
  list.** `findMatches` treated any `- id:` line as a record boundary, so
  a record whose `lifecycle:` anchor followed a nested `- id:` list (e.g.
  a `Delta`'s `surface_impact:`) was cut off before the anchor and `sdd
  approve` / `sdd finalize` flipped 0 files while still counting the id as
  matched. A `- id:` is now a boundary only when it is a sibling-or-
  shallower list item; deeper ones are record body. Restores `INV-007` /
  `BEH-013` / `BEH-024` / `INV-012` conformance. Spec: `DLT-003`.

## [1.0.1] — 2026-05-21

### Added

- **`sdd install <all|claude|codex>`** subcommand (`SUR-016`). Makes the
  package the distribution point for the SDD methodology rules under
  `rules/`: copies the minimal TDD+SDD context rules into the user-level
  agent config (`@import` block in `~/.claude/CLAUDE.md`, reference block
  in `~/.codex/AGENTS.md`), installs the full reference as an on-demand
  Claude skill, and merges two `PreToolUse` hooks into
  `~/.claude/settings.json` — a lint reminder and a spec-read guard that
  denies reading `spec/*.md` in a project carrying `.sdd/config.json`,
  steering agents to `sdd record`. Idempotent; writes only under the
  agent home roots, never inside the repo (`INV-016` / `POL-003`); driven
  by `rules/manifest.json` (`CST-008`). Spec: `BEH-065..071`,
  `CTR-029`, `CTR-030`. `package.json#files` now ships `rules/`.

### Fixed

- **spec-read guard no longer blocks non-read spec commands.** The Bash
  branch matched a read verb anywhere in the command, so `git add
  ./spec/*.md` and compound commands were denied. It now keys off the
  command's first token (the invoked program), so `git`/`npm`/`sdd` and
  compound commands pass while `cat`/`sed`/`grep … spec/*.md` reads stay
  blocked.

## [1.0.0] — 2026-05-01

### BREAKING

- **`sdd approve` default mode no longer mutates spec files.** Default
  behavior is now to write a typed attestation to
  `.sdd/plans/<plan_id>.yaml` and exit 0. A separate `sdd finalize`
  invocation materialises the queued plan into spec files atomically,
  with prospective graph validation against still-proposed referenced
  IDs. The methodology classifies this as a predicate change on
  `Surface: sdd-cli/approve` (SUR-007: §1.5 — predicate change = major).

  Migration recipe:

  ```diff
  - sdd approve --id 'p:BEH-001' --approver alice --owner-role tech-lead --change-request URL
  + sdd approve --id 'p:BEH-001' --approver alice --owner-role tech-lead --change-request URL
  + sdd finalize
  ```

  The legacy direct-rewrite path survives one minor of v1.x as
  `sdd approve --inline`, with a stderr deprecation warning. Removal
  is scheduled for v1.1.0.

### Added

- **`sdd finalize`** subcommand (`SUR-010`). Loads the active plan or
  `--plan <plan_id>`, validates the proposed graph (every flipped ID's
  referenced IDs are `>=approved` post-flip), and atomically rewrites
  `lifecycle.status` + `approval_record` for every attestation. On
  graph violation, exits 1 with `reason: "proposed-references"` and
  leaves spec files byte-stable. Spec: `BEH-024`, `BEH-025`,
  `CTR-017`, `CTR-018`, `INV-012`, `IMP-023`.
- **`sdd plan show`** subcommand (`SUR-013`). Reads the active plan
  (or `--plan <plan_id>`) and prints the attestation list in human
  or JSON format. Read-only on the working tree. Spec: `BEH-023`,
  `CTR-020`, `IMP-024`.
- **Plan-file storage surface** (`SUR-014`). Files under `.sdd/plans/`
  follow `CTR-019`: `plan_id` is `<ISO-basic UTC timestamp>-<5-char
  base32 random>`; the YAML shape pins `pending_attestations[]` per
  plan_id. The default `.sdd/plans/.gitignore` keeps plan files
  local; consumers who want a git-audited approval trail can remove
  the entry.
- **`sdd doctor --rule-version`** (`SUR-011`). Parses an enforcement
  registry markdown file (default
  `~/.claude/rules/enforcement_registry.md`) and reports drift between
  the methodology's declared compatible CLI version range and the
  running CLI, plus drift between methodology-declared diagnostic-IDs
  (maturity=implemented) and `DiagnosticRegistry`. When the registry
  file is absent, exits 2 with `kind: "registry-not-found"`.
  Spec: `BEH-026..028`, `CTR-021`, `CTR-022`, `INV-013`, `IMP-025`.
- **`sdd report --pr-summary`** (`SUR-012`). Emits a 5-section
  markdown block (closed test obligations, internal decisions
  placeholder, ASSUMPTIONs, Open-Q residuals, debt budget delta)
  suitable for pasting into a PR description. Read-only on the
  working tree. Spec: `BEH-041`, `CTR-023`, `CTR-024`, `IMP-030`.
- **`sdd ready --against <ref>`** runs two new diff-based checks:
  - **Surface semver cascade** (`ENF-004A`, kind:
    `surface_semver_cascade`). Classifies per-ID diffs as
    `predicate_change` / `content_change` / `none`, then fires when a
    Surface's declared version bump is below the cascade-required
    level (predicate-change in a reachable contractual ID requires
    major; content-change requires ≥minor). Spec: `BEH-040`,
    `IMP-029`.
  - **Debt budget monotonicity** (`ENF-020` runtime, kind:
    `debt_budget_increased`). Compares
    `Partition.unmodeled_budget.current` against the same partition's
    value at `<ref>` and fires when `current` grew in a way that
    violates the declared `trend`. Spec: `BEH-043`, `IMP-031`.
- **`Surface: diagnostics`** (`SUR-009`). Promotes the 17 lint
  diagnostic-IDs and 9 ready violation kinds from private string
  literals to a published Surface with explicit semver. New
  diagnostic-IDs are append-only at minor; rename or removal is a
  major bump on SUR-009 plus an alias period ≥1 minor. Coverage is
  enforced mechanically by `INV-010`
  (tests/unit/diagnostic-registry-coverage.test.ts).
  Spec: `CTR-016`, `IMP-021`.
- **Field-aware modal weasel detection** (`P0.5`). The
  `sdd:weasel-word` rule now distinguishes "absolute" weasel words
  (etc., approximately, ...) — which fire anywhere in a normative
  section, as before — from "modal" verbs (`may be`, `might be`),
  which fire only inside fields whose `IS_NORMATIVE` entry is `true`
  (e.g. `Behavior.then`, `Invariant.always`). Diagnostic message
  names the field. Source-of-truth lives in
  `src/shared/domain/data/weasel-words.json` for cross-plan sync.
- **P1 — five cheap requiredness rules**:
  `sdd:baseline-version-required` (`ENF-003`),
  `sdd:deprecated-fields-required` (`ENF-009`),
  `sdd:assumption-downgrade-approval` (`ENF-010`),
  `sdd:partition-default-policy-set` (`ENF-011`),
  `sdd:generated-artifact-surface-ref` (`ENF-012`). Spec: `BEH-029..033`,
  `IMP-026`.
- **P2.1 — boundary requiredness**:
  `sdd:boundary-policy-ref` (`ENF-013`),
  `sdd:boundary-concurrency-model` (`ENF-014`),
  `sdd:applicability-required` (`ENF-015`),
  `sdd:data-scope-required` (`ENF-016`). A new
  `BoundaryReachability` helper computes the set of IDs reachable
  from any external Surface (`api`, `sdk`, `event_bus`, `cli`,
  `public_db`, `public_storage`); rules fire only on those IDs.
  Spec: `BEH-034..037`, `IMP-027`.
- **P2.2 — migration consistency**:
  `sdd:migration-enforcement-stage` (`ENF-017`),
  `sdd:migration-cross-partition` (`ENF-018`).
  Spec: `BEH-038`, `BEH-039`, `IMP-028`.
- **P3.1 — debt budget form**: `sdd:debt-budget-form` (`ENF-020`
  form). Every `Partition` record must declare an
  `unmodeled_budget` block with `current`, `baseline_at`,
  `baseline_value`, `trend`. Spec: `BEH-042`, `IMP-031`.
- `.sdd/config.json#plans_dir` (optional, default `.sdd/plans`)
  configures the attestation namespace location.

### Changed

- `sdd lint` now considers field-aware modal weasel detection
  (P0.5) and emits diagnostics naming the field
  (e.g. `Behavior.then`) when a modal verb fires inside a normative
  field. Absolute-weasel section-aware behavior is unchanged.
- `Surface: sdd-cli/cli` (SUR-001) bumped `0.1.0 → 0.2.0` —
  additive new subcommands.
- `Surface: sdd-cli/lint` (SUR-006) bumped `0.2.0 → 0.3.0` —
  additive 12 new diagnostic-IDs.
- `Surface: sdd-cli/ready` (SUR-008) bumped `0.3.0 → 0.4.0` —
  additive `--against <ref>` flag and two new violation kinds.
- The agent blocklist (`BUILTIN_AGENT_BLOCKLIST`) and the
  `isBlockedApprover()` helper relocated from
  `src/features/approve/domain/ApproveRequest.ts` to
  `src/shared/domain/AgentBlocklist.ts` so the lint slice
  (ENF-010) and the approve slice can both consult it without
  crossing feature boundaries.
- The approval rewriter (`Rewrite.ts`) relocated from
  `src/features/approve/domain/Rewrite.ts` to
  `src/shared/domain/SpecApprovalRewrite.ts` so both the approve
  slice (`--inline`) and the new finalize slice (plan
  materialisation) can use it without crossing feature
  boundaries. The approve-domain shim re-exports for backward
  compatibility.

### Deprecated

- `sdd approve --inline` — preserves the v0.3.x direct-rewrite
  behavior with a stderr deprecation warning. Removal scheduled for
  v1.1.0.

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

[Unreleased]: https://github.com/cyberash-dev/sdd-cli/compare/v1.0.3...HEAD
[1.0.3]: https://github.com/cyberash-dev/sdd-cli/releases/tag/v1.0.3
[0.2.0]: https://github.com/cyberash-dev/sdd-cli/releases/tag/v0.2.0
[0.1.0]: https://github.com/cyberash-dev/sdd-cli/releases/tag/v0.1.0
