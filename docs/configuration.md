# Configuration

> English · [Русский](configuration.ru.md)

Everything `agent-sdd` needs to know about your repository lives in one file:
`<repo_root>/.sdd/config.json`. This document is the full field reference plus the
Brownfield-baseline block the CLI reads from your spec. The formal JSON Schema is
[`schema/sdd.config.schema.json`](../schema/sdd.config.schema.json).

---

## `.sdd/config.json`

Minimal example:

```json
{
  "$schema": "https://github.com/cyberash-dev/agent-sdd/blob/main/schema/sdd.config.schema.json",
  "spec_file": "spec/spec.md",
  "baseline_id": "my-partition:BL-001",
  "discovery_scope": ["src", "tests", "package.json", "tsconfig.json"],
  "mechanism": "git_tree_hash_v1"
}
```

Unknown top-level fields are **rejected** (exit 2, `config-invalid`).

### Field reference

| Field | Type | Required | Default | Meaning |
|-------|------|----------|---------|---------|
| `spec_file` | string | yes | — | Path to the SDD spec file, relative to repo root. |
| `baseline_id` | string | yes | — | Full `<partition>:BL-<n>` of the BrownfieldBaseline block to read. |
| `discovery_scope` | string[] | yes | — | Pathspecs (dirs, files, globs) relative to repo root, handed to the active VCS adapter. |
| `mechanism` | string | yes | — | Fingerprint id of the active VCS adapter (grammar `^[a-z][a-z0-9_]*$`); built-in git declares `git_tree_hash_v1`. |
| `vcs` | string | no | `"git"` | VCS adapter selector: `"git"` (built-in) or a module specifier of an external adapter package. |
| `footprint.binding_id_prefix` | string | no | `"IMP-"` | Neutral-id prefix scanned for footprint paths. |
| `footprint.binding_field` | string | no | `"binding"` | YAML key under which file paths live in IMP blocks. |
| `lint.spec_files` | string[] | no | `[spec_file]` | Glob patterns (posix) for spec files to scan with `sdd lint` / `sdd approve`. |
| `lint.approver_blocklist` | string[] | no | `[]` | Extra approver identities to refuse, on top of the built-in agent list. |
| `partitions` | object | no | absent → flat shorthand | Multi-partition mode (`CTR-015`). Per-partition `spec_paths` (required), `test_paths`, `sandbox_paths`. |
| `test_paths` (top-level) | string[] | no | `[]` | Shorthand applied to the synthesised single-partition fallback when `partitions` is absent. |
| `sandbox_paths` (top-level) | string[] | no | `[]` | Shorthand applied to the synthesised single-partition fallback when `partitions` is absent. |

### The partition/baseline-id grammar

`baseline_id` and every `partitions.<name>` key match:

```
^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*$
```

one or more lowercase tokens joined by `:`. Examples: `pipeline-driver:BL-001`,
`bridge:commands:CON-004`. Single-segment ids are the original default and are
preserved unchanged.

---

## Discovery scope tips

- A scope entry that resolves to **zero files** at HEAD is a hard config error.
  This protects against typos like `spec/0[0-9]-*.md` when no such files exist
  yet.
- Globs use git pathspec syntax (`*`, `?`, `[abc]`) and resolve against
  `git ls-tree -r --name-only HEAD`.
- Order does not matter: `git ls-tree` canonicalises by name, so the resulting
  token is stable across reorderings.
- Keep the scope tight and meaningful. It defines what "the repository's content"
  means for the freshness token — everything inside it is watched for drift,
  everything outside is `unmodeled`.
- Include only sources of observable behaviour: code, API contract sources,
  tests. Leave out deployment and platform paths: environment
  configs with hosts, DB addresses or secret references, IaC and deploy
  manifests (`deploy/`, `k8s/`, `helm/`, `terraform/`), CI and release
  configs (`.github/workflows/`, `a.yaml`), Dockerfiles. Otherwise every
  operational change, such as removing a DB host, stales the baseline.

---

## The Brownfield-baseline block

`agent-sdd` looks up a single YAML block in `<spec_file>` whose `id` equals
`config.baseline_id` and whose `type` equals `BrownfieldBaseline`. It reads two
fields from it:

```yaml
---
id: my-partition:BL-001
type: BrownfieldBaseline
freshness_token: <64-char hex>       # sha256 over the Discovery scope
baseline_commit_sha: <40-char hex>   # the commit the token was computed at
mechanism: git_tree_hash_v1
# ... lifecycle, discovery_scope, coverage_evidence, etc.
---
```

Two baseline blocks with the same `id` are treated as a config error
(`baseline-block-duplicate`). On a fresh repo, leave `freshness_token` and
`baseline_commit_sha` as placeholders and fill them via the bootstrap flow (see
[sdd-methodology.md → Worked workflows](sdd-methodology.md#worked-workflows)).

---

## Multi-partition mode

The flat `.sdd/config.json` shape is preserved as a **single-partition
shorthand** when `partitions` is absent. For a repo split into several ownership
areas, declare them explicitly:

```json
{
  "spec_file": "spec/spec.md",
  "baseline_id": "my-partition:BL-001",
  "discovery_scope": ["src", "tests"],
  "mechanism": "git_tree_hash_v1",
  "partitions": {
    "my-partition": {
      "spec_paths": ["spec/spec.md"],
      "test_paths": ["tests/**/*.test.ts"],
      "sandbox_paths": ["spike/**"]
    },
    "billing": {
      "spec_paths": ["spec/billing.md"],
      "test_paths": ["tests/billing/**/*.test.ts"],
      "sandbox_paths": ["spike/billing/**"]
    }
  }
}
```

- **`spec_paths`** (required per partition) — which spec files this partition
  owns.
- **`test_paths`** — where `sdd ready` scans for `@covers` markers crediting this
  partition's IDs.
- **`sandbox_paths`** — where `proposed`/`draft` IDs are allowed to live without
  tripping `[unapproved]`.

Gates run per partition, so drift or an unapproved ID in one area never blocks
another. A cross-partition test that legitimately covers IDs from two partitions
must appear in **both** partitions' `test_paths` — implicit cross-credit is not
provided.

---

## Selecting a VCS backend

The default backend is **git** (`mechanism: git_tree_hash_v1`). To use another
version-control system, install an external adapter package and point `vcs` at
it:

```json
{
  "spec_file": "spec/spec.md",
  "baseline_id": "my:BL-001",
  "discovery_scope": ["src", "tests"],
  "vcs": "my-vcs-adapter",
  "mechanism": "myvcs_content_v1"
}
```

The adapter's declared `mechanism` must equal `config.mechanism`, or the CLI
exits 2. Building one is covered end-to-end in
[writing-vcs-adapters.md](writing-vcs-adapters.md).

---

## See also

- [commands.md](commands.md) — how each command uses this config.
- [sdd-methodology.md](sdd-methodology.md) — the baseline, token, and gates the
  config feeds.
- [`schema/sdd.config.schema.json`](../schema/sdd.config.schema.json) — the formal
  schema.
