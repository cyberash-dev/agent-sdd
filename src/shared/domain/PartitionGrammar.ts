// Single source of truth for the partition-prefix grammar (CST-007).
// Imported by both `MarkerParser` (test-marker scanner) and `Config`
// (`.sdd/config.json` validation) so a future grammar change cannot
// drift them apart and silently re-introduce the v0.2.0 multi-segment
// gap.

// One or more lowercase tokens joined by `:`. Single-segment is preserved
// bit-for-bit from v0.2.0 (`[a-z][a-z0-9-]*`); multi-segment unblocks
// adopters that namespace partitions (e.g. `bridge:commands`).
export const PARTITION_PREFIX_RE_SRC = "[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)*";

// Normative-ID tail. Contains no `:`, which is what makes the rightmost-`:`
// split in `MarkerParser.lastIndexOf(":")` unambiguous (CST-007).
export const ID_TAIL_RE_SRC = "[A-Z]+-\\d+";

export const PARTITION_NAME_RE = new RegExp(`^${PARTITION_PREFIX_RE_SRC}$`);

export const NORMATIVE_ID_RE = new RegExp(`^${PARTITION_PREFIX_RE_SRC}:${ID_TAIL_RE_SRC}$`);
