import type { RefreshClockPort } from "../../ports/outbound/RefreshClockPort.js";

export class SystemRefreshClock implements RefreshClockPort {
	iso(): string {
		return new Date().toISOString();
	}
}
