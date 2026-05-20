import assert from "node:assert/strict";
import test from "node:test";
import { installRules } from "../../src/features/install/application/InstallRules.js";
import type { InstallSource } from "../../src/features/install/ports/outbound/InstallSource.js";
import type { InstallTargetFs } from "../../src/features/install/ports/outbound/InstallTargetFs.js";

const HOME = "/home/test";

const MANIFEST = JSON.stringify({
  format_version: 1,
  artifacts: [
    { source: "a.md", kind: "context", targets: ["claude", "codex"] },
    { source: "skills/x/SKILL.md", kind: "skill", skill_name: "x", targets: ["claude", "codex"] },
    { source: "hooks/h.sh", kind: "hook", event: "Read", targets: ["claude"] },
  ],
});

class FakeSource implements InstallSource {
  constructor(
    private readonly manifest: string | null,
    private readonly files: Record<string, string | null>,
  ) {}

  manifestText(): Promise<string | null> {
    return Promise.resolve(this.manifest);
  }

  readArtifact(source: string): Promise<string | null> {
    return Promise.resolve(this.files[source] ?? null);
  }
}

class FakeFs implements InstallTargetFs {
  readonly writes = new Map<string, { content: string; executable: boolean }>();

  homeRoot(): string {
    return HOME;
  }

  readText(): Promise<string | null> {
    return Promise.resolve(null);
  }

  writeText(absPath: string, content: string, executable: boolean): Promise<void> {
    this.writes.set(absPath, { content, executable });
    return Promise.resolve();
  }
}

function fullFiles(): Record<string, string> {
  return { "a.md": "A", "skills/x/SKILL.md": "S", "hooks/h.sh": "#!/bin/bash\n" };
}

test("installRules all writes only under the agent-config home roots", async () => {
  // @covers sdd-cli:INV-016
  // @covers sdd-cli:POL-003
  const fs = new FakeFs();
  const outcome = await installRules("all", false, { source: new FakeSource(MANIFEST, fullFiles()), fs });

  assert.ok(outcome.ok);
  for (const absPath of fs.writes.keys()) {
    const underClaude = absPath.startsWith(`${HOME}/.claude/`);
    const underCodex = absPath.startsWith(`${HOME}/.codex/`);
    assert.ok(underClaude || underCodex, `write escaped home roots: ${absPath}`);
  }
});

test("installRules all reports both targets and emits a valid action set", async () => {
  // @covers sdd-cli:BEH-067
  // @covers sdd-cli:CTR-030
  const outcome = await installRules("all", false, { source: new FakeSource(MANIFEST, fullFiles()), fs: new FakeFs() });

  assert.ok(outcome.ok);
  assert.deepEqual(outcome.targets, ["claude", "codex"]);
  assert.equal(outcome.dryRun, false);
  for (const action of outcome.actions) {
    assert.ok(["claude", "codex"].includes(action.target));
    assert.ok(["context", "skill", "reference", "data", "hook", "managed_block"].includes(action.kind));
    assert.ok(["copy", "write_block", "merge_hook", "skip"].includes(action.op));
    assert.equal(typeof action.path, "string");
  }
});

test("installRules --dry-run plans actions but writes nothing", async () => {
  // @covers sdd-cli:BEH-069
  const fs = new FakeFs();
  const outcome = await installRules("claude", true, { source: new FakeSource(MANIFEST, fullFiles()), fs });

  assert.ok(outcome.ok);
  assert.equal(outcome.dryRun, true);
  assert.ok(outcome.actions.length > 0);
  assert.equal(fs.writes.size, 0);
});

test("installRules fails with manifest-missing and writes nothing", async () => {
  // @covers sdd-cli:BEH-071
  const fs = new FakeFs();
  const outcome = await installRules("claude", false, { source: new FakeSource(null, {}), fs });

  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "manifest-missing");
    assert.equal(outcome.exitCode, 1);
  }
  assert.equal(fs.writes.size, 0);
});

test("installRules fails with artifact-missing before any write (plan-then-apply)", async () => {
  // @covers sdd-cli:BEH-071
  // @covers sdd-cli:INV-016
  const fs = new FakeFs();
  const files = { "a.md": "A", "skills/x/SKILL.md": null, "hooks/h.sh": "#!/bin/bash\n" };
  const outcome = await installRules("claude", false, { source: new FakeSource(MANIFEST, files), fs });

  assert.equal(outcome.ok, false);
  if (!outcome.ok) {
    assert.equal(outcome.reason, "artifact-missing");
  }
  assert.equal(fs.writes.size, 0);
});
