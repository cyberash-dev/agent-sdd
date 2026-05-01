// Boundary reachability — used by P2.1 lint rules (ENF-013/014/015/016).
//
// A "boundary element" is a Behavior or Contract reachable from a Surface
// whose `boundary_type` is in the set of *external* boundaries (api, sdk,
// event_bus, cli, public_db, public_storage). Internal-only behaviours and
// data don't trip the boundary requiredness rules.
//
// Reachability edges (single hop, by design — keep the rule predictable):
//   - Contract.surface_ref points to a Surface
//   - Surface.members[] lists Contracts and (rarely) Behaviors
//   - Behavior.surface_ref points to a Surface (when set)
//
// We treat the union of these edges as "is_boundary(rec)". Pure logic; no
// node:* imports.

import type { LintRecord } from "./SpecRecord.js";

export const EXTERNAL_BOUNDARY_TYPES: ReadonlySet<string> = new Set([
  "api",
  "sdk",
  "event_bus",
  "cli",
  "public_db",
  "public_storage",
]);

/** Returns the set of normative IDs that are boundary elements per the
 *  reachability edges above. Computed once per partition view. */
export function reachableBoundaryIds(records: ReadonlyArray<LintRecord>): Set<string> {
  const out = new Set<string>();

  // Map every Surface ID -> boundary_type so we can decide which Surfaces
  // count as external.
  const surfaceBoundaryType = new Map<string, string>();
  for (const r of records) {
    if (r.template !== "Surface") continue;
    const bt = r.parsed.boundary_type;
    if (typeof bt === "string") surfaceBoundaryType.set(r.id, bt);
  }

  const isExternalSurface = (id: string): boolean => {
    const bt = surfaceBoundaryType.get(id);
    return bt !== undefined && EXTERNAL_BOUNDARY_TYPES.has(bt);
  };

  // Pass A: every Contract or Behavior whose surface_ref points to an
  // external Surface is itself a boundary element.
  for (const r of records) {
    if (r.template !== "Contract" && r.template !== "Behavior") continue;
    const ref = r.parsed.surface_ref;
    if (typeof ref === "string" && isExternalSurface(ref)) out.add(r.id);
  }

  // Pass B: every member listed under an external Surface's members[] is a
  // boundary element (reverse edge for completeness).
  for (const r of records) {
    if (r.template !== "Surface") continue;
    if (!isExternalSurface(r.id)) continue;
    const members = r.parsed.members;
    if (!Array.isArray(members)) continue;
    for (const m of members) if (typeof m === "string") out.add(m);
  }

  return out;
}
