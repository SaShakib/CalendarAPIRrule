import { RRule, rrulestr, Frequency, Weekday } from "rrule";
import { DateTime } from "luxon";
import { IEvent } from "../models/event.models";
/**
 * Build rrule string from params
 * freq: 'DAILY'|'WEEKLY'|'MONTHLY'
 * dtstart should be a JS Date (UTC)
 */

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
  // If non-recurring and single occurrence, return that if in range (and not deleted)
  if (!event.recurrenceRule) {
    const st = event.startTime;
    if (st >= rangeStart && st <= rangeEnd) {
      // check exceptions for single-event (rare) — if deleted, skip
      const ex = event.exceptions?.find((e) => +e.date === +st);
      if (ex?.isDeleted) return [];
      if (ex?.override) {
        return [
          {
            startTime: new Date(ex.override.startTime || st),
            endTime: new Date(ex.override.endTime || event.endTime),
            originalEventId: event._id,
            override: ex.override,
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
  // rrulestr requires dtstart embedded in rule or passed as options; rrulestr can parse stored rule and produce RRule
  const rule = rrulestr(event.recurrenceRule, { forceset: false }) as RRule;
  // ensure we query in UTC range (dates are JS Dates in UTC)
  const dates = rule.between(rangeStart, rangeEnd, true);

  // map exceptions by ISO string (using event timezone local representation for exact matching)
  const exMap = new Map<string, any>();
  for (const ex of event.exceptions || []) {
    exMap.set(new Date(ex.date).toISOString(), ex);
  }

  const duration = event.endTime.getTime() - event.startTime.getTime();

  const occurrences = dates.reduce<any[]>((acc, occ) => {
    const iso = occ.toISOString();
    const ex = exMap.get(iso);
    if (ex?.isDeleted) return acc; // skip deleted occurrence

    if (ex?.override) {
      // apply override values; override.startTime/endTime may be provided as ISO
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
