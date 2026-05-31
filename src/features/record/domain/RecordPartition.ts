/* CST-007: partition component of a normative ID. The ID-tail has no `:`,
 * so the rightmost colon splits `<partition>:<tail>`; a bare id is its own
 * partition. See spec record. */
export function partitionOf(id: string): string {
	const idx = id.lastIndexOf(":");
	return idx === -1 ? id : id.slice(0, idx);
}
