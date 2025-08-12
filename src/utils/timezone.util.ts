import { DateTime } from "luxon";

export function parseToUTC(isoOrDate: string | Date, timezone: string): Date {
  return DateTime.fromISO(isoOrDate.toString(), { zone: timezone })
    .toUTC()
    .toJSDate();
}

export function toZone(date: Date, timezone: string) {
  return DateTime.fromJSDate(date).setZone(timezone);
}
