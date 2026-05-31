import assert from "node:assert/strict";
import test from "node:test";
import {
	inspectBody,
	normalizeBody,
} from "../../src/features/record/domain/RecordBody.js";

test("normalizeBody: bare body is returned unchanged (trimmed)", () => {
	// @covers sdd-cli:BEH-059
	assert.equal(
		normalizeBody("id: x:A-1\ntype: Thing\n"),
		"id: x:A-1\ntype: Thing",
	);
});

test("normalizeBody: strips an enclosing yaml fence", () => {
	// @covers sdd-cli:BEH-059
	const fenced = [
		"```yaml",
		"---",
		"id: x:A-1",
		"type: Thing",
		"---",
		"```",
	].join("\n");
	assert.equal(normalizeBody(fenced), "id: x:A-1\ntype: Thing");
});

test("normalizeBody: strips surrounding --- doc markers", () => {
	// @covers sdd-cli:BEH-059
	assert.equal(normalizeBody("---\nid: x:A-1\n---"), "id: x:A-1");
});

test("inspectBody: extracts id and lifecycle status", () => {
	// @covers sdd-cli:BEH-060
	const body = [
		"id: x:A-1",
		"type: Behavior",
		"lifecycle:",
		"  status: proposed",
	].join("\n");
	assert.deepEqual(inspectBody(body), { id: "x:A-1", status: "proposed" });
});

test("inspectBody: id null and status null when absent", () => {
	// @covers sdd-cli:BEH-064
	assert.deepEqual(inspectBody("type: Behavior"), { id: null, status: null });
});
