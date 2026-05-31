import assert from "node:assert/strict";
import test from "node:test";
import {
	stubs,
	yamlStubStream,
} from "../../src/features/refresh/domain/DiffStubs.js";
import type { Footprint } from "../../src/features/refresh/domain/Footprint.js";

test("diff paths become Delta or Open-Q stubs by footprint membership", () => {
	// @covers sdd-cli:BEH-006
	// @covers sdd-cli:CTR-006
	const footprint: Footprint = {
		entries: [
			{
				impId: "fixture:IMP-002",
				targetIds: ["fixture:BEH-001"],
				paths: ["src/foo.ts"],
			},
		],
	};

	const result = stubs(
		["spec/notes.md", "src/foo.ts"],
		footprint,
		"2026-04-29T15:37:35.000Z",
	);

	assert.deepEqual(
		result.map((stub) => stub.kind),
		["Open-Q", "Delta"],
	);
	assert.match(yamlStubStream(result), /kind: Delta/);
});
