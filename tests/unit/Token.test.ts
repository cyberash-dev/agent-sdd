import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { token } from "../../src/shared/domain/Token.js";

const exec = promisify(execFile);

test("token equals sha256 of git ls-tree bytes", async () => {
  // @covers sdd-cli:BEH-001
  // @covers sdd-cli:INV-001
  // @covers sdd-cli:INV-003
  const repo = await mkdtemp(join(tmpdir(), "sdd-token-"));
  await git(repo, "init", "-b", "main");
  await mkdir(join(repo, "src"));
  await writeFile(join(repo, "src", "foo.txt"), "one\n");
  await git(repo, "add", ".");
  await git(repo, "-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-m", "initial");

  const { stdout } = await execFileBuffer("git", ["ls-tree", "HEAD", "--", "src"], repo);

  assert.equal(token(stdout), createHash("sha256").update(stdout).digest("hex"));
});

async function git(cwd: string, ...args: string[]): Promise<void> {
  await exec("git", args, { cwd });
}

function execFileBuffer(command: string, args: string[], cwd: string): Promise<{ stdout: Buffer; stderr: Buffer }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { cwd, encoding: "buffer" }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr });
    });
  });
}
