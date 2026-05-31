/*
 * Source of truth for SDD weasel-word detection (CTR-016 / SUR-009):
 * `absolute` words trigger inside any normative section; `modal_in_normative`
 * words only inside fields whose IS_NORMATIVE entry is `true`.
 */

export const WEASEL_ABSOLUTE: ReadonlyArray<string> = [
	"возможно",
	"вероятно",
	"обычно",
	"as a rule",
	"etc.",
	"and so on",
	"should usually",
	"similar to",
	"approximately",
	"best-effort",
	"best effort",
	"informally",
];

export const WEASEL_MODAL_IN_NORMATIVE: ReadonlyArray<string> = [
	"may be",
	"might be",
];

/*
 * Backward-compatible aggregate used by the legacy single-pass weaselFindings
 * caller. P0.5 splits this into two passes; the union is the conservative
 * upper bound until field-aware detection lands.
 */
export const WEASEL_WORDS: ReadonlyArray<string> = [
	...WEASEL_ABSOLUTE,
	...WEASEL_MODAL_IN_NORMATIVE,
];
