import { lintRecordsFromMarkdown } from "../../../shared/domain/SpecRecord.js";
import { partitionOf } from "../domain/RecordPartition.js";
import { titleOf, type RecordSummary } from "../domain/RecordSummary.js";
import type { RecordConfigPort } from "../ports/outbound/RecordConfigPort.js";
import type { RecordFileReader } from "../ports/outbound/RecordFileReader.js";

export type { RecordSummary };

export interface RecordPorts {
  config: RecordConfigPort;
  files: RecordFileReader;
}

export async function listRecords(cwd: string, ports: RecordPorts, partition?: string): Promise<RecordSummary[]> {
  const config = await ports.config.config(cwd);
  const entries = await ports.files.resolveSpecFiles(cwd, config.lint.specFiles);
  const out: RecordSummary[] = [];
  for (const entry of entries) {
    for (const rec of lintRecordsFromMarkdown(entry.path, entry.content)) {
      if (partition !== undefined && partitionOf(rec.id) !== partition) continue;
      out.push({
        id: rec.id,
        type: rec.template,
        status: rec.lifecycleStatus,
        title: titleOf(rec.parsed),
        file: rec.file,
        line: rec.line,
      });
    }
  }
  return out;
}
