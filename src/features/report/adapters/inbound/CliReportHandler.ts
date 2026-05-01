import { ok, type CommandResult, type OutputFormat } from "../../../../shared/domain/CliOutput.js";
import { CliFailure } from "../../../../shared/domain/Errors.js";
import { runReport, type RunReportPorts } from "../../application/RunReport.js";
import type { ReportCommand, ReportRequest } from "../../ports/inbound/ReportCommand.js";

export class CliReportHandler implements ReportCommand {
  constructor(private readonly ports: RunReportPorts) {}

  async execute(cwd: string, req: ReportRequest, format: Exclude<OutputFormat, "yaml">): Promise<CommandResult> {
    if (!req.prSummary) {
      return {
        exitCode: 2,
        stdout: "",
        stderr: "report: --pr-summary is required (no other modes implemented in v0.4)\n",
      };
    }
    try {
      const out = await runReport(cwd, { prSummary: true, against: req.against }, this.ports);
      if (format === "json") {
        return ok(JSON.stringify({ format_version: 1, ok: true, markdown: out.markdown }));
      }
      return ok(out.markdown);
    } catch (error) {
      if (error instanceof CliFailure) {
        return { exitCode: 2, stdout: "", stderr: `${error.message}\n` };
      }
      throw error;
    }
  }
}
