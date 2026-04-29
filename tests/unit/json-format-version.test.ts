import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { CliCheckHandler } from "../../src/features/check/adapters/inbound/CliCheckHandler.js";
import { CliRefreshHandler } from "../../src/features/refresh/adapters/inbound/CliRefreshHandler.js";
import { CliTokenHandler } from "../../src/features/token/adapters/inbound/CliTokenHandler.js";

const SCOPE = ["src"];
const COMMIT_SHA = "0".repeat(40);
const EMPTY_TREE_TOKEN = createHash("sha256").update(new Uint8Array()).digest("hex");

const fakeConfig = {
  config: async () => ({
    specFile: "spec/spec.md",
    baselineId: "fixture:BL-001",
    discoveryScope: SCOPE,
    footprint: { bindingIdPrefix: "IMP-", bindingField: "binding" },
    mechanism: "git_tree_hash_v1" as const,
    lint: { specFiles: ["spec/spec.md"], approverBlocklist: [] },
  }),
};

const tokenGit = {
  repoRoot: async () => "/fake/repo",
  headSha: async () => COMMIT_SHA,
  treeBytes: async () => new Uint8Array(),
  treePaths: async () => ["src/foo.ts"],
  dirtyPaths: async () => [] as string[],
};

test("token success JSON carries format_version 1", async () => {
  // @covers sdd-cli:ASM-006
  // @covers sdd-cli:CTR-004
  const handler = new CliTokenHandler({ config: fakeConfig, git: tokenGit });

  const result = await handler.execute("/fake/repo", "json");

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout) as { format_version: number };
  assert.equal(body.format_version, 1);
});

test("check match JSON carries format_version 1", async () => {
  // @covers sdd-cli:ASM-006
  // @covers sdd-cli:CTR-005
  const checkSpec = {
    spec: async () => ({
      path: "/fake/repo/spec/spec.md",
      blocks: [
        {
          id: "fixture:BL-001",
          type: "BrownfieldBaseline",
          parsed: {
            id: "fixture:BL-001",
            type: "BrownfieldBaseline",
            freshness_token: EMPTY_TREE_TOKEN,
            baseline_commit_sha: COMMIT_SHA,
          },
          raw: "",
          line: 1,
        },
      ],
    }),
  };
  const checkGit = {
    repoRoot: async () => "/fake/repo",
    headSha: async () => COMMIT_SHA,
    treeBytes: async () => new Uint8Array(),
    treePaths: async () => ["src/foo.ts"],
    dirtyPaths: async () => [] as string[],
  };
  const handler = new CliCheckHandler({ config: fakeConfig, git: checkGit, spec: checkSpec });

  const result = await handler.execute("/fake/repo", "json");

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout) as { format_version: number };
  assert.equal(body.format_version, 1);
});

test("refresh empty JSON carries format_version 1", async () => {
  // @covers sdd-cli:ASM-006
  // @covers sdd-cli:CTR-006
  const refreshSpec = {
    spec: async () => ({
      path: "/fake/repo/spec/spec.md",
      blocks: [
        {
          id: "fixture:BL-001",
          type: "BrownfieldBaseline",
          parsed: {
            id: "fixture:BL-001",
            type: "BrownfieldBaseline",
            freshness_token: EMPTY_TREE_TOKEN,
            baseline_commit_sha: COMMIT_SHA,
          },
          raw: "",
          line: 1,
        },
      ],
    }),
  };
  const refreshGit = {
    repoRoot: async () => "/fake/repo",
    headSha: async () => COMMIT_SHA,
    treePaths: async () => ["src/foo.ts"],
    dirtyPaths: async () => [] as string[],
    changedPaths: async () => [] as string[],
  };
  const handler = new CliRefreshHandler({
    clock: { iso: () => "2026-04-29T15:37:35.000Z" },
    config: fakeConfig,
    git: refreshGit,
    spec: refreshSpec,
  });

  const result = await handler.execute("/fake/repo", "json");

  assert.equal(result.exitCode, 0);
  const body = JSON.parse(result.stdout) as { format_version: number };
  assert.equal(body.format_version, 1);
});
