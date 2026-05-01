import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { ReadyGitPort } from "../../ports/outbound/ReadyGitPort.js";

interface GitResult {
  code: number;
  stdout: Buffer;
  stderr: Buffer;
}

export class ChildProcessReadyGit implements ReadyGitPort {
  async isGitRepo(cwd: string): Promise<boolean> {
    try {
      const result = await runGit(cwd, ["rev-parse", "--is-inside-work-tree"]);
      return result.code === 0 && result.stdout.toString("utf8").trim() === "true";
    } catch {
      return false;
    }
  }

  async repoRoot(cwd: string): Promise<string> {
    let current = resolve(cwd);
    while (true) {
      if (existsSync(join(current, ".git"))) return current;
      const parent = dirname(current);
      if (parent === current) {
        throw new Error("not-a-git-repo");
      }
      current = parent;
    }
  }

  async treeBytes(repoRoot: string, scope: readonly string[]): Promise<Uint8Array> {
    const result = await runGit(repoRoot, ["ls-tree", "HEAD", "--", ...scope]);
    if (result.code !== 0) {
      throw new Error(result.stderr.toString("utf8").trim() || "git ls-tree failed");
    }
    return result.stdout;
  }

  async treePaths(repoRoot: string, scope: readonly string[]): Promise<string[]> {
    const result = await runGit(repoRoot, ["ls-tree", "-r", "--name-only", "HEAD", "--", ...scope]);
    if (result.code !== 0) {
      throw new Error(result.stderr.toString("utf8").trim() || "git ls-tree failed");
    }
    return nonEmptyLines(result.stdout.toString("utf8"));
  }

  async dirtyPaths(repoRoot: string, scope: readonly string[]): Promise<string[]> {
    const diffResult = await runGit(repoRoot, ["diff", "--quiet", "HEAD", "--", ...scope]);
    if (diffResult.code !== 0 && diffResult.code !== 1) {
      throw new Error(diffResult.stderr.toString("utf8").trim() || "git diff --quiet failed");
    }
    const result = await runGit(repoRoot, ["status", "--porcelain", "--", ...scope]);
    if (result.code !== 0) {
      throw new Error(result.stderr.toString("utf8").trim() || "git status failed");
    }
    return nonEmptyLines(result.stdout.toString("utf8")).map((line) => porcelainPath(line)).sort();
  }

  async readAtRef(repoRoot: string, ref: string, relativePath: string): Promise<string | null> {
    const result = await runGit(repoRoot, ["show", `${ref}:${relativePath}`]);
    if (result.code !== 0) return null;
    return result.stdout.toString("utf8");
  }
}

function runGit(cwd: string, args: readonly string[]): Promise<GitResult> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", [...args], { cwd, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") {
        reject(new Error("git binary is not on PATH"));
        return;
      }
      reject(error);
    });
    child.on("close", (code) => {
      resolvePromise({ code: code ?? 1, stdout: Buffer.concat(stdout), stderr: Buffer.concat(stderr) });
    });
  });
}

function nonEmptyLines(value: string): string[] {
  return value.split(/\r?\n/).filter((line) => line.length > 0);
}

function porcelainPath(line: string): string {
  const raw = line.slice(3);
  if (raw.includes(" -> ")) {
    return raw.split(" -> ").at(-1)!;
  }
  return raw;
}
