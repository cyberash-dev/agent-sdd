/*
 * Shared constants and predicates for the lint rule modules. Pure — no I/O,
 * no globals. Each rule module imports the closed-enum sets it validates against.
 */

export const VALID_EVIDENCE: ReadonlySet<string> = new Set([
	"public_api",
	"test_probe",
	"db_constraint",
	"operational_signal",
]);
export const VALID_STABILITY: ReadonlySet<string> = new Set([
	"contractual",
	"internal",
]);
export const VALID_DATA_SCOPE_PREFIX: ReadonlyArray<string> = [
	"new_writes_only",
	"all_data",
	"post_migration:",
];
export const VALID_VERIFICATION_STAGE: ReadonlySet<string> = new Set([
	"ci_unit",
	"ci_integration",
	"perf_lab",
	"staging_canary",
	"prod_slo",
]);
export const VALID_RUNTIME_STATE: ReadonlySet<string> = new Set([
	"pre_cutover",
	"in_progress",
	"cutover_done",
	"rolled_back",
]);
export const VALID_DIRECTION: ReadonlySet<string> = new Set([
	"forward_only",
	"reversible",
]);
export const VALID_MODE: ReadonlySet<string> = new Set([
	"online",
	"offline",
	"dual_write",
	"backfill",
	"dual_emit_with_legacy_text",
]);
export const VALID_BOUNDARY: ReadonlySet<string> = new Set([
	"api",
	"sdk",
	"event_bus",
	"cli",
	"public_db",
	"public_storage",
	"generated_published_artifact",
]);

export const OBLIGATIONLESS_TEMPLATES: ReadonlySet<string> = new Set([
	"Surface",
]);

export const REQUIRED_CONCURRENCY_FIELDS: ReadonlyArray<string> = [
	"actor_concurrency",
	"read_consistency",
	"idempotency",
	"time_source",
];

export const POST_MIGRATION_PREFIX = "post_migration:";

export function isMember(set: ReadonlySet<string>, value: string): boolean {
	return set.has(value);
}

export function stringifyValue(value: unknown): string {
	return typeof value === "string" ? value : JSON.stringify(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
