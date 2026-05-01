// Graph validator for `sdd finalize` (BEH-024 / BEH-025 / INV-012).
//
// The question: "if every pending_attestation is applied, does any flipped
// record reference an ID that is still <approved post-flip?" If yes, refuse.
//
// We don't reuse `ruleSurfaceUnapprovedRef` directly. That rule fires for
// already-approved Surfaces against current member statuses; finalize asks
// the inverse (prospective). Implementation: clone the records-by-id map,
// apply the plan flips to the clone, then walk every flipped record's
// references (Surface.members, policy_refs, target_ids) and assert each
// referenced ID is `>=approved` post-flip.

import type { LintRecord } from "../../../shared/domain/SpecRecord.js";
import type { PendingAttestation } from "../../../shared/domain/PlanFile.js";

export interface GraphViolation {
  flippedId: string;
  referencesId: string;
  referencesStatus: string;
  via: "members" | "policy_refs" | "target_ids" | "surface_ref";
}

const TERMINAL_STATUSES = new Set(["approved", "deprecated", "removed"]);

export function validateFinalizeGraph(
  records: ReadonlyArray<LintRecord>,
  plan: ReadonlyArray<PendingAttestation>,
): GraphViolation[] {
  const byId = new Map<string, LintRecord>();
  for (const r of records) byId.set(r.id, r);

  const planTargets = new Map<string, string>();
  for (const a of plan) planTargets.set(a.id, a.targetStatus);

  const out: GraphViolation[] = [];
  for (const a of plan) {
    if (a.targetStatus !== "approved") continue;
    const rec = byId.get(a.id);
    if (rec === undefined) continue; // missing record is caught elsewhere
    for (const ref of refsOf(rec)) {
      const refRec = byId.get(ref.id);
      const refStatus = effectiveStatus(refRec, planTargets.get(ref.id));
      if (refStatus === null) continue; // missing referenced record — not a graph violation
      if (TERMINAL_STATUSES.has(refStatus)) continue;
      out.push({
        flippedId: a.id,
        referencesId: ref.id,
        referencesStatus: refStatus,
        via: ref.via,
      });
    }
  }
  return out;
}

function effectiveStatus(rec: LintRecord | undefined, planTarget: string | undefined): string | null {
  if (rec === undefined) return null;
  return planTarget ?? rec.lifecycleStatus ?? "draft";
}

interface RefEdge {
  id: string;
  via: GraphViolation["via"];
}

function refsOf(rec: LintRecord): RefEdge[] {
  const out: RefEdge[] = [];
  const v = rec.parsed;
  // Surface.members[]
  const members = v.members;
  if (Array.isArray(members)) {
    for (const m of members) if (typeof m === "string") out.push({ id: m, via: "members" });
  }
  // surface_ref
  const surfaceRef = v.surface_ref;
  if (typeof surfaceRef === "string") out.push({ id: surfaceRef, via: "surface_ref" });
  // policy_refs[]
  const policyRefs = v.policy_refs;
  if (Array.isArray(policyRefs)) {
    for (const p of policyRefs) if (typeof p === "string") out.push({ id: p, via: "policy_refs" });
  }
  // target_ids[] (Migration / Delta)
  const targetIds = v.target_ids;
  if (Array.isArray(targetIds)) {
    for (const t of targetIds) if (typeof t === "string") out.push({ id: t, via: "target_ids" });
  }
  return out;
}
