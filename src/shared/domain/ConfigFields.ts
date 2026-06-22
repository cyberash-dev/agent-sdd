import { configFailure } from "./Errors.js";

export interface ConfigObject {
	readonly [key: string]: unknown;
}

export function isObject(value: unknown): value is ConfigObject {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function stringField(
	value: ConfigObject,
	key: string,
	path: string,
): string {
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

export function optionalStringField(
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

export function stringArrayField(
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

export function optionalGlobArrayField(
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

export function nonEmptyStringArray(
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

export function optionalStringArray(
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
