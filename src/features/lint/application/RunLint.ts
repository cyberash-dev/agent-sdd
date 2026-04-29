import { appendDiagnostic, emptyReport, type Diagnostic, type LintReport } from "../domain/Diagnostic.js";

export type { Diagnostic, LintReport };
import { lintRecordsFromMarkdown } from "../domain/SpecParser.js";
import {
  approvalRecordRules,
  fieldTypeRules,
  lifecycleStatusRules,
  REQUIRED_PARTITION_SECTIONS,
  sectionViolations,
  testObligationRules,
  weaselFindings,
} from "../domain/Rules.js";
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
    report = lintFileInto(report, entry);
  }
  return report;
}

function lintFileInto(report: LintReport, entry: SpecFileEntry): LintReport {
  let next = report;

  // §2 — section presence (only for files that look like a partition spec
  // i.e. contain at least one heading "## 1. Context"). Apply to any file
  // that opens with "1. Context" as its first numbered heading.
  if (looksLikePartitionFile(entry.content)) {
    for (const v of sectionViolations(entry.content)) {
      next = appendDiagnostic(next, {
        severity: "error",
        rule: v.rule,
        file: entry.path,
        message: v.message,
      });
    }
  }

  // §5.1 — weasel words in normative sections.
  for (const w of weaselFindings(entry.content)) {
    next = appendDiagnostic(next, {
      severity: "error",
      rule: "sdd:weasel-word",
      file: entry.path,
      line: w.line,
      message: `Banned phrase "${w.word}" in normative section "${w.section}" (SDD §5.1).`,
    });
  }

  // ID-level rules.
  const records = lintRecordsFromMarkdown(entry.path, entry.content);
  for (const rec of records) {
    for (const d of [
      ...lifecycleStatusRules(rec),
      ...approvalRecordRules(rec),
      ...testObligationRules(rec),
      ...fieldTypeRules(rec),
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
