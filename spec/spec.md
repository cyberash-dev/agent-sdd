# `sdd-cli` — Specification

> Single source of truth for `sdd-cli`. Written per
> `~/.claude/rules/spec-driven-development.md` and
> `~/.claude/skills/spec-driven-development/SKILL.md`.
>
> **v0.1.0** — implementable v1 behavior and surface IDs are
> human-approved via the shared `approval_record` dated 2026-04-29T15:37:35Z.
> Architecture rebinding IDs (`INV-004`, `CST-003`, `IMP-001..013`) are
> human-approved for the Vertical Slice + Hexagonal refactor via the
> shared `approval_record` dated 2026-04-29T16:26:12Z.
>
> **v0.2.0** — adds two new CLI subcommands (`sdd lint`, `sdd approve`).
> The new IDs (`SUR-006/007`, `BEH-011..016`, `CTR-008..012`,
> `INV-005..007`, `CST-006`, `DLT-001`, `IMP-015..020`, `OQ-010/011`) are
> all `lifecycle.status: proposed`. Per SDD §7.5 the agent that authored
> them cannot self-approve; promotion to `approved` requires a separate
> human-or-non-agent identity via `sdd approve` (see `DLT-001` and
> `~/Projects/pipeline-state-mcp/spec/APPROVAL.md` for the workflow).
> `BL-001` records the current implementation/test/schema baseline.
> It stays `proposed` until a non-agent owner explicitly approves the
> baseline record.

---

## 1. Context

`sdd-cli` is a generic command-line helper for Spec-Driven Development.
It computes a `freshness_token` over a configurable Discovery scope,
compares the current scope state against the value recorded in a
spec's Brownfield-baseline block, and emits machine-readable stubs
(`Delta` / `Open-Q`) describing scope drift since the recorded baseline
commit.

The mechanism is fixed (`git_tree_hash_v1`), but the tool is generic:
every SDD-following repo configures it through a small JSON file
(`.sdd/config.json`). The CLI is read-only on the spec — it never
rewrites normative spec content (SDD §0: auto-rewrite would be a
silent-removal back-door).

This spec governs **only** the construction of `~/Projects/sdd-cli/`.
Adoption inside any consumer repository (e.g. `pipeline-driver/`) is
out of scope — see §18.

---

## 2. Glossary

- **Token** — hex-encoded sha256 over the byte stream produced by
  `git ls-tree HEAD -- <discovery_scope>`. Identifies the exact
  tree-shape of Discovery scope at a commit.
- **Discovery scope** — array of git pathspecs (directories, files,
  globs) declared in `.sdd/config.json#discovery_scope`. Defines what
  the token covers.
- **Footprint** — the union of file paths reachable from the
  `binding` field of every `IMP-*` (Implementation binding) block in
  the spec file.
- **Baseline block** — the YAML block in `<spec_file>` whose `id`
  equals `<config.baseline_id>` and whose `type` is
  `BrownfieldBaseline`. Holds `freshness_token` and
  `baseline_commit_sha`.
- **Stub** — a YAML fragment emitted to stdout by `sdd refresh`
  describing one path of scope drift; either a `Delta` stub (path is
  inside an IMP footprint) or an `Open-Q` stub (path is in scope but
  outside any footprint).
- **Scope-clean working tree** — `git diff --quiet HEAD --
  <discovery_scope>` exits 0.
- **Scope-dirty working tree** — same command exits non-zero.

---

## 3. Partition

```yaml
---
id: sdd-cli
type: Partition
partition_id: sdd-cli
owner_team: cyberash
gate_scope:
  - sdd-cli
dependencies_on_other_partitions: []
default_policy_set:
  - sdd-cli:POL-001
  - sdd-cli:POL-002
id_namespace: sdd-cli
---
```

---

## 4. Brownfield baseline

```yaml
---
id: sdd-cli:BL-001
type: BrownfieldBaseline
lifecycle:
  status: proposed
partition_id: sdd-cli
discovery_scope:
  - src
  - tests
  - schema
  - package.json
  - tsconfig.json
coverage_evidence:
  - kind: git_tree_hash_v1
    reference: 192f96a8a997917121222616df9f4fb56f720caf
    note: |
      Token covers implementation, tests, schema, and build metadata.
      spec/spec.md and .sdd/config.json are intentionally outside this
      repo's own Discovery scope because BL-001 stores the token inside
      spec/spec.md; including that file would make the token
      self-referential.
freshness_token: 7a7cfd2500425e12f325225a52143a18fd7b0376d9a06403114389621cf2dcfb
baseline_commit_sha: 192f96a8a997917121222616df9f4fb56f720caf
mechanism: git_tree_hash_v1
notes: |
  Brownfield baseline carries no preserved as-is behavior by itself.
  BL-001 lifecycle remains proposed until a non-agent owner records an
  approval_record.
---
```

---

## 5. Surfaces

```yaml
---
id: sdd-cli:SUR-001
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
name: sdd-cli/cli
version: "0.1.0"
boundary_type: cli
members:
  - sdd-cli:CTR-001
  - sdd-cli:CTR-002
consumer_compat_policy: semver_per_surface
---
```

```yaml
---
id: sdd-cli:SUR-002
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
name: sdd-cli/config
version: "0.1.0"
boundary_type: public_storage
members:
  - sdd-cli:CTR-003
consumer_compat_policy: semver_per_surface
---
```

```yaml
---
id: sdd-cli:SUR-003
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
name: sdd-cli/json-output
version: "0.1.0"
boundary_type: cli
members:
  - sdd-cli:CTR-004
  - sdd-cli:CTR-005
consumer_compat_policy: semver_per_surface
---
```

```yaml
---
id: sdd-cli:SUR-004
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
name: sdd-cli/refresh-stubs
version: "0.1.0"
boundary_type: cli
members:
  - sdd-cli:CTR-006
consumer_compat_policy: semver_per_surface
---
```

```yaml
---
id: sdd-cli:SUR-005
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
name: sdd-cli/package
version: "0.1.0"
boundary_type: sdk
members:
  - sdd-cli:CTR-007
consumer_compat_policy: semver_per_surface
notes: |
  v1 is consumed via local path / npm pack only (PLAN.md §Tool name and
  distribution). npm-registry publication is out of scope (§18).
---
```

```yaml
---
id: sdd-cli:SUR-006
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:08.819Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
name: sdd-cli/lint
version: "0.2.0"
boundary_type: cli
members:
  - sdd-cli:CTR-008
  - sdd-cli:CTR-009
consumer_compat_policy: semver_per_surface
notes: |
  v0.2.0 — added the `sdd lint` subcommand. Static linter over a consumer
  repo's normative-ID specs; read-only on the spec; emits diagnostics in
  human or json formats. Spec files to scan are configured via
  `.sdd/config.json#lint.spec_files` (extension to SUR-002 — see CTR-012).
---
```

```yaml
---
id: sdd-cli:SUR-007
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:08.868Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
name: sdd-cli/approve
version: "0.2.0"
boundary_type: cli
members:
  - sdd-cli:CTR-010
  - sdd-cli:CTR-011
consumer_compat_policy: semver_per_surface
notes: |
  v0.2.0 — added the `sdd approve` subcommand. Promotes a normative ID's
  `lifecycle.status` from `proposed` to `approved` (or `deprecated`/
  `removed`) and writes the `approval_record` block. Refuses agent
  identities (SDD §7.5). The only mutating sdd-cli subcommand on consumer
  spec files; everything else is read-only.
---
```

```yaml
---
id: sdd-cli:SUR-008
type: Surface
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.547Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
name: sdd-cli/ready
version: "0.3.0"
boundary_type: cli
members:
  - sdd-cli:CTR-013
  - sdd-cli:CTR-014
  - sdd-cli:CTR-015
consumer_compat_policy: semver_per_surface
notes: |
  v0.3.0 — added the `sdd ready` subcommand. Closes the gate-3
  (implementation-valid) hole described in SDD §three gates: every
  `approved`/`deprecated` normative ID must have ≥1 executable test
  annotated `@covers <partition>:<id>`, every `removed` ID must
  have a test with the matching `compatibility_action`, and no
  `proposed`/`draft` IDs may exist outside `sandbox_paths`.
  Strict superset of `sdd lint` and `sdd check` — re-runs their
  semantics under one JSON envelope (kinds `aggregated_lint` and
  `aggregated_check`). Read-only on the working tree (INV-009);
  does not run tests (INV-008). Configured via
  `.sdd/config.json#partitions[*].{spec_paths,test_paths,sandbox_paths}`
  (extension to SUR-002 — see CTR-015), with the v0.1.0/v0.2.0
  flat config shape preserved as a single-partition shorthand.
  Marker grammar (CST-007) accepts one-or-more colon-separated
  lowercase partition segments; single-segment is the default and
  preserved unchanged from v0.2.0.
---
```

---

## 6. Requirements

### 6.1 `sdd token`

```yaml
---
id: sdd-cli:BEH-001
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd token — compute current scope token
given: |
  - cwd is inside a git repository
  - .sdd/config.json exists at <repo_root> and validates against
    sdd-cli:CTR-003
  - git binary is on PATH
  - HEAD resolves to a commit
  - git diff --quiet HEAD -- <discovery_scope> exits 0
when: user runs `sdd token` (with optional --format=json|human)
then: |
  process exits 0; stdout contains a record with these fields:
    token            = sha256(stdout_bytes_of(`git ls-tree HEAD -- <scope>`))
    commit_sha       = output of `git rev-parse HEAD`
    mechanism        = "git_tree_hash_v1"
    scope            = the discovery_scope array verbatim from config
    format_version   = 1                       (when --format=json)
  output format:
    --format=json    => single JSON object on one line; LF terminator
    --format=human   => one-line summary (token + commit_sha) followed
                        by indented detail (mechanism, scope)
negative_cases:
  - working tree is scope-dirty           => see BEH-002
  - .sdd/config.json missing or invalid    => see BEH-009
  - HEAD does not resolve / not a git repo => see BEH-010
out_of_scope:
  - computing the token against a ref other than HEAD
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
  - sdd-cli:POL-002
test_obligation:
  predicate: |
    For any commit C and any scope S that produces a non-empty
    git ls-tree, sdd token returns
      sha256(`git ls-tree HEAD -- S`@C) = token
      git rev-parse HEAD@C              = commit_sha
    and exits 0 when working tree on S is clean.
  test_template: integration
  boundary_classes:
    - empty git repo with single commit, single file in scope
    - multi-file scope with directory and glob entries
    - scope entry that matches zero files (see OQ-001 / ASM-001)
    - scope containing a binary file
  failure_scenarios:
    - scope-dirty (asserted in BEH-002)
    - HEAD missing (asserted in BEH-010)
---
```

```yaml
---
id: sdd-cli:BEH-002
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd token — refuses to run on a scope-dirty working tree
given: |
  - environment matches BEH-001 except: at least one tracked path inside
    discovery_scope has uncommitted changes
when: user runs `sdd token`
then: |
  process exits 1 with reason="baseline-dirty"; stdout (in JSON mode)
  contains { format_version: 1, ok: false, reason: "baseline-dirty",
             dirty_paths: [<path>...] }; stderr summarises in human form.
  No token is computed. Working tree is not modified.
negative_cases:
  - untracked file inside scope: treated as dirty
  - dirty file outside scope: ignored (BEH-001 path)
out_of_scope:
  - auto-staging or auto-stashing dirty changes
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    A repo with any scope-touching uncommitted change yields exit 1
    and reason "baseline-dirty"; a repo with only out-of-scope dirty
    paths yields exit 0.
  test_template: integration
  boundary_classes:
    - tracked file in scope modified
    - untracked file inside a scope directory
    - dirty file outside scope
  failure_scenarios:
    - tool exits 0 despite scope dirt
    - tool reports out-of-scope dirt as baseline-dirty
---
```

### 6.2 `sdd check`

```yaml
---
id: sdd-cli:BEH-003
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd check — token matches recorded baseline
given: |
  - environment matches BEH-001
  - <spec_file> contains a YAML block with id == config.baseline_id and
    type == BrownfieldBaseline
  - that block's freshness_token equals the value BEH-001 would produce
    at HEAD
when: user runs `sdd check`
then: |
  process exits 0; output (per --format) confirms ok=true with the
  recorded and recomputed tokens, plus baseline_commit_sha and the
  current commit_sha.
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
  - sdd-cli:POL-002
test_obligation:
  predicate: |
    After publishing the BEH-001 token into the baseline block,
    sdd check exits 0 at the same HEAD with no scope-dirt.
  test_template: integration
  boundary_classes:
    - first run after token publication
    - rerun on the same commit after an out-of-scope change
  failure_scenarios:
    - exit non-zero despite token match (asserted negative)
---
```

```yaml
---
id: sdd-cli:BEH-004
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd check — token mismatch (baseline-stale)
given: |
  - working tree is scope-clean
  - recorded freshness_token differs from the token BEH-001 would
    produce at HEAD
when: user runs `sdd check`
then: |
  process exits 1 with reason="baseline-stale"; output names the
  recorded token, the recomputed token, the recorded baseline_commit_sha
  and the current commit_sha.
  Working tree, spec_file, config file are not modified.
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    A scope-touching commit since the recorded baseline yields
    exit 1 / baseline-stale.
  test_template: integration
  boundary_classes:
    - new file added to scope and committed
    - existing scope file modified and committed
    - scope file deleted and committed
  failure_scenarios:
    - tool reports baseline-dirty when the working tree is clean
---
```

```yaml
---
id: sdd-cli:BEH-005
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd check — scope-dirty working tree
given: |
  - environment matches BEH-002 (scope-dirty)
when: user runs `sdd check`
then: |
  process exits 1 with reason="baseline-dirty"; behaves identically to
  BEH-002 on output. The recorded token is not consulted; dirt is the
  fail-fast signal.
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Scope-dirt produces exit 1 / baseline-dirty regardless of token
    state.
  test_template: integration
  boundary_classes:
    - scope-dirty AND token would mismatch
    - scope-dirty AND token would match
  failure_scenarios:
    - tool reports baseline-stale instead of baseline-dirty
---
```

### 6.3 `sdd refresh`

```yaml
---
id: sdd-cli:BEH-006
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd refresh — emit Delta / Open-Q stubs for scope drift
given: |
  - environment matches BEH-001 (scope-clean) OR BEH-005 (scope-dirty);
    refresh runs in both, but the diff source differs:
      * scope-clean:  diff(baseline_commit_sha .. HEAD) restricted to scope
      * scope-dirty:  the above PLUS uncommitted scope-touching changes
                      vs HEAD
  - recorded baseline block exists with a baseline_commit_sha that
    resolves in this repo
when: user runs `sdd refresh` (with optional --format=json|human|yaml,
                               default yaml)
then: |
  process exits 0; stdout contains zero or more YAML stubs separated by
  `^---$` lines, in deterministic order (paths sorted ASCII-ascending,
  Delta stubs before Open-Q stubs for the same path is impossible
  because each path lands in exactly one bucket — see CTR-006).
  Each changed path yields exactly one stub:
    - path appears in the footprint of one or more IMP-* blocks
        => Delta stub naming the smallest IMP-id set whose binding
           covers that path, plus the IMP's target_ids
    - path is inside discovery_scope but outside every IMP footprint
        => Open-Q stub asking whether the path should be bound to a
           normative ID
  Working tree, spec_file, config file are not modified. The CLI never
  writes to spec_file (INV-002).
negative_cases:
  - no drift           => see BEH-007
  - baseline_commit_sha missing or unresolvable => see BEH-009 (config
                                                   error path)
out_of_scope:
  - applying stubs back into spec_file
  - rewriting normative spec content
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: wall_clock:60s   # for emitted_at field; see CTR-006
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
  - sdd-cli:POL-002
test_obligation:
  predicate: |
    For every changed path in scope:
      path ∈ footprint(IMP-X)        => stub.kind == Delta, names IMP-X
      path ∉ footprint(any IMP)      => stub.kind == Open-Q
    Path partitioning is total over the changed-paths set.
  test_template: integration
  boundary_classes:
    - committed change inside an IMP footprint
    - committed change outside any footprint
    - uncommitted change inside an IMP footprint
    - mixed change-set across multiple IMPs
  failure_scenarios:
    - same path emitted twice
    - Delta stub names IMPs whose footprint does not cover the path
    - Open-Q stub emitted for a path actually covered by an IMP
---
```

```yaml
---
id: sdd-cli:BEH-007
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd refresh — no drift
given: |
  - environment matches BEH-003 (token would match) AND working tree
    is scope-clean
when: user runs `sdd refresh`
then: |
  process exits 0; stdout is empty (zero stubs). In --format=json mode,
  stdout is the empty list `{ "format_version": 1, "stubs": [] }`.
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: refresh on a clean, in-sync repo emits zero stubs and exits 0.
  test_template: integration
  boundary_classes:
    - HEAD == baseline_commit_sha
    - HEAD != baseline_commit_sha but no scope changes between them
  failure_scenarios:
    - non-empty stub stream on a clean repo
---
```

### 6.4 Cross-cutting

```yaml
---
id: sdd-cli:BEH-008
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: --help / unknown subcommand
given: cwd is anywhere
when: user runs `sdd --help`, `sdd <subcommand> --help`, `sdd` (no args),
      or `sdd <unknown-subcommand>`
then: |
  - `sdd --help` and `sdd` (no args)        => exit 0, prints top-level help
  - `sdd <known> --help`                    => exit 0, prints subcommand help
  - `sdd <unknown>`                         => exit 2, prints usage on stderr
applicability:
  invariant_to_all_axes: true
data_scope:
  not_applicable: help_does_not_touch_persistent_state
  reason: --help reads no files, executes no git commands
policy_refs:
  not_applicable: help_does_not_cross_security_boundary
  reason: no fs/git access; pure usage text
test_obligation:
  predicate: |
    Help text mentions every subcommand and every documented flag from
    CTR-001. Unknown subcommand exits 2 (config error per CTR-002).
  test_template: integration
  boundary_classes: [top-level help, per-subcommand help, unknown]
  failure_scenarios: [help text omits a known flag]
---
```

```yaml
---
id: sdd-cli:BEH-009
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: configuration error
given: |
  one of:
    - .sdd/config.json missing
    - .sdd/config.json fails JSON parse
    - .sdd/config.json fails CTR-003 schema validation
    - <spec_file> missing OR contains no block with
      id == config.baseline_id AND type == BrownfieldBaseline
    - <spec_file> contains MULTIPLE blocks matching baseline_id (see
      ASM-002)
when: user runs any of `sdd token`, `sdd check`, `sdd refresh`
then: |
  process exits 2; stderr (or json output if --format=json) names the
  failing rule and the offending file path with line/column where
  applicable.
applicability:
  invariant_to_all_axes: true
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Each of the listed config-error classes yields exit 2 with a
    human-readable message identifying the cause.
  test_template: integration
  boundary_classes:
    - missing config
    - malformed JSON in config
    - schema violation in config (each required field individually)
    - missing baseline block in spec
    - duplicate baseline block in spec
  failure_scenarios:
    - config error reported as exit 1 (drift) or exit 3 (env)
---
```

```yaml
---
id: sdd-cli:BEH-010
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: environment error
given: |
  one of:
    - `git` not on PATH
    - cwd is not inside a git working tree
    - HEAD is unborn (repo with no commits)
when: user runs any of `sdd token`, `sdd check`, `sdd refresh`
then: |
  process exits 3; stderr names the missing capability and the cwd.
applicability:
  invariant_to_all_axes: true
data_scope:
  not_applicable: environment_check_runs_before_state_reads
  reason: env error short-circuits before any data-touching code path
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Each env-error class yields exit 3 with a message naming the
    missing capability.
  test_template: integration
  boundary_classes:
    - PATH lacks git
    - cwd outside a repo
    - repo with no commits
  failure_scenarios:
    - env error reported as exit 2 (config) or exit 1 (drift)
---
```

### 6.5 `sdd lint`

```yaml
---
id: sdd-cli:BEH-011
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:08.918Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd lint — happy path emits zero diagnostics
given: |
  - cwd is inside a git repository (or anywhere — lint does not require git)
  - .sdd/config.json validates against CTR-003 (CTR-012 if `lint` block present)
  - every spec file matched by lint.spec_files (or spec_file fallback)
    parses; every normative ID record passes the §0/§1.6/§4/§5.1/§7.5/§14
    rule set.
when: user runs `sdd lint` (with optional --format=json|human)
then: |
  process exits 0; stdout reports `0 error(s), 0 warning(s)`.
    --format=json    => single JSON object with format_version: 1, ok: true,
                        error_count: 0, warn_count: 0, diagnostics: []
    --format=human   => one line per diagnostic (none) + summary line
negative_cases:
  - any error-level rule violation => see BEH-012
  - .sdd/config.json missing or invalid => see BEH-009
out_of_scope:
  - mutating any spec file (lint is read-only — see INV-006)
  - running stage tests (lint operates on the spec, not on src/)
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    A spec snapshot satisfying every rule yields exit 0 and an empty
    diagnostics list.
  test_template: integration
  boundary_classes:
    - canonical sdd-cli format (`---` separated docs)
    - list-of-objects format (single doc with `- id:` items)
    - mixed: multiple files, some in each format
  failure_scenarios:
    - exit 0 despite a known violation in a fixture spec
---
```

```yaml
---
id: sdd-cli:BEH-012
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:08.968Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd lint — reports each rule's violations
given: |
  - environment as in BEH-011, except a normative ID violates one of:
    sdd:section-presence, sdd:section-order, sdd:weasel-word,
    sdd:lifecycle-status-present, sdd:lifecycle-status-valid,
    sdd:approval-record-required, sdd:approval-record-forbidden,
    sdd:test-obligation-required, sdd:type-version-int,
    sdd:type-invariant-evidence, sdd:type-invariant-stability,
    sdd:type-data-scope, sdd:type-nfr-stage, sdd:type-migration-direction,
    sdd:type-migration-mode, sdd:type-migration-runtime-state,
    sdd:type-surface-boundary-type.
when: user runs `sdd lint`
then: |
  process exits 1; stdout/stderr enumerate the violations. JSON mode
  carries `ok: false`, `error_count >= 1`, and a `diagnostics[]` array
  with `{severity, rule, file, line, message}` per finding. Spec files
  are NOT modified.
negative_cases:
  - lint mutates spec on its own: forbidden (INV-006)
  - warn-only diagnostics (e.g. Constraint without test_obligations) keep exit 0
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Each rule is fired at least once by a fixture; the violation appears
    in diagnostics and exit is 1.
  test_template: unit + integration
  boundary_classes:
    - one rule violation per rule id
    - multiple rules in same file
    - multiple files, one violation per file
  failure_scenarios:
    - rule fires on a record that satisfies it (false positive)
    - rule does not fire on a record that violates it (false negative)
---
```

### 6.6 `sdd approve`

```yaml
---
id: sdd-cli:BEH-013
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:09.017Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd approve — promotes proposed to approved with approval_record
given: |
  - .sdd/config.json validates (CTR-003 + CTR-012)
  - flags --id, --approver, --owner-role, --change-request supplied
  - --approver is NOT in BUILTIN_AGENT_BLOCKLIST and not in
    `lint.approver_blocklist`, and does not start with `bot:`
  - --owner-role is in {tech-lead, architect, security-owner,
    platform-runtime-lead, product-owner, compliance}
  - the spec file(s) under `lint.spec_files` contain at least one
    normative ID record matching --id (exact or glob with `*`)
when: user runs `sdd approve --id <X> --approver <Y> --owner-role <R> --change-request <U>`
then: |
  for every matching record:
    - lifecycle.status is set to <target_status> (default `approved`)
    - approval_record is set to a multi-line block:
        owner_role:        <R>
        approver_identity: <Y>
        timestamp:         ISO 8601 (UTC, milliseconds)
        change_request:    <U>
        scope:             <--scope> (default first-time-approval)
      plus reviewed_test_oracle when provided.
  spec file is rewritten in place. exit 0.
  json mode emits {format_version: 1, ok: true, matched_ids[],
  files_changed[]}.
negative_cases:
  - agent identity      => see BEH-014
  - bad owner-role      => see BEH-015
  - id matches nothing  => see BEH-016
out_of_scope:
  - bumping --version or any field other than lifecycle.status / approval_record
  - validating that referenced IDs (Surface members) are also approved
    (transitive approval — see OQ-010)
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: wall_clock:1ms
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Given a fixture with a `lifecycle.status: proposed` record — either
    with a placeholder `approval_record: not_applicable_for_proposed`
    OR with no `approval_record` field at all (SDD §7.6 forbids the
    field while a record is still proposed) — `sdd approve --id <id>
    --approver <human> ...` rewrites `lifecycle.status` AND emits the
    full approval_record block in the same write; the resulting file
    is byte-identical to the golden output except for the `timestamp`
    line.
  test_template: integration (golden fixture + fake clock)
  boundary_classes:
    - single record matched
    - glob matches multiple records in one file
    - glob matches records across multiple files
    - reviewed_test_oracle flag included
    - input record has no approval_record field at all
      (SDD §7.6-conformant proposed input)
  failure_scenarios:
    - timestamp not in ISO format
    - lifecycle.status flipped without approval_record being written
    - approval_record written without lifecycle.status flip
    - file rewritten when no record matched (should be a no-op)
---
```

```yaml
---
id: sdd-cli:BEH-014
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:09.068Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd approve — refuses agent identity (SDD §7.5)
given: |
  - --approver value, after lower-casing, is in BUILTIN_AGENT_BLOCKLIST
    OR starts with `bot:` OR is in `lint.approver_blocklist`.
when: user runs `sdd approve --approver <agent-id> ...`
then: |
  process exits 1 with reason "agent-approver"; NO spec file is read for
  rewriting; NO file is written. JSON mode emits
  {format_version: 1, ok: false, reason: "agent-approver", detail: ...}.
  Stderr (human mode) names the offending identity and points to
  spec/APPROVAL.md.
negative_cases:
  - agent identity differs only in case (e.g. "Claude") — still rejected
out_of_scope:
  - whitelist mechanism for agent-approver (none — would defeat §7.5)
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: not_applicable
  time_source: none
data_scope:
  not_applicable: refused_before_any_data_read
  reason: identity check is the first gate
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Each blocked identity (every BUILTIN value + at least one bot:foo +
    one custom blocklist entry) yields exit 1 reason agent-approver
    AND no filesystem mutation.
  test_template: unit (classifier) + integration (CLI)
  boundary_classes:
    - exact match (lowercase)
    - exact match (mixed case)
    - bot: prefix
    - custom blocklist match
    - non-blocked identity passes (negative oracle for the rule)
  failure_scenarios:
    - case-sensitive match (would let "Claude" through)
    - blocklist consulted after spec rewrite (file mutated before refusal)
---
```

```yaml
---
id: sdd-cli:BEH-015
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:09.121Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd approve — refuses unknown owner-role
given: |
  - --owner-role is NOT in {tech-lead, architect, security-owner,
    platform-runtime-lead, product-owner, compliance}.
when: user runs `sdd approve --owner-role <unknown> ...`
then: |
  process exits 1 with reason "invalid-owner-role"; no file is written.
negative_cases:
  - missing --owner-role flag is caught earlier as exit 2 (argv error)
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: not_applicable
  idempotency: not_applicable
  time_source: none
data_scope:
  not_applicable: refused_before_any_data_read
  reason: identity check is the first gate
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Any owner-role outside the closed enum yields exit 1
    reason invalid-owner-role with no file mutation.
  test_template: unit (classifier) + integration (CLI)
  boundary_classes:
    - junior-dev (not in enum)
    - empty string (caught earlier as bad argv)
    - leading whitespace
  failure_scenarios:
    - typo in role allowed through
---
```

```yaml
---
id: sdd-cli:BEH-016
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:09.174Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd approve — refuses when --id matches no record
given: |
  - identity and owner-role are valid
  - --id (or glob) matches zero normative-ID records across all
    `lint.spec_files`
when: user runs `sdd approve --id <unknown-or-empty-glob> ...`
then: |
  process exits 1 with reason "no-id-match"; no file is written.
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: not_applicable
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    A glob with no matches yields exit 1 reason no-id-match;
    a glob with at least one match completes per BEH-013.
  test_template: integration
  boundary_classes:
    - exact id that does not exist
    - glob with no matches
    - glob with one match (negative oracle: should succeed)
  failure_scenarios:
    - silent no-op (exit 0 with no rewrites)
---
```

### 6.7 `sdd ready`

```yaml
---
id: sdd-cli:BEH-017
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.596Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd ready — happy path emits zero violations
given: |
  - cwd is anywhere; ready does not require git for its own rule
    evaluation (aggregated `check` does invoke git when configured)
  - .sdd/config.json validates against CTR-003 (CTR-015 if
    `partitions` block present)
  - every spec file matched by `partitions[*].spec_paths` (or the
    `lint.spec_files` fallback) parses; every approved/deprecated
    normative ID either is exempted by `Test obligation:
    not_applicable + reason` (see OQ-013) or is annotated by ≥1
    file under that partition's `test_paths` with a marker
    `@covers <partition>:<id>`; every removed ID's
    `compatibility_action` matches the matching marker's
    `compatibility_action=` token; no `proposed`/`draft` ID exists
    outside that partition's `sandbox_paths`; aggregated lint and
    check surface no error.
when: user runs `sdd ready` (with optional --format=json|human and/or --partition <name>)
then: |
  process exits 0; stdout reports `0 violation(s)`.
    --format=json   => single JSON object with ok: true,
                       error: null, violations: []
    --format=human  => one line per violation (none) + summary line
negative_cases:
  - any of the seven rule kinds fires => see BEH-018
  - aggregated lint or check surfaces a blocker => see BEH-019
  - .sdd/config.json missing/invalid or spec parse error => see BEH-020
out_of_scope:
  - mutating any spec file (ready is read-only — see INV-009)
  - running stage tests (ready scans for marker presence — see INV-008)
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    A spec snapshot satisfying every rule (every approved ID covered
    or exempted, every removed ID has a matching
    `compatibility_action` marker, no proposed/draft outside
    `sandbox_paths`, aggregated lint+check clean) yields exit 0
    and an empty violations list.
  test_template: integration
  boundary_classes:
    - single-partition flat config (legacy shorthand)
    - explicit partitions block
    - approved ID with `Test obligation: not_applicable + reason`
    - removed ID with matching `compatibility_action` marker
  failure_scenarios:
    - exit 0 despite a known violation in a fixture spec
---
```

```yaml
---
id: sdd-cli:BEH-018
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.644Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd ready — reports each rule's violations
given: |
  - environment as in BEH-017, except at least one of the seven
    ready rule kinds (unapproved, uncovered, removed_no_compat_test,
    removed_compat_action_mismatch, surface_unapproved_ref,
    orphan_covers, unknown_partition_covers) fires.
when: user runs `sdd ready`
then: |
  process exits 1; stdout/stderr enumerate the violations. JSON
  mode carries `ok: false`, `error: null`, and a `violations[]`
  array with `{kind, id, partition, status?, file?, line?, expected?, actual?, remediation?, source?}`
  per finding (kind enumerates the seven rule types plus the two
  aggregated kinds — see BEH-019 and CTR-014). Spec files are
  NOT modified.
negative_cases:
  - "ready mutates spec on its own — forbidden (INV-009)"
  - "tests are not executed (INV-008) — a `@covers` marker is sufficient to satisfy uncovered even if the test would fail at runtime"
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Each of the seven rule kinds fires at least once against a
    fixture; the violation appears in `violations[]` with the
    correct `kind`, and exit is 1.
    `removed_compat_action_mismatch` populates `expected` and
    `actual` from the spec record's `compatibility_action` and the
    marker tail's `compatibility_action=` token, respectively.
  test_template: integration
  boundary_classes:
    - one rule violation per rule kind (×7)
    - multiple rules in same partition
    - removed_compat_action_mismatch with expected/actual fields
  failure_scenarios:
    - rule fires on a record that satisfies it (false positive)
    - rule does not fire on a record that violates it (false negative)
---
```

```yaml
---
id: sdd-cli:BEH-019
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.693Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd ready — aggregates lint and check blockers under same envelope
given: |
  - environment as in BEH-017, except either `sdd lint` would emit
    ≥1 error-severity diagnostic over the configured spec files,
    OR `sdd check` would emit `baseline-dirty`/`baseline-stale`
    over the configured `discovery_scope`.
when: user runs `sdd ready`
then: |
  process exits 1. The `violations[]` array contains:
    - one ReadyViolation{kind:"aggregated_lint", source:<lint rule
      id>, file, line, remediation:<message>} per error-severity
      lint diagnostic (notably: unresolved
      `Open-Q.blocking=yes`, weasel-words in normative sections,
      missing `approval_record`, and any other lint error rule).
    - one ReadyViolation{kind:"aggregated_check",
      remediation:<baseline-dirty|baseline-stale>} when the
      baseline check is not `match` (stale `freshness_token`).
  Warning-severity lint diagnostics are NOT included (see OQ-015).
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    A fixture spec with an unresolved `Open-Q.blocking=yes`, a
    weasel-word in a normative section, a missing `approval_record`,
    OR a stale `freshness_token` surfaces in `sdd ready` violations[]
    under kind `aggregated_lint` or `aggregated_check`. Warn-severity
    diagnostics do not surface as ready blockers.
  test_template: integration
  boundary_classes:
    - aggregated_lint (each lint error rule represented at least once)
    - aggregated_check (baseline-dirty AND baseline-stale)
    - mixed lint + check failure in same run
  failure_scenarios:
    - lint warn-severity diagnostic surfaces as a ready blocker
    - lint error-severity diagnostic missing from ready output
---
```

```yaml
---
id: sdd-cli:BEH-020
type: Behavior
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.743Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd ready — exit 2 on evaluate-failure
given: |
  - one of:
      a) .sdd/config.json missing or fails CTR-003 + CTR-015
         validation (`config_invalid`)
      b) a configured spec file fails to parse as YAML/markdown
         (`spec_parse_failed`)
      c) a path under `partitions[*].test_paths` exists in the
         glob expansion but cannot be read
         (`unreadable_test_paths`)
when: user runs `sdd ready`
then: |
  process exits 2; stdout JSON envelope is
    { ok: false,
      error: { kind, message, file? },
      violations: [] }
  where `kind` is one of {spec_parse_failed, config_invalid,
  unreadable_test_paths, internal} and `file` is populated when
  the cause is locatable. Human format prints the error reason on
  stderr. No partial `violations[]` is emitted; CI distinguishes
  "fix your spec" (1) from "fix your tool/config" (2).
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: not_applicable
  time_source: none
data_scope:
  not_applicable: ready_does_not_touch_persistent_state_on_failure
  reason: evaluate-failure short-circuits before any rule scan
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Each of (a) missing config, (b) spec parse error, (c)
    unreadable test_paths produces exit 2 and a populated
    `error.kind`. `violations[]` is empty in every case.
  test_template: integration
  boundary_classes:
    - missing .sdd/config.json
    - corrupt YAML in spec.md
    - test_paths glob matches a file with mode 0 (POSIX only)
  failure_scenarios:
    - exit 1 (instead of 2) is reported on evaluate-failure
    - violations[] is non-empty when error is populated
---
```

---

## 7. Data contracts

```yaml
---
id: sdd-cli:CTR-001
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: CLI argv & subcommand contract
surface_ref: sdd-cli:SUR-001
schema:
  binary: sdd
  subcommands:
    - name: token
      flags:
        - name: --format
          values: [json, human]
          default: human
    - name: check
      flags:
        - name: --format
          values: [json, human]
          default: human
    - name: refresh
      flags:
        - name: --format
          values: [json, human, yaml]
          default: yaml
  global_flags:
    - name: --help
    - name: --version
preconditions:
  - cwd is anywhere
postconditions:
  - process exits with a code from CTR-002
external_identifiers:
  - subcommand names (token, check, refresh)
  - flag names (--format, --help, --version)
  - format values (json, human, yaml)
compatibility_rules:
  - renaming a subcommand or flag => major bump on SUR-001
  - removing a format value       => major bump on SUR-001
  - adding a flag with a default  => minor bump on SUR-001
error_taxonomy:
  - exit 2 on unknown subcommand or unknown flag
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope:
  not_applicable: argv_parsing_does_not_touch_persistent_state
  reason: argv handling occurs before any fs/git access
policy_refs:
  not_applicable: argv_handling_is_not_a_security_boundary
  reason: argv is parsed before authentication/authorization decisions
test_obligation:
  predicate: |
    Argv parser accepts every subcommand × flag combination listed and
    rejects every other combination with exit 2.
  test_template: unit
  boundary_classes: [each documented combination, each unknown form]
  failure_scenarios: [silent acceptance of unknown flag]
---
```

```yaml
---
id: sdd-cli:CTR-002
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: exit-code taxonomy
surface_ref: sdd-cli:SUR-001
schema:
  exit_codes:
    0: clean | success
    1: drift  (token mismatch OR scope-dirty; refresh-with-stubs is NOT 1)
    2: configuration error
    3: environment error
preconditions: []
postconditions:
  - every CLI invocation exits with one of {0, 1, 2, 3}
external_identifiers:
  - exit codes 0..3 (numeric values are part of contract)
compatibility_rules:
  - reassigning the meaning of an existing code => major bump on SUR-001
  - introducing exit code 4+                    => minor bump on SUR-001
error_taxonomy:
  - reasons for code 1: ["baseline-dirty", "baseline-stale"]
  - reasons for code 2: ["config-missing", "config-invalid",
                         "baseline-block-missing",
                         "baseline-block-duplicate"]
  - reasons for code 3: ["git-not-on-path", "not-a-git-repo",
                         "head-unborn"]
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope:
  not_applicable: exit_codes_are_process_metadata
  reason: not persisted state
policy_refs:
  not_applicable: exit_codes_carry_no_security_decisions
  reason: codes describe outcome class, not authorization
test_obligation:
  predicate: |
    Every Behavior in §6 maps to exactly one exit code in this taxonomy.
  test_template: contract
  boundary_classes: [each Behavior path]
  failure_scenarios: [a behavior emits an undocumented exit code]
---
```

```yaml
---
id: sdd-cli:CTR-003
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: .sdd/config.json schema
surface_ref: sdd-cli:SUR-002
schema:
  type: object
  required: [spec_file, baseline_id, discovery_scope, mechanism]
  properties:
    $schema:
      type: string
      description: optional pointer to schema/sdd.config.schema.json
    spec_file:
      type: string
      description: |
        path to the SDD spec file, relative to repo root; MUST be a
        regular readable file
    baseline_id:
      type: string
      pattern: "^[a-z0-9_-]+:[A-Z]+-[0-9]+$"
      description: full <partition>:<neutral_id> of the BL block
    discovery_scope:
      type: array
      minItems: 1
      items:
        type: string
        description: git pathspec passed verbatim to git ls-tree
    footprint:
      type: object
      properties:
        binding_id_prefix:
          type: string
          default: "IMP-"
        binding_field:
          type: string
          default: "binding"
    mechanism:
      type: string
      enum: [git_tree_hash_v1]
preconditions:
  - file exists at <repo_root>/.sdd/config.json
postconditions:
  - schema validates; otherwise BEH-009 path
external_identifiers:
  - field names (spec_file, baseline_id, discovery_scope, footprint,
    binding_id_prefix, binding_field, mechanism)
  - mechanism enum value "git_tree_hash_v1"
compatibility_rules:
  - renaming any required field   => major bump on SUR-002
  - adding an optional field      => minor bump on SUR-002
  - tightening a regex / minItems => major bump on SUR-002
applicability:
  invariant_to_all_axes: true
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Every required field is enforced; every default is applied when
    optional fields are absent; unknown top-level fields are rejected
    (additionalProperties: false in the published JSON Schema).
  test_template: contract
  boundary_classes:
    - minimum valid config (only required fields)
    - full config with footprint object
    - missing required field (each one in turn)
    - unknown field
    - mechanism enum violation
  failure_scenarios:
    - schema accepts a config that lacks discovery_scope
---
```

```yaml
---
id: sdd-cli:CTR-004
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd token JSON output schema
surface_ref: sdd-cli:SUR-003
schema:
  format_version: 1
  on_success:
    type: object
    required: [format_version, ok, token, commit_sha, mechanism, scope]
    properties:
      format_version: { const: 1 }
      ok:             { const: true }
      token:          { type: string, pattern: "^[0-9a-f]{64}$" }
      commit_sha:     { type: string, pattern: "^[0-9a-f]{40}$" }
      mechanism:      { const: git_tree_hash_v1 }
      scope:          { type: array, items: { type: string } }
  on_baseline_dirty:
    type: object
    required: [format_version, ok, reason, dirty_paths]
    properties:
      format_version: { const: 1 }
      ok:             { const: false }
      reason:         { const: baseline-dirty }
      dirty_paths:    { type: array, items: { type: string } }
preconditions:
  - --format=json was passed
postconditions:
  - stdout is exactly one JSON object terminated by LF
external_identifiers:
  - field names; values of `mechanism` and `reason` enums; format_version
compatibility_rules:
  - renaming any field            => major bump on SUR-003
  - adding an optional field      => minor bump on SUR-003
  - removing a field              => major bump on SUR-003
  - bumping format_version        => major bump on SUR-003
applicability:
  invariant_to_all_axes: true
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: JSON output validates against this schema for every BEH-001 / BEH-002 path.
  test_template: contract
  boundary_classes: [success, baseline-dirty]
  failure_scenarios: [missing field, extra field, wrong type]
---
```

```yaml
---
id: sdd-cli:CTR-005
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd check JSON output schema
surface_ref: sdd-cli:SUR-003
schema:
  format_version: 1
  on_match:
    type: object
    required: [format_version, ok, recorded_token, recomputed_token,
               baseline_commit_sha, current_commit_sha]
    properties:
      format_version:        { const: 1 }
      ok:                    { const: true }
      recorded_token:        { type: string, pattern: "^[0-9a-f]{64}$" }
      recomputed_token:      { type: string, pattern: "^[0-9a-f]{64}$" }
      baseline_commit_sha:   { type: string, pattern: "^[0-9a-f]{40}$" }
      current_commit_sha:    { type: string, pattern: "^[0-9a-f]{40}$" }
  on_drift:
    type: object
    required: [format_version, ok, reason, recorded_token,
               recomputed_token, baseline_commit_sha, current_commit_sha,
               dirty_paths]
    properties:
      format_version:        { const: 1 }
      ok:                    { const: false }
      reason:                { enum: [baseline-stale, baseline-dirty] }
      recorded_token:        { type: string }
      recomputed_token:      { type: [string, "null"] }   # null on dirty
      baseline_commit_sha:   { type: string }
      current_commit_sha:    { type: string }
      dirty_paths:           { type: array, items: { type: string } }
preconditions:
  - --format=json was passed
postconditions:
  - stdout is exactly one JSON object terminated by LF
external_identifiers:
  - field names; values of `reason` enum; format_version
compatibility_rules: same shape rules as CTR-004
applicability:
  invariant_to_all_axes: true
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: JSON output validates for BEH-003 / BEH-004 / BEH-005 paths.
  test_template: contract
  boundary_classes: [match, baseline-stale, baseline-dirty]
  failure_scenarios: [recomputed_token populated on baseline-dirty]
---
```

```yaml
---
id: sdd-cli:CTR-006
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: sdd refresh stub format
surface_ref: sdd-cli:SUR-004
schema:
  emission_modes:
    yaml:                                # default
      type: stream
      separator: "^---$"
      stub_kinds: [Delta, "Open-Q"]
    json:
      type: object
      required: [format_version, stubs]
      properties:
        format_version: { const: 1 }
        stubs:          { type: array, items: { $ref: "#/$defs/Stub" } }
    human:
      type: text
      shape: |
        one-line summary per stub: "<KIND> <path> -> <IMP-id|->"
  $defs:
    DeltaStub:
      required: [kind, path, target_imp_ids, target_ids, emitted_at]
      properties:
        kind:           { const: Delta }
        path:           { type: string }
        target_imp_ids: { type: array, minItems: 1, items: { type: string } }
        target_ids:     { type: array, items: { type: string } }
        emitted_at:     { type: string, format: date-time }
        # placeholder fields the human/agent fills in:
        compatibility_action: { const: "TODO" }
        kind_of_change:       { const: "TODO" }
        tests_old_behavior:   { const: "TODO" }
        tests_new_behavior:   { const: "TODO" }
    OpenQStub:
      required: [kind, path, question, options, blocking, emitted_at]
      properties:
        kind:        { const: "Open-Q" }
        path:        { type: string }
        question:    { type: string }
        options:     { type: array, minItems: 2, items: { type: string } }
        blocking:    { const: "TODO" }
        emitted_at:  { type: string, format: date-time }
preconditions:
  - --format=yaml|json|human was passed (or omitted; default yaml)
postconditions:
  - one stub per path, paths sorted ASCII-ascending
external_identifiers:
  - kind values "Delta" and "Open-Q"
  - field names listed above
  - placeholder sentinel "TODO"
compatibility_rules:
  - renaming a kind or field            => major bump on SUR-004
  - changing the placeholder sentinel   => major bump on SUR-004
  - bumping format_version (json mode)  => major bump on SUR-004
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: wall_clock:60s
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligation:
  predicate: |
    Every Delta stub names ≥1 IMP-id whose footprint covers `path`;
    every Open-Q stub corresponds to a path that no IMP footprint
    covers; ordering is deterministic.
  test_template: contract
  boundary_classes:
    - one Delta, one Open-Q
    - multiple Deltas at the same IMP
    - one path covered by multiple IMPs
  failure_scenarios:
    - stub kind disagrees with footprint membership
    - non-deterministic ordering between runs
---
```

```yaml
---
id: sdd-cli:CTR-007
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: package.json bin contract
surface_ref: sdd-cli:SUR-005
schema:
  name: "@cyberash/sdd-cli"
  type: module
  bin:
    sdd: dist/cli.js
  engines:
    node: ">=20"
  files: [dist, schema, README.md]
  exports:
    ".":
      types: ./dist/cli.d.ts
      default: ./dist/cli.js
preconditions:
  - "dist/cli.js carries shebang `#!/usr/bin/env node`"
  - "dist/cli.js has executable permission after npm pack/install"
postconditions:
  - "`npx sdd --help` and `node_modules/.bin/sdd --help` both work"
external_identifiers:
  - package name "@cyberash/sdd-cli"
  - bin name "sdd"
  - export entry "."
compatibility_rules:
  - renaming the bin / package / export entry => major bump on SUR-005
  - bumping the engines.node minimum          => major bump on SUR-005
applicability:
  invariant_to_all_axes: true
data_scope:
  not_applicable: package_metadata_is_not_persistent_runtime_state
  reason: package.json is build-time metadata
policy_refs:
  not_applicable: package_metadata_is_not_a_security_boundary
  reason: distribution surface, not an authz boundary
test_obligation:
  predicate: |
    npm pack produces a tarball that, when installed in a tmp dir,
    exposes `sdd` on PATH and `sdd --help` exits 0.
  test_template: integration
  boundary_classes:
    - install via local path (file:../sdd-cli)
    - install via npm pack tarball
  failure_scenarios:
    - shebang missing => `sdd token` fails with EACCES
---
```

```yaml
---
id: sdd-cli:CTR-008
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:09.224Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd lint — CLI invocation contract
applicability:
  invariant_to_all_axes: true
schema:
  argv:
    subcommand: "lint"
    flags:
      "--format": { type: enum, values: [json, human], default: human }
      "--help":   optional
  exit_codes:
    0: every rule passed
    1: at least one error-severity diagnostic
    2: argv error (unknown flag, invalid format value)
    3: environment error (e.g. config-missing — surfaces from CTR-003)
  outputs:
    stdout_human: |
      one line per diagnostic: `[ERROR|warn] <file>[:<line>]  <rule>: <message>`
      followed by blank line and summary `spec-lint: N error(s), M warning(s).`
    stdout_json: see CTR-009
external_identifiers:
  - argv flag --format
  - exit codes 0/1/2/3
preconditions: not_applicable
postconditions:
  - lint is read-only on consumer spec files (INV-006)
error_taxonomy:
  - exit 0  on no errors (warnings allowed)
  - exit 1  on >=1 error diagnostic
  - exit 2  on argv error
  - exit 3  on environment error (config-missing/invalid bubbles up here)
compatibility_rules:
  - flag enum is append-only
  - exit code semantics fixed across minor versions
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligations:
  - to:sdd-cli:CTR-008:human_summary_format
  - to:sdd-cli:CTR-008:json_envelope
  - to:sdd-cli:CTR-008:exit_codes
---
```

```yaml
---
id: sdd-cli:CTR-009
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T14:03:12.335Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd lint --format=json — output schema
applicability:
  invariant_to_all_axes: true
schema:
  json:
    format_version: int (=1)
    ok: bool
    error_count: int (>=0)
    warn_count: int (>=0)
    diagnostics:                  # array; each element shaped as below
      - severity: enum [error, warn]
        rule: string                # e.g. "sdd:weasel-word"
        file: string                # path relative to repo root, posix-separated
        line: int | null            # 1-based, or null for file-scoped findings
        message: string
external_identifiers:
  - top-level keys: format_version, ok, error_count, warn_count, diagnostics
  - diagnostic key set: severity, rule, file, line, message
preconditions: not_applicable
postconditions: not_applicable
error_taxonomy: not_applicable
compatibility_rules:
  - field set is additive at minor; rename or removal is major (cascades to SUR-006)
  - rule names (e.g. "sdd:weasel-word") are append-only — once published,
    a rule id is never renamed or repurposed
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligations:
  - to:sdd-cli:CTR-009:format_version_1
  - to:sdd-cli:CTR-009:rule_id_stable
---
```

```yaml
---
id: sdd-cli:CTR-010
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T14:03:12.383Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd approve — CLI invocation contract
applicability:
  invariant_to_all_axes: true
schema:
  argv:
    subcommand: "approve"
    flags:
      "--id":                    "required, string (id or glob with `*`)"
      "--approver":              "required, string"
      "--owner-role":            "required, enum [tech-lead, architect, security-owner, platform-runtime-lead, product-owner, compliance]"
      "--change-request":        "required, string (URL-shaped; not validated)"
      "--scope":                 "optional, string, default \"first-time-approval\""
      "--target-status":         "optional, enum [approved, deprecated, removed], default approved"
      "--reviewed-test-oracle":  "optional, string"
      "--format":                "optional, enum [json, human], default human"
  exit_codes:
    0: at least one record matched and rewritten
    1: "refused (agent identity, invalid owner-role, no-id-match)"
    2: argv error
    3: environment error
  outputs:
    stdout_human: |
      one line per matched id `approve: <id> -> <status> (approver=<who>)`
      followed by summary
    stdout_json: see CTR-011
external_identifiers:
  - all flag names above
  - the six owner-role enum values
preconditions: not_applicable
postconditions:
  - "on exit 0: matched spec files are rewritten in place; lifecycle.status flipped; approval_record block written with caller-supplied fields + server-side timestamp"
  - "on exit 1: NO file is written"
error_taxonomy:
  - reason="agent-approver" (BEH-014)
  - reason="invalid-owner-role" (BEH-015)
  - reason="no-id-match" (BEH-016)
compatibility_rules:
  - owner-role enum is append-only; values are part of the contract
  - "approval_record key set is fixed: owner_role, approver_identity, timestamp, change_request, scope, optional reviewed_test_oracle"
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: "wall_clock:1ms"   # used only to stamp the timestamp field
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligations:
  - to:sdd-cli:CTR-010:flag_set_complete
  - to:sdd-cli:CTR-010:owner_role_enum
  - to:sdd-cli:CTR-010:exit_codes
---
```

```yaml
---
id: sdd-cli:CTR-011
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T14:03:12.432Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd approve --format=json — output schema
applicability:
  invariant_to_all_axes: true
schema:
  json_success:
    format_version: int (=1)
    ok: true
    matched_ids: array of string  # exact ids that were rewritten
    files_changed: array of string # repo-relative posix paths
  json_refusal:
    format_version: int (=1)
    ok: false
    reason: enum [agent-approver, invalid-owner-role, no-id-match]
    detail: string                 # human-readable extension
external_identifiers:
  - "top-level keys: format_version, ok, matched_ids, files_changed, reason, detail"
preconditions: not_applicable
postconditions: not_applicable
error_taxonomy: not_applicable
compatibility_rules:
  - reason enum is append-only
  - field set additive at minor
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligations:
  - to:sdd-cli:CTR-011:success_envelope
  - to:sdd-cli:CTR-011:refusal_envelope
---
```

```yaml
---
id: sdd-cli:CTR-012
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T14:03:12.480Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: .sdd/config.json — optional `lint` block (extension to CTR-003)
applicability:
  invariant_to_all_axes: true
schema:
  json:
    lint:
      type: object | absent
      fields:
        spec_files:
          type: array of string (glob patterns, posix-separated)
          domain: non-empty when present
          default_when_absent: [<spec_file>]   # falls back to top-level spec_file
        approver_blocklist:
          type: array of string
          domain: 0..N entries
          default_when_absent: []
external_identifiers:
  - '"lint" top-level key (extending CTR-003)'
  - '"lint.spec_files"'
  - '"lint.approver_blocklist"'
preconditions:
  - all other CTR-003 fields still validate
postconditions:
  - when `lint` absent, sdd lint and sdd approve operate on [spec_file] only
error_taxonomy:
  - '"config-invalid" with detail naming offending lint.* field'
compatibility_rules:
  - lint key is additive at minor (was absent in v0.1.0)
  - sub-keys append-only
  - "removing `lint` from a v0.2.0+ config is allowed (graceful degradation to v0.1.0 behaviour)"
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: not_applicable
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
  - sdd-cli:POL-002
test_obligations:
  - to:sdd-cli:CTR-012:absent_falls_back
  - to:sdd-cli:CTR-012:invalid_array_rejected
  - to:sdd-cli:CTR-012:unknown_subkey_rejected
---
```

```yaml
---
id: sdd-cli:CTR-013
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.791Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd ready — CLI invocation contract
applicability:
  invariant_to_all_axes: true
schema:
  argv:
    subcommand: "ready"
    flags:
      "--format":    { type: enum, values: [json, human], default: human }
      "--partition": { type: string, optional: true, default: "(scan every configured partition)" }
      "--help":      optional
  exit_codes:
    0: every rule passed (mergeable)
    1: at least one violation found (≥1 merge blocker)
    2: could not evaluate (config_invalid | spec_parse_failed | unreadable_test_paths | internal)
  outputs:
    stdout_human: |
      one line per violation: `[<kind>] <file>[:<line>]  <id-or-context>: <remediation>`
      followed by blank line and summary `sdd ready: N violation(s).`
    stdout_json: see CTR-014
external_identifiers:
  - argv flag --format
  - argv flag --partition
  - exit codes 0 / 1 / 2
preconditions: not_applicable
postconditions:
  - ready is read-only (INV-009): no spec, config, or test file is written
error_taxonomy:
  - exit 0 on no violations
  - exit 1 on ≥1 violation (any of the seven rule kinds plus the two aggregated kinds — see CTR-014)
  - exit 2 on evaluate-failure (config_invalid | spec_parse_failed | unreadable_test_paths | internal)
compatibility_rules:
  - flag enum is append-only
  - exit code semantics fixed across minor versions
  - --partition value is a bare partition name (no glob); a value
    not present in `.sdd/config.json#partitions` yields exit 2
    config_invalid
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligations:
  - to:sdd-cli:CTR-013:flag_set_complete
  - to:sdd-cli:CTR-013:exit_codes
  - to:sdd-cli:CTR-013:partition_filter
---
```

```yaml
---
id: sdd-cli:CTR-014
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.840Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd ready --format=json — output envelope schema
applicability:
  invariant_to_all_axes: true
schema:
  json:
    ok: bool
    error: ReadyError | null
    violations: array of ReadyViolation
  ReadyError:
    kind: enum [spec_parse_failed, config_invalid, unreadable_test_paths, internal]
    message: string
    file: string | absent
  ReadyViolation:
    kind: enum [unapproved, uncovered, removed_no_compat_test, removed_compat_action_mismatch, surface_unapproved_ref, orphan_covers, unknown_partition_covers, aggregated_lint, aggregated_check]
    id: string | absent              # partition-scoped <partition>:<id>; absent for aggregated_check
    partition: string | absent       # absent for aggregated_check
    status: enum [draft, proposed, approved, deprecated, removed] | absent
    file: string | absent            # repo-relative posix path
    line: int | absent               # 1-based
    expected: string | absent        # removed_compat_action_mismatch only
    actual: string | absent          # removed_compat_action_mismatch only
    remediation: string | absent
    source: string | absent          # lint rule id when kind == aggregated_lint
external_identifiers:
  - top-level keys: ok, error, violations
  - error key set: kind, message, file
  - violation key set: kind, id, partition, status, file, line, expected, actual, remediation, source
  - violation kind enum (9 values)
  - error kind enum (4 values)
preconditions: not_applicable
postconditions: not_applicable
error_taxonomy: not_applicable
compatibility_rules:
  - field set additive at minor; rename or removal is major (cascades to SUR-008)
  - violation kind enum is append-only
  - error kind enum is append-only
  - existing violation kinds never change semantics across minor versions
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
test_obligations:
  - to:sdd-cli:CTR-014:envelope_shape_stable
  - to:sdd-cli:CTR-014:violation_kind_append_only
  - to:sdd-cli:CTR-014:error_envelope_on_exit_2
---
```

```yaml
---
id: sdd-cli:CTR-015
type: Contract
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T14:03:12.677Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: .sdd/config.json — optional `partitions` block (extension to CTR-003)
applicability:
  invariant_to_all_axes: true
schema:
  json:
    partitions:
      type: object | absent
      keys: <partition-name> matching ^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*$
            (one or more lowercase tokens joined by ':'; single-segment
            remains the default and is preserved from v0.2.0)
      values:
        spec_paths:
          type: array of string (glob patterns, posix-separated)
          domain: non-empty when the partition is present
        test_paths:
          type: array of string (glob patterns, posix-separated)
          domain: 0..N entries
          default_when_absent: []
        sandbox_paths:
          type: array of string (glob patterns, posix-separated)
          domain: 0..N entries
          default_when_absent: []
    test_paths:
      type: array of string (glob patterns) | absent
      domain: 0..N entries
      default_when_absent: []
      semantics: top-level shorthand applied to the synthesized
                 single-partition fallback when `partitions` is absent
    sandbox_paths:
      type: array of string (glob patterns) | absent
      domain: 0..N entries
      default_when_absent: []
      semantics: top-level shorthand applied to the synthesized
                 single-partition fallback when `partitions` is absent
external_identifiers:
  - '"partitions" top-level key'
  - 'per-partition keys: "spec_paths", "test_paths", "sandbox_paths"'
  - 'top-level shorthand keys: "test_paths", "sandbox_paths"'
preconditions:
  - all other CTR-003 fields still validate
  - "if `partitions` is present, ready / lint read spec_paths from `partitions[*].spec_paths` (flatten + dedupe); legacy `lint.spec_files` is ignored"
  - "if `partitions` is absent, the configuration synthesizes a single-partition fallback using `lint.spec_files` (or `[spec_file]`), top-level `test_paths`, and top-level `sandbox_paths`"
postconditions:
  - "when `partitions` is absent, single-partition fallback preserves v0.1.0/v0.2.0 behaviour (zero change for existing repos)"
error_taxonomy:
  - '"config-invalid" with detail naming offending `partitions[*].*` field'
compatibility_rules:
  - "`partitions` key is additive at minor (was absent in v0.2.0)"
  - sub-keys append-only
  - "top-level `test_paths` / `sandbox_paths` shorthand additive at minor"
  - "removing `partitions` from a v0.3.0+ config falls back to the flat shorthand (graceful degradation when only one partition exists)"
  - 'multi-segment partition keys (e.g. "bridge:commands") additive at minor relative to the v0.2.0 single-segment shape; no v0.2.0 key is rejected by the widened pattern'
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: not_applicable
  time_source: none
data_scope: all_data
policy_refs:
  - sdd-cli:POL-001
  - sdd-cli:POL-002
test_obligations:
  - to:sdd-cli:CTR-015:absent_falls_back_to_flat
  - to:sdd-cli:CTR-015:explicit_partitions_used
  - to:sdd-cli:CTR-015:invalid_subkey_rejected
  - to:sdd-cli:CTR-015:cross_partition_no_implicit_credit
  - to:sdd-cli:CTR-015:multi_segment_partition_key_accepted
---
```

---

## 8. Invariants

```yaml
---
id: sdd-cli:INV-001
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: token determinism
always: |
  For any commit C and any discovery_scope S, the value of
    token = sha256(stdout_bytes_of(`git ls-tree C -- S`))
  is identical across invocations of `sdd token` against the same
  HEAD == C, same S, same git binary version family, on a scope-clean
  working tree.
scope: sdd-cli/cli + sdd-cli/json-output
evidence: public_api
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: multi_per_resource    # parallel invocations against same repo are supported
  read_consistency: strong
  idempotency: "at_least_once_with_key:(commit_sha,scope)"
  time_source: none
negative_cases:
  - reordering scope entries that resolve to the same path set
    MUST NOT change the token (git ls-tree canonicalises by name)
out_of_scope:
  - tokens across major git versions
test_obligation:
  predicate: |
    Two invocations on the same HEAD with the same scope produce equal
    tokens. An out-of-scope-only commit between them does not change
    the token. A scope-touching commit changes the token.
  test_template: unit
  boundary_classes:
    - identical reruns
    - out-of-scope edits between runs
    - scope-touching edits between runs
  failure_scenarios:
    - token differs across reruns on identical state
---
```

```yaml
---
id: sdd-cli:INV-002
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: spec.md and config.json are read-only
never: |
  No CLI invocation writes to <spec_file>, <repo_root>/.sdd/config.json,
  or any file under <repo_root>/.git/. The CLI's only outputs are
  stdout and stderr.
scope: sdd-cli (entire CLI)
evidence: public_api
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: multi_per_resource
  read_consistency: strong
  idempotency: none
  time_source: none
negative_cases:
  - SDD §0 forbids auto-rewrite of normative spec content
out_of_scope:
  - hypothetical future `sdd apply` command (not in v1; §18)
test_obligation:
  predicate: |
    After every BEH-001..010 run, mtime/inode/size of <spec_file>,
    .sdd/config.json, and .git/* are unchanged.
  test_template: integration
  boundary_classes:
    - each BEH path × each --format mode
  failure_scenarios:
    - any byte of spec_file changes
---
```

```yaml
---
id: sdd-cli:INV-003
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: token mechanism is git_tree_hash_v1
always: |
  Every emitted token is computed via the algorithm declared in §11
  (git_tree_hash_v1). The string `mechanism` in CTR-004 / CTR-005
  output equals "git_tree_hash_v1".
scope: sdd-cli/json-output
evidence: public_api
stability: contractual
data_scope:
  not_applicable: mechanism_is_a_label_not_runtime_state
  reason: it identifies the algorithm, not data shape
applicability:
  invariant_to_all_axes: true
test_obligation:
  predicate: every JSON output for token / check carries mechanism = "git_tree_hash_v1".
  test_template: contract
  boundary_classes: [token success, check match, check mismatch]
  failure_scenarios: [mechanism field absent or other value]
---
```

```yaml
---
id: sdd-cli:INV-004
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
title: vertical-slice hexagonal boundaries
never: |
  The source tree MUST NOT contain any of these top-level layer
  folders: src/domain, src/ports, src/adapters, src/commands.
  Feature implementation lives under src/features/<feature>/ with
  local domain, application, ports, and adapters folders. Cross-feature
  imports are forbidden. Shared code lives only under src/shared/domain
  and contains no use-case orchestration.
scope: src/ tree at build time
evidence: test_probe
stability: internal
data_scope:
  not_applicable: layer_invariant_is_static_property_of_source_tree
  reason: enforced at lint/test time over import graph, not runtime state
applicability:
  invariant_to_all_axes: true
test_obligation:
  predicate: |
    A static-import test scans every *.ts under src/features and
    src/shared/domain and asserts:
      - top-level src/domain, src/ports, src/adapters, src/commands do
        not exist
      - feature domain files import only same-feature domain files and
        src/shared/domain
      - feature application files import only same-feature domain,
        same-feature ports, and src/shared/domain
      - feature ports import only same-feature domain and
        src/shared/domain
      - feature adapters import only same-feature ports,
        same-feature application, src/shared/domain, and runtime
        adapters' external dependencies
      - src/shared/domain imports no feature path and no node:* module,
        except node:crypto inside src/shared/domain/Token.ts
  test_template: unit
  boundary_classes:
    - token feature slice
    - check feature slice
    - refresh feature slice
    - shared domain
  failure_scenarios:
    - cross-feature import
    - global layer folder reintroduced
    - domain file imports node:fs
---
```

```yaml
---
id: sdd-cli:INV-005
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T14:03:12.530Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd approve refuses agent identities (self-approval ban)
always: |
  For any invocation of `sdd approve`, if --approver, after lower-casing,
  is an element of BUILTIN_AGENT_BLOCKLIST OR starts with "bot:" OR is
  in `.sdd/config.json#lint.approver_blocklist`, the process exits 1
  with reason "agent-approver" AND no spec file is read for rewriting
  AND no file is written.
scope:
  - src/features/approve/domain/ApproveRequest.ts (BUILTIN_AGENT_BLOCKLIST + classifyRefusal)
  - src/features/approve/application/ApplyApproval.ts (early-refusal gate)
  - src/features/approve/adapters/inbound/CliApproveHandler.ts (refusalResult)
evidence: public_api
stability: contractual
data_scope:
  not_applicable: refused_before_any_data_read
  reason: identity check is the first gate; no spec file is touched on refusal
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: not_applicable
  idempotency: not_applicable
  time_source: none
negative_cases:
  - case-sensitive comparison would let "Claude" through
  - blocklist consulted after writeFileSync (file mutation precedes refusal)
  - bot: prefix check missing
test_obligation:
  predicate: |
    For each blocked identity (every BUILTIN_AGENT_BLOCKLIST entry,
    "bot:foo" for at least one foo, and at least one custom blocklist
    member supplied via .sdd/config.json), `sdd approve --approver <id> ...`
    exits 1 reason agent-approver AND the working tree is byte-identical
    before and after the run.
  test_template: integration (with fs-readonly assertion)
  boundary_classes:
    - exact match (lowercase)
    - exact match (mixed case "Claude")
    - bot:foo
    - custom blocklist
    - empty string and whitespace-only (edge cases)
  failure_scenarios:
    - '"Claude" passes through'
    - '"BOT:tg-1" passes through (case sensitivity in prefix check)'
    - blocklist short-circuit happens after rewrite
---
```

```yaml
---
id: sdd-cli:INV-006
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T14:03:12.577Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd lint is read-only on consumer spec files
always: |
  For any invocation of `sdd lint`, no file under `lint.spec_files` is
  modified. The working tree is byte-identical before and after the run,
  regardless of how many diagnostics are produced.
scope:
  - src/features/lint/**
evidence: test_probe
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: not_applicable
  time_source: none
negative_cases:
  - lint adds an `Open-Q` block to the spec on stale-baseline detection
  - lint normalises whitespace in the spec
test_obligation:
  predicate: |
    A snapshot of every file under lint.spec_files (mtime + content sha)
    taken before `sdd lint` is identical to the snapshot taken after,
    in both happy-path and rule-violating fixtures.
  test_template: integration (fs-readonly probe)
  boundary_classes:
    - 0 diagnostics
    - "≥1 error diagnostics"
    - mixed warn + error
  failure_scenarios:
    - lint silently rewrites whitespace
    - lint emits Open-Q stubs into the spec
---
```

```yaml
---
id: sdd-cli:INV-007
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:09.273Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd approve atomic per record — status flip implies approval_record
always: |
  For every record rewritten by `sdd approve`:
  if `lifecycle.status` is set to one of {approved, deprecated, removed},
  the same record's `approval_record` is set to a multi-line block in
  the same write. Conversely: a record's `approval_record` is never
  set without a matching `lifecycle.status` flip in the same run.
scope:
  - src/features/approve/domain/Rewrite.ts
evidence: public_api
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: none
  time_source: wall_clock:1ms
negative_cases:
  - lifecycle.status flipped without approval_record (would land
    spec-invalid; see SDD §7.5)
  - approval_record written without lifecycle.status flip (would leave
    a "secretly-approved proposed" record)
test_obligation:
  predicate: |
    For every fixture record with status `proposed`, in both input
    shapes — (a) placeholder `approval_record:
    not_applicable_for_proposed` present, and (b) no `approval_record`
    field at all (SDD §7.6-conformant) — and in both YAML key shapes —
    (i) flat `lifecycle.status: …`, and (ii) nested
    `lifecycle:\n  status: …` (the canonical brownfield form used in
    sdd-cli's own spec.md) — after `sdd approve`:
      - the record's status field reads ∈ {approved, deprecated, removed}
      - `approval_record` parses as a YAML mapping with the six fields
        owner_role, approver_identity, timestamp, change_request, scope
        (+ optional reviewed_test_oracle), placed contiguously with the
        flipped status field at the same indent family.
    Both invariants are checked together; failure of either fails the
    record. The atomicity contract is independent of the YAML key shape.
  test_template: integration (golden fixture + parsed assertions)
  boundary_classes:
    - exact id match
    - glob match (multiple records in one file rewritten as one batch)
    - reviewed_test_oracle present
    - input record has no approval_record field
      (SDD §7.6-conformant proposed input)
    - flat `lifecycle.status:` form (compact YAML)
    - nested `lifecycle:\n  status:` form (canonical brownfield)
  failure_scenarios:
    - status flip emitted without approval_record block
    - approval_record block emitted without status flip
    - approval_record absent from input and not inserted on rewrite
      (regression of the lift-and-flip bug fixed in v0.2.x)
    - nested lifecycle form silently no-ops
      (regression of the rewriter scoping its anchor to flat form only)
---
```

```yaml
---
id: sdd-cli:INV-008
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.891Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd ready does not execute tests
never: |
  No invocation of `sdd ready` spawns a test runner, executes test
  binaries, evaluates expressions inside test files, or otherwise
  interprets test code beyond byte-level scanning for `@covers`
  markers. The CLI's only file IO on `partitions[*].test_paths` is
  a read of bytes for marker extraction.
scope:
  - src/features/ready/**
evidence: public_api
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: not_applicable
  time_source: none
negative_cases:
  - ready spawns `npm test` as a side effect of evaluating
    `uncovered`/`orphan_covers`
  - ready imports a test file via `require()` / `import()` and
    triggers side-effects
  - ready uses an AST parser instead of byte scanning
out_of_scope:
  - hypothetical future `sdd run` (not in v0.3.0; §19)
test_obligation:
  predicate: |
    During every `sdd ready` invocation, no child process is
    spawned other than `git` (used by aggregated `check`). No file
    under `partitions[*].test_paths` is opened with anything but
    a byte-level read — verified by an integration test that
    points `test_paths` at a deliberately-broken JS/TS file and
    asserts ready completes without surfacing the throw that an
    `import()` would produce.
  test_template: integration
  boundary_classes:
    - test_paths matches a deliberately-broken JS/TS file
    - test_paths matches a binary file
    - test_paths matches an empty file
  failure_scenarios:
    - ready spawns a test runner
    - ready interprets a test file via `require()` / `import()`
---
```

```yaml
---
id: sdd-cli:INV-009
type: Invariant
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.940Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: sdd ready is read-only on the working tree
always: |
  For every invocation of `sdd ready`, no file under <repo_root>
  is modified. The working tree is byte-identical before and after
  the run, regardless of how many violations are produced or
  whether evaluation succeeded.
scope:
  - src/features/ready/**
evidence: test_probe
stability: contractual
data_scope: all_data
applicability:
  invariant_to_all_axes: true
concurrency_model:
  actor_concurrency: single_per_process
  read_consistency: strong
  idempotency: not_applicable
  time_source: none
negative_cases:
  - ready emits an Open-Q stub into spec.md on aggregated_lint
  - ready normalises whitespace in scanned test files
  - ready creates a `.sdd/cache` directory between runs
test_obligation:
  predicate: |
    A snapshot of every tracked file in the repo (mtime + content
    sha) taken before `sdd ready` is identical to the snapshot
    taken after, in happy-path, violation-path, and
    evaluate-failure fixtures.
  test_template: integration (fs-readonly probe)
  boundary_classes:
    - exit 0 (no violations)
    - exit 1 (≥1 violation)
    - exit 2 (evaluate-failure)
  failure_scenarios:
    - ready writes a marker into a test file
    - ready emits a stub into spec.md
    - ready creates any new file under <repo_root>
---
```

---

## 9. External dependencies

```yaml
---
id: sdd-cli:EXT-001
type: ExternalDependency
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
provider: git (cli binary)
provider_surface: "git@>=2.30"
authority_url_or_doc: "https://git-scm.com/docs"
consumer_contract:
  invocations:
    - cmd: "git diff --quiet HEAD -- <pathspec...>"
      expects:
        - exit 0  => clean
        - exit 1  => dirty
    - cmd: "git ls-tree HEAD -- <pathspec...>"
      expects:
        - exit 0; stdout = canonical mode/type/hash/path entries
    - cmd: "git rev-parse HEAD"
      expects:
        - exit 0; stdout = 40-char lowercase hex
    - cmd: "git rev-parse --is-inside-work-tree"
      expects:
        - exit 0 + "true"  => inside repo (BEH-001 path)
        - non-zero         => env error (BEH-010)
    - cmd: "git diff --name-only <baseline_sha>..HEAD -- <pathspec...>"
      expects:
        - exit 0; stdout = newline-separated paths (BEH-006 path)
    - cmd: "git status --porcelain -- <pathspec...>"
      expects:
        - exit 0; lines describe uncommitted scope changes (BEH-006 dirty branch)
drift_detection:
  mechanism: contract_test_against_sandbox
  artefact: tests/integration/e2e.test.ts
last_verified_at: 2026-04-29
auth_scope:
  not_applicable: local_binary_no_auth
  reason: git is invoked locally on user files; no remote auth
rate_limits:
  not_applicable: local_binary_no_rate_limit
  reason: same as above
retry/idempotency:
  not_applicable: read_only_invocations
  reason: every invocation listed is a read; failures bubble up to env error
error_taxonomy:
  - non-zero exit on `git rev-parse` => BEH-010 env error
  - non-zero exit on `git diff --quiet` => BEH-002 dirty signal (1) or BEH-010 (other)
sandbox_or_fixture:
  - tests/integration/e2e.test.ts spins a tmp git repo per test
test_obligation:
  predicate: |
    Each invocation form above is exercised in tests/integration with a
    real git binary on PATH; the consumer parses output exactly as
    described.
  test_template: integration
  boundary_classes: [each cmd entry]
  failure_scenarios:
    - git output format changes => contract test reds
---
```

```yaml
---
id: sdd-cli:EXT-002
type: ExternalDependency
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
provider: yaml (npm package by Eemeli Aro)
provider_surface: "yaml@^2"
authority_url_or_doc: "https://eemeli.org/yaml/v2/"
consumer_contract:
  surface_used:
    - parseDocument(string): Document
    - Document.toJS(): unknown
  expectations:
    - YAML 1.2 by default; we do not rely on YAML 1.1 quirks
    - parseDocument accepts a single document; the spec scanner splits
      on `^---$` before handing each block to parseDocument
drift_detection:
  mechanism: changelog_watcher
  artefact: package.json `^2` range; review notes on minor bumps
last_verified_at: 2026-04-29
auth_scope:
  not_applicable: pure_library_no_network
  reason: parser only
rate_limits:
  not_applicable: pure_library_no_network
  reason: same
retry/idempotency:
  not_applicable: pure_library
  reason: deterministic parse
error_taxonomy:
  - parse error on a block => BEH-009 config error path mapping to spec
sandbox_or_fixture:
  - tests/fixtures/spec.simple.md
  - tests/fixtures/spec.with-imps.md
test_obligation:
  predicate: |
    Parsing spec.with-imps.md returns the expected ID-keyed map and
    the expected IMP-* count.
  test_template: unit
  boundary_classes:
    - well-formed block
    - malformed block (single-block fixture)
  failure_scenarios:
    - parser silently swallows a malformed block
---
```

---

## 10. Generated artifacts

```yaml
---
id: sdd-cli:GEN-001
type: GeneratedArtifact
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: dist/ build via tsc
source_ids:
  - sdd-cli:SUR-001
  - sdd-cli:SUR-002
  - sdd-cli:SUR-003
  - sdd-cli:SUR-004
  - sdd-cli:SUR-005
generator: tsc
generator_version: typescript@^5
command: "npm run build"
output_paths:
  - dist/**/*.js
  - dist/**/*.d.ts
regeneration_mode: clean
published_surface: no
notes: |
  v1 ships consumed via local path / npm pack only. published_surface
  becomes `yes` when SUR-005 is actually published to a registry; that
  transition is a separate Surface bump.
test_obligation:
  predicate: |
    `npm run build` produces a dist/cli.js with the documented shebang
    and `node dist/cli.js --help` exits 0.
  test_template: integration
  boundary_classes: [fresh build, rebuild after no source change]
  failure_scenarios: [shebang missing, types/d.ts missing]
---
```

---

## 11. Localization

`LocalizationContract` — `not_applicable: english_only_cli`. Reason: v1
exposes only English diagnostic and help text on stderr; no boundary
error messages are part of contract (errors are identified by the
exit-code taxonomy CTR-002 + machine-readable `reason` strings, never
by free text). When a future release adds localized output, that change
will land as a new `LocalizationContract` ID with `text_is_contract:
yes` for any error code whose text downstream parsers depend on.

---

## 12. Policies

```yaml
---
id: sdd-cli:POL-001
type: Policy
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: filesystem read-only outside stdout/stderr
policy_kind: io_scope
applicability:
  applies_to: every Behavior in §6 and every Contract in §7
predicate: |
  The CLI's process MUST NOT open any file under <repo_root> for write
  during any invocation. Allowed write sinks are stdout and stderr.
  Allowed read sinks are <repo_root>/.sdd/config.json,
  <repo_root>/<config.spec_file>, and any path resolved by git
  (read-only invocations only — see EXT-001).
negative_test_obligations:
  - run each BEH-001..010 path while monitoring open(2) syscalls (or
    equivalent fs probe); assert no write-mode opens against any path
    inside <repo_root>
  - run each BEH path with <repo_root>/.sdd/config.json on a read-only
    filesystem; assert the CLI still completes (read-only access is
    enough)
test_obligation:
  predicate: same as negative_test_obligations
  test_template: integration
  boundary_classes: [each BEH path]
  failure_scenarios: [any write-mode open against a repo path]
---
```

```yaml
---
id: sdd-cli:POL-002
type: Policy
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
title: git operations are read-only
policy_kind: io_scope
applicability:
  applies_to: every Behavior in §6 that invokes git
predicate: |
  The CLI MUST invoke only the git subcommands enumerated in EXT-001
  (diff --quiet, ls-tree, rev-parse, status --porcelain, diff
  --name-only). It MUST NOT invoke any state-mutating subcommand
  (commit, checkout, fetch, push, reset, clean, gc, prune, add,
  branch -d/D, tag, stash apply/drop, worktree add/remove).
negative_test_obligations:
  - mock-shim git binary that records argv; assert the recorded set is
    a subset of the EXT-001 allowed list across every BEH path
test_obligation:
  predicate: same as negative_test_obligations
  test_template: integration
  boundary_classes: [each BEH path]
  failure_scenarios: [a state-mutating git subcommand is invoked]
---
```

---

## 13. Constraints

```yaml
---
id: sdd-cli:CST-001
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
constraint: Node runtime must be >= 20 (engines.node = ">=20")
rationale: |
  Aligns with the user's existing pipeline-driver stack; needed for
  modern node:test, top-level await in ESM, and stable `node --import`.
test_obligation:
  predicate: |
    package.json#engines.node equals ">=20" verbatim. Any runtime drift
    (e.g. ">=18" or removal of the engines block) fails the test.
  test_template: contract
  boundary_classes:
    - canonical package.json
  failure_scenarios:
    - engines.node missing
    - engines.node downgraded to a value that does not include 20
---
```

```yaml
---
id: sdd-cli:CST-002
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
constraint: |
  Source language is TypeScript with module: NodeNext, target: ES2022,
  declaration: true, outDir: dist. Package type: module.
rationale: |
  Matches user's existing TS stack; ESM is the modern Node default;
  declaration files are required for SUR-005 published_surface=yes
  later.
test_obligation:
  predicate: |
    tsconfig.json#compilerOptions has module="NodeNext", target="ES2022",
    declaration=true, outDir="dist"; package.json#type equals "module".
  test_template: contract
  boundary_classes:
    - canonical tsconfig + package.json
  failure_scenarios:
    - any compilerOptions field drifts off the four pinned values
    - package.json#type is removed or set to "commonjs"
---
```

```yaml
---
id: sdd-cli:CST-003
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
constraint: |
  Source layout follows Vertical Slice + Hexagonal architecture:

  src/
    cli.ts
    features/
      token/
        domain/
        application/
        ports/inbound/
        ports/outbound/
        adapters/inbound/
        adapters/outbound/
      check/
        domain/
        application/
        ports/inbound/
        ports/outbound/
        adapters/inbound/
        adapters/outbound/
      refresh/
        domain/
        application/
        ports/inbound/
        ports/outbound/
        adapters/inbound/
        adapters/outbound/
      shared/
        domain/

  Dependency direction inside each feature is adapters -> ports ->
  application -> domain. Feature slices MUST NOT import another
  feature slice. Cross-feature primitives live in src/shared/domain.
  The tree MUST NOT contain global layer folders src/domain, src/ports,
  src/adapters, or src/commands.
rationale: |
  Matches the user's existing pipeline-driver discipline; enforced
  mechanically by INV-004.
test_obligations:
  - to:sdd-cli:INV-004
---
```

```yaml
---
id: sdd-cli:CST-004
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
constraint: |
  YAML parsing MUST go through the npm package `yaml` (Eemeli Aro,
  ^2.x). No hand-rolled YAML parser, no js-yaml.
rationale: |
  Single, audited, widely used dependency; spec-fidelity to YAML 1.2;
  pinned in EXT-002.
test_obligation:
  predicate: |
    package.json#dependencies."yaml" matches "^2"; neither `dependencies`
    nor `devDependencies` mention `js-yaml`.
  test_template: contract
  boundary_classes:
    - canonical package.json
  failure_scenarios:
    - yaml downgraded below ^2 or removed
    - js-yaml introduced as a runtime or dev dependency
---
```

```yaml
---
id: sdd-cli:CST-005
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
constraint: |
  v1 mechanism is fixed at "git_tree_hash_v1". The mechanism field of
  CTR-003 is a closed enum with this single value. Other mechanisms
  (sha256_of_concat, git_tag_based) are reserved but not implemented;
  introducing one is a major bump on SUR-002 (config schema).
rationale: |
  Keeps v1 narrow per PLAN.md §Out of scope.
test_obligation:
  predicate: |
    schema/sdd.config.schema.json#properties.mechanism.enum equals
    ["git_tree_hash_v1"] (exactly one element).
  test_template: contract
  boundary_classes:
    - canonical schema file
  failure_scenarios:
    - additional mechanism value silently added to the enum
    - mechanism property removed or made non-required
---
```

```yaml
---
id: sdd-cli:CST-006
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:09.322Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
constraint: |
  The glob expander used by `sdd lint` and `sdd approve` MUST be a
  hand-rolled implementation supporting only `*` (any chars within a
  segment), `?` (single char within a segment), `**` (zero-or-more
  directory levels), and literal segments. The runtime dependency tree
  MUST NOT contain any third-party glob library; the only runtime
  dependency in v0.2.0 stays the same as in v0.1.0 (`yaml`).
rationale: |
  EXT-001 narrows the dependency footprint to git + node-stdlib + yaml.
  Adding a glob library widens the supply-chain attack surface for a
  trivially expressible feature. Path-sensitive consumers (specs are
  user-supplied repos) reject opaque glob behaviour.
scope:
  - src/features/lint/adapters/outbound/NodeLintFileReader.ts
  - src/features/approve/adapters/outbound/NodeApproveFileSystem.ts
test_obligation:
  predicate: |
    `package.json` dependencies after v0.2.0 build is exactly
    {"yaml": "^2.7.0"}. None of {glob, picomatch, minimatch, fast-glob,
    globby} appear anywhere in the runtime dependency tree
    (devDependencies excluded).
  test_template: integration (npm ls + assert)
  failure_scenarios:
    - a transitive dep introduces a glob library
    - the source imports `glob` / `minimatch` / `picomatch`
---
```

```yaml
---
id: sdd-cli:CST-007
type: Constraint
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:13.990Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
constraint: |
  `sdd ready` recognises traceability markers of the form
    @covers <partition>:<id> [<key>=<value>]*
  where:
    - <partition> matches ^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*$
      (one or more lowercase tokens joined by ':'; single-segment
      remains the default and is preserved bit-for-bit from v0.2.0)
    - <id> matches ^[A-Z]+-\d+$
    - <key>=<value> tail tokens are split on the first `=` per
      whitespace-separated token; tokens whose key is not in the
      v0.3.0 whitelist {`compatibility_action`} are silently ignored
      (forward-compat for future v0.x keys; see OQ-016).
  Parsing is two-stage to avoid the JS/TS regex foot-gun where a
  single capture group with `*` keeps only the last match:
    stage 1 — /@covers\s+([a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)*:[A-Z]+-\d+)([^\n\r]*)/g
              captures <partition>:<id> as a single group and the raw
              tail. Partition and id are split at the LAST `:` of the
              capture (rightmost-`:` is unambiguous because the id
              tail `[A-Z]+-\d+` contains no `:` — implementation MUST
              use `lastIndexOf(":")`, not `indexOf(":")`).
    stage 2 — tokenise the tail by whitespace, split each token on
              first `=`, filter by the whitelist.
  The scanner is language-agnostic: it reads bytes from files
  matched by `partitions[*].test_paths` with no AST or syntax
  awareness. Adopters in TS, Py, Go, and Rust all work the same way.
rationale: |
  Markers must remain greppable, IDE-friendly, and stable across
  consumer languages. AST scanning would force per-language tooling
  and add supply-chain surface (one parser per ecosystem). The
  per-key whitelist keeps the v0.3.0 contract narrow while leaving
  room to grow without breaking older specs. The multi-segment
  partition grammar is a strict superset of v0.2.0: every v0.2.0-
  valid marker remains valid; single-segment adopters see byte-
  identical scanner output. Multi-segment support unblocks adopters
  that namespace their partitions (e.g. `bridge:commands:CON-004`).
scope:
  - src/features/ready/domain/MarkerParser.ts
test_obligation:
  predicate: |
    For every test file under `partitions[*].test_paths`, every
    `@covers <p>:<id> [k=v ...]` line is detected; partitions/IDs
    that do not match the documented charset are not detected; tail
    tokens with keys outside the v0.3.0 whitelist do not contribute
    to the parsed marker tail; multiple markers on the same line
    are detected. The single-capture-group regex foot-gun is
    explicitly ruled out by a test with three `key=value` pairs in
    one tail. Multi-segment partition prefixes are split at the
    rightmost `:` so that `@covers bridge:lock:BEH-001` yields
    partition=`bridge:lock`, id=`BEH-001`.
  test_template: unit
  boundary_classes:
    - happy-path single marker
    - multiple markers per line
    - mixed allowed / disallowed key in tail
    - multiple `key=value` pairs in single tail (regex foot-gun probe)
    - non-matching partition / ID charset
    - single-segment partition (legacy form regression)
    - two-segment partition prefix
    - three-segment partition prefix (forward-compat)
  failure_scenarios:
    - regex captures only the last `key=value` pair
    - whitelisted key silently dropped
    - non-whitelisted key surfaces in parsed tail
    - near-miss with uppercase in partition prefix is silently skipped (OQ-017 default a)
---
```

---

## 14. Migrations

`Migration` — `not_applicable: greenfield_no_data_at_rest`. Reason:
`sdd-cli` is a stateless CLI. No persistent data shape evolves across
runs. The only persistent state the CLI reads (the consumer repo's
`spec.md` and `.sdd/config.json`) is owned by the consumer's spec
governance, not by `sdd-cli` itself. Future addition of an
`sdd cache` or `sdd init` (out of scope, §18) would introduce
Migrations.

---

## 15. Deltas

`Delta` — for v1.0.0 the section was `not_applicable:
greenfield_no_baseline_to_delta_against`. v0.2.0 introduces the first
behavioural extension; recorded below.

```yaml
---
id: sdd-cli:DLT-001
type: Delta
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T14:03:12.626Z
    change_request: approve sdd-cli v0.2.0 lint+approve surfaces (DLT-001 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: v0.1.0 → v0.2.0 — add `sdd lint` and `sdd approve` subcommands
target_ids:
  - sdd-cli:SUR-006   # new — sdd-cli/lint
  - sdd-cli:SUR-007   # new — sdd-cli/approve
  - sdd-cli:BEH-011
  - sdd-cli:BEH-012
  - sdd-cli:BEH-013
  - sdd-cli:BEH-014
  - sdd-cli:BEH-015
  - sdd-cli:BEH-016
  - sdd-cli:CTR-008
  - sdd-cli:CTR-009
  - sdd-cli:CTR-010
  - sdd-cli:CTR-011
  - sdd-cli:CTR-012   # new lint block in .sdd/config.json (extends CTR-003)
  - sdd-cli:INV-005
  - sdd-cli:INV-006
  - sdd-cli:INV-007
  - sdd-cli:CST-006
kind: replace
compatibility_action: ignore
baseline_version: sdd-cli:BL-001@v0.1.0
description: |
  Adds two new CLI subcommands without altering existing token/check/
  refresh behaviour. The v0.1.0 surfaces (SUR-001..SUR-005) are unchanged.
  A new `lint` block is added to `.sdd/config.json`; absence of the block
  preserves v0.1.0 behaviour (graceful degradation per CTR-012).

  The change is purely additive at every Surface; existing v0.1.0
  consumers see identical behaviour.
tests_old_behavior:
  - existing token/check/refresh integration tests stay green (no behavioural
    regression in the v0.1.0 surface)
  - existing argv unit tests stay green (v0.1.0 flag set is preserved)
tests_new_behavior:
  - to:sdd-cli:BEH-011
  - to:sdd-cli:BEH-012
  - to:sdd-cli:BEH-013
  - to:sdd-cli:BEH-014
  - to:sdd-cli:BEH-015
  - to:sdd-cli:BEH-016
  - to:sdd-cli:INV-005
  - to:sdd-cli:INV-006
  - to:sdd-cli:INV-007
caveats:
  - "BL-001's `freshness_token` is stale w.r.t. the v0.2.0 source tree (added ~20 files under src/features/{lint,approve}/). A separate `sdd refresh` run is required to regenerate the token; this Delta documents the intent of the change but does not itself update BL-001 (per SDD §6.5: a Delta authoring is allowed against a pinned baseline_version even when the baseline is stale)."
  - "v0.2.0 was released without an `approval_record` on these IDs. Approval is the human owner's gate (SDD §7.5). Until approved the IDs are `proposed` and not `implementation-valid`."
---
```

```yaml
---
id: sdd-cli:DLT-002
type: Delta
lifecycle:
  status: approved
  approval_record:
    owner_role: tech-lead
    approver_identity: cyberash
    timestamp: 2026-05-01T13:52:14.040Z
    change_request: approve sdd-cli v0.3.0 ready surface incl. multi-segment partition prefix grammar (DLT-002 cohort)
    scope: first-time-approval
partition_id: sdd-cli
title: v0.2.0 → v0.3.0 — add `sdd ready` (gate-3 implementation-valid)
target_ids:
  - sdd-cli:SUR-008    # new — sdd-cli/ready
  - sdd-cli:BEH-017
  - sdd-cli:BEH-018
  - sdd-cli:BEH-019
  - sdd-cli:BEH-020
  - sdd-cli:CTR-013
  - sdd-cli:CTR-014
  - sdd-cli:CTR-015    # extension to CTR-003 (partitions block)
  - sdd-cli:INV-008
  - sdd-cli:INV-009
  - sdd-cli:CST-007
kind: replace
compatibility_action: ignore
baseline_version: sdd-cli:BL-001@v0.2.0
description: |
  Adds one new CLI subcommand (`sdd ready`) without altering existing
  token/check/refresh/lint/approve behaviour. The v0.1.0 surfaces
  (SUR-001..SUR-005) and v0.2.0 surfaces (SUR-006, SUR-007) are
  unchanged. A new optional `partitions` block is added to
  `.sdd/config.json`; absence of the block preserves v0.2.0
  behaviour (graceful degradation per CTR-015).

  `sdd ready` is a strict superset of `sdd lint` and `sdd check`:
  internally it reuses the same parsing/check engine (lifted into
  `src/shared/domain/` for cross-slice reuse), but externally it is
  the single authoritative command CI calls. Adding it as a required
  check in protected-branch policy is sufficient to close the gate-3
  (implementation-valid) hole described in SDD §three gates: every
  `approved`/`deprecated` normative ID must have ≥1 executable test
  with `@covers <partition>:<id>`, every `removed` ID must have a
  `compatibility_action=…` test, no `proposed`/`draft` ID may exist
  outside `sandbox_paths`, and aggregated `lint`/`check` blockers
  (unresolved `Open-Q.blocking=yes`, weasel-words, missing
  `approval_record`, stale `freshness_token`) surface under the
  same envelope.

  v0.3.0 also widens the partition-prefix grammar in CST-007 (and the
  partition-name pattern in CTR-015) from one to one-or-more colon-
  separated lowercase segments. Single-segment adopters (sdd-cli
  itself) see byte-identical behaviour because `lastIndexOf(":")` on
  a one-colon string equals `indexOf(":")`. Multi-segment adopters
  (e.g. gatehouse) gain credit on existing
  `@covers <a>:<b>:<TYPE>-<NNN>` markers as soon as the corresponding
  `partitions["<a>:<b>"]` entry is declared in `.sdd/config.json`.

  The change is purely additive at every Surface; existing v0.2.0
  consumers see identical behaviour.
tests_old_behavior:
  - existing token/check/refresh/lint/approve integration tests stay
    green (no behavioural regression in the v0.1.0 / v0.2.0
    surfaces)
  - existing argv unit tests stay green (v0.2.0 flag set is preserved)
  - existing fs-readonly probe stays green for the new `sdd ready`
    invocation path (extends to INV-009)
tests_new_behavior:
  - to:sdd-cli:BEH-017
  - to:sdd-cli:BEH-018
  - to:sdd-cli:BEH-019
  - to:sdd-cli:BEH-020
  - to:sdd-cli:INV-008
  - to:sdd-cli:INV-009
  - to:sdd-cli:CST-007
caveats:
  - BL-001's `freshness_token` is stale w.r.t. the v0.3.0 source
    tree (added ~10 files under src/features/ready/ and a small lift
    of pure-domain code from src/features/lint/ + src/features/check/
    into src/shared/domain/). A separate `sdd refresh` run is
    required to regenerate the token; this Delta documents the
    intent of the change but does not itself update BL-001 (per
    SDD §6.5).
  - v0.3.0 ships these IDs in `proposed` status. Approval is the
    human owner's gate (SDD §7.5). Until approved the IDs are
    `proposed` and not `implementation-valid`.
  - The lifted shared-kernel modules (SpecRecord, LintRules,
    CheckOutcome) preserve identical observable behaviour for `sdd
    lint` and `sdd check`. Re-export shims remain in the original
    slices for backward compatibility within this PR; future PRs
    may inline the shared-kernel imports and delete the shims.
  - README gains the verbatim "verifies traceability presence, not
    test fidelity" clause from the v0.3.0 design committee
    transcript. README content is not normatively spec-tracked, so
    this is documented here rather than as a separate normative ID.
---
```

---

## 16. Implementation bindings

```yaml
---
id: sdd-cli:IMP-001
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:BEH-001
  - sdd-cli:BEH-002
  - sdd-cli:BEH-003
  - sdd-cli:BEH-004
  - sdd-cli:BEH-005
  - sdd-cli:BEH-006
  - sdd-cli:BEH-007
  - sdd-cli:BEH-008
  - sdd-cli:BEH-009
  - sdd-cli:BEH-010
  - sdd-cli:CTR-001
  - sdd-cli:CTR-002
binding:
  composition_root: src/cli.ts
  inbound_adapters:
    token: src/features/token/adapters/inbound/CliTokenHandler.ts
    check: src/features/check/adapters/inbound/CliCheckHandler.ts
    refresh: src/features/refresh/adapters/inbound/CliRefreshHandler.ts
authority: code_annotation
verification_method: |
  Each BEH-* test asserts the corresponding exit code path is reached
  via the `sdd` binary entrypoint and then dispatched into the owning
  feature inbound adapter.
---
```

```yaml
---
id: sdd-cli:IMP-002
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids: [sdd-cli:BEH-001, sdd-cli:BEH-002]
binding:
  feature_slice:
    root: src/features/token
    inbound_port: src/features/token/ports/inbound/TokenCommand.ts
    inbound_adapter: src/features/token/adapters/inbound/CliTokenHandler.ts
    application: src/features/token/application/ComputeToken.ts
    shared_domain:
      - src/shared/domain/Token.ts
    outbound_ports:
      - src/features/token/ports/outbound/TokenConfigPort.ts
      - src/features/token/ports/outbound/TokenGitPort.ts
authority: code_annotation
verification_method: tests/integration/e2e.test.ts § "sdd token"
---
```

```yaml
---
id: sdd-cli:IMP-003
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids: [sdd-cli:BEH-003, sdd-cli:BEH-004, sdd-cli:BEH-005]
binding:
  feature_slice:
    root: src/features/check
    inbound_port: src/features/check/ports/inbound/CheckCommand.ts
    inbound_adapter: src/features/check/adapters/inbound/CliCheckHandler.ts
    application: src/features/check/application/CheckBaseline.ts
    domain:
      - src/features/check/domain/BaselineComparison.ts
    outbound_ports:
      - src/features/check/ports/outbound/CheckConfigPort.ts
      - src/features/check/ports/outbound/CheckGitPort.ts
      - src/features/check/ports/outbound/CheckSpecPort.ts
authority: code_annotation
verification_method: tests/integration/e2e.test.ts § "sdd check"
---
```

```yaml
---
id: sdd-cli:IMP-004
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids: [sdd-cli:BEH-006, sdd-cli:BEH-007]
binding:
  feature_slice:
    root: src/features/refresh
    inbound_port: src/features/refresh/ports/inbound/RefreshCommand.ts
    inbound_adapter: src/features/refresh/adapters/inbound/CliRefreshHandler.ts
    application: src/features/refresh/application/BuildRefreshStubs.ts
    domain:
      - src/features/refresh/domain/Footprint.ts
      - src/features/refresh/domain/DiffStubs.ts
    outbound_ports:
      - src/features/refresh/ports/outbound/RefreshClockPort.ts
      - src/features/refresh/ports/outbound/RefreshConfigPort.ts
      - src/features/refresh/ports/outbound/RefreshGitPort.ts
      - src/features/refresh/ports/outbound/RefreshSpecPort.ts
authority: code_annotation
verification_method: tests/integration/e2e.test.ts § "sdd refresh"
---
```

```yaml
---
id: sdd-cli:IMP-005
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:INV-001
  - sdd-cli:INV-003
binding:
  shared_domain: src/shared/domain/Token.ts
  used_by:
    - src/features/token/application/ComputeToken.ts
    - src/features/check/application/CheckBaseline.ts
authority: code_annotation
verification_method: tests/unit/Token.test.ts
---
```

```yaml
---
id: sdd-cli:IMP-006
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:BEH-003
  - sdd-cli:BEH-004
  - sdd-cli:BEH-009
binding:
  shared_domain: src/shared/domain/SpecBlocks.ts
  used_by:
    - src/features/check/application/CheckBaseline.ts
    - src/features/refresh/application/BuildRefreshStubs.ts
authority: code_annotation
verification_method: tests/unit/SpecBlocks.test.ts
---
```

```yaml
---
id: sdd-cli:IMP-007
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:BEH-006
binding:
  domain: src/features/refresh/domain/Footprint.ts
authority: code_annotation
verification_method: tests/unit/Footprint.test.ts
---
```

```yaml
---
id: sdd-cli:IMP-008
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:BEH-006
  - sdd-cli:CTR-006
binding:
  domain: src/features/refresh/domain/DiffStubs.ts
authority: code_annotation
verification_method: tests/unit/DiffStubs.test.ts
---
```

```yaml
---
id: sdd-cli:IMP-009
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:BEH-009
  - sdd-cli:CTR-003
binding:
  shared_domain: src/shared/domain/Config.ts
  schema: schema/sdd.config.schema.json
authority: code_annotation
verification_method: |
  tests/unit/Config.test.ts (round-trip & negative cases) +
  tests/integration/e2e.test.ts (config-error paths)
---
```

```yaml
---
id: sdd-cli:IMP-010
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:BEH-001
  - sdd-cli:BEH-006
binding:
  shared_domain: src/shared/domain/Scope.ts
authority: code_annotation
verification_method: |
  Exercised transitively via Token.test.ts and DiffStubs.test.ts;
  no dedicated unit test required.
---
```

```yaml
---
id: sdd-cli:IMP-011
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:CST-003
  - sdd-cli:INV-004
binding:
  architecture:
    feature_roots:
      - src/features/token
      - src/features/check
      - src/features/refresh
    shared_domain_root: src/shared/domain
    forbidden_top_level_folders:
      - src/domain
      - src/ports
      - src/adapters
      - src/commands
  ports:
    token:
      inbound:
        - src/features/token/ports/inbound/TokenCommand.ts
      outbound:
        - src/features/token/ports/outbound/TokenConfigPort.ts
        - src/features/token/ports/outbound/TokenGitPort.ts
    check:
      inbound:
        - src/features/check/ports/inbound/CheckCommand.ts
      outbound:
        - src/features/check/ports/outbound/CheckConfigPort.ts
        - src/features/check/ports/outbound/CheckGitPort.ts
        - src/features/check/ports/outbound/CheckSpecPort.ts
    refresh:
      inbound:
        - src/features/refresh/ports/inbound/RefreshCommand.ts
      outbound:
        - src/features/refresh/ports/outbound/RefreshClockPort.ts
        - src/features/refresh/ports/outbound/RefreshConfigPort.ts
        - src/features/refresh/ports/outbound/RefreshGitPort.ts
        - src/features/refresh/ports/outbound/RefreshSpecPort.ts
authority: code_annotation
verification_method: tests/unit/layer-imports.test.ts (INV-004)
---
```

```yaml
---
id: sdd-cli:IMP-012
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:EXT-001
  - sdd-cli:POL-002
binding:
  outbound_adapters:
    token: src/features/token/adapters/outbound/ChildProcessTokenGit.ts
    check: src/features/check/adapters/outbound/ChildProcessCheckGit.ts
    refresh: src/features/refresh/adapters/outbound/ChildProcessRefreshGit.ts
authority: code_annotation
verification_method: tests/integration/e2e.test.ts (real git) + POL-002 shim test
---
```

```yaml
---
id: sdd-cli:IMP-013
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T16:26:12Z
    change_request: approve vertical-slice hexagonal architecture refactor
partition_id: sdd-cli
target_ids:
  - sdd-cli:POL-001
binding:
  outbound_adapters:
    token: src/features/token/adapters/outbound/NodeTokenConfigReader.ts
    check: src/features/check/adapters/outbound/NodeCheckFileReader.ts
    refresh: src/features/refresh/adapters/outbound/NodeRefreshFileReader.ts
    refresh_clock: src/features/refresh/adapters/outbound/SystemRefreshClock.ts
authority: code_annotation
verification_method: POL-001 syscall-probe integration test
---
```

```yaml
---
id: sdd-cli:IMP-014
type: ImplementationBinding
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
target_ids:
  - sdd-cli:CTR-007
  - sdd-cli:GEN-001
binding:
  build:
    - package.json
    - tsconfig.json
authority: code_annotation
verification_method: tests/integration/e2e.test.ts (npm pack tarball install)
---
```

```yaml
---
id: sdd-cli:IMP-015
type: ImplementationBinding
lifecycle:
  status: proposed
partition_id: sdd-cli
title: lint feature — domain layer (pure rules + parser)
target_ids:
  - sdd-cli:BEH-011
  - sdd-cli:BEH-012
  - sdd-cli:CTR-009
  - sdd-cli:INV-006
binding:
  domain:
    - src/features/lint/domain/Diagnostic.ts
    - src/features/lint/domain/Record.ts
    - src/features/lint/domain/SpecParser.ts
    - src/features/lint/domain/Rules.ts
authority: code_annotation
verification_method: tests/unit/Rules.test.ts + tests/unit/SpecParser.test.ts
---
```

```yaml
---
id: sdd-cli:IMP-016
type: ImplementationBinding
lifecycle:
  status: proposed
partition_id: sdd-cli
title: lint feature — application + ports + adapters
target_ids:
  - sdd-cli:BEH-011
  - sdd-cli:BEH-012
  - sdd-cli:CTR-008
  - sdd-cli:CTR-009
binding:
  application:
    - src/features/lint/application/RunLint.ts
  ports:
    - src/features/lint/ports/inbound/LintCommand.ts
    - src/features/lint/ports/outbound/LintConfigPort.ts
    - src/features/lint/ports/outbound/LintFileReader.ts
  adapters:
    - src/features/lint/adapters/inbound/CliLintHandler.ts
    - src/features/lint/adapters/outbound/NodeLintFileReader.ts
authority: code_annotation
verification_method: tests/integration/e2e.test.ts (sdd lint subcommand fixture)
---
```

```yaml
---
id: sdd-cli:IMP-017
type: ImplementationBinding
lifecycle:
  status: proposed
partition_id: sdd-cli
title: approve feature — domain layer (request classifier + rewriter)
target_ids:
  - sdd-cli:BEH-013
  - sdd-cli:BEH-014
  - sdd-cli:BEH-015
  - sdd-cli:BEH-016
  - sdd-cli:INV-005
  - sdd-cli:INV-007
binding:
  domain:
    - src/features/approve/domain/ApproveRequest.ts
    - src/features/approve/domain/Rewrite.ts
authority: code_annotation
verification_method: tests/unit/ApproveRequest.test.ts + tests/unit/Rewrite.test.ts
---
```

```yaml
---
id: sdd-cli:IMP-018
type: ImplementationBinding
lifecycle:
  status: proposed
partition_id: sdd-cli
title: approve feature — application + ports + adapters
target_ids:
  - sdd-cli:BEH-013
  - sdd-cli:BEH-014
  - sdd-cli:BEH-015
  - sdd-cli:BEH-016
  - sdd-cli:CTR-010
  - sdd-cli:CTR-011
binding:
  application:
    - src/features/approve/application/ApplyApproval.ts
  ports:
    - src/features/approve/ports/inbound/ApproveCommand.ts
    - src/features/approve/ports/outbound/ApproveClock.ts
    - src/features/approve/ports/outbound/ApproveConfigPort.ts
    - src/features/approve/ports/outbound/ApproveFileSystem.ts
  adapters:
    - src/features/approve/adapters/inbound/CliApproveHandler.ts
    - src/features/approve/adapters/outbound/NodeApproveFileSystem.ts
    - src/features/approve/adapters/outbound/SystemApproveClock.ts
authority: code_annotation
verification_method: tests/integration/e2e.test.ts (sdd approve fixture)
---
```

```yaml
---
id: sdd-cli:IMP-019
type: ImplementationBinding
lifecycle:
  status: proposed
partition_id: sdd-cli
title: shared/domain/Config.ts — extension for the `lint` block
target_ids:
  - sdd-cli:CTR-012
binding:
  shared_domain:
    - src/shared/domain/Config.ts   # adds LintConfig type + lintConfig() parser
authority: code_annotation
verification_method: "tests/unit/Config.test.ts (NB: extension tests are authored alongside Phase-3 approval — current Config.test.ts asserts v0.1.0 shape only)"
---
```

```yaml
---
id: sdd-cli:IMP-020
type: ImplementationBinding
lifecycle:
  status: proposed
partition_id: sdd-cli
title: cli.ts — dispatch for lint and approve subcommands
target_ids:
  - sdd-cli:CTR-008
  - sdd-cli:CTR-010
binding:
  composition_root:
    - src/cli.ts   # parseArgv extended; new subcommand union; new dispatchers
authority: code_annotation
verification_method: "tests/unit/argv.test.ts (Phase-3 follow-up: extend argv tests to cover the new flag matrix)"
---
```

---

## 17. Open questions

```yaml
---
id: sdd-cli:OQ-001
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  When a discovery_scope entry is a glob that resolves to zero files at
  HEAD, should `sdd token` (a) error out (typo-protection) or
  (b) silently include nothing for that entry?
options:
  - id: a
    label: error_zero_match
    consequence: |
      Catches typos in config (for example `spec/0[0-9]-*.md` when no
      such files exist yet); rejects scope entries whose globs are
      empty at HEAD but become populated in later commits.
  - id: b
    label: silent_empty_match
    consequence: |
      Permissive; matches `git ls-tree` default behavior; loses typo
      protection.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-001
---
```

```yaml
---
id: sdd-cli:OQ-002
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  When <spec_file> contains MULTIPLE blocks whose `id` equals
  config.baseline_id, what is the correct behavior?
options:
  - id: a
    label: error_duplicate
    consequence: |
      Treats duplicates as a config error (BEH-009 path, exit 2);
      surfaces the violation early.
  - id: b
    label: use_first
    consequence: |
      Picks the first block; risks silent shadowing of the second.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-002; reflected in CTR-002 reason set
---
```

```yaml
---
id: sdd-cli:OQ-003
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  What is the exact shape of the `binding` field in IMP-* blocks?
  PLAN.md describes it as an object, but the value type is unstated.
  Possible value shapes per key: string path, array of string paths,
  nested object whose leaf values are paths.
options:
  - id: a
    label: union_string_or_array_or_nested
    consequence: |
      Footprint extractor walks any object/array/string tree under
      `binding` and collects every string-leaf as a path. Most flexible.
  - id: b
    label: array_of_strings_only
    consequence: |
      Strict; rejects mixed shapes; simpler implementation.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-003
---
```

```yaml
---
id: sdd-cli:OQ-004
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  When an IMP-* block has no `binding` field at all, should the
  footprint extractor (a) skip silently, (b) emit a warning to stderr,
  or (c) treat it as a config error?
options:
  - id: a
    label: skip_silently
    consequence: |
      Maximally permissive; an IMP that exists only to declare
      target_ids contributes no footprint paths and does not interact
      with refresh.
  - id: b
    label: warn_on_stderr
    consequence: |
      Same routing as (a) but flags the omission for human review.
  - id: c
    label: config_error
    consequence: |
      Strict; every IMP must carry binding; surfaces under-spec'd IMPs.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-004
---
```

```yaml
---
id: sdd-cli:OQ-005
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  Should the human-format output of `sdd refresh` include the
  `emitted_at` timestamp, or is that field json/yaml-only?
options:
  - id: a
    label: human_omits_timestamp
    consequence: |
      Human output stays terse; timestamp lives only in machine
      formats.
  - id: b
    label: human_includes_timestamp
    consequence: |
      Consistent across formats; slightly noisier.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-005
---
```

```yaml
---
id: sdd-cli:OQ-006
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  Should every v1 machine-readable output schema pin
  `format_version` to 1, or should each command/stub surface own an
  independent version counter?
options:
  - id: a
    label: shared_format_version_1
    consequence: |
      Every json output uses `format_version: 1`; future incompatible
      machine-readable changes bump the relevant Surface major version.
  - id: b
    label: per_surface_version_counter
    consequence: |
      Each command/stub schema evolves its own version independently;
      consumers must track several counters.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-006
---
```

```yaml
---
id: sdd-cli:OQ-007
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  How should the spec block scanner distinguish normative YAML blocks
  from markdown separators and prose in spec.md?
options:
  - id: a
    label: fenced_yaml_documents_only
    consequence: |
      Only ```yaml fenced code blocks containing `---` document
      delimiters are scanned; markdown horizontal rules and prose are
      ignored.
  - id: b
    label: every_triple_dash_line
    consequence: |
      Every `^---$` line participates in tokenisation; simpler but
      risks treating markdown separators as YAML content.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-007
---
```

```yaml
---
id: sdd-cli:OQ-008
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  How should untracked files inside discovery_scope participate in
  dirty checks and refresh stub generation?
options:
  - id: a
    label: untracked_scope_paths_are_dirty_and_refresh_drift
    consequence: |
      `git status --porcelain -- <scope>` is part of dirty detection;
      untracked in-scope paths cause baseline-dirty and are included in
      refresh's uncommitted drift set.
  - id: b
    label: ignore_untracked_paths
    consequence: |
      Matches `git diff --quiet` alone; avoids extra status parsing but
      misses new in-scope files until they are staged or committed.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-008
---
```

```yaml
---
id: sdd-cli:OQ-009
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  What should `sdd --version` print in v1?
options:
  - id: a
    label: package_version_only
    consequence: |
      Prints the package version string from package metadata, exits 0,
      and performs no repo/config/git access.
  - id: b
    label: binary_name_and_package_version
    consequence: |
      Prints `sdd <version>`; friendlier to humans but makes the string
      shape part of the CLI contract.
blocking: no
owner: cyberash
default_if_unresolved: a   # see ASM-009
---
```

```yaml
---
id: sdd-cli:OQ-010
type: Open-Q
partition_id: sdd-cli
question: |
  Should `sdd approve` refuse to promote a Surface to `approved` when one
  of its referenced Contracts/Policies is still `proposed` (transitive
  approval check, SDD §7.3-bis)? Current v0.2.0 behaviour: no transitive
  check — the operator may produce a Surface@approved with a Contract@proposed
  member, which a downstream `sdd lint` flags as `spec-invalid`.
options:
  - id: a
    label: enforce_in_approve
    consequence: |
      `sdd approve` refuses (exit 1, reason="proposed-references") when
      any transitively-referenced ID is below the target_status. Forces
      a strict approval order. Slightly slower (transitive scan).
  - id: b
    label: leave_to_lint
    consequence: |
      `sdd approve` is a pure local rewriter; the gate is `sdd lint`
      run after the rewrite. Simpler approve; one extra lint run.
blocking: no
owner: cyberash
default_if_unresolved: b   # current v0.2.0 behaviour
review_by: 2026-07-01
---
```

```yaml
---
id: sdd-cli:OQ-011
type: Open-Q
partition_id: sdd-cli
question: |
  Should `sdd lint` recognise the canonical SDD §2 partition section
  ordering (18 sections starting "1. Context") as the only acceptable
  shape? sdd-cli's own spec.md uses a slightly different section list
  (Invariants is §8, External dependencies §9, Generated artifacts §10,
  Localization §11, Policies §12, Constraints §13). v0.2.0 lint applies
  the §2 shape only to files that contain a "## 1. Context" heading;
  spec/spec.md and any non-partition file is exempt. Is this the
  intended semantics?
options:
  - id: a
    label: opt_in_via_heading
    consequence: |
      Current behaviour. Files starting with "## 1. Context" get §2
      structure check; everything else is exempt.
  - id: b
    label: configurable_per_glob
    consequence: |
      `.sdd/config.json#lint.partition_glob` opt-in; only files matching
      the glob get the structure check. More explicit but adds config
      surface (CTR-012 extension).
blocking: no
owner: cyberash
default_if_unresolved: a
review_by: 2026-07-01
---
```

```yaml
---
id: sdd-cli:OQ-012
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  When `partitions[*].test_paths` globs of two partitions overlap,
  should a marker in a shared test file count as covering BOTH
  partitions, or should the operator be required to list the same
  file in each partition's test_paths array? v0.3.0 default: a
  test counts toward partition X iff its file matches X's
  test_paths glob — overlapping globs implicitly cross-credit; no
  global cross-credit table.
options:
  - id: a
    label: implicit_cross_credit_via_overlapping_globs
    consequence: |
      Operators relying on cross-partition coverage list the same
      file in both partitions' test_paths (or use overlapping
      globs). Implicit cross-credit is the documented mechanism;
      matches v0.3.0 default and the issue §Config schema clause
      "A cross-partition integration test that legitimately covers
      IDs from both A and B must appear in both partitions'
      test_paths."
  - id: b
    label: forbid_glob_overlap
    consequence: |
      Reject configs where two partitions' test_paths overlap;
      operators must use explicit per-partition globs. Stricter
      audit; more work for adopters of cross-partition tests.
blocking: yes
owner: cyberash
default_if_unresolved: a
---
```

```yaml
---
id: sdd-cli:OQ-013
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  What is the canonical YAML form of a `Test obligation` declared
  `not_applicable + reason`? Acceptance criterion #3 of `sdd ready`
  requires it: an approved ID without a `@covers` marker is
  exempted from the `uncovered` rule iff its `test_obligation` is
  `not_applicable`. This convention is not yet used in this
  repo's spec.
options:
  - id: a
    label: nested_object_with_reason_token
    consequence: |
      `test_obligation: { not_applicable: <reason_token>, reason: "<text>" }`
      mirrors the convention already used by `data_scope` and
      `policy_refs` (see CTR-001 lines 1184-1188 and BEH-008
      data_scope at line 712). Consistent with existing parser.
  - id: b
    label: separate_top_level_keys
    consequence: |
      Two flat keys: `test_obligation_not_applicable: <reason_token>`
      plus `test_obligation_reason: "<text>"`. Loses the "this
      field is conditional" framing already used elsewhere.
blocking: yes
owner: cyberash
default_if_unresolved: a
---
```

```yaml
---
id: sdd-cli:OQ-014
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  Should `sdd ready` rules respect a per-ID `applicability` field
  (skip an ID for partition X when its applicability excludes X),
  or evaluate every rule uniformly across all configured partitions
  in v0.3.0?
options:
  - id: a
    label: uniform_evaluation
    consequence: |
      v0.3.0 evaluates every rule uniformly. An ID whose
      `applicability` excludes a given partition still surfaces
      violations in that partition. Simpler; matches issue §Out of
      scope.
  - id: b
    label: applicability_aware
    consequence: |
      Skip an ID for a partition when applicability excludes it.
      Adds a per-rule filter; risks silent gaps if applicability
      drifts from real behaviour.
blocking: yes
owner: cyberash
default_if_unresolved: a
---
```

```yaml
---
id: sdd-cli:OQ-015
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  Which severity classes of `sdd lint` diagnostics surface as
  `aggregated_lint` violations under `sdd ready`? The issue text
  lists weasel-words, missing approval_record, unresolved
  Open-Q.blocking=yes, stale freshness_token — all error-severity
  in current lint rules. Should warn-severity diagnostics also
  surface as merge blockers?
options:
  - id: a
    label: error_severity_only
    consequence: |
      `aggregated_lint` includes every Diagnostic with `severity:
      "error"` and drops `severity: "warn"`. `sdd lint` standalone
      preserves the warn-only-no-fail semantics; `sdd ready`
      blocks merge on every error. Default; matches issue text
      ("notably: unresolved Open-Q.blocking=yes, weasel-words,
      missing approval_record, stale freshness_token").
  - id: b
    label: include_warns_as_blockers
    consequence: |
      All diagnostics surface as ready blockers. Stricter merge
      gate; risks blocking on advisory issues that lint itself
      does not block.
blocking: yes
owner: cyberash
default_if_unresolved: a
---
```

```yaml
---
id: sdd-cli:OQ-016
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  When a `@covers` marker tail contains a `key=value` token whose
  key is NOT in CST-007's v0.3.0 whitelist (currently only
  `compatibility_action`), what does the scanner do?
options:
  - id: a
    label: silently_ignore
    consequence: |
      Drop the unknown key/value pair from the parsed marker tail;
      keep the marker. Forward-compatible for future v0.x keys —
      older specs/tests can experimentally adopt new keys ahead
      of the next sdd-cli version without breaking. v0.3.0
      default.
  - id: b
    label: warn_via_aggregated_lint
    consequence: |
      Emit an aggregated_lint diagnostic on the marker line but
      do not fail the gate. Surfaces typos to operators while
      preserving forward-compat. Slightly more code.
  - id: c
    label: reject_as_evaluate_failure
    consequence: |
      Exit 2 evaluate-failure. Strictest; catches typos
      immediately; breaks adopter repos that experimentally adopt
      new keys.
blocking: yes
owner: cyberash
default_if_unresolved: a
---
```

```yaml
---
id: sdd-cli:OQ-017
type: Open-Q
lifecycle:
  status: proposed
partition_id: sdd-cli
question: |
  When a `@covers` line contains text that *almost* matches the
  marker grammar but fails the lowercase-only partition charset
  (e.g. `@covers bridge:Commands:CON-004` — uppercase in a partition
  segment), what does sdd-cli do?
options:
  - id: a
    label: silently_skip
    consequence: |
      Scanner does not emit a marker for the offending substring;
      the left-to-right regex engine recovers at the next valid
      partition-shaped token. Matches v0.2.0 behaviour bit-for-bit;
      no advisory output. Default for v0.3.0 — adopters who already
      relied on this in v0.2.0 see zero change.
  - id: b
    label: warn_via_aggregated_lint
    consequence: |
      Surface a near-miss diagnostic on the offending line at
      severity=advisory under the `aggregated_lint` envelope. Helps
      adopters catch typos without breaking the gate. Modest extra
      code in MarkerParser + LintReport; requires a second-pass
      scanner that recognises near-miss-shaped tokens.
  - id: c
    label: reject_as_evaluate_failure
    consequence: |
      Exit 2 evaluate-failure on first near-miss. Strictest; risks
      breaking adopter repos that legitimately have non-marker
      `@covers`-shaped text in comments or string literals.
blocking: no
owner: cyberash
default_if_unresolved: a
---
```

---

## 18. Assumptions

```yaml
---
id: sdd-cli:ASM-001
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  A glob entry in discovery_scope that resolves to zero files at HEAD
  is a hard error (BEH-009 path, reason "config-invalid").
source_open_q: sdd-cli:OQ-001
blocking: no
review_by: 2026-07-29
default_if_unresolved: keep_assumption
tests:
  - tests/integration/e2e.test.ts § "scope glob with zero matches errors"
---
```

```yaml
---
id: sdd-cli:ASM-002
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  Duplicate baseline blocks in <spec_file> are a config error (exit 2,
  reason "baseline-block-duplicate"). Reflected in CTR-002 reason set.
source_open_q: sdd-cli:OQ-002
blocking: no
review_by: 2026-07-29
default_if_unresolved: keep_assumption
tests:
  - tests/integration/e2e.test.ts § "duplicate baseline block errors"
---
```

```yaml
---
id: sdd-cli:ASM-003
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  The `binding` field of an IMP-* block is parsed as a generic tree of
  objects, arrays, and strings; any string leaf is treated as a path.
  Non-string leaves (numbers, booleans, null) are ignored with no
  warning.
source_open_q: sdd-cli:OQ-003
blocking: no
review_by: 2026-07-29
default_if_unresolved: keep_assumption
tests:
  - tests/unit/Footprint.test.ts § "binding tree walk: string | array | nested"
---
```

```yaml
---
id: sdd-cli:ASM-004
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  An IMP-* block with no `binding` field contributes zero paths to the
  footprint and does not produce a warning.
source_open_q: sdd-cli:OQ-004
blocking: no
review_by: 2026-07-29
default_if_unresolved: keep_assumption
tests:
  - tests/unit/Footprint.test.ts § "IMP without binding contributes nothing"
---
```

```yaml
---
id: sdd-cli:ASM-005
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  Human-format refresh output omits the `emitted_at` timestamp; only
  json and yaml emissions include it.
source_open_q: sdd-cli:OQ-005
blocking: no
review_by: 2026-07-29
default_if_unresolved: keep_assumption
tests:
  - tests/integration/e2e.test.ts § "human refresh output omits emitted_at"
---
```

```yaml
---
id: sdd-cli:ASM-006
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  JSON output uses `format_version: 1` for every machine-readable
  emission (CTR-004, CTR-005, CTR-006). Future changes bump
  format_version and the owning Surface major version per CTR-* compat
  rules.
source_open_q: sdd-cli:OQ-006
blocking: no
review_by: 2026-10-29
default_if_unresolved: keep_assumption
tests:
  - tests/unit/json-format-version.test.ts
---
```

```yaml
---
id: sdd-cli:ASM-007
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  SpecBlocks scans only markdown ```yaml fenced code blocks and parses
  YAML documents delimited by `---` inside those fences. Markdown
  horizontal rules and prose outside YAML fences are ignored.
source_open_q: sdd-cli:OQ-007
blocking: no
review_by: 2026-10-29
default_if_unresolved: keep_assumption
tests:
  - tests/unit/SpecBlocks.test.ts § "markdown separators are ignored"
---
```

```yaml
---
id: sdd-cli:ASM-008
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  Untracked files inside discovery_scope are treated as scope-dirty.
  `sdd token` and `sdd check` return baseline-dirty, and `sdd refresh`
  includes those paths in the uncommitted drift set.
source_open_q: sdd-cli:OQ-008
blocking: no
review_by: 2026-10-29
default_if_unresolved: keep_assumption
tests:
  - tests/integration/e2e.test.ts § "untracked scope file is dirty"
  - tests/integration/e2e.test.ts § "refresh includes untracked scope file"
---
```

```yaml
---
id: sdd-cli:ASM-009
type: ASSUMPTION
lifecycle:
  status: approved
  approval_record:
    owner_role: partition_owner
    approver_identity: cyberash
    timestamp: 2026-04-29T15:37:35Z
    change_request: approve sdd-cli v1 specification block for implementation
partition_id: sdd-cli
assumption: |
  `sdd --version` prints exactly the package version string followed by
  LF, exits 0, and performs no config, spec, or git access.
source_open_q: sdd-cli:OQ-009
blocking: no
review_by: 2026-10-29
default_if_unresolved: keep_assumption
tests:
  - tests/integration/e2e.test.ts § "sdd --version prints package version"
---
```

---

## 19. Out of scope

The following are deliberately out of scope for `sdd-cli` v1 (mirrors
PLAN.md §Out of scope and adds the implications for downstream IDs):

- **Publication of `@cyberash/sdd-cli` to npm registry.** SUR-005 stays
  in local-path / `npm pack` consumption mode. Promoting to a public
  registry is a separate Surface bump.
- **Other token mechanisms** (`sha256_of_concat`, `git_tag_based`).
  CTR-003.mechanism is a closed enum at one value; expanding is a major
  bump on SUR-002 (CST-005).
- **General spec linter** (`sdd lint`) covering §12.2 enforcement.
  Separate Surface; not part of SUR-001.
- **Scaffolding command** (`sdd init`). Consumers hand-write
  `.sdd/config.json` from `tests/fixtures/config.example.json`.
- **Auto-application of stubs into spec.md.** INV-002 forbids it.
  Future `sdd apply` is a separate, future Surface with its own Policy
  and approval ceremony.
- **Adoption inside `pipeline-driver/`.** Follow-up plan, not this one.
- **Adoption inside `pipeline-state-mcp/`.** Separate concern.
- **CI integration recipes (GitHub Actions, GitLab, etc.).** README
  guidance only; no normative ID.
- **Computing the token against a ref other than HEAD.** No flag, no
  contract.
- **Localized output / message catalogs.** §11 defers; future
  `LocalizationContract` block when needed.
- **Performance characterisation of `git ls-tree` on very large repos.**
  No NFR in v1; acceptable behavior is "completes in time bounded by
  git itself".

---

## Appendix A — Token algorithm (`git_tree_hash_v1`)

Definition restated for unambiguous implementation; binds INV-001 and
INV-003.

1. Run `git diff --quiet HEAD -- <discovery_scope>`.
   - exit 0 → working tree clean on scope; continue
   - non-zero → BEH-002 path (reason "baseline-dirty")
2. Run `git ls-tree HEAD -- <discovery_scope>`. Capture stdout as raw
   bytes — no decoding, no normalisation, no sorting (git canonicalises
   by name).
3. `token = hex(sha256(stdout_bytes))`.
4. `commit_sha = hex(stdout of `git rev-parse HEAD`).strip()`.
5. Emit `{ token, commit_sha, mechanism: "git_tree_hash_v1", scope }`.

Determinism follows from: git's canonical `ls-tree` output for a fixed
commit and pathspec set is byte-identical across invocations on the
same git version family (CST-001 / EXT-001).

---

## Appendix B — Section ↔ §-rule cross-reference (for the linter)

| §  | Section heading            | SDD §                |
|----|----------------------------|----------------------|
| 1  | Context                    | §2.1                 |
| 2  | Glossary                   | §2.2                 |
| 3  | Partition                  | §2.3, §13            |
| 4  | Brownfield baseline        | §2.4, §6             |
| 5  | Surfaces                   | §2.5, §7             |
| 6  | Requirements               | §2.6                 |
| 7  | Data contracts             | §2.7                 |
| 8  | Invariants                 | §2.6 (Invariant)     |
| 9  | External dependencies      | §2.8, §11.1          |
| 10 | Generated artifacts        | §2.9, §11.4          |
| 11 | Localization               | §2.10, §10.3         |
| 12 | Policies                   | §2.11, §10           |
| 13 | Constraints                | §2.12                |
| 14 | Migrations                 | §2.13, §11.3         |
| 15 | Deltas                     | §2.14, §6.4          |
| 16 | Implementation bindings    | §2.15                |
| 17 | Open questions             | §2.16, §5            |
| 18 | Assumptions                | §2.17, §5.3          |
| 19 | Out of scope               | §2.18                |
