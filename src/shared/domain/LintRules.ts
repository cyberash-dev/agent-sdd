import {
	WEASEL_ABSOLUTE,
	WEASEL_MODAL_IN_NORMATIVE,
	WEASEL_WORDS as WEASEL_WORDS_SOT,
} from "./WeaselWords.js";

/*
 * Lint rule surface — re-exports the pure rule functions from focused sibling
 * modules so consumers keep one import site. Diagnostic rule-IDs are members
 * of CTR-016 / SUR-009 (DiagnosticRegistry.ts holds the canonical list).
 */

export {
	NORMATIVE_SECTIONS,
	REQUIRED_PARTITION_SECTIONS,
} from "./LintSections.js";

/*
 * Re-exported from WeaselWords.ts for backward-compatibility with the lint
 * feature's domain shim. Two narrower exports are the new canonical names.
 */
export const WEASEL_WORDS: ReadonlyArray<string> = WEASEL_WORDS_SOT;
export { WEASEL_ABSOLUTE, WEASEL_MODAL_IN_NORMATIVE };

export * from "./LintFieldRules.js";
export * from "./LintEnforcementRules.js";
export * from "./LintBoundaryRules.js";
export * from "./LintMigrationBudgetRules.js";
export * from "./LintMarkdownScans.js";
