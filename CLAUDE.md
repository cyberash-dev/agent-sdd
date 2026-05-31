# CLAUDE.md — `sdd-cli`

Claude Code overlay for this repository. The user's global rules under
`~/.claude/rules/*.md` always apply.

**Read [`AGENTS.md`](AGENTS.md) first.** It is the canonical,
agent-agnostic guide and the source of truth for everything that is not
Claude-specific. This file does not repeat it — it only adds the Claude
Code bits. `AGENTS.md` is where you'll find:

- **Rule zero** — `spec/spec.md` is the source of truth; the spec change
  comes first, in the same PR, with `sdd lint` before implementation.
- **The self-approval ban** — `sdd approve` refuses agent identities
  (SDD §7.5); never write `lifecycle.status: approved` by hand.
- **What you may / may not change** without ceremony.
- **The architecture cheat sheet** (Vertical Slice + Hexagonal) and its
  hard rules, enforced by `tests/unit/layer-imports.test.ts`
  (`INV-004` / `CST-003`).
- **The command list** and the CI gate
  (`tsc && test:unit && test:integration && build && sdd lint && sdd ready`).
- **The "tests that must never regress" table.**
- **The gotchas** (YAML parser, mechanism enum, marker grammar, byte-level
  scanner, `sdd install` write boundary, …) and the **finish-a-task
  checklist**.

For what the tool does, see [`README.md`](README.md); for the normative
spec, `spec/spec.md`.

---

## Claude Code specifics

- **Reading `spec/spec.md` is intercepted by a hook.** `sdd install
  claude` wires a `PreToolUse` spec-read guard that DENIES `Read` /
  `cat` / `grep` of `spec/*.md` in any project carrying
  `.sdd/config.json` (this repo carries one). Navigate the spec with
  `sdd record list` / `sdd record get <id>` and edit a single
  draft/proposed record with `sdd record set` / `add` — not `Read` /
  `Edit` on the whole file. The full `sdd record` contract is in
  `AGENTS.md` → Commands.

- **Code navigation** — prefer the builtin `LSP` and
  `mcp__code-skeleton__*` tools over `Read` to understand structure; use
  `Read` only immediately before an `Edit`. Details in
  `~/.claude/rules/code-navigation.md`.

- **Methodology layer** — `~/.claude/rules/spec-driven-development.md`
  and the `~/.claude/sdd/*.md` rules (installed by `sdd install claude`)
  are the global SDD discipline that frames the repo-specific rules in
  `AGENTS.md`. When they disagree, the repo's `AGENTS.md` / `spec/spec.md`
  win for this project.
