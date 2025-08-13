import { Router } from "express";
import * as EventController from "../controllers/event.controller";
import { mockAuth } from "../middlewares/auth.middleware";
import { validate } from "../middlewares/validate.middleware";
import {
  objectIdSchema,
  createEventSchema,
  deleteEventSchema,
} from "../validators/event.validator";
import { z } from "zod";


const router = Router();

router.use(mockAuth);

router.post("/events", validate(createEventSchema), EventController.create);

router.get("/myevents", EventController.getMine);

router.put(
  "/events/:eventId",
  validate(z.object({ eventId: objectIdSchema }), "params"),
  EventController.update
);

router.delete(
  "/events/:eventId",
  validate(z.object({ eventId: objectIdSchema }), "params"),
  validate(deleteEventSchema, "query"),
  EventController.deleteEvent
);

export default router;
