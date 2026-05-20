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

export function mergeHooks(existingText: string | null, desired: readonly DesiredHook[]): string {
  const settings = parseSettings(existingText);
  const hooks = asObject(settings.hooks);
  settings.hooks = hooks;
  const preToolUse = Array.isArray(hooks.PreToolUse) ? (hooks.PreToolUse as HookEntry[]) : [];
  hooks.PreToolUse = preToolUse;

  for (const want of desired) {
    if (!hasHook(preToolUse, want)) {
      preToolUse.push({ matcher: want.matcher, hooks: [{ type: "command", command: want.command }] });
    }
  }

  return `${JSON.stringify(settings, null, 2)}\n`;
}

function hasHook(entries: readonly HookEntry[], want: DesiredHook): boolean {
  return entries.some((entry) =>
    entry.matcher === want.matcher
    && Array.isArray(entry.hooks)
    && entry.hooks.some((h) => h.command === want.command));
}

function parseSettings(text: string | null): Record<string, unknown> {
  if (text === null || text.trim().length === 0) {
    return {};
  }
  const parsed = JSON.parse(text) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("settings.json must contain a JSON object");
  }
  return parsed as Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
