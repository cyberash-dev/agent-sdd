// Re-export shim — content lives in src/shared/domain/LintReport.ts.

export {
  appendDiagnostic,
  emptyReport,
  type Diagnostic,
  type DiagnosticSeverity,
  type LintReport,
} from "../../../shared/domain/LintReport.js";
