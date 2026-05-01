// INV-010 / CTR-016 / SUR-009 — every published diagnostic-ID literal in
// product source ∈ DiagnosticRegistry, and every registry entry is referenced
// ≥1 time as a Diagnostic.rule (lint) or ReadyViolation.kind (ready).

import assert from "node:assert/strict";
import test from "node:test";
import { promises as fs } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

import {
  LINT_DIAGNOSTIC_ID_GRAMMAR,
  LINT_DIAGNOSTIC_IDS,
  READY_VIOLATION_KINDS,
} from "../../src/shared/domain/DiagnosticRegistry.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const srcRoot = resolve(repoRoot, "src");
const registrySrcPath = resolve(srcRoot, "shared/domain/DiagnosticRegistry.ts");

async function listTsFilesUnder(root: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = resolve(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && full.endsWith(".ts")) out.push(full);
    }
  }
  await walk(root);
  return out;
}

async function readAllSrcFiles(root: string): Promise<Array<{ path: string; content: string }>> {
  const files = await listTsFilesUnder(root);
  return Promise.all(files.map(async (p) => ({ path: p, content: await fs.readFile(p, "utf8") })));
}

test("every \"sdd:*\" literal in src/ is in LINT_DIAGNOSTIC_IDS (INV-010)", async () => {
  const files = await readAllSrcFiles(srcRoot);
  const offenders: Array<{ path: string; literal: string }> = [];
  const literalRe = /"(sdd:[a-z][a-z0-9-]*)"/g;
  const allowed = new Set<string>(LINT_DIAGNOSTIC_IDS as readonly string[]);

  for (const { path, content } of files) {
    if (path === registrySrcPath) continue;
    let m: RegExpExecArray | null;
    while ((m = literalRe.exec(content)) !== null) {
      const lit = m[1]!;
      if (!LINT_DIAGNOSTIC_ID_GRAMMAR.test(lit)) continue;
      if (!allowed.has(lit)) {
        offenders.push({ path: relative(repoRoot, path), literal: lit });
      }
    }
  }

  assert.deepEqual(offenders, []);
});

test("every entry in LINT_DIAGNOSTIC_IDS is referenced ≥1 time as a literal in src/ (INV-010 inverse)", async () => {
  const files = await readAllSrcFiles(srcRoot);
  const concatenated = files
    .filter((f) => f.path !== registrySrcPath)
    .map((f) => f.content)
    .join("\n");
  const orphans = LINT_DIAGNOSTIC_IDS.filter((id) => !concatenated.includes(`"${id}"`));
  assert.deepEqual(orphans, []);
});

test("every entry in READY_VIOLATION_KINDS is referenced ≥1 time in src/features/ready/", async () => {
  const readyRoot = resolve(srcRoot, "features/ready");
  const files = await readAllSrcFiles(readyRoot);
  const concatenated = files.map((f) => f.content).join("\n");
  const orphans = READY_VIOLATION_KINDS.filter((kind) => !concatenated.includes(`"${kind}"`));
  assert.deepEqual(orphans, []);
});
