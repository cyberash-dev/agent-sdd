import { appendDiagnostic, emptyReport, type Diagnostic, type LintReport } from "../domain/Diagnostic.js";

export type { Diagnostic, LintReport };
import { lintRecordsFromMarkdown } from "../domain/SpecParser.js";
import {
  applicabilityRequiredRule,
  approvalRecordRules,
  assumptionDowngradeApprovalRule,
  baselineVersionRequiredRule,
  boundaryConcurrencyModelRule,
  boundaryPolicyRefRule,
  dataScopeRequiredRule,
  debtBudgetFormRule,
  deprecatedFieldsRequiredRule,
  fieldTypeRules,
  generatedArtifactSurfaceRefRule,
  lifecycleStatusRules,
  migrationCrossPartitionRule,
  migrationEnforcementStageRule,
  openQBlockingRule,
  partitionDefaultPolicySetRule,
  REQUIRED_PARTITION_SECTIONS,
  sectionViolations,
  testObligationRules,
  weaselFindings,
} from "../domain/Rules.js";
import { reachableBoundaryIds } from "../../../shared/domain/BoundaryReachability.js";
import { fileInGlobs } from "../../../shared/domain/GlobMatch.js";
import type { LintConfigPort } from "../ports/outbound/LintConfigPort.js";
import type { LintFileReader, SpecFileEntry } from "../ports/outbound/LintFileReader.js";

export interface RunLintPorts {
  config: LintConfigPort;
  files: LintFileReader;
}

export async function runLint(cwd: string, ports: RunLintPorts): Promise<LintReport> {
  const config = await ports.config.config(cwd);
  const entries = await ports.files.resolveSpecFiles(cwd, config.lint.specFiles);
  let report = emptyReport();
  for (const entry of entries) {
    report = lintFileInto(report, entry, config.lint.approverBlocklist, config.lint.partitionGlob);
  }
  return report;
}

function lintFileInto(report: LintReport, entry: SpecFileEntry, approverBlocklist: readonly string[], partitionGlob: readonly string[]): LintReport {
  let next = report;

  // §2 — section presence. When `lint.partition_glob` is configured, the §2
  // structure check applies to files whose path matches a glob (OQ-011 / BEH-052);
  // otherwise it falls back to heading-based detection ("## 1. Context").
  const isPartitionFile = partitionGlob.length > 0
    ? fileInGlobs(entry.path, partitionGlob)
    : looksLikePartitionFile(entry.content);
  if (isPartitionFile) {
    for (const v of sectionViolations(entry.content)) {
      next = appendDiagnostic(next, {
        severity: "error",
        rule: v.rule,
        file: entry.path,
        message: v.message,
      });
    }
  }

  // ID-level rules + weasel scan share the parsed records (P0.5: weasel
  // pass 2 needs them for field-aware modal-verb detection).
  const records = lintRecordsFromMarkdown(entry.path, entry.content);
  const boundaryIds = reachableBoundaryIds(records);

  // §5.1 — weasel words in normative sections (Pass 1) + modal verbs in
  // normative fields (Pass 2, P0.5).
  for (const w of weaselFindings(entry.content, records)) {
    const where = w.field !== undefined ? `normative field ${w.field}` : `normative section "${w.section}"`;
    next = appendDiagnostic(next, {
      severity: "error",
      rule: "sdd:weasel-word",
      file: entry.path,
      line: w.line,
      message: `Banned phrase "${w.word}" in ${where} (SDD §5.1).`,
    });
  }
  for (const rec of records) {
    for (const d of [
      ...lifecycleStatusRules(rec),
      ...approvalRecordRules(rec),
      ...testObligationRules(rec),
      ...fieldTypeRules(rec),
      // P1 (ENF-003/009/010/011/012)
      ...baselineVersionRequiredRule(rec),
      ...deprecatedFieldsRequiredRule(rec),
      ...assumptionDowngradeApprovalRule(rec, approverBlocklist),
      ...partitionDefaultPolicySetRule(rec),
      ...generatedArtifactSurfaceRefRule(rec),
      // P2.1 — boundary requiredness (ENF-013/014/015/016)
      ...boundaryPolicyRefRule(rec, boundaryIds),
      ...boundaryConcurrencyModelRule(rec, boundaryIds),
      ...applicabilityRequiredRule(rec, boundaryIds),
      ...dataScopeRequiredRule(rec, boundaryIds),
      // P2.2 — migration consistency (ENF-017/018)
      ...migrationEnforcementStageRule(rec, records),
      ...migrationCrossPartitionRule(rec),
      // P3.1 — debt budget form (ENF-020)
      ...debtBudgetFormRule(rec),
      // unresolved blocking Open-Q (ENF-059)
      ...openQBlockingRule(rec),
    ]) {
      next = appendDiagnostic(next, d);
    }
  }

  return next;
}

function looksLikePartitionFile(markdown: string): boolean {
  const firstNumberedHeading = REQUIRED_PARTITION_SECTIONS[0]!;
  const re = new RegExp(`^##\\s+${firstNumberedHeading.replace(/\./g, "\\.").replace(/ /g, "\\s+")}`, "m");
  return re.test(markdown);
}

export function diagnosticsByFile(report: LintReport): Map<string, Diagnostic[]> {
  const map = new Map<string, Diagnostic[]>();
  for (const d of report.diagnostics) {
    const list = map.get(d.file) ?? [];
    list.push(d);
    map.set(d.file, list);
  }
  return map;
}
