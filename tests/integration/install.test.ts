import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { runSdd } from "./_helpers.js";

async function tmpHome(): Promise<string> {
  return mkdtemp(join(tmpdir(), "sdd-install-home-"));
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

test("sdd install claude installs rules, skill, import block, and both hooks", async () => {
  // @covers sdd-cli:BEH-065
  const home = await tmpHome();

  const result = await runSdd(process.cwd(), ["install", "claude"], { env: { SDD_INSTALL_HOME: home } });

  assert.equal(result.code, 0);
  assert.ok(await exists(join(home, ".claude/sdd/spec-driven-development.md")));
  assert.ok(await exists(join(home, ".claude/skills/spec-driven-development/SKILL.md")));

  const claudeMd = await readFile(join(home, ".claude/CLAUDE.md"), "utf8");
  assert.match(claudeMd, /@sdd\/spec-driven-development\.md/);
  assert.match(claudeMd, /@sdd\/tdd-sdd\.md/);

  const settings = JSON.parse(await readFile(join(home, ".claude/settings.json"), "utf8")) as {
    hooks: { PreToolUse: { matcher: string }[] };
  };
  const matchers = settings.hooks.PreToolUse.map((e) => e.matcher).sort();
  assert.deepEqual(matchers, ["Edit|Write", "Read|Bash|Grep|Glob"]);
});

test("sdd install claude preserves a pre-existing user hook in settings.json", async () => {
  // @covers sdd-cli:BEH-065
  const home = await tmpHome();
  await runSdd(process.cwd(), ["install", "claude"], { env: { SDD_INSTALL_HOME: home } });
  // Re-run after a user hand-added an unrelated hook; the installer must keep it.
  const settingsPath = join(home, ".claude/settings.json");
  const withUser = JSON.parse(await readFile(settingsPath, "utf8")) as { hooks: { PreToolUse: unknown[] } };
  withUser.hooks.PreToolUse.push({ matcher: "Bash", hooks: [{ type: "command", command: "/user/custom.sh" }] });
  await (await import("node:fs/promises")).writeFile(settingsPath, JSON.stringify(withUser), "utf8");

  const result = await runSdd(process.cwd(), ["install", "claude"], { env: { SDD_INSTALL_HOME: home } });

  assert.equal(result.code, 0);
  const settings = JSON.parse(await readFile(settingsPath, "utf8")) as { hooks: { PreToolUse: { matcher: string }[] } };
  assert.ok(settings.hooks.PreToolUse.some((e) => e.matcher === "Bash"));
});

test("sdd install codex copies rules under .codex/sdd, writes AGENTS.md, and installs no hooks", async () => {
  // @covers sdd-cli:BEH-066
  const home = await tmpHome();

  const result = await runSdd(process.cwd(), ["install", "codex", "--format=json"], { env: { SDD_INSTALL_HOME: home } });

  assert.equal(result.code, 0);
  assert.ok(await exists(join(home, ".codex/sdd/spec-driven-development.md")));
  assert.ok(await exists(join(home, ".codex/AGENTS.md")));
  assert.equal(await exists(join(home, ".codex/settings.json")), false);

  const body = JSON.parse(result.stdout) as { actions: { kind: string; op: string }[] };
  assert.ok(body.actions.some((a) => a.kind === "hook" && a.op === "skip"));
});

test("sdd install all installs both targets", async () => {
  // @covers sdd-cli:BEH-067
  const home = await tmpHome();

  const result = await runSdd(process.cwd(), ["install", "all"], { env: { SDD_INSTALL_HOME: home } });

  assert.equal(result.code, 0);
  assert.ok(await exists(join(home, ".claude/CLAUDE.md")));
  assert.ok(await exists(join(home, ".codex/AGENTS.md")));
});

test("sdd install is idempotent on re-run", async () => {
  // @covers sdd-cli:BEH-068
  const home = await tmpHome();
  await runSdd(process.cwd(), ["install", "claude"], { env: { SDD_INSTALL_HOME: home } });

  const result = await runSdd(process.cwd(), ["install", "claude"], { env: { SDD_INSTALL_HOME: home } });

  assert.equal(result.code, 0);
  const claudeMd = await readFile(join(home, ".claude/CLAUDE.md"), "utf8");
  assert.equal(claudeMd.split("BEGIN sdd-cli").length - 1, 1);
  const settings = JSON.parse(await readFile(join(home, ".claude/settings.json"), "utf8")) as {
    hooks: { PreToolUse: unknown[] };
  };
  assert.equal(settings.hooks.PreToolUse.length, 2);
});

test("sdd install --dry-run writes nothing and reports dry_run true", async () => {
  // @covers sdd-cli:BEH-069
  const home = await tmpHome();

  const result = await runSdd(process.cwd(), ["install", "all", "--dry-run", "--format=json"], { env: { SDD_INSTALL_HOME: home } });

  assert.equal(result.code, 0);
  const body = JSON.parse(result.stdout) as { dry_run: boolean; actions: unknown[] };
  assert.equal(body.dry_run, true);
  assert.ok(body.actions.length > 0);
  assert.deepEqual(await readdir(home), []);
});

test("sdd install JSON output matches the CTR-030 envelope", async () => {
  // @covers sdd-cli:CTR-030
  const home = await tmpHome();

  const result = await runSdd(process.cwd(), ["install", "claude", "--format=json"], { env: { SDD_INSTALL_HOME: home } });

  const body = JSON.parse(result.stdout) as {
    format_version: number;
    ok: boolean;
    dry_run: boolean;
    targets: string[];
    actions: { target: string; kind: string; op: string; path: string }[];
  };
  assert.equal(body.format_version, 1);
  assert.equal(body.ok, true);
  assert.equal(body.dry_run, false);
  assert.deepEqual(body.targets, ["claude"]);
  for (const action of body.actions) {
    assert.ok(typeof action.target === "string" && typeof action.kind === "string");
    assert.ok(typeof action.op === "string" && typeof action.path === "string");
  }
});

test("sdd install rejects a missing or unknown target with exit 2", async () => {
  // @covers sdd-cli:BEH-070
  // @covers sdd-cli:CTR-029
  const home = await tmpHome();
  const env = { SDD_INSTALL_HOME: home };

  const noTarget = await runSdd(process.cwd(), ["install"], { env });
  const unknown = await runSdd(process.cwd(), ["install", "bogus"], { env });
  const unknownFlag = await runSdd(process.cwd(), ["install", "claude", "--nope"], { env });

  assert.equal(noTarget.code, 2);
  assert.equal(unknown.code, 2);
  assert.equal(unknownFlag.code, 2);
  assert.equal(await exists(join(home, ".claude")), false);
});

test("sdd install never writes inside the repo working tree", async () => {
  // @covers sdd-cli:INV-016
  // @covers sdd-cli:POL-003
  const home = await tmpHome();
  const repo = await mkdtemp(join(tmpdir(), "sdd-install-cwd-"));

  const result = await runSdd(repo, ["install", "all"], { env: { SDD_INSTALL_HOME: home } });

  assert.equal(result.code, 0);
  assert.deepEqual(await readdir(repo), []);
});
