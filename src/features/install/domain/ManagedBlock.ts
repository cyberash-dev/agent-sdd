export const BLOCK_BEGIN = "<!-- BEGIN sdd-cli (managed by `sdd install`) -->";
export const BLOCK_END = "<!-- END sdd-cli -->";

export function upsertManagedBlock(
	existing: string | null,
	body: string,
): string {
	const block = `${BLOCK_BEGIN}\n${body}\n${BLOCK_END}`;
	const current = existing ?? "";
	const beginAt = current.indexOf(BLOCK_BEGIN);
	const endAt = current.indexOf(BLOCK_END, beginAt + BLOCK_BEGIN.length);

	if (beginAt !== -1 && endAt !== -1) {
		const before = current.slice(0, beginAt);
		const after = current.slice(endAt + BLOCK_END.length);
		return ensureTrailingLf(`${before}${block}${after}`);
	}

	if (current.trim().length === 0) {
		return `${block}\n`;
	}
	return `${current.replace(/\n+$/, "")}\n\n${block}\n`;
}

function ensureTrailingLf(value: string): string {
	return value.endsWith("\n") ? value : `${value}\n`;
}
