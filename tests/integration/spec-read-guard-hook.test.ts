import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";

// Regression coverage for the shipped PreToolUse guard rules/hooks/sdd-spec-read-guard.sh.
// It denies reads of spec/*.md inside an SDD project (a tree carrying .sdd/config.json)
// and stays silent everywhere else. The repo root itself is an SDD project.

const HOOK = join(process.cwd(), "rules", "hooks", "sdd-spec-read-guard.sh");

function runHook(input: object): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("bash", [HOOK], (error, stdout) => {
      if (error && (error as { code?: number }).code !== 0 && stdout.length === 0 && error.message.includes("ENOENT")) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
    child.stdin!.end(JSON.stringify(input));
  });
}

function denies(stdout: string): boolean {
  return stdout.includes('"permissionDecision": "deny"');
}

test("guard denies a Read of spec/*.md inside an SDD project", async () => {
  const out = await runHook({ tool_name: "Read", cwd: process.cwd(), tool_input: { file_path: `${process.cwd()}/spec/spec.md` } });
  assert.ok(denies(out));
});

test("guard denies a Bash cat of a spec file", async () => {
  const out = await runHook({ tool_name: "Bash", cwd: process.cwd(), tool_input: { command: "cat spec/spec.md" } });
  assert.ok(denies(out));
});

test("guard denies a Grep targeting the spec directory", async () => {
  const out = await runHook({ tool_name: "Grep", cwd: process.cwd(), tool_input: { pattern: "foo", path: "spec" } });
  assert.ok(denies(out));
});

test("guard allows a sanctioned `sdd record` Bash command", async () => {
  const out = await runHook({ tool_name: "Bash", cwd: process.cwd(), tool_input: { command: "sdd record get sdd-cli:INV-002" } });
  assert.ok(!denies(out));
});

test("guard allows git operations on spec files (not content reads)", async () => {
  const add = await runHook({ tool_name: "Bash", cwd: process.cwd(), tool_input: { command: "git add ./spec/*.md" } });
  const diff = await runHook({ tool_name: "Bash", cwd: process.cwd(), tool_input: { command: "git diff spec/spec.md" } });
  assert.ok(!denies(add));
  assert.ok(!denies(diff));
});

test("guard allows reading a non-spec file", async () => {
  const out = await runHook({ tool_name: "Read", cwd: process.cwd(), tool_input: { file_path: `${process.cwd()}/src/cli.ts` } });
  assert.ok(!denies(out));
});

test("guard stays silent outside an SDD project", async () => {
  const out = await runHook({ tool_name: "Read", cwd: "/tmp", tool_input: { file_path: "/tmp/spec/spec.md" } });
  assert.ok(!denies(out));
});
