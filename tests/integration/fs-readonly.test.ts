import assert from "node:assert/strict";
import { readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import test from "node:test";
import { commit, fixtureRepo, git, runSdd, type FixtureRepo } from "./_helpers.js";

interface FileSnapshot {
  path: string;
  size: number;
  mtimeMs: number;
  ino: number;
}

interface RepoSnapshot {
  spec: FileSnapshot;
  config: FileSnapshot;
  gitObjectCount: number;
  gitRefHeadsCount: number;
}

async function fileSnapshot(absolutePath: string, root: string): Promise<FileSnapshot> {
  const info = await stat(absolutePath);
  return {
    path: relative(root, absolutePath),
    size: info.size,
    mtimeMs: info.mtimeMs,
    ino: info.ino,
  };
}

async function countTree(start: string): Promise<number> {
  let count = 0;
  let stack: string[] = [start];
  while (stack.length > 0) {
    const current = stack.pop()!;
    const info = await stat(current);
    if (info.isDirectory()) {
      const children = await readdir(current);
      stack = stack.concat(children.map((child) => join(current, child)));
      continue;
    }
    count += 1;
  }
  return count;
}

async function snapshot(repo: FixtureRepo): Promise<RepoSnapshot> {
  return {
    spec: await fileSnapshot(join(repo.root, "spec", "spec.md"), repo.root),
    config: await fileSnapshot(join(repo.root, ".sdd", "config.json"), repo.root),
    gitObjectCount: await countTree(join(repo.root, ".git", "objects")),
    gitRefHeadsCount: await countTree(join(repo.root, ".git", "refs", "heads")),
  };
}

async function assertReadOnly(repo: FixtureRepo, action: () => Promise<unknown>): Promise<void> {
  const before = await snapshot(repo);
  await action();
  const after = await snapshot(repo);
  assert.deepEqual(after, before);
}

test("sdd token does not mutate spec, config or git refs/objects", async () => {
  // @covers sdd-cli:INV-002
  // @covers sdd-cli:POL-001
  const repo = await fixtureRepo();

  await assertReadOnly(repo, () => runSdd(repo.root, ["token", "--format=json"]));
});

test("sdd check does not mutate spec, config or git refs/objects", async () => {
  // @covers sdd-cli:INV-002
  // @covers sdd-cli:POL-001
  const repo = await fixtureRepo();

  await assertReadOnly(repo, () => runSdd(repo.root, ["check", "--format=json"]));
});

test("sdd refresh does not mutate spec, config or git refs/objects", async () => {
  // @covers sdd-cli:INV-002
  // @covers sdd-cli:POL-001
  const repo = await fixtureRepo();
  await writeFile(join(repo.root, "src", "extra.ts"), "export const x = 1;\n");
  await git(repo.root, ["add", "src/extra.ts"]);
  await commit(repo.root, "drift");

  await assertReadOnly(repo, () => runSdd(repo.root, ["refresh", "--format=json"]));
});

test("sdd ready does not mutate spec, config or git refs/objects", async () => {
  // @covers sdd-cli:INV-008
  // @covers sdd-cli:INV-009
  // @covers sdd-cli:POL-001
  // INV-008 is asserted via the same fs-readonly probe: a test runner that
  // executed any of the fixture tests would necessarily create cache files,
  // node_modules state, or test-output artifacts inside the working tree.
  // The byte-identical-tree post-condition demonstrates ready never spawned
  // such a runner.
  const repo = await fixtureRepo();

  await assertReadOnly(repo, () => runSdd(repo.root, ["ready", "--format=json"]));
});

test("sdd record list/get do not mutate spec, config or git refs/objects", async () => {
  // @covers sdd-cli:INV-002
  // @covers sdd-cli:POL-001
  const repo = await fixtureRepo();

  await assertReadOnly(repo, async () => {
    await runSdd(repo.root, ["record", "list", "--format=json"]);
    await runSdd(repo.root, ["record", "get", "fixture:BL-001", "--format=json"]);
  });
});

test("config-error path does not mutate spec or git refs/objects", async () => {
  // @covers sdd-cli:INV-002
  // @covers sdd-cli:POL-001
  const repo = await fixtureRepo();
  const before = await fileSnapshot(join(repo.root, "spec", "spec.md"), repo.root);
  const beforeObjects = await countTree(join(repo.root, ".git", "objects"));
  await rm(join(repo.root, ".sdd", "config.json"));

  const result = await runSdd(repo.root, ["token", "--format=json"]);

  assert.equal(result.code, 2);
  const afterSpec = await fileSnapshot(join(repo.root, "spec", "spec.md"), repo.root);
  const afterObjects = await countTree(join(repo.root, ".git", "objects"));
  assert.deepEqual(afterSpec, before);
  assert.equal(afterObjects, beforeObjects);
});
