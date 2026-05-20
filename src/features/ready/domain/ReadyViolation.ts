// Discriminated union for sdd ready output. Encoded by CTR-014; the union is
// derived from src/shared/domain/DiagnosticRegistry.READY_VIOLATION_KINDS so
// that CTR-016 / SUR-009 / INV-010 stays the single source of truth.

import type { ReadyViolationKindId } from "../../../shared/domain/DiagnosticRegistry.js";

export type ReadyViolationKind = ReadyViolationKindId;

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

/** Non-blocking advisory (OQ-011/OQ-017): surfaced in the ready envelope but
 *  never affects exit code. */
export interface ReadyAdvisory {
  kind: "covers_near_miss";
  file: string;
  line: number;
  text: string;
  remediation: string;
}

export interface ReadyEnvelope {
  ok: boolean;
  error: ReadyError | null;
  violations: ReadyViolation[];
  advisories: ReadyAdvisory[];
}

export function emptyEnvelope(): ReadyEnvelope {
  return { ok: true, error: null, violations: [], advisories: [] };
}

export function envelopeFromError(error: ReadyError): ReadyEnvelope {
  return { ok: false, error, violations: [], advisories: [] };
}

export function envelopeFromViolations(violations: ReadyViolation[]): ReadyEnvelope {
  return { ok: violations.length === 0, error: null, violations, advisories: [] };
}
