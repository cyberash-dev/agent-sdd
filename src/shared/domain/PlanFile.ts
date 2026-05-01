// Plan-file shape per CTR-019 (Surface SUR-014 sdd-cli/plan-files).
//
// One YAML file per plan_id under <plansDir>/<plan_id>.yaml. Each file holds
// a list of pending attestations that `sdd finalize` materialises atomically
// into spec files (lifecycle.status flips + approval_record blocks).
//
// `plan_id` grammar — basic ISO-8601 UTC timestamp + 5-char base32 suffix.
// Sortable chronologically. Collision-safe under POL-001 single-actor.
//
// IMPORTANT: this module is pure (no node:* imports) — it lives in
// shared/domain. Filesystem I/O lives in feature-local outbound adapters.

export type AttestationTargetStatus = "approved" | "deprecated" | "removed";

export interface PendingAttestation {
  id: string;
  ownerRole: string;
  approverIdentity: string;
  timestamp: string; // ISO-8601 UTC
  changeRequest: string;
  scope: string;
  targetStatus: AttestationTargetStatus;
  reviewedTestOracle?: string;
}

export interface PlanFileShape {
  planId: string;
  createdAt: string; // ISO-8601 UTC
  pendingAttestations: PendingAttestation[];
}

export const PLAN_ID_GRAMMAR = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{6}Z-[a-z0-9]{5}$/;

const RAND_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

/** Generate a plan-id from a Date and 5 [a-z0-9] random chars.
 *  rand: optional injectable RNG (yields a value in [0, 1)) for determinism. */
export function generatePlanId(now: Date, rand: () => number = Math.random): string {
  const ts = isoBasicUtc(now);
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    const r = Math.floor(rand() * RAND_ALPHABET.length);
    suffix += RAND_ALPHABET[r];
  }
  return `${ts}-${suffix}`;
}

/** Format a Date as YYYY-MM-DDTHHMMSSZ (ISO-8601 basic UTC, second precision). */
export function isoBasicUtc(now: Date): string {
  const y = String(now.getUTCFullYear()).padStart(4, "0");
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  const hh = String(now.getUTCHours()).padStart(2, "0");
  const mm = String(now.getUTCMinutes()).padStart(2, "0");
  const ss = String(now.getUTCSeconds()).padStart(2, "0");
  return `${y}-${m}-${d}T${hh}${mm}${ss}Z`;
}

/** Parse a YAML-decoded plan-file object into a typed PlanFileShape.
 *  Throws on shape violation. */
export function parsePlanFile(value: unknown): PlanFileShape {
  if (!isObj(value)) throw new Error("plan-file must be an object");
  const planId = strField(value, "plan_id");
  if (!PLAN_ID_GRAMMAR.test(planId)) {
    throw new Error(`plan_id "${planId}" does not match grammar ${PLAN_ID_GRAMMAR.source}`);
  }
  const createdAt = strField(value, "created_at");
  const pendingRaw = value.pending_attestations;
  if (!Array.isArray(pendingRaw)) {
    throw new Error("plan-file.pending_attestations must be an array");
  }
  const pending = pendingRaw.map((item: unknown, idx: number): PendingAttestation => {
    if (!isObj(item)) throw new Error(`pending_attestations[${idx}] must be an object`);
    const ts = strField(item, "target_status", "approved") as AttestationTargetStatus;
    if (ts !== "approved" && ts !== "deprecated" && ts !== "removed") {
      throw new Error(`pending_attestations[${idx}].target_status invalid: ${String(ts)}`);
    }
    const out: PendingAttestation = {
      id: strField(item, "id"),
      ownerRole: strField(item, "owner_role"),
      approverIdentity: strField(item, "approver_identity"),
      timestamp: strField(item, "timestamp"),
      changeRequest: strField(item, "change_request"),
      scope: strField(item, "scope", "first-time-approval"),
      targetStatus: ts,
    };
    const oracle = item.reviewed_test_oracle;
    if (typeof oracle === "string" && oracle.length > 0) out.reviewedTestOracle = oracle;
    return out;
  });
  return { planId, createdAt, pendingAttestations: pending };
}

/** Serialise a PlanFileShape into a stable YAML string. The fields are
 *  emitted in fixed order so plan files diff cleanly across edits. */
export function serialisePlanFile(plan: PlanFileShape): string {
  const lines: string[] = [];
  lines.push(`plan_id: ${plan.planId}`);
  lines.push(`created_at: ${plan.createdAt}`);
  lines.push("pending_attestations:");
  for (const a of plan.pendingAttestations) {
    lines.push(`  - id: ${a.id}`);
    lines.push(`    owner_role: ${a.ownerRole}`);
    lines.push(`    approver_identity: ${a.approverIdentity}`);
    lines.push(`    timestamp: ${a.timestamp}`);
    lines.push(`    change_request: ${quoteIfNeeded(a.changeRequest)}`);
    lines.push(`    scope: ${a.scope}`);
    lines.push(`    target_status: ${a.targetStatus}`);
    if (a.reviewedTestOracle !== undefined) {
      lines.push(`    reviewed_test_oracle: ${a.reviewedTestOracle}`);
    }
  }
  return lines.join("\n") + "\n";
}

function quoteIfNeeded(s: string): string {
  if (/^[a-zA-Z0-9_./:?=&%@+\-]+$/.test(s)) return s;
  return JSON.stringify(s);
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function strField(o: Record<string, unknown>, key: string, fallback?: string): string {
  const v = o[key];
  if (typeof v === "string" && v.length > 0) return v;
  if (v === undefined && fallback !== undefined) return fallback;
  throw new Error(`plan-file field ${key} must be a non-empty string`);
}
