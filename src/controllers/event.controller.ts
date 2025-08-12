import { Request, Response, NextFunction } from "express";
import * as EventService from "../services/event.service";
import { DateTime } from "luxon";

  export const create = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const created = await EventService.createEvent({
        ...req.body,
        createdBy: req.userId!,
      });
      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  }

  export const getMine = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { start, end } = req.query;
      const rangeStart = start
        ? new Date(String(start))
        : DateTime.now().minus({ days: 1 }).toJSDate();
      const rangeEnd = end
        ? new Date(String(end))
        : DateTime.now().plus({ days: 30 }).toJSDate();
      const occ = await EventService.getOccurrencesForUser({
        userId: req.userId!,
        rangeStart,
        rangeEnd,
      });
      res.json({ occurrences: occ });
    } catch (err) {
      next(err);
    }
  }

  export const update = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.eventId;
      const updateType = (req.query.updateType as any) || "thisEvent";
      const occurrenceDate =
        req.body.occurrenceDate || req.query.occurrenceDate;
      // permissions should be checked by caller middleware or controller wrapper; simplified here
      const updated = await EventService.updateEvent({
        actorId: req.userId!,
        eventId,
        updateType,
        occurrenceDate,
        payload: req.body,
      });
      res.json(updated);
    } catch (err) {
      next(err);
    }
  }

  export const deleteEvent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const eventId = req.params.eventId;
      const deleteType = (req.query.deleteType as any) || "thisEvent";
      const occurrenceDate =
        req.body.occurrenceDate || req.query.occurrenceDate;
      const result = await EventService.deleteEvent({
        actorId: req.userId!,
        eventId,
        deleteType,
        occurrenceDate,
      });
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

