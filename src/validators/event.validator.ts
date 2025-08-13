import { z } from "zod";
import mongoose from "mongoose";

export const objectIdSchema = z
  .string()
  .refine((val) => mongoose.isValidObjectId(val), {
    message: "Invalid Id",
  });

export const dateStringSchema = z
  .string()
  .refine((val) => !isNaN(Date.parse(val)), {
    message: "Invalid date format",
  });

export const recurrenceSchema = z.object({
  freq: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
  interval: z.number().int().positive().optional(),
  until: dateStringSchema.optional(),
  byweekday: z.array(z.string()).optional(),
});

export const createEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  startTime: dateStringSchema,
  endTime: dateStringSchema,
  timezone: z.string().min(1),
  recurrence: recurrenceSchema.optional(),
});

export const updateEventSchema = z
  .object({
    updateType: z.enum(["thisEvent", "thisAndFollowing", "allEvents"]),
    occurrenceDate: dateStringSchema.optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    startTime: dateStringSchema.optional(),
    endTime: dateStringSchema.optional(),
    timezone: z.string().optional(),
    recurrence: recurrenceSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.updateType === "thisEvent") {
        return !!data.occurrenceDate;
      }
      return true;
    },
    {
      message: "occurrenceDate is required when updateType is 'thisEvent'",
      path: ["occurrenceDate"],
    }
  );

export const deleteEventSchema = z
  .object({
    deleteType: z.enum(["thisEvent", "thisAndFollowing", "allEvents"]),
    occurrenceDate: dateStringSchema.optional(),
  })
  .refine(
    (data) => {
      // If deleteType is 'thisEvent', occurrenceDate must exist
      if (data.deleteType === "thisEvent") {
        return !!data.occurrenceDate;
      }
      return true;
    },
    {
      message: "occurrenceDate is required when deleteType is 'thisEvent'",
      path: ["occurrenceDate"],
    }
  );
