/*
 * Resolves the active VCS adapter for a command. "git" (or an absent `vcs`
 * field) yields the built-in GitVcs; any other value is a module specifier of
 * an external adapter package, loaded from the consumer repo (not sdd-cli's
 * own node_modules) and validated for shape before use.
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
	BUILTIN_GIT_VCS,
	configFromJson,
	type SddConfig,
} from "../shared/domain/Config.js";
import { configFailure } from "../shared/domain/Errors.js";
import type { Vcs, VcsAdapterOptions } from "../shared/domain/Vcs.js";
import { conformsToVcs } from "../shared/domain/VcsConformance.js";
import { GitVcs } from "./GitVcs.js";

type Factory = (options: VcsAdapterOptions) => unknown;

export async function resolveVcs(cwd: string): Promise<Vcs> {
	const bootstrap = readBootstrapConfig(cwd);
	if (bootstrap === null || bootstrap.config.vcs === BUILTIN_GIT_VCS) {
		return new GitVcs();
	}
	return loadExternalVcs(
		bootstrap.repoRoot,
		bootstrap.config.vcs,
		bootstrap.config.mechanism,
	);
}

async function loadExternalVcs(
	repoRoot: string,
	spec: string,
	expectedMechanism: string,
): Promise<Vcs> {
	const moduleUrl = resolveModuleUrl(repoRoot, spec);
	const loaded = await loadModule(moduleUrl, spec);
	const factory = pickFactory(loaded);
	if (factory === null) {
		throw configFailure(
			"config-invalid",
			`vcs adapter "${spec}" does not export a createVcs factory or a default function`,
		);
	}
	const options: VcsAdapterOptions = { repoRoot };
	const candidate = await callFactory(factory, options, spec);
	const conformance = conformsToVcs(candidate);
	if (!conformance.ok) {
		throw configFailure(
			"config-invalid",
			`vcs adapter "${spec}" is not conformant: ${conformance.problems.join("; ")}`,
		);
	}
	if (conformance.vcs.mechanism !== expectedMechanism) {
		throw configFailure(
			"config-invalid",
			`config mechanism "${expectedMechanism}" does not match vcs adapter "${spec}" mechanism "${conformance.vcs.mechanism}"`,
		);
	}
	return conformance.vcs;
}

function resolveModuleUrl(repoRoot: string, spec: string): string {
	if (isAbsolute(spec) || spec.startsWith(".")) {
		const resolved = resolve(repoRoot, spec);
		if (!isInsideRepo(repoRoot, resolved)) {
			throw configFailure(
				"config-invalid",
				`vcs adapter path "${spec}" escapes the repo root ${repoRoot}`,
			);
		}
		return pathToFileURL(resolved).href;
	}
	try {
		const requireFromRepo = createRequire(
			pathToFileURL(join(repoRoot, "package.json")),
		);
		return pathToFileURL(requireFromRepo.resolve(spec)).href;
	} catch {
		throw configFailure(
			"config-invalid",
			`vcs adapter "${spec}" is not installed in ${repoRoot}`,
		);
	}
}

async function loadModule(url: string, spec: string): Promise<unknown> {
	try {
		return await dynamicImport(url);
	} catch (error) {
		throw configFailure(
			"config-invalid",
			`vcs adapter "${spec}" failed to load`,
			error instanceof Error ? error.message : String(error),
		);
	}
}

function dynamicImport(specifier: string): Promise<unknown> {
	return import(specifier);
}

async function callFactory(
	factory: Factory,
	options: VcsAdapterOptions,
	spec: string,
): Promise<unknown> {
	try {
		return await Promise.resolve(factory(options));
	} catch (error) {
		throw configFailure(
			"config-invalid",
			`vcs adapter "${spec}" factory threw`,
			error instanceof Error ? error.message : String(error),
		);
	}
}

function pickFactory(mod: unknown): Factory | null {
	if (!isObject(mod)) {
		return null;
	}
	if (isFactory(mod.createVcs)) {
		return mod.createVcs;
	}
	const fallback = mod.default;
	if (isFactory(fallback)) {
		return fallback;
	}
	if (isObject(fallback) && isFactory(fallback.createVcs)) {
		return fallback.createVcs;
	}
	return null;
}

interface BootstrapConfig {
	repoRoot: string;
	config: SddConfig;
}

function readBootstrapConfig(cwd: string): BootstrapConfig | null {
	let current = resolve(cwd);
	while (true) {
		const configPath = join(current, ".sdd", "config.json");
		if (existsSync(configPath)) {
			try {
				const parsed: unknown = JSON.parse(readFileSync(configPath, "utf8"));
				return {
					repoRoot: current,
					config: configFromJson(parsed, configPath),
				};
			} catch {
				return null;
			}
		}
		const parent = dirname(current);
		if (parent === current) {
			return null;
		}
		current = parent;
	}
}

function isInsideRepo(repoRoot: string, target: string): boolean {
	const rel = relative(repoRoot, target);
	return rel !== "" && !rel.startsWith("..") && !isAbsolute(rel);
}

function isFactory(value: unknown): value is Factory {
	return typeof value === "function";
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
