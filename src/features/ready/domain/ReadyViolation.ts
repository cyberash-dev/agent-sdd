// Discriminated union for sdd ready output. Encoded by CTR-014.

export type ReadyViolationKind =
  | "unapproved"
  | "uncovered"
  | "removed_no_compat_test"
  | "removed_compat_action_mismatch"
  | "surface_unapproved_ref"
  | "orphan_covers"
  | "unknown_partition_covers"
  | "aggregated_lint"
  | "aggregated_check";

export type ReadyErrorKind =
  | "spec_parse_failed"
  | "config_invalid"
  | "unreadable_test_paths"
  | "internal";

export interface ReadyViolation {
  kind: ReadyViolationKind;
  id?: string;
  partition?: string;
  status?: string;
  file?: string;
  line?: number;
  expected?: string;
  actual?: string;
  remediation?: string;
  source?: string;
}

export interface ReadyError {
  kind: ReadyErrorKind;
  message: string;
  file?: string;
}

export interface ReadyEnvelope {
  ok: boolean;
  error: ReadyError | null;
  violations: ReadyViolation[];
}

export function emptyEnvelope(): ReadyEnvelope {
  return { ok: true, error: null, violations: [] };
}

export function envelopeFromError(error: ReadyError): ReadyEnvelope {
  return { ok: false, error, violations: [] };
}

export function envelopeFromViolations(violations: ReadyViolation[]): ReadyEnvelope {
  return { ok: violations.length === 0, error: null, violations };
}
