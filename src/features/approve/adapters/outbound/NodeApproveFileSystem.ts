import type { Dirent } from "node:fs";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import {
	configFromJson,
	type SddConfig,
} from "../../../../shared/domain/Config.js";
import { configFailure } from "../../../../shared/domain/Errors.js";
import type { ApproveConfigPort } from "../../ports/outbound/ApproveConfigPort.js";
import type {
	ApproveFileSystem,
	SpecFileEntry,
} from "../../ports/outbound/ApproveFileSystem.js";

export class NodeApproveFileSystem
	implements ApproveConfigPort, ApproveFileSystem
{
	async config(repoRoot: string): Promise<SddConfig> {
		const configPath = join(repoRoot, ".sdd", "config.json");
		const text = await readConfig(configPath);
		return configFromJson(parseConfigJson(text, configPath), configPath);
	}

	async resolveSpecFiles(
		repoRoot: string,
		patterns: readonly string[],
	): Promise<SpecFileEntry[]> {
		const matched = new Set<string>();
		for (const pattern of patterns) {
			for (const abs of await expandGlob(repoRoot, pattern)) {
				matched.add(abs);
			}
		}
		const list = [...matched].sort();
		const out: SpecFileEntry[] = [];
		for (const abs of list) {
			const text = await readFile(abs, "utf8");
			const rel = relative(repoRoot, abs).split("\\").join("/");
			out.push({ path: rel, content: text });
		}
		return out;
	}

	async writeSpecFile(
		repoRoot: string,
		relativePath: string,
		content: string,
	): Promise<void> {
		const abs = resolve(repoRoot, relativePath);
		await writeFile(abs, content, "utf8");
	}
}

async function expandGlob(
	repoRoot: string,
	pattern: string,
): Promise<string[]> {
	const normalised = pattern.split("\\").join("/");
	if (!hasGlob(normalised)) {
		const abs = resolve(repoRoot, normalised);
		return (await isFile(abs)) ? [abs] : [];
	}
	const segments = normalised.split("/");
	const literal: string[] = [];
	let firstGlobIndex = -1;
	for (let i = 0; i < segments.length; i++) {
		if (hasGlob(segments[i])) {
			firstGlobIndex = i;
			break;
		}
		literal.push(segments[i]);
	}
	const baseDir = resolve(repoRoot, ...literal);
	const remaining = segments.slice(firstGlobIndex);
	const out: string[] = [];
	await walk(baseDir, remaining, out);
	return out;
}

async function walk(
	dir: string,
	remaining: string[],
	acc: string[],
): Promise<void> {
	if (remaining.length === 0) {
		return;
	}
	const head = remaining[0];
	const rest = remaining.slice(1);
	let entries: Dirent[];
	try {
		entries = await readdir(dir, { withFileTypes: true });
	} catch {
		return;
	}
	if (head === "**") {
		if (rest.length === 0) {
			for (const e of entries) {
				const abs = join(dir, e.name);
				if (e.isDirectory()) {
					await walk(abs, ["**"], acc);
				} else if (e.isFile()) {
					acc.push(abs);
				}
			}
			return;
		}
		for (const e of entries) {
			if (e.isDirectory()) {
				await walk(join(dir, e.name), remaining, acc);
			}
		}
		await walk(dir, rest, acc);
		return;
	}
	for (const e of entries) {
		if (!matchSegment(head, e.name)) {
			continue;
		}
		const abs = join(dir, e.name);
		if (rest.length === 0) {
			if (e.isFile()) {
				acc.push(abs);
			}
			continue;
		}
		if (e.isDirectory()) {
			await walk(abs, rest, acc);
		}
	}
}

function matchSegment(pattern: string, name: string): boolean {
	if (!hasGlob(pattern)) {
		return pattern === name;
	}
	const re = new RegExp(
		`^${pattern
			.split("")
			.map((c) =>
				c === "*"
					? "[^/]*"
					: c === "?"
						? "[^/]"
						: c.replace(/[.+^${}()|[\]\\]/g, "\\$&"),
			)
			.join("")}$`,
	);
	return re.test(name);
}

function hasGlob(value: string): boolean {
	return /[*?[\]]/.test(value);
}

async function isFile(abs: string): Promise<boolean> {
	try {
		return (await stat(abs)).isFile();
	} catch {
		return false;
	}
}

async function readConfig(path: string): Promise<string> {
	try {
		return await readFile(path, "utf8");
	} catch (error) {
		throw configFailure(
			"config-missing",
			".sdd/config.json is missing or unreadable",
			errorMessage(error),
			path,
		);
	}
}
function parseConfigJson(text: string, path: string): unknown {
	try {
		return JSON.parse(text) as unknown;
	} catch (error) {
		throw configFailure(
			"config-invalid",
			".sdd/config.json is not valid JSON",
			errorMessage(error),
			path,
		);
	}
}
function errorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
