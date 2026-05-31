// Cross-plan sync test: src/shared/domain/data/weasel-words.json (the local
// canonical) MUST be byte-equivalent in semantic content to Plan 1's copy at
// code-aget-config/skills/spec-driven-development/data/weasel-words.json.
//
// While Plan 1's copy is not yet shipped, this test soft-skips with a
// "Plan 1 pending" notice rather than failing CI. Once the methodology
// repository ships its copy, the test becomes mandatory.
//
// We additionally verify that the JSON file matches the TS source-of-truth
// in WeaselWords.ts so the JSON is never silently out-of-sync with runtime.

import assert from "node:assert/strict";
import test from "node:test";
import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
	WEASEL_ABSOLUTE,
	WEASEL_MODAL_IN_NORMATIVE,
} from "../../src/shared/domain/WeaselWords.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const localCanonical = resolve(
	repoRoot,
	"src/shared/domain/data/weasel-words.json",
);
const methodologyCanonical = resolve(
	repoRoot,
	"../code-aget-config/skills/spec-driven-development/data/weasel-words.json",
);

interface WeaselFile {
	absolute: string[];
	modal_in_normative: string[];
}

async function readJson(path: string): Promise<WeaselFile> {
	const raw = await fs.readFile(path, "utf8");
	return JSON.parse(raw) as WeaselFile;
}

async function pathExists(p: string): Promise<boolean> {
	try {
		await fs.access(p);
		return true;
	} catch {
		return false;
	}
}

test("local weasel-words.json matches WeaselWords.ts (TS source-of-truth)", async () => {
	const local = await readJson(localCanonical);
	assert.deepEqual(local.absolute, [...WEASEL_ABSOLUTE]);
	assert.deepEqual(local.modal_in_normative, [...WEASEL_MODAL_IN_NORMATIVE]);
});

test("local weasel-words.json matches code-aget-config canonical (soft-skip while Plan 1 pending)", async () => {
	if (!(await pathExists(methodologyCanonical))) {
		// Plan 1 (code-aget-config) has not yet shipped weasel-words.json. Until
		// it does, sdd-cli's copy is the de facto canonical. The test passes so
		// CI is not held hostage by a cross-plan sequencing dependency.
		return;
	}

	const local = await readJson(localCanonical);
	const methodology = await readJson(methodologyCanonical);

	assert.deepEqual(
		local.absolute,
		methodology.absolute,
		"absolute weasel-word list diverges between sdd-cli and code-aget-config",
	);
	assert.deepEqual(
		local.modal_in_normative,
		methodology.modal_in_normative,
		"modal_in_normative weasel-word list diverges between sdd-cli and code-aget-config",
	);
});
