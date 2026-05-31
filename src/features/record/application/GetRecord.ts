import { findMatches } from "../../../shared/domain/SpecApprovalRewrite.js";
import type { RecordSlice } from "../domain/RecordSlice.js";
import type { RecordConfigPort } from "../ports/outbound/RecordConfigPort.js";
import type { RecordFileReader } from "../ports/outbound/RecordFileReader.js";

export type { RecordSlice };

export async function getRecord(
	cwd: string,
	id: string,
	ports: { config: RecordConfigPort; files: RecordFileReader },
): Promise<RecordSlice[]> {
	const config = await ports.config.config(cwd);
	const entries = await ports.files.resolveSpecFiles(
		cwd,
		config.lint.specFiles,
	);
	const out: RecordSlice[] = [];
	for (const entry of entries) {
		const lines = entry.content.split(/\r?\n/);
		for (const match of findMatches(lines, id)) {
			const raw = lines
				.slice(match.startLine - 1, match.endLine - 1)
				.join("\n");
			out.push({
				id: match.id,
				file: entry.path,
				startLine: match.startLine,
				endLine: match.endLine,
				raw,
			});
		}
	}
	return out;
}
