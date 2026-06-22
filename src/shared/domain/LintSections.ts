/*
 * Section catalogue for the §2 partition-structure and weasel-scan rules.
 * Pure constants shared by LintRules (re-export) and LintMarkdownScans.
 */

export const REQUIRED_PARTITION_SECTIONS: ReadonlyArray<string> = [
	"1. Context",
	"2. Glossary",
	"3. Partition",
	"4. Brownfield baseline",
	"5. Surfaces",
	"6. Requirements",
	"7. Data contracts",
	"8. Invariants",
	"9. External dependencies",
	"10. Generated artifacts",
	"11. Localization",
	"12. Policies",
	"13. Constraints",
	"14. Migrations",
	"15. Deltas",
	"16. Implementation bindings",
	"17. Open questions",
	"18. Assumptions",
	"19. Out of scope",
];

export const NORMATIVE_SECTIONS: ReadonlyArray<string> = [
	"6. Requirements",
	"7. Data contracts",
	"8. Invariants",
	"9. External dependencies",
	"11. Localization",
	"12. Policies",
	"13. Constraints",
	"14. Migrations",
	"15. Deltas",
];
