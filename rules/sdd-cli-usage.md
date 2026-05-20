# sdd-cli Usage

Operational rules for invoking `@cyberash/sdd-cli` as part of SDD workflow.
This file maps each workflow phase to the CLI command(s) that close the
mechanical part of the corresponding gate. The full mapping
requirement → enforcement_class → executor lives in `enforcement_registry.md`;
this file is the *trigger* layer (when to run what).

## Phase-to-command mapping

| Workflow phase | Command | Expected exit | If non-zero |
|---|---|---|---|
| After every spec edit | `sdd lint` | 0 | Fix diagnostics; do not proceed to Implement until 0 |
| After scope-touching commit | `sdd check` | 0 | Run `sdd refresh > stubs.yaml`; fill Delta/Open-Q stubs in spec; recompute token via `sdd token`; paste into BL block |
| Before proposing commit | `sdd ready` | 0 | Address violations (uncovered, unapproved, surface_unapproved_ref, semver cascade, debt_budget_increased, etc.); never commit on exit 1 |
| Before release tag | `sdd ready` | 0 | Same as above; release without exit 0 violates SDD «spec is source of truth» invariant |
| When promoting `proposed → approved` | `sdd approve --id <X> --approver <human> ...` then `sdd finalize` | 0 + 0 | If `sdd finalize` exits 1 with `proposed-references` — promote referenced IDs first or include them in the same plan |
| On new checkout / version drift | `sdd doctor --rule-version --rules rules/enforcement_registry.md` | 0 | Investigate `version_mismatch` / `missing_diagnostic` / `stale_diagnostic`; either bump CLI or update `enforcement_registry.md` |
| Before opening PR | `sdd report --pr-summary --against <base>` | 0 | Paste output into PR description; expand «Internal decisions» section manually (mechanical part is just a skeleton) |
| Locating / inspecting a record in a large spec | `sdd record list [--partition <p>]` / `sdd record get <id>` | 0 | Read-only (INV-002); use instead of opening the whole spec file |
| Editing / adding a single draft\|proposed record | `sdd record set <id> …` / `sdd record add --after <id> …` | 0 | Then `sdd lint` MUST be 0; refuses approved/deprecated/removed records |

## Navigating and editing the spec (`sdd record`)

Spec files grow to thousands of lines. **Do not read or hand-edit the whole file** to work on one record — use `sdd record`, which keeps the agent's context scoped to the records that matter and edits a single record atomically.

| Goal | Command | Notes |
|---|---|---|
| Compact index of every record | `sdd record list [--partition <name>] [--format=json\|human]` | One row per record: `id` · `type` · `lifecycle.status` · derived title (`title`, else Surface `name`, else blank). `--partition` keeps only records whose partition component (id minus its trailing `:<ID-tail>`) equals `<name>`. Read-only (INV-002). |
| Read ONE record verbatim | `sdd record get <id> [--format=json\|human]` | Prints the record's exact source body (round-trips into `set`); JSON adds `file` + `start_line`/`end_line`. Exit 1 if not found. |
| Replace a record body in place | `sdd record set <id> (--from-file <p> \| --content <s>)` | Edits a **draft/proposed** record; surrounding fence and `---` are preserved. Body may be bare (as `get` emits) or wrapped in a ```yaml fence — both are normalised. |
| Insert a new record | `sdd record add --after <id> (--from-file <p> \| --content <s>)` | Inserts a new ```yaml-fenced record immediately after the anchor's fence. Body `id` must be new; status `draft`/`proposed`. |

Rules:
- **Prefer `sdd record list`/`get` over `Read`** to find or inspect records in a large spec — `Read` only when you genuinely need broad surrounding context.
- **Prefer `sdd record set`/`add` over `Edit`/`Write`** for single-record changes. The write is atomic and scoped to `lint.spec_files` (INV-015); `get → edit → set` round-trips byte-for-byte.
- **`set`/`add` refuse `approved`/`deprecated`/`removed` records** (exit 1, `record-protected`). Changing a governed record is a `Delta` + `sdd approve`/`sdd finalize` job — never a `set`.
- **Pass multi-line YAML via `--from-file <path>`** (use `--content` only for one-liners); never inline multi-line YAML through the shell.
- **`set`/`add` are not a lint substitute** — the body is spliced verbatim. Always run `sdd lint` afterwards (it MUST be 0), then the normal gates.

## Universal rules

1. **Never bypass `sdd ready` exit 1 with `--no-verify` or by commenting out checks.** The exit code is the gate — work around it by fixing the underlying issue, not the verifier.
2. **Never write `approval_record` directly in spec files.** Use `sdd approve` (writes pending attestation to a plan-namespace artefact) followed by `sdd finalize` (atomic flip with graph validation). Direct edits bypass graph validation. Legacy `sdd approve --inline` is deprecated and removed in v1.1.0 of the CLI Surface.
3. **Self-approval is forbidden.** `sdd approve --approver <agent-id>` exits with `agent-approver` reason; this includes Claude, Codex, any `bot:*` identity, and `sdd-cli` itself. The CLI enforces this; the agent must not retry with a different bot identity.
4. **`sdd lint` is read-only.** It never modifies spec files. Diagnostics with `--format=json` are stable per `Surface: diagnostics` semver — pin against `compatible_sdd_cli` from `enforcement_registry.md`.
5. **`sdd refresh` writes only to stdout.** Apply emitted Delta/Open-Q stubs by hand; review every stub before pasting into spec.
6. **Never hand-craft a `--plan <plan_id>` for `sdd approve`.** The id must match the minted grammar `^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z-[a-z0-9]{5}$` (e.g. `2026-05-20T210159Z-038af`); an arbitrary string is accepted on first write but the CLI throws on the next append/parse. Prefer omitting `--plan` so the CLI mints a valid id and writes `.sdd/plans/.active` (subsequent `approve` calls without `--plan` append to it; `sdd finalize` without `--plan` consumes it). To approve N IDs that reference each other (e.g. a `Surface` and its member `Contract`s), queue all N into **one** plan, then a single `sdd finalize` flips them atomically — piecemeal finalize fails with `proposed-references`.
7. **Use `sdd record` to navigate and edit large specs.** `record list`/`get` are read-only (INV-002) and keep context scoped to single records — prefer them over `Read` on big spec files. `record set`/`add` edit one record atomically (INV-015) and only touch `draft`/`proposed` — prefer them over `Edit`/`Write`, and never use them on `approved`/`deprecated`/`removed` records (that's a `Delta` + `sdd approve`/`finalize`). After any `set`/`add`, `sdd lint` MUST be 0.

## Exit-code taxonomy (across commands)

| Exit | Meaning | Action |
|---|---|---|
| 0 | Clean / mergeable | Proceed to next phase |
| 1 | Drift / violation / refusal | Fix the underlying issue (see command-specific `reason` / `kind`) |
| 2 | Configuration error | Fix `.sdd/config.json` or spec syntax; do not retry until parseable |
| 3 | Environment error | Fix env (`git` on PATH, inside repo, `HEAD` resolves, etc.) |

## Spec-file glob (for the lint hook)

Spec files that trigger `sdd lint` reminders are anything matching `**/spec/**/*.md` or paths declared under `lint.spec_files` in `.sdd/config.json`. The hook (`sdd/hooks/sdd-lint-reminder.sh`) is non-blocking — the agent decides whether to actually run `sdd lint` based on whether the change is normative (touched a YAML block with `id:` and `lifecycle.status:`) vs purely descriptive (Context/Glossary edits).

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `sdd ready` flags `[uncovered]` | Approved ID has no `@covers <id>` marker in test files | Add `// @covers <id>` next to a test that closes the obligation, OR set `Test obligation: not_applicable + reason` in the spec |
| `sdd ready` flags `[unapproved]` | A `proposed`/`draft` ID lives outside `sandbox_paths` | Move the spec file under `partitions[*].sandbox_paths` OR promote via `sdd approve` + `sdd finalize` |
| `sdd ready` flags `[unknown_partition_covers]` | Marker `@covers <prefix>:<id>` uses a partition not declared in config | Add the partition to `.sdd/config.json#partitions`, or fix the marker prefix |
| `sdd approve` throws `plan_id "..." does not match grammar` | Hand-crafted `--plan <id>` that isn't `YYYY-MM-DDTHHMMSSZ-<5 lowercase alnum>` (first `approve` wrote the file; the next append re-parses and throws) | Delete the stale `.sdd/plans/<bad-id>.yaml`, then re-run omitting `--plan` (CLI mints a valid id) or pass a grammar-valid id. No spec mutation occurred — `approve` only queues; `finalize` flips |
| `sdd record set/add` exits 1 `record-protected` | Target (or supplied body) is `approved`/`deprecated`/`removed` | Don't edit governed records via `set`/`add`; author a `Delta` and use `sdd approve` + `sdd finalize` |
| `sdd record set/add` exits 1 `record-not-found` / `anchor-not-found` / `duplicate-id` | id missing, `--after` anchor missing, or the new body `id` already exists | Verify ids with `sdd record list`; for `add` pick an existing `--after` anchor and a fresh `id` |
| `sdd record set/add` exits 2 `invalid-body` | Body has no `id:`, doesn't parse, both/neither `--from-file`/`--content`, or (set) the body `id` ≠ `<id>` | Provide exactly one input flag; ensure the body parses as one YAML mapping whose `id:` matches |
| `sdd ready` flags `[surface_semver_cascade]` | Policy/Invariant(contractual) referenced by a Surface changed predicate, but Surface declared bump < required | Bump the Surface major (predicate change) or minor (content change); see `enforcement_registry.md#ENF-004A` |
| `sdd ready` flags `[generated_artifact_structural_diff_unbumped]` | GeneratedArtifact emission has structural-breaking diff but its Surface bump is < major | Bump the generated Surface major; see ENF-019 |
| `sdd ready` flags `[debt_budget_increased]` | `Partition.unmodeled_budget.current` exceeds `--against <ref>` value | Reduce `current` (close `unmodeled` items) or adjust `baseline_at`/`baseline_value` with explicit owner approval |
| `sdd check` reports `baseline-dirty` | Uncommitted scope-touching edits | `git commit` or `git stash`, then re-run |
| `sdd check` reports `baseline-stale` | Scope-touching commit since recorded baseline | `sdd refresh > stubs.yaml` → fill Delta/Open-Q → commit → `sdd token --format=json` → paste new token + sha into BL block |
| `sdd finalize` fails with `proposed-references` | Plan tries to flip an ID whose Surface members or Policy refs are still proposed | Include referenced IDs in the same plan, or promote them first; `sdd plan show` lists current pending attestations |
| `sdd doctor` reports `missing_diagnostic` | `enforcement_registry.md` declares a rule the current CLI does not publish | Either: (a) bump CLI to a version that implements it, (b) downgrade `maturity: implemented → planned` in registry until CLI catches up |
| `sdd doctor` reports `stale_diagnostic` | CLI publishes a rule registry does not know | Add a row to `enforcement_registry.md` with the new rule_id and appropriate ENF-id |
| `sdd doctor` reports `version_mismatch` | `package.json#version` of CLI is outside `compatible_sdd_cli` range from registry | Bump registry's `compatible_sdd_cli` (after coordinated review) or pin the consumer to a compatible CLI version |

## Cross-references

- Operational gate definitions: `@sdd/enforcement_registry.md`
- Methodology principles: `@sdd/spec-driven-development.md` (rule), `@sdd/skills/spec-driven-development/SKILL.md` (full)
- Hook implementation: `sdd/hooks/sdd-lint-reminder.sh`
- Self-review checklist: `@rules/review.md` + `@sdd/review-sdd.md`
- Workflow integration: `@rules/workflow.md` + `@sdd/workflow-sdd.md`
