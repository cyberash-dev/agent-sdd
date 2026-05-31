import { createHash } from "node:crypto";

export const TOKEN_MECHANISM = "git_tree_hash_v1";

export function token(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}
