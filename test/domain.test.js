import test from "node:test";
import assert from "node:assert/strict";
import {
  createSeed,
  SEED_DATE,
  getCoverage,
  eligibleResources,
  assignResource,
  getFacilityOptions,
  affectedByClosure,
  closeFacility,
  rescheduleEvent,
  addEvent,
  affectedByAbsence,
  markUnavailable,
} from "../src/domain.js";

const event = (state, id) => state.events.find((item) => item.id === id);
test("seed has exactly three real coverage issues, with useful shortfalls", () => {
  const state = createSeed();
  assert.deepEqual(
    state.events.filter((e) => !getCoverage(state, e).ready).map((e) => e.id),
    ["e1", "e4", "e10"],
  );
  assert.equal(getCoverage(state, event(state, "e1")).shortfall, 4);
  assert.equal(getCoverage(state, event(state, "e4")).shortfall, 8);
});
test("assigning qualified staff resolves a shortfall without mutating prior state", () => {
  const state = createSeed();
  const next = assignResource(state, "e1", "hassan", 4);
  assert.equal(getCoverage(next, event(next, "e1")).ready, true);
  assert.equal(getCoverage(state, event(state, "e1")).shortfall, 4);
  assert.equal(next.history.length, 1);
});
test("assignment rejects incompatible skills, double bookings, and over-allocation", () => {
  const state = createSeed();
  assert.throws(() => assignResource(state, "e1", "kelly", 4), /Not qualified/);
  assert.throws(() => assignResource(state, "e10", "priya", 18), /up to 12/);
  assert.throws(() => assignResource(state, "e1", "hassan", 5), /only needs 4/);
  const extra = {
    ...event(state, "e1"),
    id: "conflict",
    facilityId: "lake-b",
    assignments: [{ resourceId: "hassan", quantity: 8 }],
  };
  state.events.push(extra);
  assert.throws(
    () => assignResource(state, "e1", "hassan", 4),
    /Already assigned/,
  );
});
test("equipment availability uses peak concurrent demand, not all overlapping bookings summed", () => {
  const state = createSeed();
  state.events = [
    {
      ...event(state, "e1"),
      id: "a",
      start: "09:00",
      end: "10:00",
      assignments: [{ resourceId: "kayaks", quantity: 12 }],
    },
    {
      ...event(state, "e1"),
      id: "b",
      start: "10:00",
      end: "11:00",
      assignments: [{ resourceId: "kayaks", quantity: 12 }],
    },
  ];
  const probe = {
    ...state.events[0],
    id: "probe",
    start: "09:30",
    end: "10:30",
  };
  assert.equal(
    eligibleResources(state, probe, "Equipment").find((r) => r.id === "kayaks")
      .available,
    12,
  );
});
test("closure impact is time-bounded and requires every affected booking to move", () => {
  const state = createSeed();
  const period = {
    facilityId: "lake-a",
    date: SEED_DATE,
    start: "11:00",
    end: "13:00",
    reason: "Maintenance",
  };
  assert.deepEqual(
    affectedByClosure(state, period).map((e) => e.id),
    ["e4"],
  );
  assert.throws(() => closeFacility(state, period), /Choose an alternative/);
  assert.throws(
    () => closeFacility(state, { ...period, moves: { e4: "studio" } }),
    /Not suitable/,
  );
  const next = closeFacility(state, { ...period, moves: { e4: "lake-b" } });
  assert.equal(event(next, "e4").facilityId, "lake-b");
  assert.equal(next.closures.length, 1);
  assert.equal(state.closures.length, 0);
});
test("facility options reject occupied spaces and insufficient capacity", () => {
  const state = createSeed();
  const proposed = { ...event(state, "e4"), start: "09:30", end: "10:30" };
  assert.equal(
    getFacilityOptions(state, proposed).find((f) => f.id === "lake-a")
      .available,
    false,
  );
  const large = { ...event(state, "e4"), attendees: 17 };
  assert.equal(
    getFacilityOptions(state, large).find((f) => f.id === "lake-b").available,
    false,
  );
});
test("rescheduling validates closures and assigned staff at the proposed time", () => {
  const state = createSeed();
  state.closures.push({
    facilityId: "lake-a",
    date: SEED_DATE,
    start: "18:00",
    end: "19:00",
  });
  assert.throws(
    () => rescheduleEvent(state, "e8", { start: "18:00", end: "19:00" }),
    /Closed/,
  );
  const next = rescheduleEvent(state, "e8", {
    date: "2026-10-21",
    start: "09:00",
    end: "10:30",
  });
  assert.equal(event(next, "e8").date, "2026-10-21");
  assert.throws(
    () => rescheduleEvent(state, "e7", { start: "09:00", end: "10:00" }),
    /Already assigned/,
  );
});
test("absence requires compatible replacements and preserves assignment quantities", () => {
  const state = createSeed();
  const period = {
    resourceId: "mindy",
    date: SEED_DATE,
    start: "08:00",
    end: "17:00",
    reason: "Sick leave",
  };
  assert.deepEqual(
    affectedByAbsence(state, period).map((e) => e.id),
    ["e1", "e7"],
  );
  assert.throws(() => markUnavailable(state, period), /Choose a replacement/);
  assert.throws(
    () =>
      markUnavailable(state, {
        ...period,
        replacements: { e1: "kelly", e7: "hassan" },
      }),
    /Not qualified/,
  );
  const next = markUnavailable(state, {
    ...period,
    replacements: { e1: "hassan", e7: "hassan" },
  });
  assert.deepEqual(
    event(next, "e1").assignments.find((a) => a.resourceId === "hassan"),
    { resourceId: "hassan", quantity: 8 },
  );
  assert.equal(
    next.resources.find((r) => r.id === "mindy").unavailable.length,
    1,
  );
  assert.equal(
    eligibleResources(next, event(next, "e4")).find((r) => r.id === "mindy")
      .eligible,
    false,
  );
});
test("new events validate real dates, times, attendee count and free suitable space", () => {
  const state = createSeed();
  const fields = {
    title: "Morning paddle",
    type: "Public",
    activity: "Kayaking",
    date: "2026-10-21",
    start: "09:00",
    end: "10:00",
    facilityId: "lake-a",
    attendees: 8,
  };
  for (const bad of [
    { date: "2026-02-30" },
    { start: "25:00" },
    { end: "08:00" },
    { attendees: 0 },
    { attendees: 1.2 },
    { title: "  " },
  ])
    assert.throws(() => addEvent(state, { ...fields, ...bad }));
  const next = addEvent(state, fields);
  assert.equal(next.events.length, 11);
  assert.equal(getCoverage(next, next.events.at(-1)).ready, false);
  assert.throws(
    () => addEvent(state, { ...fields, date: SEED_DATE }),
    /Another event/,
  );
});
test("coverage distinguishes staff shortages from equipment shortages", () => {
  const state = createSeed();
  const target = event(state, "e1");
  target.assignments = [{ resourceId: "hassan", quantity: 12 }];
  const noEquipment = getCoverage(state, target);
  assert.equal(noEquipment.staffCovered, 12);
  assert.equal(noEquipment.staffShortfall, 0);
  assert.equal(noEquipment.equipmentCovered, 0);
  assert.equal(noEquipment.equipmentShortfall, 12);
  assert.equal(noEquipment.shortfall, 12);
  assert.equal(noEquipment.ready, false);
  target.assignments = [{ resourceId: "kayaks", quantity: 12 }];
  const noStaff = getCoverage(state, target);
  assert.equal(noStaff.staffCovered, 0);
  assert.equal(noStaff.staffShortfall, 12);
  assert.equal(noStaff.equipmentCovered, 12);
  assert.equal(noStaff.equipmentShortfall, 0);
  assert.equal(noStaff.shortfall, 12);
  const yoga = getCoverage(state, event(state, "e5"));
  assert.equal(yoga.equipmentShortfall, 0);
  assert.equal(yoga.ready, true);
});
test("closures preserve optional notes and record newest history first", () => {
  const state = assignResource(createSeed(), "e1", "hassan", 4);
  const next = closeFacility(state, {
    facilityId: "lake-a",
    date: SEED_DATE,
    start: "11:00",
    end: "13:00",
    reason: "Maintenance",
    notes: "  Replace the pontoon rail.  ",
    moves: { e4: "lake-b" },
  });
  assert.equal(next.closures[0].notes, "Replace the pontoon rail.");
  assert.equal(next.history[0].title, "Facility closure applied");
  assert.equal(next.history[1].title, "Resource assigned");
});
