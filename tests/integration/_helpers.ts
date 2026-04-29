import { execFile } from "node:child_process";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

export const projectRoot = process.cwd();

const tsxLoader = pathToFileURL(join(projectRoot, "node_modules", "tsx", "dist", "loader.mjs")).href;
const exec = promisify(execFile);

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

export interface RunOptions {
  env?: NodeJS.ProcessEnv;
}

export interface FixtureRepo {
  root: string;
  baselineCommitSha: string;
  baselineToken: string;
}

export function runSdd(cwd: string, args: readonly string[], options: RunOptions = {}): Promise<RunResult> {
  return new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ["--import", tsxLoader, join(projectRoot, "src", "cli.ts"), ...args],
      { cwd, env: { ...process.env, ...options.env } },
      (error, stdout, stderr) => {
        if (error && typeof error === "object" && "code" in error && typeof error.code === "number") {
          resolve({ code: error.code, stdout, stderr });
          return;
        }
        if (error) {
          reject(error);
          return;
        }
        resolve({ code: 0, stdout, stderr });
      },
    );
  });
}

export async function git(cwd: string, args: readonly string[]): Promise<void> {
  await exec("git", [...args], { cwd });
}

export async function commit(cwd: string, message: string): Promise<void> {
  await git(cwd, ["-c", "user.name=Test", "-c", "user.email=test@example.test", "commit", "-m", message]);
}

export function specText(freshnessToken: string, baselineCommitSha: string): string {
  return `# fixture

\`\`\`yaml
---
id: fixture:BL-001
type: BrownfieldBaseline
freshness_token: ${freshnessToken}
baseline_commit_sha: ${baselineCommitSha}
---
\`\`\`

\`\`\`yaml
---
id: fixture:IMP-001
type: ImplementationBinding
target_ids:
  - fixture:BEH-001
binding:
  command: src/foo.ts
---
\`\`\`
`;
}

export async function fixtureRepo(): Promise<FixtureRepo> {
  const root = await mkdtemp(join(tmpdir(), "sdd-e2e-"));
  await git(root, ["init", "-b", "main"]);
  await mkdir(join(root, ".sdd"));
  await mkdir(join(root, "spec"));
  await mkdir(join(root, "src"));
  await writeFile(join(root, ".sdd", "config.json"), JSON.stringify({
    spec_file: "spec/spec.md",
    baseline_id: "fixture:BL-001",
    discovery_scope: ["src"],
    mechanism: "git_tree_hash_v1",
  }, null, 2));
  await writeFile(join(root, "src", "foo.ts"), "export const value = 1;\n");
  await writeFile(join(root, "spec", "spec.md"), specText("0".repeat(64), "0".repeat(40)));
  await git(root, ["add", "."]);
  await commit(root, "baseline");
  const tokenResult = await runSdd(root, ["token", "--format=json"]);
  const tokenBody = JSON.parse(tokenResult.stdout) as { token: string; commit_sha: string };
  await writeFile(join(root, "spec", "spec.md"), specText(tokenBody.token, tokenBody.commit_sha));
  await git(root, ["add", "spec/spec.md"]);
  await commit(root, "record baseline");
  return { root, baselineCommitSha: tokenBody.commit_sha, baselineToken: tokenBody.token };
}
