import { Schema, model, Document } from "mongoose";

export interface IException {
  date: Date;
  isDeleted?: boolean;
  override?: Record<string, any>;
}

export interface IEvent extends Document {
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  timezone: string;
  recurrenceRule?: string;
  seriesId?: string;
  exceptions: IException[];
  createdBy: string;
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
    seriesId: { type: String },
    exceptions: { type: [ExceptionSchema], default: [] },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const EventModel = model<IEvent>("Event", EventSchema);
