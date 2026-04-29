# CLAUDE.md — `sdd-cli`

Project-specific instructions for Claude Code when working in this
repository. The user's global rules under `~/.claude/rules/*.md` always
apply; this file overrides or extends them where the project diverges.

---

## What this project is

`sdd-cli` is a generic, repo-agnostic command-line tool for Spec-Driven
Development. It computes a deterministic `freshness_token` over a
configurable Discovery scope, compares it against the value recorded in
the spec's Brownfield-baseline block, emits stubs (`Delta` / `Open-Q`)
on drift, runs SDD spec-lint rules over normative IDs, and rewrites
`lifecycle.status` + `approval_record` blocks via `sdd approve`.

The full normative specification is `spec/spec.md`. **It is the source
of truth.** Every code change must be reflected in the spec first. The
tool itself enforces this discipline: `sdd lint` against `spec/spec.md`
is part of CI and must exit 0.

---

## Architecture (don't break this)

Vertical Slice + Hexagonal, enforced by
`tests/unit/layer-imports.test.ts` (per `INV-004` / `CST-003`):

```
src/
  cli.ts                        # composition root only
  features/
    {token,check,refresh,lint,approve}/
      domain/                   # pure logic, no node:* (except Token.ts)
      application/              # use cases, depend on ports + domain
      ports/{inbound,outbound}/ # interfaces only
      adapters/{inbound,outbound}/
                                # only here you may import node:*
  shared/
    domain/                     # cross-feature primitives
```

Hard rules (the test will fail if you violate them):

- No global `src/domain/`, `src/ports/`, `src/adapters/`, `src/commands/`.
- Cross-feature imports are forbidden. Reach via `src/shared/domain/`.
- `src/shared/domain/` imports no `node:*` module **except**
  `node:crypto` inside `src/shared/domain/Token.ts`.
- Domain layer of any feature imports only same-feature domain and
  `src/shared/domain/`.
- Application layer imports only same-feature domain, same-feature
  ports, and `src/shared/domain/`.
- Adapters import same-feature ports/application/domain,
  `src/shared/domain/`, and runtime SDKs (e.g. `node:fs`,
  `node:child_process`).

---

## Workflow for any code change

1. **Spec first.** Open `spec/spec.md`, update the relevant ID
   (Behavior, Contract, Invariant, Policy, Constraint, Migration,
   Delta, ImplementationBinding) BEFORE touching code. New behavior →
   new BEH-* / CTR-* / INV-* with `lifecycle.status: proposed`. If you
   are extending an existing approved ID with breaking change, write a
   `Delta` (§14) instead of mutating the approved record.
2. **Run `sdd lint`.** It must exit 0. New `proposed` records require
   `test_obligation:` (singular object form is the canonical shape).
3. **Write tests.** Per `~/.claude/rules/testing.md` — AAA, no internal
   mocks, fakes preferred. `tests/unit/` for domain logic;
   `tests/integration/` for end-to-end CLI behavior.
4. **Implement.** Make tests pass. Stay inside the slice that owns the
   feature (or `src/shared/domain/` for cross-cutting primitives).
5. **Run all checks.** `npm run tsc && npm test && npm run build`.
6. **`sdd approve` requires a human.** Never set `lifecycle.status:
   approved` directly in YAML. Use `sdd approve` and supply a
   non-agent identity (your own, not Claude / agent / bot:*). The
   built-in `BUILTIN_AGENT_BLOCKLIST` will refuse self-approval —
   that is intentional (SDD §7.5).

If you're tempted to skip the spec update — stop. Add the spec change
in the same PR. There is no exception.

---

## Key commands

```sh
npm install            # one-time
npm run tsc            # type-check (no emit)
npm run test:unit
npm run test:integration
npm test               # both
npm run build          # tsc + chmod +x dist/cli.js
node dist/cli.js --help

# operate on this repo's own spec.md
node dist/cli.js token
node dist/cli.js check
node dist/cli.js refresh
node dist/cli.js lint            # must exit 0 in CI
```

`.sdd/config.json` is already set up to point at `spec/spec.md` with
`baseline_id: sdd-cli:BL-001` and `discovery_scope` covering `src`,
`tests`, `schema`, build files, `spec/spec.md`, `.sdd/config.json`.

---

## Tests you must not regress

- `tests/unit/layer-imports.test.ts` — `INV-004` / `CST-003`. If you
  touch the import graph, run this first.
- `tests/integration/git-shim-allowlist.test.ts` — `POL-002`. Only the
  six git subcommands enumerated in `EXT-001` may be invoked.
- `tests/integration/fs-readonly.test.ts` — `INV-002` / `POL-001`. The
  CLI never writes to `spec.md`, `.sdd/config.json`, or `.git/` refs &
  objects. The exception is `sdd approve`, which is allowed to write to
  files matched by `lint.spec_files` and only those.
- `tests/integration/lint-and-approve.test.ts` — `BEH-011..016`,
  `INV-005..007`. Approve must refuse agent identities case-insensitively
  and via the `bot:` prefix.
- `tests/unit/constraints.test.ts` — `CST-001/002/004/005`. Reads
  `package.json`/`tsconfig.json`/`schema/sdd.config.schema.json` and
  asserts the structural Constraints hold.

---

## Common gotchas

- The composition root `src/cli.ts` is the only place that wires
  inbound + outbound adapters. Don't construct adapters elsewhere.
- The `yaml` package (`^2`) is the only YAML parser allowed (`CST-004`).
  Don't add `js-yaml` or hand-roll a parser.
- The mechanism enum in `schema/sdd.config.schema.json` is exactly
  `["git_tree_hash_v1"]` (`CST-005`). Adding another mechanism is a
  major bump on `SUR-002`.
- `Surface` records use semver (`"0.1.0"` etc.); every other normative
  template uses integer `version` (`SDD §1.5`).
- `approval_record` lives nested under `lifecycle.approval_record:` in
  `sdd-cli`'s spec; the parser also accepts a top-level form. Both work
  — but stick to one shape per record.
- `sdd approve` rewrites `lifecycle.status` and `approval_record`
  atomically (`INV-007`). Never split them.

---

## When in doubt

- Read `spec/spec.md` Appendix B (Section ↔ §-rule cross-reference) to
  see which spec section governs which template.
- Read `~/.claude/rules/spec-driven-development.md` for the SDD
  discipline at a global level.
- Run `sdd lint --format=json` and read the diagnostics — every rule id
  is stable and self-explanatory.
