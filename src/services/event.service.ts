import { EventModel, IEvent } from "../models/event.models";
import {
  buildRRuleString,
  generateOccurrencesForEvent,
} from "../utils/recurrence.util";
import { parseToUTC } from "../utils/timezone.util";
import { v4 as uuidv4 } from "uuid";
import mongoose from "mongoose";

/**
 * responsibility: business logic for events (single place — SRP)
 */

export class EventService {
  // create event (single master event). If recurrence provided, create seriesId.
  public static async createEvent(payload: {
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
    createdBy: string;
  }): Promise<IEvent> {
    const {
      title,
      description,
      startTime,
      endTime,
      timezone,
      recurrence,
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
        // byweekday could be converted; keep simple for now
      });
    }

    const doc = new EventModel({
      title,
      description,
      startTime: startUTC,
      endTime: endUTC,
      timezone,
      recurrenceRule,
      seriesId,
      createdBy,
    });

    await doc.save();
    return doc;
  }

  // get occurrences for a user (their created events or where they are participant if you implement participants)
  // For simplicity, returns occurrences for a date range
  public static async getOccurrencesForUser(opts: {
    userId: string;
    rangeStart: Date;
    rangeEnd: Date;
    page?: number;
    limit?: number;
  }) {
    const { userId, rangeStart, rangeEnd } = opts;

    // fetch series that could intersect range — very simple query: recurrenceRule exists OR startTime in range
    const masters = await EventModel.find({
      createdBy: userId,
    }).lean();

    // generate occurrences per event and merge
    const allOccurrences: any[] = [];
    for (const m of masters) {
      const ev = await EventModel.findById(m._id); // get full doc to have methods and exceptions
      if (!ev) continue;
      const occ = generateOccurrencesForEvent(ev as any, rangeStart, rangeEnd);
      // enrich with basic metadata
      occ.forEach((o) => {
        o.title = ev.title;
        o.description = ev.description;
        o.timezone = ev.timezone;
        o.seriesId = ev.seriesId;
        o.masterId = ev._id;
      });
      allOccurrences.push(...occ);
    }

    // sort by startTime
    allOccurrences.sort((a, b) => a.startTime - b.startTime);

    return allOccurrences;
  }

  // update event behavior:
  // - thisEvent: create or update exception for that date
  // - thisAndFollowing: split series into two (modify current master to end before date, create new master)
  // - allEvents: update master (if series), or single event
  public static async updateEvent(params: {
    actorId: string;
    eventId: string; // could be master or single event
    updateType: "thisEvent" | "thisAndFollowing" | "allEvents";
    occurrenceDate?: string; // ISO date for the targeted occurrence (required for thisEvent & thisAndFollowing)
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
    }>;
  }) {
    const { eventId, updateType, occurrenceDate, payload } = params;
    const event = await EventModel.findById(eventId);
    if (!event) throw { status: 404, message: "Event not found" };

    // ALL EVENTS: update main/master
    if (updateType === "allEvents") {
      // apply simple updates
      if (payload.title) event.title = payload.title;
      if (payload.description) event.description = payload.description;
      if (payload.startTime && payload.timezone) {
        event.startTime = parseToUTC(payload.startTime, payload.timezone);
      } else if (payload.startTime) {
        // assume same timezone
        event.startTime = new Date(payload.startTime);
      }
      if (payload.endTime && payload.timezone)
        event.endTime = parseToUTC(payload.endTime, payload.timezone);
      // recurrence replacement if provided
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
      await event.save();
      return event;
    }

    // THIS EVENT: create exception override or deletion for occurrenceDate
    if (updateType === "thisEvent") {
      if (!occurrenceDate)
        throw { status: 400, message: "occurrenceDate required for thisEvent" };
      const targetDateISO = new Date(occurrenceDate).toISOString();
      // If payload is empty and we want deletion, the client can set { delete: true } — but we'll interpret override
      // If payload has a marker "deleteOccurrence": true -> mark isDeleted
      if ((payload as any).deleteOccurrence) {
        event.exceptions.push({
          date: new Date(targetDateISO),
          isDeleted: true,
        });
      } else {
        // create override object with provided fields
        const override: any = {};
        if (payload.title) override.title = payload.title;
        if (payload.description) override.description = payload.description;
        if (payload.startTime) override.startTime = payload.startTime;
        if (payload.endTime) override.endTime = payload.endTime;
        if (payload.timezone) override.timezone = payload.timezone;
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
        // not a series — treat as allEvents
        return this.updateEvent({
          actorId: params.actorId,
          eventId,
          updateType: "allEvents",
          payload,
        });
      }

      const cutDate = new Date(occurrenceDate); // this occurrence and following should be modified
      // 1) Adjust current event's recurrence to end before cutDate
      // We'll parse current rule and set until = cutDate - 1ms
      const { RRule, rrulestr } = await import("rrule"); // dynamic import for types
      const rule = rrulestr(event.recurrenceRule, { forceset: false }) as any;
      const opts = rule.options;
      const untilDate = new Date(cutDate.getTime() - 1);
      const oldRule = new RRule({ ...opts, until: untilDate });

      event.recurrenceRule = oldRule.toString();
      await event.save();

      // 2) Create new series starting from cutDate with payload (if recurrence provided use that else copy old settings)
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
        // reuse old frequency but set dtstart newStart (this is simplistic — ideally extract freq/interval from old rule)
        // For now, copy event.recurrenceRule options but adjust dtstart.
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
        seriesId: newSeriesId,
        createdBy: event.createdBy,
      });

      await newDoc.save();
      return newDoc;
    }

    throw { status: 400, message: "Invalid updateType" };
  }

  // delete event:
  // thisEvent => add deleted exception
  // thisAndFollowing => adjust old recurrence until before date and delete exceptions from after date
  // allEvents => delete master and related exceptions
  public static async deleteEvent(params: {
    actorId: string;
    eventId: string;
    deleteType: "thisEvent" | "thisAndFollowing" | "allEvents";
    occurrenceDate?: string;
  }) {
    const { eventId, deleteType, occurrenceDate } = params;
    const event = await EventModel.findById(eventId);
    if (!event) throw { status: 404, message: "Event not found" };

    if (deleteType === "allEvents") {
      // delete master and any potential other masters with same seriesId
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
        // single event -> delete it
        await event.deleteOne();
        return { message: "Event deleted" };
      }
      // set current series until before occurrenceDate
      const cutDate = new Date(occurrenceDate);
      const { rrulestr, RRule } = await import("rrule");
      const rule = rrulestr(event.recurrenceRule, { forceset: false }) as any;
      const opts = rule.options;
      const untilDate = new Date(cutDate.getTime() - 1);
      const newRule = new RRule({ ...opts, until: untilDate });
      event.recurrenceRule = newRule.toString();
      // remove exceptions that fall on/after cutDate
      event.exceptions = (event.exceptions || []).filter(
        (e) => e.date < cutDate
      );
      await event.save();
      return {
        message: "This and following occurrences removed/series truncated",
      };
    }

    throw { status: 400, message: "Invalid deleteType" };
  }
}
