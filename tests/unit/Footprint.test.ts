import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { footprint, footprintEntriesForPath, impsMissingBinding } from "../../src/features/refresh/domain/Footprint.js";
import { specBlocks } from "../../src/shared/domain/SpecBlocks.js";

test("binding tree walk collects string leaves", async () => {
  // @covers sdd-cli:ASM-003
  // @covers sdd-cli:BEH-006
  const markdown = await readFile(join("tests", "fixtures", "spec.with-imps.md"), "utf8");
  const blocks = specBlocks(markdown);

  const result = footprint(blocks, "IMP-", "binding");

  assert.deepEqual(result.entries[0]?.paths, ["src/foo.ts", "src/bar.ts", "src/nested"]);
});

test("impsMissingBinding flags an IMP-* block without a binding field", async () => {
  // @covers sdd-cli:BEH-051
  const markdown = await readFile(join("tests", "fixtures", "spec.with-imps.md"), "utf8");
  const blocks = specBlocks(markdown);

  const missing = impsMissingBinding(blocks, "IMP-", "binding");

  assert.deepEqual(missing, ["fixture:IMP-003"]);
});

test("path can be covered by multiple IMP entries", async () => {
  // @covers sdd-cli:CTR-006
  const markdown = await readFile(join("tests", "fixtures", "spec.with-imps.md"), "utf8");
  const blocks = specBlocks(markdown);
  const result = footprint(blocks, "IMP-", "binding");

  const entries = footprintEntriesForPath(result, "src/foo.ts");

  assert.deepEqual(entries.map((entry) => entry.impId), ["fixture:IMP-001", "fixture:IMP-002"]);
});
