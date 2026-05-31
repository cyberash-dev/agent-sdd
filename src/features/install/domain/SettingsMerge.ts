export interface DesiredHook {
	matcher: string;
	command: string;
}

interface HookCommand {
	type: string;
	command: string;
}

interface HookEntry {
	matcher?: string;
	hooks?: HookCommand[];
}

export function mergeHooks(
	existingText: string | null,
	desired: readonly DesiredHook[],
): string {
	const settings = parseSettings(existingText);
	const hooks = asObject(settings.hooks);
	settings.hooks = hooks;
	const preToolUse = asHookEntries(hooks.PreToolUse);
	hooks.PreToolUse = preToolUse;

	for (const want of desired) {
		if (!hasHook(preToolUse, want)) {
			preToolUse.push({
				matcher: want.matcher,
				hooks: [{ type: "command", command: want.command }],
			});
		}
	}

	return `${JSON.stringify(settings, null, 2)}\n`;
}

function hasHook(entries: readonly HookEntry[], want: DesiredHook): boolean {
	return entries.some(
		(entry) =>
			entry.matcher === want.matcher &&
			Array.isArray(entry.hooks) &&
			entry.hooks.some((h) => h.command === want.command),
	);
}

function parseSettings(text: string | null): Record<string, unknown> {
	if (text === null || text.trim().length === 0) {
		return {};
	}
	const parsed: unknown = JSON.parse(text);
	if (!isRecord(parsed)) {
		throw new Error("settings.json must contain a JSON object");
	}
	return parsed;
}

function asObject(value: unknown): Record<string, unknown> {
	return isRecord(value) ? value : {};
}

function asHookEntries(value: unknown): HookEntry[] {
	return isHookEntryArray(value) ? value : [];
}

function isHookEntryArray(value: unknown): value is HookEntry[] {
	return Array.isArray(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
