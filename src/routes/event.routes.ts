import { Router } from "express";
import * as EventController from "../controllers/event.controller";
import { mockAuth } from "../middlewares/auth.middleware";

const router = Router();

// All routes need auth
router.use(mockAuth);

// create
router.post("/events", EventController.create);

// get my occurrences
router.get("/myevents", EventController.getMine);

// update (query param updateType = thisEvent|thisAndFollowing|allEvents)
router.put("/events/:eventId", EventController.update);

// delete
router.delete("/events/:eventId", EventController.deleteEvent);

export default router;
