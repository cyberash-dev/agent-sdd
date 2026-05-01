import type { FinalizeClock } from "../../ports/outbound/FinalizeClock.js";

export class SystemFinalizeClock implements FinalizeClock {
  now(): Date {
    return new Date();
  }
}
