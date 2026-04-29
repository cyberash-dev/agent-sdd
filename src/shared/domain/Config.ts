import { configFailure } from "./Errors.js";

export type Mechanism = "git_tree_hash_v1";

export interface FootprintConfig {
  bindingIdPrefix: string;
  bindingField: string;
}

export interface SddConfig {
  specFile: string;
  baselineId: string;
  discoveryScope: string[];
  footprint: FootprintConfig;
  mechanism: Mechanism;
  lint: LintConfig;
}

export interface LintConfig {
  specFiles: string[];          // glob patterns; defaults to [spec_file] when absent
  approverBlocklist: string[];  // additional identities forbidden as approvers
}

interface ConfigObject {
  readonly [key: string]: unknown;
}

const TOP_LEVEL_FIELDS = new Set(["$schema", "spec_file", "baseline_id", "discovery_scope", "footprint", "mechanism", "lint"]);
const FOOTPRINT_FIELDS = new Set(["binding_id_prefix", "binding_field"]);
const LINT_FIELDS = new Set(["spec_files", "approver_blocklist"]);

export function configFromJson(value: unknown, path: string): SddConfig {
  if (!isObject(value)) {
    throw configFailure("config-invalid", ".sdd/config.json must be a JSON object", undefined, path);
  }

  for (const key of Object.keys(value)) {
    if (!TOP_LEVEL_FIELDS.has(key)) {
      throw configFailure("config-invalid", `unknown config field: ${key}`, undefined, path);
    }
  }

  const specFile = stringField(value, "spec_file", path);
  const baselineId = stringField(value, "baseline_id", path);
  const discoveryScope = stringArrayField(value, "discovery_scope", path);
  const mechanism = stringField(value, "mechanism", path);
  if (mechanism !== "git_tree_hash_v1") {
    throw configFailure("config-invalid", `unsupported mechanism: ${mechanism}`, undefined, path);
  }
  if (!/^[a-z0-9_-]+:[A-Z]+-[0-9]+$/.test(baselineId)) {
    throw configFailure("config-invalid", `invalid baseline_id: ${baselineId}`, undefined, path);
  }

  return {
    specFile,
    baselineId,
    discoveryScope,
    footprint: footprintConfig(value.footprint, path),
    mechanism,
    lint: lintConfig(value.lint, path, specFile),
  };
}

function lintConfig(value: unknown, path: string, specFileFallback: string): LintConfig {
  if (value === undefined) {
    return { specFiles: [specFileFallback], approverBlocklist: [] };
  }
  if (!isObject(value)) {
    throw configFailure("config-invalid", "lint must be an object", undefined, path);
  }
  for (const key of Object.keys(value)) {
    if (!LINT_FIELDS.has(key)) {
      throw configFailure("config-invalid", `unknown lint field: ${key}`, undefined, path);
    }
  }
  const specFilesRaw = value.spec_files;
  let specFiles: string[];
  if (specFilesRaw === undefined) {
    specFiles = [specFileFallback];
  } else {
    if (!Array.isArray(specFilesRaw) || specFilesRaw.length === 0) {
      throw configFailure("config-invalid", "lint.spec_files must be a non-empty array", undefined, path);
    }
    if (!specFilesRaw.every((entry): entry is string => typeof entry === "string" && entry.length > 0)) {
      throw configFailure("config-invalid", "lint.spec_files entries must be non-empty strings", undefined, path);
    }
    specFiles = [...specFilesRaw];
  }
  const blocklistRaw = value.approver_blocklist;
  let approverBlocklist: string[];
  if (blocklistRaw === undefined) {
    approverBlocklist = [];
  } else {
    if (!Array.isArray(blocklistRaw)) {
      throw configFailure("config-invalid", "lint.approver_blocklist must be an array", undefined, path);
    }
    if (!blocklistRaw.every((entry): entry is string => typeof entry === "string" && entry.length > 0)) {
      throw configFailure("config-invalid", "lint.approver_blocklist entries must be non-empty strings", undefined, path);
    }
    approverBlocklist = [...blocklistRaw];
  }
  return { specFiles, approverBlocklist };
}

function footprintConfig(value: unknown, path: string): FootprintConfig {
  if (value === undefined) {
    return { bindingIdPrefix: "IMP-", bindingField: "binding" };
  }
  if (!isObject(value)) {
    throw configFailure("config-invalid", "footprint must be an object", undefined, path);
  }
  for (const key of Object.keys(value)) {
    if (!FOOTPRINT_FIELDS.has(key)) {
      throw configFailure("config-invalid", `unknown footprint field: ${key}`, undefined, path);
    }
  }
  const bindingIdPrefix = optionalStringField(value, "binding_id_prefix", path) ?? "IMP-";
  const bindingField = optionalStringField(value, "binding_field", path) ?? "binding";
  return { bindingIdPrefix, bindingField };
}

function stringField(value: ConfigObject, key: string, path: string): string {
  const field = value[key];
  if (typeof field !== "string" || field.length === 0) {
    throw configFailure("config-invalid", `${key} must be a non-empty string`, undefined, path);
  }
  return field;
}

function optionalStringField(value: ConfigObject, key: string, path: string): string | undefined {
  const field = value[key];
  if (field === undefined) {
    return undefined;
  }
  if (typeof field !== "string" || field.length === 0) {
    throw configFailure("config-invalid", `${key} must be a non-empty string`, undefined, path);
  }
  return field;
}

function stringArrayField(value: ConfigObject, key: string, path: string): string[] {
  const field = value[key];
  if (!Array.isArray(field) || field.length === 0) {
    throw configFailure("config-invalid", `${key} must be a non-empty array`, undefined, path);
  }
  if (!field.every((entry): entry is string => typeof entry === "string" && entry.length > 0)) {
    throw configFailure("config-invalid", `${key} entries must be non-empty strings`, undefined, path);
  }
  return field;
}

function isObject(value: unknown): value is ConfigObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
