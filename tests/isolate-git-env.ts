import { execFileSync } from "node:child_process";

/*
 * A git hook exports GIT_DIR, GIT_INDEX_FILE and friends; inherited by the
 * suite, they redirect every scratch-repo git call into the real repository.
 */
const repositoryLocalVariables = execFileSync(
	"git",
	["rev-parse", "--local-env-vars"],
	{ encoding: "utf8" },
)
	.split("\n")
	.filter((name) => name.length > 0);

for (const name of repositoryLocalVariables) {
	delete process.env[name];
}
