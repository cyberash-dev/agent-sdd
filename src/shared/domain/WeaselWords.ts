// Source-of-truth for SDD weasel-word detection (rule sdd:weasel-word in
// CTR-016 / SUR-009). The JSON sibling at ./data/weasel-words.json is the
// cross-plan sync canonical (Plan 1 mirrors it into
// code-aget-config/skills/spec-driven-development/data/weasel-words.json);
// `tests/unit/weasel-words-sync.test.ts` asserts the two stay byte-equivalent
// in semantic content.
//
// `absolute` words trigger anywhere inside a normative section heading
// (NORMATIVE_SECTIONS in LintRules.ts). `modal_in_normative` words trigger
// only inside fields whose IS_NORMATIVE entry is `true` — see
// TemplateFieldMetadata.ts and the field-aware pass in weaselFindings.

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

// Backward-compatible aggregate used by the legacy single-pass weaselFindings
// caller. P0.5 splits this into two passes; the union is the conservative
// upper bound until field-aware detection lands.
export const WEASEL_WORDS: ReadonlyArray<string> = [
  ...WEASEL_ABSOLUTE,
  ...WEASEL_MODAL_IN_NORMATIVE,
];
