/* Pure baseline-comparison decision shared between check and ready slices. */

export type BaselineComparison =
	| { kind: "match"; recordedToken: string; recomputedToken: string }
	| { kind: "stale"; recordedToken: string; recomputedToken: string };

export function baselineComparison(
	recordedToken: string,
	recomputedToken: string,
): BaselineComparison {
	if (recordedToken === recomputedToken) {
		return { kind: "match", recordedToken, recomputedToken };
	}
	return { kind: "stale", recordedToken, recomputedToken };
}
