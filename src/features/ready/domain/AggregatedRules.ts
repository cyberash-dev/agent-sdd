import type { Diagnostic } from "../../../shared/domain/LintReport.js";
import type { ReadyViolation } from "./ReadyViolation.js";

// Adapt a LintReport's error-severity diagnostics into ReadyViolations of kind
// `aggregated_lint`. Per OQ-015 (default a), warn-severity diagnostics are
// dropped; only errors block the merge gate.
export function aggregatedLintViolations(diagnostics: readonly Diagnostic[]): ReadyViolation[] {
  const out: ReadyViolation[] = [];
  for (const d of diagnostics) {
    if (d.severity !== "error") continue;
    out.push({
      kind: "aggregated_lint",
      file: d.file,
      line: d.line,
      remediation: d.message,
      source: d.rule,
    });
  }
  return out;
}

// Aggregate a check outcome (computed externally) into a ReadyViolation when
// the baseline is not in the `match` state. The kind discriminates dirty vs.
// stale via `remediation`.
export type AggregatedCheckOutcome =
  | { kind: "match" }
  | { kind: "dirty"; dirtyPaths: readonly string[] }
  | { kind: "stale"; recordedToken: string; recomputedToken: string }
  | { kind: "skipped" };

export function aggregatedCheckViolations(outcome: AggregatedCheckOutcome): ReadyViolation[] {
  if (outcome.kind === "match" || outcome.kind === "skipped") return [];
  if (outcome.kind === "dirty") {
    const head = outcome.dirtyPaths[0];
    return [{
      kind: "aggregated_check",
      remediation: `baseline-dirty: ${outcome.dirtyPaths.length} uncommitted path(s) inside discovery_scope`,
      file: head,
    }];
  }
  return [{
    kind: "aggregated_check",
    remediation: `baseline-stale: recorded freshness_token does not match recomputed (recorded=${outcome.recordedToken.slice(0, 12)}…, recomputed=${outcome.recomputedToken.slice(0, 12)}…)`,
  }];
}
