import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname } from "node:path";
import process from "node:process";
import type { InstallTargetFs } from "../../ports/outbound/InstallTargetFs.js";

export class NodeInstallTargetFs implements InstallTargetFs {
	homeRoot(): string {
		const override = process.env.SDD_INSTALL_HOME;
		return override !== undefined && override.length > 0 ? override : homedir();
	}

	async readText(absPath: string): Promise<string | null> {
		try {
			return await readFile(absPath, "utf8");
		} catch {
			return null;
		}
	}

	async writeText(
		absPath: string,
		content: string,
		executable: boolean,
	): Promise<void> {
		await mkdir(dirname(absPath), { recursive: true });
		const tmp = `${absPath}.tmp.${process.pid}.${Date.now()}`;
		await writeFile(tmp, content, "utf8");
		if (executable) {
			await chmod(tmp, 0o755);
		}
		await rename(tmp, absPath);
	}
}
