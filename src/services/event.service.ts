import { EventModel, IEvent } from "../models/event.models";
import {
  buildRRuleString,
  generateOccurrencesForEvent,
} from "../utils/recurrence.util";
import { parseToUTC } from "../utils/timezone.util";
import { v4 as uuidv4 } from "uuid";

export const createEvent = async (payload: {
  title: string;
  description?: string;
  startTime: string; // ISO in timezone
  endTime: string;
  timezone: string;
  recurrence?: {
    freq: "DAILY" | "WEEKLY" | "MONTHLY";
    interval?: number;
    until?: string;
    byweekday?: string[];
  };
  participants?: { userId: string }[];
  createdBy: string;
}): Promise<IEvent> => {
  const {
    title,
    description,
    startTime,
    endTime,
    timezone,
    recurrence,
    participants = [],
    createdBy,
  } = payload;
  const startUTC = parseToUTC(startTime, timezone);
  const endUTC = parseToUTC(endTime, timezone);

  let recurrenceRule: string | undefined = undefined;
  let seriesId: string | undefined = undefined;

  if (recurrence) {
    seriesId = uuidv4();
    recurrenceRule = buildRRuleString({
      freq: recurrence.freq,
      dtstart: startUTC,
      interval: recurrence.interval || 1,
      until: recurrence.until
        ? parseToUTC(recurrence.until, timezone)
        : undefined,
    });
  }

  const doc = new EventModel({
    title,
    description,
    startTime: startUTC,
    endTime: endUTC,
    timezone,
    recurrenceRule,
    participants: (participants || []).map((userId) => ({ userId })),
    seriesId,
    createdBy,
  });

  await doc.save();
  return doc;
};

export const getOccurrencesForUser = async (opts: {
  userId: string;
  rangeStart: Date;
  rangeEnd: Date;
}) => {
  const { userId, rangeStart, rangeEnd } = opts;

  const masters = await EventModel.find({
    createdBy: userId,
  });

  const allOccurrences: any[] = [];
  for (const event of masters) {
    const occurrences = generateOccurrencesForEvent(
      event,
      rangeStart,
      rangeEnd
    );

    occurrences.forEach((occurrence) => {
      occurrence.title = event.title;
      occurrence.description = event.description;
      occurrence.timezone = event.timezone;
      occurrence.seriesId = event.seriesId;
      occurrence.participants = event.participants;
      occurrence.eventId = event._id;
    });

    allOccurrences.push(...occurrences);
  }

  // sort by startTime
  allOccurrences.sort((a, b) => a.startTime - b.startTime);

  return allOccurrences;
};

// update event behavior:
// - thisEvent: create or update exception for that date
// - thisAndFollowing: split series into two (modify current master to end before date, create new master)
// - allEvents: update master (if series), or single event
export const updateEvent = async (params: {
  actorId: string;
  eventId: string;
  updateType: "thisEvent" | "thisAndFollowing" | "allEvents";
  occurrenceDate?: string;
  payload: Partial<{
    title: string;
    description: string;
    startTime: string;
    endTime: string;
    timezone: string;
    recurrence?: {
      freq: "DAILY" | "WEEKLY" | "MONTHLY";
      interval?: number;
      until?: string;
    };
    participants?: string[];
  }>;
}): Promise<any> => {
  const { eventId, updateType, occurrenceDate, payload } = params;
  const event = await EventModel.findById(eventId);
  if (!event) throw { status: 404, message: "Event not found" };

  // ALL EVENTS: update main/master
  if (updateType === "allEvents") {
    if (payload.title) event.title = payload.title;
    if (payload.description) event.description = payload.description;
    if (payload.startTime && payload.timezone) {
      event.startTime = parseToUTC(payload.startTime, payload.timezone);
    } else if (payload.startTime) {
      event.startTime = new Date(payload.startTime);
    }
    if (payload.endTime && payload.timezone)
      event.endTime = parseToUTC(payload.endTime, payload.timezone);

    if (payload.recurrence && payload.timezone) {
      event.recurrenceRule = buildRRuleString({
        freq: payload.recurrence.freq,
        dtstart: parseToUTC(
          payload.startTime || event.startTime,
          payload.timezone
        ),
        interval: payload.recurrence.interval || 1,
        until: payload.recurrence.until
          ? parseToUTC(payload.recurrence.until, payload.timezone)
          : undefined,
      });
    }

    if (payload.participants) {
      event.participants = payload.participants.map((p) => ({ userId: p }));
    }
    await event.save();
    return event;
  }

  // THIS EVENT: create exception override or deletion for occurrenceDate
  if (updateType === "thisEvent") {
    if (!occurrenceDate)
      throw { status: 400, message: "occurrenceDate required for thisEvent" };
    const targetDateISO = new Date(occurrenceDate).toISOString();

    if ((payload as any).deleteOccurrence) {
      event.exceptions.push({
        date: new Date(targetDateISO),
        isDeleted: true,
      });
    } else {
      const override: any = {};
      if (payload.title) override.title = payload.title;
      if (payload.description) override.description = payload.description;
      if (payload.startTime) override.startTime = payload.startTime;
      if (payload.endTime) override.endTime = payload.endTime;
      if (payload.timezone) override.timezone = payload.timezone;
      if (payload.participants)
        override.participants = payload.participants.map((u: string) => ({
          userId: u,
        }));

      event.exceptions.push({ date: new Date(targetDateISO), override });
    }
    await event.save();
    return event;
  }

  // THIS AND FOLLOWING: split series. We will end original recurrence before occurrenceDate and create new series from occurrenceDate with new payload
  if (updateType === "thisAndFollowing") {
    if (!occurrenceDate)
      throw {
        status: 400,
        message: "occurrenceDate required for thisAndFollowing",
      };
    if (!event.recurrenceRule) {
      return updateEvent({
        actorId: params.actorId,
        eventId,
        updateType: "allEvents",
        payload,
      });
    }

    const cutDate = new Date(occurrenceDate);
    const { RRule, rrulestr } = await import("rrule");
    const rule = rrulestr(event.recurrenceRule, { forceset: false }) as any;
    const opts = rule.options;
    const untilDate = new Date(cutDate.getTime() - 1);
    const oldRule = new RRule({ ...opts, until: untilDate });

    event.recurrenceRule = oldRule.toString();
    await event.save();

    const newSeriesId = event.seriesId || uuidv4();
    const newStart = payload.startTime
      ? parseToUTC(payload.startTime, payload.timezone || event.timezone)
      : cutDate;
    const newEnd = payload.endTime
      ? parseToUTC(payload.endTime, payload.timezone || event.timezone)
      : new Date(
          newStart.getTime() +
            (event.endTime.getTime() - event.startTime.getTime())
        );

    let newRecurrenceRule = undefined;
    if (payload.recurrence) {
      newRecurrenceRule = buildRRuleString({
        freq: payload.recurrence.freq,
        dtstart: newStart,
        interval: payload.recurrence.interval || 1,
        until: payload.recurrence.until
          ? parseToUTC(
              payload.recurrence.until,
              payload.timezone || event.timezone
            )
          : undefined,
      });
    } else {
      const { rrulestr } = await import("rrule");
      const oldParsed = rrulestr((event as any).recurrenceRule, {
        forceset: false,
      }) as any;
      newRecurrenceRule = new (await import("rrule")).RRule({
        ...oldParsed.options,
        dtstart: newStart,
      }).toString();
    }

    const newDoc = new EventModel({
      title: payload.title || event.title,
      description: payload.description || event.description,
      startTime: newStart,
      endTime: newEnd,
      timezone: payload.timezone || event.timezone,
      recurrenceRule: newRecurrenceRule,
      participants: payload.participants
        ? payload.participants.map((u: string) => ({ userId: u }))
        : event.participants || [],
      seriesId: newSeriesId,
      createdBy: event.createdBy,
    });

    await newDoc.save();
    return newDoc;
  }

  throw { status: 400, message: "Invalid updateType" };
};

// delete event:
// thisEvent => add deleted exception
// thisAndFollowing => adjust old recurrence until before date and delete exceptions from after date
// allEvents => delete master and related exceptions
export const deleteEvent = async (params: {
  actorId: string;
  eventId: string;
  deleteType: "thisEvent" | "thisAndFollowing" | "allEvents";
  occurrenceDate?: string;
}) => {
  const { eventId, deleteType, occurrenceDate } = params;
  const event = await EventModel.findById(eventId);
  if (!event) throw { status: 404, message: "Event not found" };

  if (deleteType === "allEvents") {
    if (event.seriesId) {
      await EventModel.deleteMany({ seriesId: event.seriesId });
    } else {
      await event.deleteOne();
    }
    return { message: "All events in series deleted" };
  }

  if (deleteType === "thisEvent") {
    if (!occurrenceDate)
      throw { status: 400, message: "occurrenceDate required" };
    event.exceptions.push({
      date: new Date(occurrenceDate),
      isDeleted: true,
    });
    await event.save();
    return { message: "Occurrence marked deleted (exception created)" };
  }

  if (deleteType === "thisAndFollowing") {
    if (!occurrenceDate)
      throw { status: 400, message: "occurrenceDate required" };
    if (!event.recurrenceRule) {
      await event.deleteOne();
      return { message: "Event deleted" };
    }
    const cutDate = new Date(occurrenceDate);
    const { rrulestr, RRule } = await import("rrule");
    const rule = rrulestr(event.recurrenceRule, { forceset: false }) as any;
    const opts = rule.options;
    const untilDate = new Date(cutDate.getTime() - 1);
    const newRule = new RRule({ ...opts, until: untilDate });
    event.recurrenceRule = newRule.toString();
    event.exceptions = (event.exceptions || []).filter((e) => e.date < cutDate);
    await event.save();
    return {
      message: "This and following occurrences removed/series truncated",
    };
  }

  throw { status: 400, message: "Invalid deleteType" };
};
