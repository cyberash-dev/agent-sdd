import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSdd } from "./_helpers.js";

const SPEC = [
	"# fixture",
	"",
	"```yaml",
	"---",
	"id: fixture:BEH-001",
	"type: Behavior",
	"lifecycle:",
	"  status: proposed",
	"title: first behavior",
	"---",
	"```",
	"",
	"```yaml",
	"---",
	"id: fixture:INV-001",
	"type: Invariant",
	"lifecycle:",
	"  status: approved",
	"never: nothing happens",
	"---",
	"```",
	"",
	"```yaml",
	"---",
	"id: fixture:SUR-001",
	"type: Surface",
	"lifecycle:",
	"  status: draft",
	"name: fixture/thing",
	'version: "0.1.0"',
	"---",
	"```",
	"",
].join("\n");

const INV_001_BODY = [
	"id: fixture:INV-001",
	"type: Invariant",
	"lifecycle:",
	"  status: approved",
	"never: nothing happens",
].join("\n");

async function fixture(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "sdd-record-"));
	await mkdir(join(root, ".sdd"));
	await mkdir(join(root, "spec"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify(
			{
				spec_file: "spec/spec.md",
				baseline_id: "fixture:BL-001",
				discovery_scope: ["src"],
				mechanism: "git_tree_hash_v1",
			},
			null,
			2,
		),
	);
	await writeFile(join(root, "spec", "spec.md"), SPEC);
	return root;
}

interface ListBody {
	format_version: number;
	count: number;
	records: Array<{
		id: string;
		type: string | null;
		status: string | null;
		title: string | null;
		file: string;
		line: number;
	}>;
}

test("BEH-054 / CTR-026: record list indexes every record (json)", async () => {
	// @covers sdd-cli:BEH-054
	// @covers sdd-cli:CTR-026
	const root = await fixture();

	const r = await runSdd(root, ["record", "list", "--format=json"]);

	assert.equal(r.code, 0);
	const body = JSON.parse(r.stdout) as ListBody;
	assert.equal(body.format_version, 1);
	assert.equal(body.count, 3);
	assert.deepEqual(
		body.records.map((x) => x.id),
		["fixture:BEH-001", "fixture:INV-001", "fixture:SUR-001"],
	);

	const byId = new Map(body.records.map((x) => [x.id, x]));
	assert.equal(byId.get("fixture:BEH-001")?.title, "first behavior");
	assert.equal(byId.get("fixture:INV-001")?.title, null);
	assert.equal(byId.get("fixture:SUR-001")?.title, "fixture/thing");
	assert.equal(byId.get("fixture:INV-001")?.status, "approved");
	assert.equal(byId.get("fixture:BEH-001")?.type, "Behavior");
});

test("BEH-054: record list human output names every record", async () => {
	// @covers sdd-cli:BEH-054
	const root = await fixture();

	const r = await runSdd(root, ["record", "list"]);

	assert.equal(r.code, 0);
	assert.match(r.stdout, /fixture:BEH-001/);
	assert.match(r.stdout, /fixture:INV-001/);
	assert.match(r.stdout, /fixture:SUR-001/);
});

test("BEH-055 / CTR-027: record get returns the verbatim block (json)", async () => {
	// @covers sdd-cli:BEH-055
	// @covers sdd-cli:CTR-027
	const root = await fixture();

	const r = await runSdd(root, [
		"record",
		"get",
		"fixture:INV-001",
		"--format=json",
	]);

	assert.equal(r.code, 0);
	const body = JSON.parse(r.stdout) as {
		format_version: number;
		found: boolean;
		id: string;
		raw: string;
	};
	assert.equal(body.format_version, 1);
	assert.equal(body.found, true);
	assert.equal(body.id, "fixture:INV-001");
	assert.equal(body.raw, INV_001_BODY);
});

test("BEH-055: record get prints the verbatim block (human)", async () => {
	// @covers sdd-cli:BEH-055
	const root = await fixture();

	const r = await runSdd(root, ["record", "get", "fixture:INV-001"]);

	assert.equal(r.code, 0);
	assert.equal(r.stdout.trimEnd(), INV_001_BODY);
});

test("BEH-056 / CTR-027: record get on unknown id exits 1", async () => {
	// @covers sdd-cli:BEH-056
	// @covers sdd-cli:CTR-027
	const root = await fixture();

	const r = await runSdd(root, ["record", "get", "fixture:NOPE-999"]);

	assert.equal(r.code, 1);
	assert.match(r.stderr, /record not found: fixture:NOPE-999/);
});

test("BEH-056: record get unknown id json reports found false", async () => {
	// @covers sdd-cli:BEH-056
	const root = await fixture();

	const r = await runSdd(root, [
		"record",
		"get",
		"fixture:NOPE-999",
		"--format=json",
	]);

	assert.equal(r.code, 1);
	const body = JSON.parse(r.stdout) as { found: boolean; id: string };
	assert.equal(body.found, false);
	assert.equal(body.id, "fixture:NOPE-999");
});

test("BEH-057: invalid record invocation exits 2", async () => {
	// @covers sdd-cli:BEH-057
	const root = await fixture();

	const noSub = await runSdd(root, ["record"]);
	const unknown = await runSdd(root, ["record", "bogus"]);
	const getNoId = await runSdd(root, ["record", "get"]);

	assert.equal(noSub.code, 2);
	assert.equal(unknown.code, 2);
	assert.equal(getNoId.code, 2);
	assert.match(getNoId.stderr, /record/);
});

const MULTI_PARTITION_SPEC = [
	"# fixture",
	"",
	"```yaml",
	"---",
	"id: alpha:BEH-001",
	"type: Behavior",
	"lifecycle:",
	"  status: proposed",
	"title: alpha behavior",
	"---",
	"```",
	"",
	"```yaml",
	"---",
	"id: alpha:INV-001",
	"type: Invariant",
	"lifecycle:",
	"  status: proposed",
	"never: nothing",
	"---",
	"```",
	"",
	"```yaml",
	"---",
	"id: beta:BEH-001",
	"type: Behavior",
	"lifecycle:",
	"  status: proposed",
	"title: beta behavior",
	"---",
	"```",
	"",
	"```yaml",
	"---",
	"id: alpha",
	"type: Partition",
	"lifecycle:",
	"  status: proposed",
	"---",
	"```",
	"",
].join("\n");

async function partitionFixture(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "sdd-record-part-"));
	await mkdir(join(root, ".sdd"));
	await mkdir(join(root, "spec"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify(
			{
				spec_file: "spec/spec.md",
				baseline_id: "fixture:BL-001",
				discovery_scope: ["src"],
				mechanism: "git_tree_hash_v1",
			},
			null,
			2,
		),
	);
	await writeFile(join(root, "spec", "spec.md"), MULTI_PARTITION_SPEC);
	return root;
}

test("BEH-058: record list --partition keeps only the named partition (incl. bare id)", async () => {
	// @covers sdd-cli:BEH-058
	const root = await partitionFixture();

	const r = await runSdd(root, [
		"record",
		"list",
		"--partition",
		"alpha",
		"--format=json",
	]);

	assert.equal(r.code, 0);
	const body = JSON.parse(r.stdout) as ListBody;
	assert.deepEqual(body.records.map((x) => x.id).sort(), [
		"alpha",
		"alpha:BEH-001",
		"alpha:INV-001",
	]);
	assert.equal(body.count, 3);
});

test("BEH-058: record list --partition selects a single-member partition", async () => {
	// @covers sdd-cli:BEH-058
	const root = await partitionFixture();

	const r = await runSdd(root, [
		"record",
		"list",
		"--partition",
		"beta",
		"--format=json",
	]);

	assert.equal(r.code, 0);
	const body = JSON.parse(r.stdout) as ListBody;
	assert.deepEqual(
		body.records.map((x) => x.id),
		["beta:BEH-001"],
	);
});

test("BEH-058: record list --partition with no match yields count 0", async () => {
	// @covers sdd-cli:BEH-058
	const root = await partitionFixture();

	const r = await runSdd(root, [
		"record",
		"list",
		"--partition",
		"gamma",
		"--format=json",
	]);

	assert.equal(r.code, 0);
	const body = JSON.parse(r.stdout) as ListBody;
	assert.equal(body.count, 0);
	assert.deepEqual(body.records, []);
});

test("BEH-058: --partition is rejected on record get", async () => {
	// @covers sdd-cli:BEH-058
	const root = await partitionFixture();

	const r = await runSdd(root, [
		"record",
		"get",
		"alpha:BEH-001",
		"--partition",
		"alpha",
	]);

	assert.equal(r.code, 2);
});

const EDIT_SPEC = [
	"# fixture",
	"",
	"```yaml",
	"---",
	"id: fixture:BEH-001",
	"type: Behavior",
	"lifecycle:",
	"  status: proposed",
	"title: original",
	"---",
	"```",
	"",
	"```yaml",
	"---",
	"id: fixture:INV-001",
	"type: Invariant",
	"lifecycle:",
	"  status: approved",
	"  approval_record:",
	"    owner_role: tech-lead",
	"    approver_identity: human",
	"    timestamp: 2026-01-01T00:00:00Z",
	"    change_request: x",
	"never: nothing",
	"---",
	"```",
	"",
].join("\n");

async function editFixture(): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "sdd-record-edit-"));
	await mkdir(join(root, ".sdd"));
	await mkdir(join(root, "spec"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify(
			{
				spec_file: "spec/spec.md",
				baseline_id: "fixture:BL-001",
				discovery_scope: ["src"],
				mechanism: "git_tree_hash_v1",
			},
			null,
			2,
		),
	);
	await writeFile(join(root, "spec", "spec.md"), EDIT_SPEC);
	return root;
}

const UPDATED_BEH_001 = [
	"id: fixture:BEH-001",
	"type: Behavior",
	"lifecycle:",
	"  status: proposed",
	"title: updated",
].join("\n");

test("BEH-059 / CTR-028: record set replaces a proposed record body (--content)", async () => {
	// @covers sdd-cli:BEH-059
	// @covers sdd-cli:CTR-028
	const root = await editFixture();

	const r = await runSdd(root, [
		"record",
		"set",
		"fixture:BEH-001",
		"--content",
		UPDATED_BEH_001,
		"--format=json",
	]);

	assert.equal(r.code, 0);
	const body = JSON.parse(r.stdout) as {
		ok: boolean;
		action: string;
		id: string;
	};
	assert.equal(body.ok, true);
	assert.equal(body.action, "set");
	assert.equal(body.id, "fixture:BEH-001");

	const got = await runSdd(root, ["record", "get", "fixture:BEH-001"]);
	assert.equal(got.stdout.trimEnd(), UPDATED_BEH_001);
});

test("BEH-059: record set accepts a fenced body via --from-file", async () => {
	// @covers sdd-cli:BEH-059
	const root = await editFixture();
	const fenced = [
		"```yaml",
		"---",
		"id: fixture:BEH-001",
		"type: Behavior",
		"lifecycle:",
		"  status: proposed",
		"title: fromfile",
		"---",
		"```",
	].join("\n");
	await writeFile(join(root, "body.yaml"), fenced);

	const r = await runSdd(root, [
		"record",
		"set",
		"fixture:BEH-001",
		"--from-file",
		"body.yaml",
	]);

	assert.equal(r.code, 0);
	const got = await runSdd(root, ["record", "get", "fixture:BEH-001"]);
	assert.equal(
		got.stdout.trimEnd(),
		[
			"id: fixture:BEH-001",
			"type: Behavior",
			"lifecycle:",
			"  status: proposed",
			"title: fromfile",
		].join("\n"),
	);
});

test("BEH-060 / INV-015: record set refuses an approved record and writes nothing", async () => {
	// @covers sdd-cli:BEH-060
	// @covers sdd-cli:INV-015
	const root = await editFixture();
	const before = await readFile(join(root, "spec", "spec.md"), "utf8");
	const newBody = [
		"id: fixture:INV-001",
		"type: Invariant",
		"lifecycle:",
		"  status: proposed",
		"never: changed",
	].join("\n");

	const r = await runSdd(root, [
		"record",
		"set",
		"fixture:INV-001",
		"--content",
		newBody,
	]);

	assert.equal(r.code, 1);
	assert.equal(await readFile(join(root, "spec", "spec.md"), "utf8"), before);
});

test("BEH-060: record set refuses a body that declares a protected status", async () => {
	// @covers sdd-cli:BEH-060
	const root = await editFixture();
	const before = await readFile(join(root, "spec", "spec.md"), "utf8");
	const newBody = [
		"id: fixture:BEH-001",
		"type: Behavior",
		"lifecycle:",
		"  status: approved",
		"title: sneak",
	].join("\n");

	const r = await runSdd(root, [
		"record",
		"set",
		"fixture:BEH-001",
		"--content",
		newBody,
	]);

	assert.equal(r.code, 1);
	assert.equal(await readFile(join(root, "spec", "spec.md"), "utf8"), before);
});

test("BEH-061: record set on an unknown id exits 1 and writes nothing", async () => {
	// @covers sdd-cli:BEH-061
	const root = await editFixture();
	const before = await readFile(join(root, "spec", "spec.md"), "utf8");
	const newBody = [
		"id: fixture:NOPE-9",
		"type: Behavior",
		"lifecycle:",
		"  status: proposed",
	].join("\n");

	const r = await runSdd(root, [
		"record",
		"set",
		"fixture:NOPE-9",
		"--content",
		newBody,
	]);

	assert.equal(r.code, 1);
	assert.equal(await readFile(join(root, "spec", "spec.md"), "utf8"), before);
});

test("BEH-064: record set with id/body mismatch exits 2", async () => {
	// @covers sdd-cli:BEH-064
	const root = await editFixture();

	const r = await runSdd(root, [
		"record",
		"set",
		"fixture:BEH-001",
		"--content",
		"id: fixture:OTHER-1\ntype: Behavior",
	]);

	assert.equal(r.code, 2);
});

test("BEH-064: record set with neither --from-file nor --content exits 2", async () => {
	// @covers sdd-cli:BEH-064
	const root = await editFixture();

	const r = await runSdd(root, ["record", "set", "fixture:BEH-001"]);

	assert.equal(r.code, 2);
});

const NEW_BEH_002 = [
	"id: fixture:BEH-002",
	"type: Behavior",
	"lifecycle:",
	"  status: proposed",
	"title: brand new",
].join("\n");

test("BEH-062 / CTR-028: record add inserts a new record after the anchor", async () => {
	// @covers sdd-cli:BEH-062
	// @covers sdd-cli:CTR-028
	const root = await editFixture();

	const r = await runSdd(root, [
		"record",
		"add",
		"--after",
		"fixture:BEH-001",
		"--content",
		NEW_BEH_002,
		"--format=json",
	]);

	assert.equal(r.code, 0);
	const body = JSON.parse(r.stdout) as {
		ok: boolean;
		action: string;
		id: string;
	};
	assert.equal(body.action, "add");
	assert.equal(body.id, "fixture:BEH-002");

	const got = await runSdd(root, ["record", "get", "fixture:BEH-002"]);
	assert.equal(got.stdout.trimEnd(), NEW_BEH_002);
	// anchor still present
	const anchor = await runSdd(root, ["record", "get", "fixture:BEH-001"]);
	assert.equal(anchor.code, 0);
});

test("BEH-063: record add refuses a duplicate id and writes nothing", async () => {
	// @covers sdd-cli:BEH-063
	const root = await editFixture();
	const before = await readFile(join(root, "spec", "spec.md"), "utf8");
	const dup = [
		"id: fixture:BEH-001",
		"type: Behavior",
		"lifecycle:",
		"  status: proposed",
	].join("\n");

	const r = await runSdd(root, [
		"record",
		"add",
		"--after",
		"fixture:BEH-001",
		"--content",
		dup,
	]);

	assert.equal(r.code, 1);
	assert.equal(await readFile(join(root, "spec", "spec.md"), "utf8"), before);
});

test("BEH-063: record add refuses an unknown anchor", async () => {
	// @covers sdd-cli:BEH-063
	const root = await editFixture();

	const r = await runSdd(root, [
		"record",
		"add",
		"--after",
		"fixture:NOPE-9",
		"--content",
		NEW_BEH_002,
	]);

	assert.equal(r.code, 1);
});

test("BEH-063: record add without --after exits 2", async () => {
	// @covers sdd-cli:BEH-063
	const root = await editFixture();

	const r = await runSdd(root, ["record", "add", "--content", NEW_BEH_002]);

	assert.equal(r.code, 2);
});

test("INV-015: record set rewrites only the target spec file", async () => {
	// @covers sdd-cli:INV-015
	const root = await mkdtemp(join(tmpdir(), "sdd-record-multi-"));
	await mkdir(join(root, ".sdd"));
	await mkdir(join(root, "spec"));
	await writeFile(
		join(root, ".sdd", "config.json"),
		JSON.stringify(
			{
				spec_file: "spec/a.md",
				baseline_id: "fixture:BL-001",
				discovery_scope: ["src"],
				mechanism: "git_tree_hash_v1",
				lint: { spec_files: ["spec/*.md"] },
			},
			null,
			2,
		),
	);
	await writeFile(join(root, "spec", "a.md"), EDIT_SPEC);
	const bContent = [
		"# other",
		"",
		"```yaml",
		"---",
		"id: other:BEH-001",
		"type: Behavior",
		"lifecycle:",
		"  status: proposed",
		"---",
		"```",
		"",
	].join("\n");
	await writeFile(join(root, "spec", "b.md"), bContent);
	const configBefore = await readFile(
		join(root, ".sdd", "config.json"),
		"utf8",
	);

	const r = await runSdd(root, [
		"record",
		"set",
		"fixture:BEH-001",
		"--content",
		UPDATED_BEH_001,
	]);

	assert.equal(r.code, 0);
	assert.equal(await readFile(join(root, "spec", "b.md"), "utf8"), bContent);
	assert.equal(
		await readFile(join(root, ".sdd", "config.json"), "utf8"),
		configBefore,
	);
});
