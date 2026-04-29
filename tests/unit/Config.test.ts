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
