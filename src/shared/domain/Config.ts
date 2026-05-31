import { configFailure } from "./Errors.js";
import { NORMATIVE_ID_RE, PARTITION_NAME_RE } from "./PartitionGrammar.js";

export type Mechanism = "git_tree_hash_v1";

export interface FootprintConfig {
	bindingIdPrefix: string;
	bindingField: string;
}

export interface Partition {
	name: string;
	specPaths: string[];
	testPaths: string[];
	sandboxPaths: string[];
}

export interface SddConfig {
	specFile: string;
	baselineId: string;
	discoveryScope: string[];
	footprint: FootprintConfig;
	mechanism: Mechanism;
	lint: LintConfig;
	partitions: Partition[];
	/** Directory under <repo_root> where attestation plan files live (P0.6).
	 *  Default: ".sdd/plans". */
	plansDir: string;
}

export interface LintConfig {
	specFiles: string[]; /* glob patterns; defaults to [spec_file] when absent */
	approverBlocklist: string[]; /* additional identities forbidden as approvers */
	partitionGlob: string[]; /* globs selecting partition-spec files for the §2 structure check; [] = heading-based detection */
}

interface ConfigObject {
	readonly [key: string]: unknown;
}

const TOP_LEVEL_FIELDS = new Set([
	"$schema",
	"spec_file",
	"baseline_id",
	"discovery_scope",
	"footprint",
	"mechanism",
	"lint",
	"partitions",
	"plans_dir",
	"test_paths",
	"sandbox_paths",
]);

const DEFAULT_PLANS_DIR = ".sdd/plans";
const FOOTPRINT_FIELDS = new Set(["binding_id_prefix", "binding_field"]);
const LINT_FIELDS = new Set([
	"spec_files",
	"approver_blocklist",
	"partition_glob",
]);
const PARTITION_FIELDS = new Set(["spec_paths", "test_paths", "sandbox_paths"]);

const DEFAULT_PARTITION_NAME = "default";

export function configFromJson(value: unknown, path: string): SddConfig {
	if (!isObject(value)) {
		throw configFailure(
			"config-invalid",
			".sdd/config.json must be a JSON object",
			undefined,
			path,
		);
	}

	for (const key of Object.keys(value)) {
		if (!TOP_LEVEL_FIELDS.has(key)) {
			throw configFailure(
				"config-invalid",
				`unknown config field: ${key}`,
				undefined,
				path,
			);
		}
	}

	const specFile = stringField(value, "spec_file", path);
	const baselineId = stringField(value, "baseline_id", path);
	const discoveryScope = stringArrayField(value, "discovery_scope", path);
	const mechanism = stringField(value, "mechanism", path);
	if (mechanism !== "git_tree_hash_v1") {
		throw configFailure(
			"config-invalid",
			`unsupported mechanism: ${mechanism}`,
			undefined,
			path,
		);
	}
	if (!NORMATIVE_ID_RE.test(baselineId)) {
		throw configFailure(
			"config-invalid",
			`invalid baseline_id: ${baselineId}`,
			undefined,
			path,
		);
	}

	const lint = lintConfig(value.lint, path, specFile);
	const topLevelTestPaths = optionalGlobArrayField(value, "test_paths", path);
	const topLevelSandboxPaths = optionalGlobArrayField(
		value,
		"sandbox_paths",
		path,
	);
	const partitions = partitionsField(
		value.partitions,
		path,
		lint.specFiles,
		topLevelTestPaths,
		topLevelSandboxPaths,
	);

	const plansDir =
		optionalStringField(value, "plans_dir", path) ?? DEFAULT_PLANS_DIR;

	return {
		specFile,
		baselineId,
		discoveryScope,
		footprint: footprintConfig(value.footprint, path),
		mechanism,
		lint,
		partitions,
		plansDir,
	};
}

function partitionsField(
	raw: unknown,
	path: string,
	lintSpecFiles: readonly string[],
	topLevelTestPaths: string[],
	topLevelSandboxPaths: string[],
): Partition[] {
	if (raw === undefined) {
		return [
			{
				name: DEFAULT_PARTITION_NAME,
				specPaths: [...lintSpecFiles],
				testPaths: topLevelTestPaths,
				sandboxPaths: topLevelSandboxPaths,
			},
		];
	}
	if (!isObject(raw)) {
		throw configFailure(
			"config-invalid",
			"partitions must be an object",
			undefined,
			path,
		);
	}
	const out: Partition[] = [];
	for (const name of Object.keys(raw)) {
		if (!PARTITION_NAME_RE.test(name)) {
			throw configFailure(
				"config-invalid",
				`invalid partition name "${name}" — must match /^[a-z][a-z0-9-]*(:[a-z][a-z0-9-]*)*$/`,
				undefined,
				path,
			);
		}
		const entry = raw[name];
		if (!isObject(entry)) {
			throw configFailure(
				"config-invalid",
				`partitions.${name} must be an object`,
				undefined,
				path,
			);
		}
		for (const key of Object.keys(entry)) {
			if (!PARTITION_FIELDS.has(key)) {
				throw configFailure(
					"config-invalid",
					`unknown partition field: partitions.${name}.${key}`,
					undefined,
					path,
				);
			}
		}
		const specPaths = stringArrayField(entry, "spec_paths", path);
		const testPaths = optionalGlobArrayField(entry, "test_paths", path);
		const sandboxPaths = optionalGlobArrayField(entry, "sandbox_paths", path);
		out.push({ name, specPaths, testPaths, sandboxPaths });
	}
	if (out.length === 0) {
		throw configFailure(
			"config-invalid",
			"partitions must declare at least one entry when present",
			undefined,
			path,
		);
	}
	return out;
}

function optionalGlobArrayField(
	value: ConfigObject,
	key: string,
	path: string,
): string[] {
	const field = value[key];
	if (field === undefined) {
		return [];
	}
	if (!Array.isArray(field)) {
		throw configFailure(
			"config-invalid",
			`${key} must be an array`,
			undefined,
			path,
		);
	}
	if (
		!field.every(
			(entry): entry is string => typeof entry === "string" && entry.length > 0,
		)
	) {
		throw configFailure(
			"config-invalid",
			`${key} entries must be non-empty strings`,
			undefined,
			path,
		);
	}
	return [...field];
}

function lintConfig(
	value: unknown,
	path: string,
	specFileFallback: string,
): LintConfig {
	if (value === undefined) {
		return {
			specFiles: [specFileFallback],
			approverBlocklist: [],
			partitionGlob: [],
		};
	}
	if (!isObject(value)) {
		throw configFailure(
			"config-invalid",
			"lint must be an object",
			undefined,
			path,
		);
	}
	for (const key of Object.keys(value)) {
		if (!LINT_FIELDS.has(key)) {
			throw configFailure(
				"config-invalid",
				`unknown lint field: ${key}`,
				undefined,
				path,
			);
		}
	}
	const specFilesRaw = value.spec_files;
	const specFiles =
		specFilesRaw === undefined
			? [specFileFallback]
			: nonEmptyStringArray(specFilesRaw, "lint.spec_files", path);
	const approverBlocklist = optionalStringArray(
		value.approver_blocklist,
		"lint.approver_blocklist",
		path,
	);
	const partitionGlob = optionalStringArray(
		value.partition_glob,
		"lint.partition_glob",
		path,
	);
	return { specFiles, approverBlocklist, partitionGlob };
}

function nonEmptyStringArray(
	raw: unknown,
	field: string,
	path: string,
): string[] {
	if (!Array.isArray(raw) || raw.length === 0) {
		throw configFailure(
			"config-invalid",
			`${field} must be a non-empty array`,
			undefined,
			path,
		);
	}
	return assertStringEntries(raw, field, path);
}

function optionalStringArray(
	raw: unknown,
	field: string,
	path: string,
): string[] {
	if (raw === undefined) {
		return [];
	}
	if (!Array.isArray(raw)) {
		throw configFailure(
			"config-invalid",
			`${field} must be an array`,
			undefined,
			path,
		);
	}
	return assertStringEntries(raw, field, path);
}

function assertStringEntries(
	raw: unknown[],
	field: string,
	path: string,
): string[] {
	if (
		!raw.every(
			(entry): entry is string => typeof entry === "string" && entry.length > 0,
		)
	) {
		throw configFailure(
			"config-invalid",
			`${field} entries must be non-empty strings`,
			undefined,
			path,
		);
	}
	return [...raw];
}

function footprintConfig(value: unknown, path: string): FootprintConfig {
	if (value === undefined) {
		return { bindingIdPrefix: "IMP-", bindingField: "binding" };
	}
	if (!isObject(value)) {
		throw configFailure(
			"config-invalid",
			"footprint must be an object",
			undefined,
			path,
		);
	}
	for (const key of Object.keys(value)) {
		if (!FOOTPRINT_FIELDS.has(key)) {
			throw configFailure(
				"config-invalid",
				`unknown footprint field: ${key}`,
				undefined,
				path,
			);
		}
	}
	const bindingIdPrefix =
		optionalStringField(value, "binding_id_prefix", path) ?? "IMP-";
	const bindingField =
		optionalStringField(value, "binding_field", path) ?? "binding";
	return { bindingIdPrefix, bindingField };
}

function stringField(value: ConfigObject, key: string, path: string): string {
	const field = value[key];
	if (typeof field !== "string" || field.length === 0) {
		throw configFailure(
			"config-invalid",
			`${key} must be a non-empty string`,
			undefined,
			path,
		);
	}
	return field;
}

function optionalStringField(
	value: ConfigObject,
	key: string,
	path: string,
): string | undefined {
	const field = value[key];
	if (field === undefined) {
		return undefined;
	}
	if (typeof field !== "string" || field.length === 0) {
		throw configFailure(
			"config-invalid",
			`${key} must be a non-empty string`,
			undefined,
			path,
		);
	}
	return field;
}

function stringArrayField(
	value: ConfigObject,
	key: string,
	path: string,
): string[] {
	const field = value[key];
	if (!Array.isArray(field) || field.length === 0) {
		throw configFailure(
			"config-invalid",
			`${key} must be a non-empty array`,
			undefined,
			path,
		);
	}
	if (
		!field.every(
			(entry): entry is string => typeof entry === "string" && entry.length > 0,
		)
	) {
		throw configFailure(
			"config-invalid",
			`${key} entries must be non-empty strings`,
			undefined,
			path,
		);
	}
	return field;
}

function isObject(value: unknown): value is ConfigObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
