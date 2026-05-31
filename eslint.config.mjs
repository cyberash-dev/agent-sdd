import base from "@cyberash-dev/dev-tooling/eslint.base.mjs";

const REPO_ID_TYPES =
	"ASM|BEH|BL|CON|CST|CTR|DEL|DLT|ENF|EXT|GAR|GEN|IMP|INV|LCN|MIG|NFR|OQ|POL|REQ|SCN|SUR";

const REPO_PROTECTED = [
	"@covers\\s+\\S+(?:\\s+\\w+=\\S+)*",
	`\\b[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?::[a-z0-9]+(?:-[a-z0-9]+)*)*:(?:${REPO_ID_TYPES})-\\d+\\b`,
	`\\b(?:${REPO_ID_TYPES})-\\d+\\b`,
	"\\bM\\d+[A-Z]+-\\d+\\b",
];

export default [
	...base,
	{ ignores: ["dist/**", "node_modules/**"] },
	{
		rules: {
			"spec-anchor/no-dead-spec-anchor": ["error", { specDirs: ["spec"] }],
			"comment-policy/max-comment-lines": [
				"error",
				{ max: 4, anchoredMax: 3, protectedPatterns: REPO_PROTECTED },
			],
			"comment-policy/no-comment-narrative": [
				"error",
				{ protectedPatterns: REPO_PROTECTED },
			],
			"comment-policy/no-comment-code-snippet": [
				"error",
				{ protectedPatterns: REPO_PROTECTED },
			],
			"comment-policy/no-decorative-comment": [
				"error",
				{ protectedPatterns: REPO_PROTECTED },
			],
			"comment-policy/no-line-comment": [
				"error",
				{ protectedPatterns: REPO_PROTECTED },
			],
		},
	},
];
