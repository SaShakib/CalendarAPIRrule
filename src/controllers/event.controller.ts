import { Request, Response, NextFunction } from "express";
// import * as eventService from "../services/event.service";

export const createEvent = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // const event = await eventService.createEvent(req, {
    //   ...req.body,
    //   createdBy: req.userId!,
    // });
    res.status(201).json("event created");
  } catch (error) {
    next(error);
  }
}

// Implement updateEvent, deleteEvent, getMyEvents similarly using eventService
