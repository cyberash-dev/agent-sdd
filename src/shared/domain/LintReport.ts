// Lint diagnostics shared between lint and ready slices.

export type DiagnosticSeverity = "error" | "warn";

export interface Diagnostic {
  severity: DiagnosticSeverity;
  rule: string;
  file: string;
  line?: number;
  message: string;
}

export interface LintReport {
  diagnostics: Diagnostic[];
  errorCount: number;
  warnCount: number;
}

export function emptyReport(): LintReport {
  return { diagnostics: [], errorCount: 0, warnCount: 0 };
}

export function appendDiagnostic(report: LintReport, d: Diagnostic): LintReport {
  return {
    diagnostics: [...report.diagnostics, d],
    errorCount: report.errorCount + (d.severity === "error" ? 1 : 0),
    warnCount: report.warnCount + (d.severity === "warn" ? 1 : 0),
  };
}
