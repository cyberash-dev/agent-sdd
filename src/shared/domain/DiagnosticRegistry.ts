// Single source of truth for the strings that make up Surface
// `sdd-cli/diagnostics` (SUR-009). Every value here is a published external
// identifier: it appears in `Diagnostic.rule` (lint) or `ReadyViolation.kind`
// (ready) of the JSON envelope and in stderr/stdout of `sdd lint` / `sdd ready`.
//
// Append-only at minor on SUR-009. Renaming or removing an entry is a major
// bump on SUR-009 and requires an `alias_for` entry retained ≥1 minor.
//
// Coverage is enforced mechanically by tests/unit/diagnostic-registry-coverage.test.ts
// (INV-010): every `"sdd:..."` literal under src/ must appear in
// LINT_DIAGNOSTIC_IDS, and every distinct ReadyViolation.kind must appear in
// READY_VIOLATION_KINDS — and inversely.

export const LINT_DIAGNOSTIC_IDS = [
  "sdd:section-presence",
  "sdd:section-order",
  "sdd:weasel-word",
  "sdd:lifecycle-status-present",
  "sdd:lifecycle-status-valid",
  "sdd:approval-record-required",
  "sdd:approval-record-forbidden",
  "sdd:test-obligation-required",
  "sdd:type-version-int",
  "sdd:type-invariant-evidence",
  "sdd:type-invariant-stability",
  "sdd:type-data-scope",
  "sdd:type-nfr-stage",
  "sdd:type-migration-direction",
  "sdd:type-migration-mode",
  "sdd:type-migration-runtime-state",
  "sdd:type-surface-boundary-type",
  // P1 — cheap requiredness gaps (ENF-003/009/010/011/012)
  "sdd:baseline-version-required",
  "sdd:deprecated-fields-required",
  "sdd:assumption-downgrade-approval",
  "sdd:partition-default-policy-set",
  "sdd:generated-artifact-surface-ref",
] as const;

export type LintDiagnosticId = typeof LINT_DIAGNOSTIC_IDS[number];

export const READY_VIOLATION_KINDS = [
  "unapproved",
  "uncovered",
  "removed_no_compat_test",
  "removed_compat_action_mismatch",
  "surface_unapproved_ref",
  "orphan_covers",
  "unknown_partition_covers",
  "aggregated_lint",
  "aggregated_check",
] as const;

export type ReadyViolationKindId = typeof READY_VIOLATION_KINDS[number];

export const LINT_DIAGNOSTIC_ID_GRAMMAR = /^sdd:[a-z][a-z0-9-]*$/;
export const READY_VIOLATION_KIND_GRAMMAR = /^[a-z][a-z0-9_]*$/;
