import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { specBlocks, typedBlock } from "../../src/shared/domain/SpecBlocks.js";

test("scanner ignores markdown separators outside yaml fences", async () => {
  // @covers sdd-cli:ASM-007
  // @covers sdd-cli:BEH-009
  const path = join("tests", "fixtures", "spec.simple.md");
  const markdown = await readFile(path, "utf8");

  const blocks = specBlocks(markdown);

  assert.deepEqual(blocks.map((block) => block.id), ["fixture:BL-001", "fixture:IMP-001"]);
});

test("baseline lookup rejects duplicate blocks", async () => {
  // @covers sdd-cli:ASM-002
  // @covers sdd-cli:BEH-009
  const markdown = `${await readFile(join("tests", "fixtures", "spec.simple.md"), "utf8")}\n${await readFile(join("tests", "fixtures", "spec.simple.md"), "utf8")}`;
  const blocks = specBlocks(markdown);

  assert.throws(() => typedBlock(blocks, "fixture:BL-001", "BrownfieldBaseline", "spec/spec.md"));
});
