import type { Dirent } from "node:fs";
import {
	readFile,
	readdir,
	stat,
	writeFile,
	rename,
	unlink,
} from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";

import {
	configFromJson,
	type SddConfig,
} from "../../../../shared/domain/Config.js";
import {
	configFailure,
	errorMessage,
} from "../../../../shared/domain/Errors.js";
import type { FinalizeConfigPort } from "../../ports/outbound/FinalizeConfigPort.js";
import type {
	FinalizeFileSystem,
	SpecFileEntry,
} from "../../ports/outbound/FinalizeFileSystem.js";

export class NodeFinalizeFileSystem
	implements FinalizeConfigPort, FinalizeFileSystem
{
	async config(repoRoot: string): Promise<SddConfig> {
		const configPath = join(repoRoot, ".sdd", "config.json");
		let text: string;
		try {
			text = await readFile(configPath, "utf8");
		} catch (e) {
			throw configFailure(
				"config-invalid",
				`cannot read .sdd/config.json: ${errorMessage(e)}`,
				undefined,
				configPath,
			);
		}
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch (e) {
			throw configFailure(
				"config-invalid",
				`JSON parse error: ${errorMessage(e)}`,
				undefined,
				configPath,
			);
		}
		return configFromJson(parsed, configPath);
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

	async writeBatch(
		repoRoot: string,
		entries: ReadonlyArray<{ path: string; content: string }>,
	): Promise<void> {
		if (entries.length === 0) {
			return;
		}
		const tmps: Array<{ tmpPath: string; final: string }> = [];
		try {
			for (const e of entries) {
				const finalAbs = resolve(repoRoot, e.path);
				const tmpPath = `${finalAbs}.finalize.tmp.${process.pid}.${Date.now()}.${tmps.length}`;
				await writeFile(tmpPath, e.content, "utf8");
				tmps.push({ tmpPath, final: finalAbs });
			}
			for (const { tmpPath, final } of tmps) {
				await rename(tmpPath, final);
			}
		} catch (e) {
			/* Best-effort cleanup of any tmp files left behind. */
			for (const { tmpPath } of tmps) {
				try {
					await unlink(tmpPath);
				} catch {
					/* tmp may already be gone; original error is rethrown */
				}
			}
			throw e;
		}
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
	const remainder = segments.slice(firstGlobIndex);
	return walk(baseDir, remainder);
}

function hasGlob(s: string): boolean {
	return s.includes("*") || s.includes("?");
}

async function walk(
	baseDir: string,
	segments: readonly string[],
): Promise<string[]> {
	if (segments.length === 0) {
		return (await isFile(baseDir)) ? [baseDir] : [];
	}
	const [head, ...rest] = segments;
	if (head === "**") {
		const out: string[] = [];
		out.push(...(await walk(baseDir, rest)));
		let entries: Dirent[];
		try {
			entries = await readdir(baseDir, { withFileTypes: true });
		} catch {
			return [];
		}
		for (const e of entries) {
			if (!e.isDirectory()) {
				continue;
			}
			out.push(...(await walk(join(baseDir, e.name), segments)));
		}
		return out;
	}
	const re = segmentToRegExp(head);
	let entries: Dirent[];
	try {
		entries = await readdir(baseDir, { withFileTypes: true });
	} catch {
		return [];
	}
	const out: string[] = [];
	for (const e of entries) {
		if (!re.test(e.name)) {
			continue;
		}
		const next = join(baseDir, e.name);
		if (rest.length === 0) {
			if (await isFile(next)) {
				out.push(next);
			}
			continue;
		}
		if (e.isDirectory()) {
			out.push(...(await walk(next, rest)));
		}
	}
	return out;
}

function segmentToRegExp(seg: string): RegExp {
	let body = "^";
	for (const ch of seg) {
		switch (ch) {
			case "*":
				body += "[^/]*";
				break;
			case "?":
				body += "[^/]";
				break;
			default:
				body += ch.replace(/[-./\\^$+?()|[\]{}]/g, "\\$&");
		}
	}
	body += "$";
	return new RegExp(body);
}

async function isFile(abs: string): Promise<boolean> {
	try {
		const st = await stat(abs);
		return st.isFile();
	} catch {
		return false;
	}
}

void dirname; /* reserved */
