/** Partition component of a normative ID. IDs are `<partition>:<ID-tail>`
 *  where the tail contains no `:` (CST-007), so the rightmost colon splits
 *  them unambiguously. A bare partition-name id (no colon) is its own
 *  partition. */
export function partitionOf(id: string): string {
  const idx = id.lastIndexOf(":");
  return idx === -1 ? id : id.slice(0, idx);
}
