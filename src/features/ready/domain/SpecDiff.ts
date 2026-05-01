// P2.3 — Semver cascade diff engine (ENF-004A).
//
// Given two parsed snapshots of normative records (current vs. an --against
// ref), classify per-ID changes and compute the required Surface bump.
//
// Classification (per ID present in both snapshots):
//   - predicate_change — a predicate-bearing field flipped its semantic
//     content. Predicate-bearing fields: always, never, when, then,
//     predicate, schema, preconditions, postconditions, error_taxonomy,
//     compatibility_rules. Predicate-change cascades to a major bump on
//     every Surface that reaches the changed ID.
//   - content_change — any other field changed (notes, title, applicability
//     tweaks that are not predicate-bearing). Content-change cascades to
//     ≥minor on the Surface.
//   - none — no observable change.
//
// Required Surface bump (per Surface):
//   - "major" if any reachable contractual ID has predicate_change
//   - "minor" if any has content_change (and none has predicate_change)
//   - "patch" otherwise
//
// Pure logic — no I/O. Reading the prior snapshot is a feature-local
// outbound port (NodeGitFileReader).

import type { LintRecord } from "../../../shared/domain/SpecRecord.js";

export type DiffClassification = "predicate_change" | "content_change" | "none";

const PREDICATE_FIELDS: ReadonlySet<string> = new Set([
  "always",
  "never",
  "when",
  "then",
  "predicate",
  "schema",
  "preconditions",
  "postconditions",
  "error_taxonomy",
  "compatibility_rules",
  "rule",                 // Constraint, Policy
  "metric",               // NFR
  "target",               // NFR
  "given",                // Behavior
]);

export interface ClassifiedDiff {
  id: string;
  template: string | null;
  classification: DiffClassification;
  changedFields: string[];
}

/** Per-ID diff: classify each ID present in `curr` against `prev`. IDs new to
 *  `curr` are classified as "content_change" (additive). IDs removed in
 *  `curr` are not returned (the consumer detects removal separately via
 *  lifecycle.status flips, which lint already covers). */
export function classifyDiff(
  prev: ReadonlyArray<LintRecord>,
  curr: ReadonlyArray<LintRecord>,
): ClassifiedDiff[] {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const out: ClassifiedDiff[] = [];
  for (const c of curr) {
    const p = prevById.get(c.id);
    if (p === undefined) {
      out.push({ id: c.id, template: c.template, classification: "content_change", changedFields: ["__new__"] });
      continue;
    }
    const changed = changedTopLevelKeys(p.parsed, c.parsed);
    if (changed.length === 0) {
      out.push({ id: c.id, template: c.template, classification: "none", changedFields: [] });
      continue;
    }
    const isPredicate = changed.some((k) => PREDICATE_FIELDS.has(k));
    out.push({
      id: c.id,
      template: c.template,
      classification: isPredicate ? "predicate_change" : "content_change",
      changedFields: changed,
    });
  }
  return out;
}

/** Required bump for a single Surface, computed by walking reachable IDs. */
export type RequiredBump = "patch" | "minor" | "major";

export interface SurfaceBumpAnalysis {
  surfaceId: string;
  declaredVersion: string | null;
  prevDeclaredVersion: string | null;
  required: RequiredBump;
  drivenBy: ClassifiedDiff[];
}

export function requiredSurfaceBumps(
  prev: ReadonlyArray<LintRecord>,
  curr: ReadonlyArray<LintRecord>,
  diffs: ReadonlyArray<ClassifiedDiff>,
): SurfaceBumpAnalysis[] {
  const prevById = new Map(prev.map((r) => [r.id, r]));
  const diffById = new Map(diffs.map((d) => [d.id, d]));
  const currSurfaces = curr.filter((r) => r.template === "Surface");

  const out: SurfaceBumpAnalysis[] = [];
  for (const sur of currSurfaces) {
    const reachable = reachableFrom(sur, curr);
    const drivenBy: ClassifiedDiff[] = [];
    for (const id of reachable) {
      const d = diffById.get(id);
      if (d !== undefined && d.classification !== "none") drivenBy.push(d);
    }
    const required = drivenBy.some((d) => d.classification === "predicate_change")
      ? "major"
      : drivenBy.some((d) => d.classification === "content_change")
        ? "minor"
        : "patch";
    const declaredVersion = readVersion(sur);
    const prevSur = prevById.get(sur.id);
    const prevDeclaredVersion = prevSur !== undefined ? readVersion(prevSur) : null;
    out.push({
      surfaceId: sur.id,
      declaredVersion,
      prevDeclaredVersion,
      required,
      drivenBy,
    });
  }
  return out;
}

function reachableFrom(surface: LintRecord, all: ReadonlyArray<LintRecord>): Set<string> {
  const out = new Set<string>([surface.id]);
  const byId = new Map(all.map((r) => [r.id, r]));
  const queue: string[] = [surface.id];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const r = byId.get(id);
    if (r === undefined) continue;
    const members = r.parsed.members;
    if (Array.isArray(members)) {
      for (const m of members) if (typeof m === "string" && !out.has(m)) {
        out.add(m);
        queue.push(m);
      }
    }
    const policyRefs = r.parsed.policy_refs;
    if (Array.isArray(policyRefs)) {
      for (const p of policyRefs) if (typeof p === "string" && !out.has(p)) {
        out.add(p);
        queue.push(p);
      }
    }
  }
  return out;
}

function readVersion(rec: LintRecord): string | null {
  const v = rec.parsed.version;
  return typeof v === "string" ? v : null;
}

/** Compare two semver strings ("0.3.0" vs "0.4.0") and return the actual bump.
 *  Returns null if either string is unparseable. */
export function actualBump(prev: string | null, curr: string | null): RequiredBump | null {
  if (prev === null || curr === null) return null;
  const p = parseSemver(prev);
  const c = parseSemver(curr);
  if (p === null || c === null) return null;
  if (c.major > p.major) return "major";
  if (c.major === p.major && c.minor > p.minor) return "minor";
  if (c.major === p.major && c.minor === p.minor && c.patch > p.patch) return "patch";
  return "patch"; // unchanged or downgrade — treat as patch (no cascade triggered)
}

interface ParsedSemver { major: number; minor: number; patch: number; }

function parseSemver(v: string): ParsedSemver | null {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(v.trim());
  if (m === null) return null;
  return {
    major: Number.parseInt(m[1]!, 10),
    minor: Number.parseInt(m[2]!, 10),
    patch: Number.parseInt(m[3]!, 10),
  };
}

const BUMP_RANK: Record<RequiredBump, number> = { patch: 0, minor: 1, major: 2 };

export function bumpAtLeast(actual: RequiredBump | null, required: RequiredBump): boolean {
  if (actual === null) return false;
  return BUMP_RANK[actual] >= BUMP_RANK[required];
}

function changedTopLevelKeys(prev: Record<string, unknown>, curr: Record<string, unknown>): string[] {
  const out: string[] = [];
  const keys = new Set([...Object.keys(prev), ...Object.keys(curr)]);
  // Skip metadata keys that don't affect semver: id, type, partition_id,
  // lifecycle (status flips are governed separately), approval_record.
  const SKIP = new Set(["id", "type", "partition_id", "lifecycle", "approval_record", "version"]);
  for (const k of keys) {
    if (SKIP.has(k)) continue;
    if (!deepEqual(prev[k], curr[k])) out.push(k);
  }
  return out;
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object") return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false;
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(ao), ...Object.keys(bo)]);
  for (const k of keys) if (!deepEqual(ao[k], bo[k])) return false;
  return true;
}
