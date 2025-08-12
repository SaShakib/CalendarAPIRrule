import express from "express";
import * as eventController from "../controllers/event.controller";
import { mockAuth } from "../middlewares/auth.middleware";

const router = express.Router();

router.post("/", mockAuth, eventController.createEvent);

export default router;
