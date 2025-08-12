import request from "supertest";
import mongoose from "mongoose";
import app from "../app";
import { env } from "../config/env.config";
import { EventModel } from "../models/event.models";

beforeAll(async () => {
  await mongoose.connect(env.MONGO_URI);
});

afterAll(async () => {
  // await mongoose.connection?.db?.dropDatabase();
  await mongoose.disconnect();
});

describe("Hybrid Recurrence API", () => {
  let masterId: string;
  let recurringId: string | undefined = "";
  let singleId: string;

  const headers = { "x-user-id": "user1", "x-user-admin": "false" };
  const otherHeaders = { "x-user-id": "user2", "x-user-admin": "false" };

  const adminHeaders = { "x-user-id": "admin", "x-user-admin": "true" };

  it("creates a weekly recurring event", async () => {
    const res = await request(app)
      .post("/api/events")
      .set(headers)
      .send({
        title: "Weekly Team Sync",
        description: "Weekly meeting",
        startTime: "2025-08-05T09:00:00",
        endTime: "2025-08-05T10:00:00",
        timezone: "Asia/Dhaka",
        recurrence: {
          freq: "WEEKLY",
          interval: 1,
          until: "2025-09-30T10:00:00",
        },
      });
    expect(res.status).toBe(201);
    expect(res.body.recurrenceRule).toBeDefined();
    masterId = res.body._id;
  });

  it("creates a single (non-recurring) event", async () => {
    const res = await request(app).post("/api/events").set(headers).send({
      title: "Doctor Appointment",
      startTime: "2025-08-15T14:00:00",
      endTime: "2025-08-15T15:00:00",
      timezone: "Asia/Dhaka",
    });
    expect(res.status).toBe(201);
    singleId = res.body._id;
  });

  it("fetches my events in a date range", async () => {
    const res = await request(app)
      .get("/api/myevents?start=2025-08-01T00:00:00Z&end=2025-08-31T23:59:59Z")
      .set(headers);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.occurrences)).toBe(true);
    expect(res.body.occurrences.length).toBeGreaterThan(0);
  });

  it("generates occurrences in a range", async () => {
    const res = await request(app)
      .get("/api/myevents?start=2025-08-01T00:00:00Z&end=2025-08-31T23:59:59Z")
      .set(headers);
    expect(res.status).toBe(200);
    expect(res.body.occurrences.length).toBeGreaterThan(1);
  });

  it("Update a single occurrence (thisEvent)", async () => {
    // target the occurrence on 2025-08-19 (a date that would be part of weekly series)
    const occDate = "2025-08-19T09:00:00.000Z";
    const res = await request(app)
      .put(`/api/events/${masterId}?updateType=thisEvent`)
      .set(headers)
      .send({
        occurrenceDate: occDate,
        title: "Weekly Team Sync - Rescheduled",
        startTime: "2025-08-19T11:00:00",
        endTime: "2025-08-19T12:00:00",
        timezone: "Asia/Dhaka",
      });
    expect(res.status).toBe(200);

    // ensure exception saved in DB
    const updated = await EventModel.findById(masterId);
    expect(updated?.exceptions.length).toBeGreaterThan(0);
    expect(
      updated?.exceptions.some(
        (e) => e.date.toISOString() === new Date(occDate).toISOString()
      )
    ).toBeTruthy();
  });

  it("Update event with thisAndFollowing", async () => {
    const cut = "2025-09-02T09:00:00.000Z";
    const res = await request(app)
      .put(`/api/events/${masterId}?updateType=thisAndFollowing`)
      .set(headers)
      .send({
        occurrenceDate: cut,
        title: "Weekly Team Sync - New",
        startTime: "2025-09-02T09:00:00",
        endTime: "2025-09-02T10:00:00",
        timezone: "Asia/Dhaka",
        recurrence: {
          freq: "WEEKLY",
          interval: 1,
          until: "2025-12-31T10:00:00",
        },
      });
    expect(res.status).toBe(200);
    // new doc created
    const all = await EventModel.find({});
    expect(all.length).toBeGreaterThan(1);
  });

  it("Update a single occurrence (thisEvent) for Non user and Non adming Should return forbidden", async () => {
    // target the occurrence on 2025-08-19 (a date that would be part of weekly series)
    const occDate = "2025-08-19T09:00:00.000Z";
    const res = await request(app)
      .put(`/api/events/${masterId}?updateType=thisEvent`)
      .set(otherHeaders)
      .send({
        occurrenceDate: occDate,
        title: "Weekly Team Sync - Rescheduled",
        startTime: "2025-08-19T11:00:00",
        endTime: "2025-08-19T12:00:00",
        timezone: "Asia/Dhaka",
      });
    expect(res.status).toBe(403);

    // ensure exception saved in DB
    const updated = await EventModel.findById(masterId);
    expect(updated?.exceptions.length).toBeGreaterThan(0);
    expect(
      updated?.exceptions.some(
        (e) => e.date.toISOString() === new Date(occDate).toISOString()
      )
    ).toBeTruthy();
  });

  it("Update event with thisAndFollowing using Non User and Non Admin should Return Forbidden", async () => {
    const cut = "2025-09-02T09:00:00.000Z";
    const res = await request(app)
      .put(`/api/events/${masterId}?updateType=thisAndFollowing`)
      .set(otherHeaders)
      .send({
        occurrenceDate: cut,
        title: "Weekly Team Sync - New",
        startTime: "2025-09-02T09:00:00",
        endTime: "2025-09-02T10:00:00",
        timezone: "Asia/Dhaka",
        recurrence: {
          freq: "WEEKLY",
          interval: 1,
          until: "2025-12-31T10:00:00",
        },
      });
    expect(res.status).toBe(403);
    // new doc created
    const all = await EventModel.find({});
    expect(all.length).toBeGreaterThan(1);
  });

  it("deletes a single occurrence (thisEvent)", async () => {
    // first find one occurrence date to delete from any master
    const masters = await EventModel.find({ createdBy: "user1" });
    const m = masters[0];
    const occDate = m.startTime.toISOString(); // delete first occurrence (just example)
    const res = await request(app)
      .delete(
        `/api/events/${m._id}?deleteType=thisEvent&occurrenceDate=${occDate}`
      )
      .set(headers);
    expect(res.status).toBe(200);
    const updated = await EventModel.findById(m._id);
    expect(
      updated?.exceptions.some(
        (e) =>
          e.date.toISOString() === new Date(occDate).toISOString() &&
          e.isDeleted
      )
    ).toBeTruthy();
  });

  it("admin can delete entire series", async () => {
    const masters = await EventModel.find({ createdBy: "user1" });
    const someMaster = masters[0];
    expect(someMaster).toBeTruthy();
    const res = await request(app)
      .delete(`/api/events/${someMaster._id}?deleteType=allEvents`)
      .set(adminHeaders);
    expect(res.status).toBe(200);
    // confirm deletion
    const still = await EventModel.findById(someMaster._id);
    expect(still).toBeNull();
  });

  it("prevents non-owner, non-admin from deleting", async () => {
    const newEvent = await EventModel.create({
      title: "Private Event",
      startTime: new Date("2025-08-10T10:00:00Z"),
      endTime: new Date("2025-08-10T11:00:00Z"),
      timezone: "Asia/Dhaka",
      createdBy: "user1",
    });
    const res = await request(app)
      .delete(`/api/events/${newEvent._id}?deleteType=allEvents`)
      .set(otherHeaders);
    expect(res.status).toBe(403);
  });

  it("returns 404 for invalid eventId", async () => {
    const res = await request(app)
      .delete(`/api/events/64ff9aa5e1c123456789abcd?deleteType=allEvents`)
      .set(adminHeaders);
    expect(res.status).toBe(404);
  });
});
