import { Schema, model, Document, Types } from "mongoose";

export interface IException {
  date: Date; // date/time of occurrence being overridden/deleted
  isDeleted?: boolean; // if true, occurrence is deleted
  override?: Record<string, any>; // fields to override for this instance (title, startTime, etc.)
}

export interface IEvent extends Document {
  title: string;
  description?: string;
  startTime: Date; // base start (dtstart)
  endTime: Date;
  timezone: string; // IANA string
  recurrenceRule?: string; // rrule string for series (optional)
  seriesId?: string; // unique id for series (same across master events)
  exceptions: IException[]; // list of exceptions (deleted or overrides)
  createdBy: string; // userId
  createdAt: Date;
  updatedAt: Date;
}

const ExceptionSchema = new Schema<IException>(
  {
    date: { type: Date, required: true },
    isDeleted: { type: Boolean, default: false },
    override: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const EventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true },
    description: { type: String },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    timezone: { type: String, required: true },
    recurrenceRule: { type: String },
    seriesId: { type: String }, // can be generated when creating recurring series
    exceptions: { type: [ExceptionSchema], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const EventModel = model<IEvent>("Event", EventSchema);
