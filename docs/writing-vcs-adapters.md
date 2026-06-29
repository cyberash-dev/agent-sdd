# Writing a VCS adapter for `agent-sdd`

`agent-sdd` reads the version-control state of your repository through a
single port, the `Vcs` contract. The **built-in adapter shells to git** and
is the default. If your repository is managed by a different version-control
system, you can ship an external adapter as a **separate npm package** and
select it from `.sdd/config.json` — `agent-sdd` itself stays VCS-agnostic and
never depends on your adapter.

This guide is everything you need to write one. It assumes no knowledge of
`agent-sdd`'s internals beyond this document.

---

## Why an adapter exists

Every `agent-sdd` operation that touches version control goes through eight
methods: detect a repo, find its root, read the head revision, fingerprint a
set of paths, list the files under those paths, list dirty paths, list paths
changed since a baseline revision, and read one file at a given revision. The
built-in git adapter implements them with `git`. An adapter for another VCS
implements the same eight methods with that VCS's CLI (or library).

The freshness token — the hash `agent-sdd` records in the spec's
Brownfield-baseline block — is `sha256(fingerprint-bytes)`, where the bytes
come from your adapter's `treeBytes`. So the adapter fully determines what
"the repository's content" means for the token.

---

## How `agent-sdd` selects and loads an adapter

The `.sdd/config.json` field `vcs` selects the adapter:

- **absent or `"git"`** → the built-in git adapter (default; unchanged
  behaviour);
- **any other string** → a **module specifier** of your adapter package.

Loading is deterministic and fail-closed:

1. `agent-sdd` resolves the module **from the consumer repository's
   `node_modules`** (not from its own install) — a bare package name like
   `my-vcs-adapter` resolves the same way `require()` would from your repo
   root; a path (`./adapters/local.js`, absolute) resolves against the repo
   root and must stay inside it.
2. It imports the module and picks a **factory**: a named `createVcs` export,
   a default factory function, or a default object exposing `createVcs`.
3. It calls `createVcs({ repoRoot })` and **validates the returned object's
   shape** (all eight methods present and callable, `mechanism` a string
   matching the grammar below).
4. It checks that the adapter's `mechanism` **equals** `config.mechanism`.

Any failure — module not found, no factory, missing method, bad `mechanism`,
or a mismatch with `config.mechanism` — exits `2` (configuration error) with
a descriptive message and changes nothing. The adapter runs **in-process and
is trusted**; `agent-sdd` validates its shape, not its behaviour.

---

## The `Vcs` contract

Your factory returns an object implementing this interface (shown in
TypeScript; a plain JS object with the same methods is fine):

```ts
interface Vcs {
  readonly mechanism: string;
  isGitRepo(cwd: string): Promise<boolean>;
  repoRoot(cwd: string): Promise<string>;
  headSha(repoRoot: string): Promise<string>;
  treeBytes(repoRoot: string, scope: readonly string[]): Promise<Uint8Array>;
  treePaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
  dirtyPaths(repoRoot: string, scope: readonly string[]): Promise<string[]>;
  changedPaths(
    repoRoot: string,
    baselineCommitSha: string,
    scope: readonly string[],
  ): Promise<string[]>;
  readAtRef(
    repoRoot: string,
    ref: string,
    relativePath: string,
  ): Promise<string | null>;
}

interface VcsAdapterOptions {
  repoRoot: string;
}

export function createVcs(options: VcsAdapterOptions): Vcs | Promise<Vcs>;
```

> The method named `isGitRepo` is part of the historical contract name; for a
> non-git adapter read it as "is this a working copy of my VCS?". Keep the
> name — `agent-sdd` calls it by that name.

### Method reference

| Method | Must return | Used by |
|---|---|---|
| `mechanism` | fingerprint algorithm id, e.g. `myvcs_tree_hash_v1` | echoed in `token` / `check` JSON |
| `isGitRepo(cwd)` | `true` if `cwd` is inside a working copy, else `false` (never throw) | optional baseline check in `ready` |
| `repoRoot(cwd)` | the project root — the directory `agent-sdd` treats as the repo (see Path conventions) | every command |
| `headSha(repoRoot)` | the current head revision id as a string | `token`, `check`, `refresh` |
| `treeBytes(repoRoot, scope)` | deterministic bytes fingerprinting the content of `scope`; `sha256` of these is the token | `token`, `check`, `ready` |
| `treePaths(repoRoot, scope)` | every file path under `scope` (repoRoot-relative) | glob-scope validation |
| `dirtyPaths(repoRoot, scope)` | paths inside `scope` with uncommitted changes (repoRoot-relative), sorted | `token`, `check`, `refresh` |
| `changedPaths(repoRoot, baseline, scope)` | paths inside `scope` changed between `baseline` and head (repoRoot-relative), sorted | `refresh` |
| `readAtRef(repoRoot, ref, path)` | file content at `ref`, or `null` if the path/ref is absent | `ready --against`, `report --against` |

`scope` is the configured `discovery_scope` — an array of paths/globs
relative to `repoRoot`.

---

## `mechanism`

`mechanism` is a stable id for **how** your adapter fingerprints content. It
must match the grammar:

```
^[a-z][a-z0-9_]*$
```

(e.g. `git_tree_hash_v1`, `myvcs_content_v1`). Pick a value distinct from the
built-in `git_tree_hash_v1` unless your bytes are genuinely git-compatible.
Treat it as a versioned contract: if you ever change how `treeBytes` is
produced in a way that changes the hash for unchanged content, bump the
suffix (`_v2`). The consumer sets the same value in `.sdd/config.json`'s
`mechanism`; a mismatch is a hard error.

---

## Path conventions (the part that bites)

`agent-sdd` works entirely in **repoRoot-relative** paths: `discovery_scope`,
the IMP footprints in the spec, the `spec_file` path, the paths your methods
return, and the path passed to `readAtRef` are all relative to whatever your
`repoRoot()` returns.

Two rules follow:

1. **`repoRoot()` must be the directory that carries `.sdd/config.json`.**
   `agent-sdd` reads the config from `repoRoot/.sdd/config.json` and resolves
   `discovery_scope` against it. If your VCS's notion of "repository root"
   differs from the project that `agent-sdd` governs (common in monorepos,
   where one VCS root contains many independent projects), do **not** return
   the VCS root — walk up to the nearest `.sdd/config.json` and return that.

2. **Normalize paths to repoRoot-relative on the way out, and back on the way
   in.** If your VCS CLI prints paths relative to its own root (not your
   project dir) for some commands, strip the project prefix from their output;
   if a command (like "read file at revision") wants a VCS-root-relative path,
   prepend the prefix before calling it. Keep the translation **per-command
   and unambiguous** — compute the prefix once (`repoRoot` relative to the VCS
   root) and apply it deterministically, never by guessing a path's origin
   from its string. Restrict `discovery_scope` to paths inside the project so
   the mapping stays a clean bijection.

Verify both rules against a **real** working copy of your VCS. Do not assume
your VCS behaves like git: command syntax, which paths a command accepts, and
whether output is cwd-relative or root-relative all vary, and getting them
wrong silently produces wrong tokens or empty diffs rather than errors.

---

## Error handling

- `isGitRepo` never throws — return `false` on any failure.
- `readAtRef` returns `null` (not throw) when the ref or path is missing.
- The other methods throw a normal `Error` with a clear message on failure
  (e.g. "cli not on PATH", "`<cmd>` failed: <stderr>"). `agent-sdd`'s precise
  exit-code mapping (the fail-closed exit-2 shape) is reserved for the
  built-in adapter; an external adapter's `Error` surfaces as a non-zero exit
  with your message.

Keep every invocation **read-only**. An adapter must never mutate the working
copy or history.

---

## Packaging

A minimal adapter package:

```jsonc
// package.json
{
  "name": "my-vcs-adapter",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "engines": { "node": ">=20" },
  "files": ["dist", "README.md"]
}
```

- No runtime dependency on `agent-sdd` — the contract is structural. Copy the
  `Vcs` interface locally for type-checking.
- Ship the built `dist/`. Both ESM and CommonJS packages load.
- Export `createVcs` (named is preferred; a default factory also works).

---

## Configuring the consumer repo

Install the adapter into the repo that carries `.sdd/config.json`:

```sh
npm install my-vcs-adapter
```

```jsonc
// .sdd/config.json
{
  "spec_file": "spec/spec.md",
  "baseline_id": "<partition>:BL-001",
  "discovery_scope": ["src", "tests"],
  "vcs": "my-vcs-adapter",
  "mechanism": "myvcs_content_v1"
}
```

---

## Testing your adapter

Two layers:

1. **Shape conformance** — a unit test that `createVcs({ repoRoot })` returns
   an object with all eight methods as functions and a grammar-valid
   `mechanism`. This is exactly what `agent-sdd` checks at load time, so it
   catches contract drift early.

2. **Live behaviour** — against a real working copy of your VCS, call each
   method and assert: `repoRoot` is the project dir, `headSha` is a stable id,
   `treePaths`/`dirtyPaths`/`changedPaths` are repoRoot-relative,
   `treeBytes`→`sha256` is stable for unchanged content, `readAtRef` returns
   the file's content at head. This is the only place command syntax and path
   relativity are actually proven — do not skip it.

---

## Worked skeleton

```ts
// src/index.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

export const MECHANISM = "myvcs_content_v1";

interface Vcs { /* the interface from above */ }

export class MyVcs implements Vcs {
  readonly mechanism = MECHANISM;

  async isGitRepo(cwd: string): Promise<boolean> {
    try { return (await run(cwd, ["is-repo"])).code === 0; }
    catch { return false; }
  }

  // repoRoot = the project dir, not the VCS root: walk up to .sdd/config.json
  async repoRoot(cwd: string): Promise<string> {
    let dir = resolve(cwd);
    for (;;) {
      if (existsSync(join(dir, ".sdd", "config.json"))) return dir;
      const up = dirname(dir);
      if (up === dir) throw new Error("no .sdd/config.json above " + cwd);
      dir = up;
    }
  }

  async headSha(repoRoot: string): Promise<string> {
    const r = await run(repoRoot, ["head-id"]);
    if (r.code !== 0) throw new Error("head-id failed: " + r.stderr);
    return r.stdout.toString("utf8").trim();
  }

  // treeBytes / treePaths / dirtyPaths / changedPaths / readAtRef:
  // run your VCS, normalize paths to repoRoot-relative, return the bytes/lists.
}

export function createVcs(_options: { repoRoot: string }): Vcs {
  return new MyVcs();
}
export default { createVcs };

function run(cwd: string, args: string[]) {
  return new Promise<{ code: number; stdout: Buffer; stderr: Buffer }>((res, rej) => {
    const c = spawn("myvcs", args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const out: Buffer[] = [], err: Buffer[] = [];
    c.stdout.on("data", (b: Buffer) => out.push(b));
    c.stderr.on("data", (b: Buffer) => err.push(b));
    c.on("error", rej);
    c.on("close", (code) => res({ code: code ?? 1, stdout: Buffer.concat(out), stderr: Buffer.concat(err) }));
  });
}
```

Fill in the five content methods against your VCS, prove them against a real
working copy, and you have a working adapter.
