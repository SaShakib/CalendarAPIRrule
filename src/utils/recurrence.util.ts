import { RRule, rrulestr, Weekday } from "rrule";
import { IEvent } from "../models/event.models";

const freqMap = {
  DAILY: RRule.DAILY,
  WEEKLY: RRule.WEEKLY,
  MONTHLY: RRule.MONTHLY,
};

export function buildRRuleString(params: {
  freq: "DAILY" | "WEEKLY" | "MONTHLY";
  dtstart: Date;
  interval?: number;
  until?: Date;
  byweekday?: Weekday[];
}) {
  const rule = new RRule({
    freq: freqMap[params.freq],
    dtstart: params.dtstart,
    interval: params.interval ?? 1,
    until: params.until,
    byweekday: params.byweekday,
  });
  return rule.toString();
}

export function generateOccurrencesForEvent(
  event: IEvent,
  rangeStart: Date,
  rangeEnd: Date
) {
  // If non-recurring and single occurrence
  if (!event.recurrenceRule) {
    const st = event.startTime;
    if (st >= rangeStart && st <= rangeEnd) {
      // check exceptions for single-event = if deleted, skip
      const exception = event.exceptions?.find((e) => +e.date === +st);
      if (exception?.isDeleted) return [];
      if (exception?.override) {
        return [
          {
            startTime: new Date(exception.override.startTime || st),
            endTime: new Date(exception.override.endTime || event.endTime),
            originalEventId: event._id,
            override: exception.override,
          },
        ];
      }
      return [
        { startTime: st, endTime: event.endTime, originalEventId: event._id },
      ];
    }
    return [];
  }

  // Recurring

  const rule = rrulestr(event.recurrenceRule, { forceset: false }) as RRule;
  const dates = rule.between(rangeStart, rangeEnd, true);

  const exMap = new Map<string, any>();
  for (const ex of event.exceptions || []) {
    exMap.set(new Date(ex.date).toISOString(), ex);
  }

  const duration = event.endTime.getTime() - event.startTime.getTime();

  const occurrences = dates.reduce<any[]>((acc, occ) => {
    const iso = occ.toISOString();
    const ex = exMap.get(iso);
    if (ex?.isDeleted) return acc;

    if (ex?.override) {
      const start = ex.override.startTime
        ? new Date(ex.override.startTime)
        : occ;
      const end = ex.override.endTime
        ? new Date(ex.override.endTime)
        : new Date(start.getTime() + duration);
      acc.push({
        startTime: start,
        endTime: end,
        originalEventId: event._id,
        override: ex.override,
      });
    } else {
      acc.push({
        startTime: occ,
        endTime: new Date(occ.getTime() + duration),
        originalEventId: event._id,
      });
    }
    return acc;
  }, []);

  return occurrences;
}
