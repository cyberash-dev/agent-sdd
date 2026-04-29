import { parseAllDocuments, parseDocument } from "yaml";
import type { LintRecord } from "./Record.js";

// Extract LintRecord[] from a markdown file's YAML fences.
//
// Supports two YAML shapes inside a ```yaml fence:
//   (a) `---`-separated documents (canonical sdd-cli format)
//   (b) a single document whose root is a list of objects (used by some
//       brownfield specs, e.g. pipeline-state-mcp).

const ALIAS_FIELDS: ReadonlyArray<string> = [
  "negative_test_obligations",
  "tests_pre",
  "tests_during",
  "tests_post",
  "tests_old_behavior",
  "tests_new_behavior",
];

export function lintRecordsFromMarkdown(file: string, markdown: string): LintRecord[] {
  const out: LintRecord[] = [];
  for (const fence of yamlFences(markdown)) {
    out.push(...lintRecordsFromFence(file, fence));
  }
  return out;
}

interface YamlFence {
  raw: string;
  startLine: number;   // 1-based, first content line inside the fence
}

function yamlFences(markdown: string): YamlFence[] {
  const lines = markdown.split(/\r?\n/);
  const fences: YamlFence[] = [];
  let inFence = false;
  let buffer: string[] = [];
  let startLine = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (!inFence && /^```yaml\s*$/.test(line)) {
      inFence = true;
      buffer = [];
      startLine = i + 2;
      continue;
    }
    if (inFence && /^```\s*$/.test(line)) {
      fences.push({ raw: buffer.join("\n"), startLine });
      inFence = false;
      continue;
    }
    if (inFence) buffer.push(line);
  }
  return fences;
}

function lintRecordsFromFence(file: string, fence: YamlFence): LintRecord[] {
  // Heuristic: if the fence contains a top-level `---` line, treat it as a
  // multi-document YAML stream. Otherwise treat the whole block as a single
  // document.
  const hasSeparator = fence.raw.split(/\r?\n/).some((l) => l === "---");

  if (hasSeparator) {
    const docs = parseAllDocuments(fence.raw, { prettyErrors: false });
    const out: LintRecord[] = [];
    for (const doc of docs) {
      if (doc.errors.length > 0) continue;
      const value = doc.toJS() as unknown;
      if (!isObject(value)) continue;
      const rec = recordFromObject(file, value, fence.startLine + (doc.range?.[0] ?? 0));
      if (rec !== null) out.push(rec);
    }
    return out;
  }

  const doc = parseDocument(fence.raw, { prettyErrors: false });
  if (doc.errors.length > 0) return [];
  const value = doc.toJS() as unknown;

  if (Array.isArray(value)) {
    const out: LintRecord[] = [];
    const fenceLines = fence.raw.split(/\r?\n/);
    let cursor = 0;
    for (const item of value) {
      if (!isObject(item)) continue;
      const id = typeof item.id === "string" ? item.id : null;
      let lineWithin = cursor;
      if (id !== null) {
        for (let j = cursor; j < fenceLines.length; j++) {
          if (new RegExp(`^-\\s+id:\\s*${escapeRe(id)}\\b`).test(fenceLines[j]!)) {
            lineWithin = j;
            cursor = j + 1;
            break;
          }
        }
      }
      const rec = recordFromObject(file, item, fence.startLine + lineWithin);
      if (rec !== null) out.push(rec);
    }
    return out;
  }

  if (isObject(value)) {
    const rec = recordFromObject(file, value, fence.startLine);
    return rec === null ? [] : [rec];
  }

  return [];
}

function recordFromObject(file: string, value: Record<string, unknown>, line: number): LintRecord | null {
  const id = typeof value.id === "string" ? value.id : null;
  if (id === null) return null;

  const template = pickTemplate(value);
  const lifecycleStatus = pickLifecycleStatus(value);
  const approvalRecord = pickApprovalRecord(value);
  const testObligations = stringArray(value.test_obligations);
  const hasAliasedObligations = ALIAS_FIELDS.some((k) => value[k] !== undefined)
    || hasSingularTestObligation(value);

  return {
    id,
    template,
    lifecycleStatus,
    approvalRecord,
    testObligations,
    hasAliasedObligations,
    parsed: value,
    file,
    line,
    rawBlock: "",
  };
}

// SDD-canonical alternative to plural test_obligations: a singular
// `test_obligation:` block carrying { predicate, test_template,
// boundary_classes, failure_scenarios } as a structured object. We treat any
// object form (or an explicit `not_applicable: <reason>` discriminator) as
// discharging §4. The shape of the predicate itself is not validated here.
function hasSingularTestObligation(value: Record<string, unknown>): boolean {
  const v = value.test_obligation;
  if (isObject(v)) return true;
  if (typeof v === "string" && v.startsWith("not_applicable")) return true;
  return false;
}

function pickTemplate(value: Record<string, unknown>): string | null {
  const t = value.template ?? value.type;
  return typeof t === "string" ? t : null;
}

function pickLifecycleStatus(value: Record<string, unknown>): string | null {
  // Flat: lifecycle.status: x   → key `lifecycle.status`
  const flat = (value as Record<string, unknown>)["lifecycle.status"];
  if (typeof flat === "string") return flat;
  // Nested: lifecycle: { status: x }
  const nested = value.lifecycle;
  if (isObject(nested) && typeof nested.status === "string") return nested.status;
  return null;
}

function pickApprovalRecord(value: Record<string, unknown>): string | null {
  // Top-level form: approval_record: ...
  const top = value.approval_record;
  const fromTop = describeApprovalRecord(top);
  if (fromTop !== null) return fromTop;
  // Nested form: lifecycle: { approval_record: ... }
  const lifecycle = value.lifecycle;
  if (isObject(lifecycle)) {
    return describeApprovalRecord(lifecycle.approval_record);
  }
  return null;
}

function describeApprovalRecord(v: unknown): string | null {
  if (v === undefined) return null;
  if (typeof v === "string") return v;
  if (isObject(v)) {
    const tag = typeof v.approver_identity === "string" ? `obj:${v.approver_identity}` : "obj:unknown";
    return tag;
  }
  return null;
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeRe(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
