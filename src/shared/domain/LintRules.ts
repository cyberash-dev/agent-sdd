import type { Diagnostic } from "./LintReport.js";
import { NORMATIVE_TEMPLATES, VALID_LIFECYCLE_STATUS, type LintRecord } from "./SpecRecord.js";

// Pure rule functions. Each returns 0..N diagnostics for a single record.
// No I/O. No globals. The caller wires Diagnostics together into a LintReport.

export const REQUIRED_PARTITION_SECTIONS: ReadonlyArray<string> = [
  "1. Context",
  "2. Glossary",
  "3. Partition",
  "4. Brownfield baseline",
  "5. Surfaces",
  "6. Requirements",
  "7. Data contracts",
  "8. Invariants",
  "9. External dependencies",
  "10. Generated artifacts",
  "11. Localization",
  "12. Policies",
  "13. Constraints",
  "14. Migrations",
  "15. Deltas",
  "16. Implementation bindings",
  "17. Open questions",
  "18. Assumptions",
  "19. Out of scope",
];

export const NORMATIVE_SECTIONS: ReadonlyArray<string> = [
  "6. Requirements",
  "7. Data contracts",
  "8. Invariants",
  "9. External dependencies",
  "11. Localization",
  "12. Policies",
  "13. Constraints",
  "14. Migrations",
  "15. Deltas",
];

export const WEASEL_WORDS: ReadonlyArray<string> = [
  "возможно",
  "вероятно",
  "обычно",
  "as a rule",
  "etc.",
  "and so on",
  "may be",
  "might be",
  "should usually",
  "similar to",
  "approximately",
  "best-effort",
  "best effort",
  "informally",
];

const VALID_EVIDENCE: ReadonlySet<string> = new Set(["public_api", "test_probe", "db_constraint", "operational_signal"]);
const VALID_STABILITY: ReadonlySet<string> = new Set(["contractual", "internal"]);
const VALID_DATA_SCOPE_PREFIX: ReadonlyArray<string> = ["new_writes_only", "all_data", "post_migration:"];
const VALID_VERIFICATION_STAGE: ReadonlySet<string> = new Set(["ci_unit", "ci_integration", "perf_lab", "staging_canary", "prod_slo"]);
const VALID_RUNTIME_STATE: ReadonlySet<string> = new Set(["pre_cutover", "in_progress", "cutover_done", "rolled_back"]);
const VALID_DIRECTION: ReadonlySet<string> = new Set(["forward_only", "reversible"]);
const VALID_MODE: ReadonlySet<string> = new Set(["online", "offline", "dual_write", "backfill", "dual_emit_with_legacy_text"]);
const VALID_BOUNDARY: ReadonlySet<string> = new Set([
  "api",
  "sdk",
  "event_bus",
  "cli",
  "public_db",
  "public_storage",
  "generated_published_artifact",
]);

const OBLIGATIONLESS_TEMPLATES: ReadonlySet<string> = new Set(["Surface"]);

// ---------------------------------------------------------------------------
// Per-record rules.
// ---------------------------------------------------------------------------

export function lifecycleStatusRules(rec: LintRecord): Diagnostic[] {
  const out: Diagnostic[] = [];
  const isNormative = rec.template !== null && (NORMATIVE_TEMPLATES as Set<string>).has(rec.template);
  if (!isNormative) return out;
  if (rec.lifecycleStatus === null) {
    out.push({
      severity: "error",
      rule: "sdd:lifecycle-status-present",
      file: rec.file,
      line: rec.line,
      message: `ID "${rec.id}" missing lifecycle.status (SDD §1.6 + §14).`,
    });
    return out;
  }
  if (!(VALID_LIFECYCLE_STATUS as Set<string>).has(rec.lifecycleStatus)) {
    out.push({
      severity: "error",
      rule: "sdd:lifecycle-status-valid",
      file: rec.file,
      line: rec.line,
      message: `ID "${rec.id}" has invalid lifecycle.status="${rec.lifecycleStatus}". Valid: draft|proposed|approved|deprecated|removed.`,
    });
  }
  return out;
}

export function approvalRecordRules(rec: LintRecord): Diagnostic[] {
  const out: Diagnostic[] = [];
  const isNormative = rec.template !== null && (NORMATIVE_TEMPLATES as Set<string>).has(rec.template);
  if (!isNormative) return out;
  const status = rec.lifecycleStatus;
  const ar = rec.approvalRecord;
  if (status === "approved" || status === "deprecated" || status === "removed") {
    if (ar === null || ar === "" || ar.startsWith("not_applicable")) {
      out.push({
        severity: "error",
        rule: "sdd:approval-record-required",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" has lifecycle.status=${status} but no real approval_record (SDD §7.5).`,
      });
    }
  }
  if ((status === "draft" || status === "proposed") && ar !== null && ar !== "" && !ar.startsWith("not_applicable")) {
    out.push({
      severity: "error",
      rule: "sdd:approval-record-forbidden",
      file: rec.file,
      line: rec.line,
      message: `ID "${rec.id}" has lifecycle.status=${status} but approval_record is set (SDD §7.3).`,
    });
  }
  return out;
}

export function testObligationRules(rec: LintRecord): Diagnostic[] {
  const out: Diagnostic[] = [];
  const isNormative = rec.template !== null && (NORMATIVE_TEMPLATES as Set<string>).has(rec.template);
  if (!isNormative) return out;
  if ((OBLIGATIONLESS_TEMPLATES as Set<string>).has(rec.template!)) return out;
  const hasAny = rec.testObligations.length > 0 || rec.hasAliasedObligations;
  if (hasAny) return out;
  out.push({
    severity: rec.template === "Constraint" ? "warn" : "error",
    rule: "sdd:test-obligation-required",
    file: rec.file,
    line: rec.line,
    message: `ID "${rec.id}" (template=${rec.template}) has no test_obligations / aliased obligation entry (SDD §4).`,
  });
  return out;
}

export function fieldTypeRules(rec: LintRecord): Diagnostic[] {
  const out: Diagnostic[] = [];
  const v = rec.parsed;

  if (rec.template !== "Surface") {
    const versionV = v.version;
    if (versionV !== undefined && (typeof versionV !== "number" || !Number.isInteger(versionV))) {
      out.push({
        severity: "error",
        rule: "sdd:type-version-int",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" version="${String(versionV)}" is not an integer (SDD §1.5).`,
      });
    }
  }

  if (rec.template === "Invariant") {
    const ev = v.evidence;
    if (typeof ev === "string" && !VALID_EVIDENCE.has(ev)) {
      out.push({
        severity: "error",
        rule: "sdd:type-invariant-evidence",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" evidence="${ev}" not in {public_api, test_probe, db_constraint, operational_signal} (SDD §1.7).`,
      });
    }
    const st = v.stability;
    if (typeof st === "string" && !VALID_STABILITY.has(st)) {
      out.push({
        severity: "error",
        rule: "sdd:type-invariant-stability",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" stability="${st}" not in {contractual, internal} (SDD §1.7).`,
      });
    }
  }

  const ds = v.data_scope;
  if (typeof ds === "string" && ds !== "not_applicable") {
    const ok = VALID_DATA_SCOPE_PREFIX.some((p) => ds === p || ds.startsWith(p));
    if (!ok) {
      out.push({
        severity: "error",
        rule: "sdd:type-data-scope",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" data_scope="${ds}" not in {new_writes_only, all_data, post_migration:<MIG-ID>} (SDD §14).`,
      });
    }
  }

  if (rec.template === "NFR") {
    const stage = readVerificationStage(v);
    if (stage !== null && !VALID_VERIFICATION_STAGE.has(stage)) {
      out.push({
        severity: "error",
        rule: "sdd:type-nfr-stage",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" verification_stage="${stage}" not in {ci_unit, ci_integration, perf_lab, staging_canary, prod_slo} (SDD §9.4).`,
      });
    }
  }

  if (rec.template === "Migration") {
    const dir = v.direction;
    if (typeof dir === "string" && !VALID_DIRECTION.has(dir)) {
      out.push({
        severity: "error",
        rule: "sdd:type-migration-direction",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" direction="${dir}" not in {forward_only, reversible} (SDD §14).`,
      });
    }
    const mode = v.mode;
    if (typeof mode === "string" && !VALID_MODE.has(mode)) {
      out.push({
        severity: "error",
        rule: "sdd:type-migration-mode",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" mode="${mode}" not in {online, offline, dual_write, backfill, dual_emit_with_legacy_text} (SDD §14).`,
      });
    }
    const rs = v.runtime_state;
    if (typeof rs === "string" && !VALID_RUNTIME_STATE.has(rs)) {
      out.push({
        severity: "error",
        rule: "sdd:type-migration-runtime-state",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" runtime_state="${rs}" not in {pre_cutover, in_progress, cutover_done, rolled_back} (SDD §11.3-bis).`,
      });
    }
  }

  if (rec.template === "Surface") {
    const bt = v.boundary_type;
    if (typeof bt === "string" && !VALID_BOUNDARY.has(bt)) {
      out.push({
        severity: "error",
        rule: "sdd:type-surface-boundary-type",
        file: rec.file,
        line: rec.line,
        message: `ID "${rec.id}" boundary_type="${bt}" not in {api, sdk, event_bus, cli, public_db, public_storage, generated_published_artifact} (SDD §1.4).`,
      });
    }
  }

  return out;
}

function readVerificationStage(v: Record<string, unknown>): string | null {
  const vo = v.verification_obligation;
  if (typeof vo === "object" && vo !== null && !Array.isArray(vo)) {
    const stage = (vo as Record<string, unknown>).verification_stage;
    return typeof stage === "string" ? stage : null;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Section presence (per partition file). Operates on raw markdown.
// ---------------------------------------------------------------------------

export interface SectionViolation {
  rule: "sdd:section-presence" | "sdd:section-order";
  message: string;
}

export function sectionViolations(markdown: string): SectionViolation[] {
  const headings = parseHeadings(markdown);
  const out: SectionViolation[] = [];
  for (let i = 0; i < REQUIRED_PARTITION_SECTIONS.length; i++) {
    const required = REQUIRED_PARTITION_SECTIONS[i]!;
    if (headings[i] === required) continue;
    if (!headings.includes(required)) {
      out.push({ rule: "sdd:section-presence", message: `Missing required section "${required}" (SDD §2).` });
    } else {
      out.push({
        rule: "sdd:section-order",
        message: `Section "${required}" is out of order; expected position ${i + 1}, found at position ${headings.indexOf(required) + 1}.`,
      });
    }
  }
  return out;
}

function parseHeadings(markdown: string): string[] {
  const out: string[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m !== null && /^\d+\./.test(m[1]!)) out.push(m[1]!);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Weasel-word scan (per file). Operates on raw markdown.
// ---------------------------------------------------------------------------

export interface WeaselFinding {
  line: number;
  word: string;
  section: string;
}

export function weaselFindings(markdown: string): WeaselFinding[] {
  const out: WeaselFinding[] = [];
  const lines = markdown.split(/\r?\n/);
  let currentSection = "";
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const headingM = /^##\s+(.+?)\s*$/.exec(line);
    if (headingM !== null) {
      currentSection = headingM[1]!;
      continue;
    }
    if (!NORMATIVE_SECTIONS.includes(currentSection)) continue;
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (/^-?\s*(id:|test_obligations:|to:|target_ids:|target_id:|source_open_q:)/.test(trimmed)) continue;
    if (/^to:[a-z\-]+:[a-z\-]+:/.test(trimmed)) continue;
    const lower = line.toLowerCase();
    for (const w of WEASEL_WORDS) {
      if (lower.includes(w.toLowerCase())) {
        out.push({ line: i + 1, word: w, section: currentSection });
        break;
      }
    }
  }
  return out;
}
