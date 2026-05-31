import type { ApproveClock } from "../../ports/outbound/ApproveClock.js";

export class SystemApproveClock implements ApproveClock {
	now(): Date {
		return new Date();
	}
}
