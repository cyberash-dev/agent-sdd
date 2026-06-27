import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join, normalize, relative } from "node:path";
import test from "node:test";

test("source tree follows vertical-slice hexagonal import boundaries", async () => {
	// @covers sdd-cli:CST-003
	// @covers sdd-cli:INV-004
	const files = [
		...(await tsFiles(join("src", "features"))),
		...(await tsFiles(join("src", "shared", "domain"))),
		...(await tsFiles(join("src", "vcs"))),
	];
	const violations: string[] = [];

	for (const path of [
		join("src", "domain"),
		join("src", "ports"),
		join("src", "adapters"),
		join("src", "commands"),
	]) {
		if (await exists(path)) {
			violations.push(`forbidden global layer folder exists: ${path}`);
		}
	}

	for (const file of files) {
		const text = await readFile(file, "utf8");
		for (const specifier of importSpecifiers(text)) {
			const violation = importViolation(file, specifier);
			if (violation !== undefined) {
				violations.push(violation);
			}
		}
	}

	assert.deepEqual(violations, []);
});

async function tsFiles(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	const files = await Promise.all(
		entries.map(async (entry) => {
			const path = join(dir, entry.name);
			if (entry.isDirectory()) {
				return tsFiles(path);
			}
			return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
		}),
	);
	return files.flat();
}

async function exists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

function importSpecifiers(text: string): string[] {
	return [...text.matchAll(/from "([^"]+)"/g)].map((match) => match[1]!);
}

function importViolation(file: string, specifier: string): string | undefined {
	const source = parts(file);
	if (specifier.startsWith("node:")) {
		if (source[1] === "features" && source[3] === "adapters") {
			return undefined;
		}
		if (source[1] === "vcs") {
			return undefined;
		}
		const isAllowed =
			file === join("src", "shared", "domain", "Token.ts") &&
			specifier === "node:crypto";
		return isAllowed
			? undefined
			: `${file}: forbidden runtime import ${specifier}`;
	}
	if (!specifier.startsWith(".")) {
		return undefined;
	}

	const target = normalize(join(dirname(file), specifier)).replace(
		/\.js$/,
		".ts",
	);
	const targetParts = parts(target);
	if (source[1] === "vcs") {
		if (targetParts[1] === "vcs") {
			return undefined;
		}
		if (targetParts[1] === "shared" && targetParts[2] === "domain") {
			return undefined;
		}
		return `${file}: vcs imports outside shared/domain ${target}`;
	}
	if (source[1] === "shared") {
		if (targetParts[1] === "features") {
			return `${file}: shared imports feature ${target}`;
		}
		if (targetParts[1] === "vcs") {
			return `${file}: shared imports vcs ${target}`;
		}
		return undefined;
	}
	if (source[1] !== "features") {
		return undefined;
	}

	const feature = source[2];
	const layer = source[3];
	if (targetParts[1] === "features" && targetParts[2] !== feature) {
		return `${file}: cross-feature import ${target}`;
	}
	if (targetParts[1] === "shared" && targetParts[2] === "domain") {
		return undefined;
	}
	if (targetParts[1] !== "features" || targetParts[2] !== feature) {
		return `${file}: import leaves feature/shared boundary ${target}`;
	}

	const targetLayer = targetParts[3];
	if (layer === "domain" && targetLayer !== "domain") {
		return `${file}: domain imports ${target}`;
	}
	if (
		layer === "application" &&
		targetLayer !== "domain" &&
		targetLayer !== "ports"
	) {
		return `${file}: application imports ${target}`;
	}
	if (layer === "ports" && targetLayer !== "domain") {
		return `${file}: ports import ${target}`;
	}
	if (
		layer === "adapters" &&
		targetLayer !== "application" &&
		targetLayer !== "ports"
	) {
		return `${file}: adapter imports ${target}`;
	}
	return undefined;
}

function parts(path: string): string[] {
	return relative(".", path).split(/[\\/]/);
}
