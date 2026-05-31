/*
 * Single source of truth for the partition-prefix grammar (CST-007),
 * imported by both `MarkerParser` and `Config` so the two cannot drift.
 */

/*
 * One or more lowercase tokens joined by `:`, so adopters can namespace
 * partitions (e.g. `bridge:commands`).
 */
export const PARTITION_PREFIX_RE_SRC = "[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)*";

/*
 * Normative-ID tail. Contains no `:`, which is what makes the rightmost-`:`
 * split in `MarkerParser.lastIndexOf(":")` unambiguous (CST-007).
 */
export const ID_TAIL_RE_SRC = "[A-Z]+-\\d+";

export const PARTITION_NAME_RE = new RegExp(`^${PARTITION_PREFIX_RE_SRC}$`);

export const NORMATIVE_ID_RE = new RegExp(
	`^${PARTITION_PREFIX_RE_SRC}:${ID_TAIL_RE_SRC}$`,
);
