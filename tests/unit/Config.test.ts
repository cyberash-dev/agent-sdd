import assert from "node:assert/strict";
import test from "node:test";
import { configFromJson } from "../../src/shared/domain/Config.js";
import { CliFailure } from "../../src/shared/domain/Errors.js";

test("minimum config applies footprint defaults", () => {
  // @covers sdd-cli:CTR-003
  const value = {
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
  };

  const config = configFromJson(value, ".sdd/config.json");

  assert.equal(config.footprint.bindingIdPrefix, "IMP-");
  assert.equal(config.footprint.bindingField, "binding");
});

test("unknown top-level field is rejected", () => {
  // @covers sdd-cli:CTR-003
  const value = {
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    extra: true,
  };

  assert.throws(
    () => configFromJson(value, ".sdd/config.json"),
    (error: unknown) => error instanceof CliFailure && error.reason === "config-invalid",
  );
});

test("flat config (no partitions) synthesises a single `default` partition", () => {
  // @covers sdd-cli:CTR-015
  const value = {
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
  };

  const config = configFromJson(value, ".sdd/config.json");

  assert.equal(config.partitions.length, 1);
  assert.equal(config.partitions[0]!.name, "default");
  assert.deepEqual(config.partitions[0]!.specPaths, ["spec/spec.md"]);
  assert.deepEqual(config.partitions[0]!.testPaths, []);
  assert.deepEqual(config.partitions[0]!.sandboxPaths, []);
});

test("top-level test_paths/sandbox_paths feed the synthesised default partition", () => {
  // @covers sdd-cli:CTR-015
  const value = {
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    test_paths: ["tests/**/*.ts"],
    sandbox_paths: ["spike/**"],
  };

  const config = configFromJson(value, ".sdd/config.json");

  assert.equal(config.partitions.length, 1);
  assert.deepEqual(config.partitions[0]!.testPaths, ["tests/**/*.ts"]);
  assert.deepEqual(config.partitions[0]!.sandboxPaths, ["spike/**"]);
});

test("explicit partitions block parses per-partition spec/test/sandbox paths", () => {
  // @covers sdd-cli:CTR-015
  const value = {
    spec_file: "spec/A.md",
    baseline_id: "a:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    partitions: {
      a: { spec_paths: ["spec/A.md"], test_paths: ["tests/a/**/*.ts"] },
      b: { spec_paths: ["spec/B.md"], sandbox_paths: ["spike/**"] },
    },
  };

  const config = configFromJson(value, ".sdd/config.json");

  assert.equal(config.partitions.length, 2);
  const a = config.partitions.find((p) => p.name === "a")!;
  const b = config.partitions.find((p) => p.name === "b")!;
  assert.deepEqual(a.specPaths, ["spec/A.md"]);
  assert.deepEqual(a.testPaths, ["tests/a/**/*.ts"]);
  assert.deepEqual(a.sandboxPaths, []);
  assert.deepEqual(b.specPaths, ["spec/B.md"]);
  assert.deepEqual(b.sandboxPaths, ["spike/**"]);
});

test("invalid partition name is rejected", () => {
  // @covers sdd-cli:CTR-015
  const value = {
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    partitions: {
      "Invalid Name": { spec_paths: ["spec/spec.md"] },
    },
  };

  assert.throws(
    () => configFromJson(value, ".sdd/config.json"),
    (error: unknown) => error instanceof CliFailure && error.reason === "config-invalid",
  );
});

test("unknown partition sub-field is rejected", () => {
  // @covers sdd-cli:CTR-015
  const value = {
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    partitions: {
      a: { spec_paths: ["spec/spec.md"], whatever: 1 },
    },
  };

  assert.throws(
    () => configFromJson(value, ".sdd/config.json"),
    (error: unknown) => error instanceof CliFailure && error.reason === "config-invalid",
  );
});

test("accepts a multi-segment partition name", () => {
  // @covers sdd-cli:CTR-015
  // @covers sdd-cli:CST-007
  const value = {
    spec_file: "spec/partitions/commands.md",
    baseline_id: "umbrella:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    partitions: {
      "bridge:commands": { spec_paths: ["spec/partitions/commands.md"] },
    },
  };

  const config = configFromJson(value, ".sdd/config.json");

  assert.equal(config.partitions.length, 1);
  assert.equal(config.partitions[0]!.name, "bridge:commands");
  assert.deepEqual(config.partitions[0]!.specPaths, ["spec/partitions/commands.md"]);
});

test("accepts a multi-segment baseline_id", () => {
  // @covers sdd-cli:CTR-003
  // @covers sdd-cli:CST-007
  const value = {
    spec_file: "spec/spec.md",
    baseline_id: "bridge:gateway:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
  };

  const config = configFromJson(value, ".sdd/config.json");

  assert.equal(config.baselineId, "bridge:gateway:BL-001");
});

test("rejects partition name with uppercase segment", () => {
  // @covers sdd-cli:CTR-015
  // @covers sdd-cli:CST-007
  const value = {
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
    partitions: {
      "Bridge:commands": { spec_paths: ["spec/spec.md"] },
    },
  };

  assert.throws(
    () => configFromJson(value, ".sdd/config.json"),
    (error: unknown) => error instanceof CliFailure && error.reason === "config-invalid",
  );
});
