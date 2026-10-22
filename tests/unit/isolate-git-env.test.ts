import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const exec = promisify(execFile);

test("test processes drop the repository a calling git hook selected", async () => {
	const isolateGitEnv = fileURLToPath(
		new URL("../isolate-git-env.ts", import.meta.url),
	);

	const { stdout } = await exec(
		process.execPath,
		[
			"--import",
			"tsx",
			"--import",
			isolateGitEnv,
			"-e",
			"process.stdout.write(JSON.stringify([process.env.GIT_DIR, process.env.GIT_INDEX_FILE, process.env.GIT_WORK_TREE]))",
		],
		{
			env: {
				...process.env,
				GIT_DIR: "/hook/repo/.git",
				GIT_INDEX_FILE: "/hook/repo/.git/index",
				GIT_WORK_TREE: "/hook/repo",
			},
		},
	);

	assert.deepEqual(JSON.parse(stdout), [null, null, null]);
});
