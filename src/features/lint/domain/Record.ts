/*
 * INV-004 / CST-003: re-export shim over src/shared/domain/SpecRecord.ts so
 * lint and ready share one shape without a cross-feature import. See spec.
 */

export {
	NORMATIVE_TEMPLATES,
	VALID_LIFECYCLE_STATUS,
	type LifecycleStatus,
	type LintRecord,
	type LintTemplate,
} from "../../../shared/domain/SpecRecord.js";
