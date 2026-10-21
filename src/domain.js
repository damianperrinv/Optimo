export const SEED_DATE = "2026-10-20";

const copy = (value) => structuredClone(value);
const uid = (prefix) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const requiredEquipment = {
  Kayaking: "kayaks",
  Snorkelling: "snorkels",
  Trail: "trail-kits",
};
export const getFacility = (state, id) =>
  state.facilities.find((item) => item.id === id);
export const getResource = (state, id) =>
  state.resources.find((item) => item.id === id);
export const overlaps = (a, b) =>
  a.date === b.date && a.start < b.end && b.start < a.end;

export function createSeed() {
  const facilities = [
    {
      id: "lake-a",
      name: "Lake Zone A",
      venue: "riverside",
      type: "Water",
      capacity: 16,
      activities: ["Kayaking"],
    },
    {
      id: "lake-b",
      name: "Lake Zone B",
      venue: "riverside",
      type: "Water",
      capacity: 16,
      activities: ["Kayaking"],
    },
    {
      id: "woodland",
      name: "Woodland Trail",
      venue: "riverside",
      type: "Outdoor",
      capacity: 24,
      activities: ["Trail"],
    },
    {
      id: "studio",
      name: "River Studio",
      venue: "riverside",
      type: "Indoor",
      capacity: 20,
      activities: ["Yoga"],
    },
    {
      id: "hall",
      name: "Activity Hall",
      venue: "riverside",
      type: "Indoor",
      capacity: 30,
      activities: ["Trail", "Yoga"],
    },
    {
      id: "pier",
      name: "North Pier Zone",
      venue: "north-pier",
      type: "Water",
      capacity: 20,
      activities: ["Snorkelling", "Swimming"],
    },
  ];
  const people = [
    ["mindy", "Mindy Lewis", ["Kayaking"], 8, "riverside"],
    ["hassan", "Hassan Mwanzia", ["Kayaking"], 12, "riverside"],
    ["kelly", "Kelly Wong", ["Trail"], 12, "riverside"],
    ["priya", "Priya Shah", ["Trail"], 12, "riverside"],
    ["nora", "Nora Patel", ["Trail"], 12, "riverside"],
    ["elena", "Elena Brooks", ["Yoga"], 16, "riverside"],
    ["daniel", "Daniel Ortiz", ["Snorkelling", "Swimming"], 16, "north-pier"],
  ];
  const resources = people.map(([id, name, skills, capacity, venue]) => ({
    id,
    name,
    skills,
    capacity,
    venue,
    type: "Staff",
    unavailable: [],
  }));
  resources.push(
    {
      id: "kayaks",
      name: "Single kayaks",
      skills: ["Kayaking"],
      capacity: 24,
      venue: "riverside",
      type: "Equipment",
      unavailable: [],
    },
    {
      id: "snorkels",
      name: "Snorkel sets",
      skills: ["Snorkelling"],
      capacity: 16,
      venue: "north-pier",
      type: "Equipment",
      unavailable: [],
    },
    {
      id: "trail-kits",
      name: "Adventure kits",
      skills: ["Trail"],
      capacity: 30,
      venue: "riverside",
      type: "Equipment",
      unavailable: [],
    },
  );
  const event = (
    id,
    title,
    type,
    activity,
    start,
    end,
    facilityId,
    attendees,
    assignments,
    contact,
  ) => ({
    id,
    title,
    type,
    activity,
    date: SEED_DATE,
    start,
    end,
    facilityId,
    attendees,
    assignments: assignments.map(([resourceId, quantity]) => ({
      resourceId,
      quantity,
    })),
    ...(contact ? { contact } : {}),
  });
  return {
    facilities,
    resources,
    closures: [],
    history: [],
    events: [
      event(
        "e1",
        "Kayak discovery",
        "Public",
        "Kayaking",
        "09:00",
        "10:30",
        "lake-a",
        12,
        [
          ["mindy", 8],
          ["kayaks", 12],
        ],
      ),
      event(
        "e2",
        "Team adventure",
        "Private",
        "Trail",
        "09:30",
        "11:00",
        "woodland",
        18,
        [
          ["kelly", 12],
          ["priya", 6],
          ["trail-kits", 18],
        ],
        "Alex Morgan · Acme Group",
      ),
      event(
        "e3",
        "Snorkelling intro",
        "Public",
        "Snorkelling",
        "10:30",
        "11:30",
        "pier",
        8,
        [
          ["daniel", 8],
          ["snorkels", 8],
        ],
      ),
      event(
        "e4",
        "Kayak discovery",
        "Public",
        "Kayaking",
        "11:00",
        "12:30",
        "lake-a",
        8,
        [["kayaks", 8]],
      ),
      event(
        "e5",
        "Lakeside yoga",
        "Public",
        "Yoga",
        "11:00",
        "12:00",
        "studio",
        10,
        [["elena", 10]],
      ),
      event(
        "e6",
        "Corporate away day",
        "Private",
        "Trail",
        "13:00",
        "15:00",
        "woodland",
        20,
        [
          ["kelly", 12],
          ["priya", 8],
          ["trail-kits", 20],
        ],
        "Sam Taylor · Meridian",
      ),
      event(
        "e7",
        "Guided paddle",
        "Public",
        "Kayaking",
        "14:00",
        "15:00",
        "lake-b",
        8,
        [
          ["mindy", 8],
          ["kayaks", 8],
        ],
      ),
      event(
        "e8",
        "Sunset paddle",
        "Public",
        "Kayaking",
        "16:00",
        "17:30",
        "lake-a",
        10,
        [
          ["hassan", 10],
          ["kayaks", 10],
        ],
      ),
      event(
        "e9",
        "Community swim",
        "Public",
        "Swimming",
        "14:00",
        "15:30",
        "pier",
        12,
        [["daniel", 12]],
      ),
      event(
        "e10",
        "Trail explorers",
        "Public",
        "Trail",
        "15:30",
        "17:00",
        "woodland",
        18,
        [
          ["priya", 12],
          ["trail-kits", 18],
        ],
      ),
    ],
  };
}

function assertPeriod(period) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(period.date || "") ||
    Number.isNaN(Date.parse(`${period.date}T00:00:00Z`)) ||
    new Date(`${period.date}T00:00:00Z`).toISOString().slice(0, 10) !==
      period.date
  )
    throw new Error("Choose a valid date.");
  if (
    ![period.start, period.end].every((time) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(time || ""),
    )
  )
    throw new Error("Enter valid start and end times.");
  if (period.start >= period.end)
    throw new Error("End time must be after the start time.");
}
function findEvent(state, id) {
  const event = state.events.find((item) => item.id === id);
  if (!event) throw new Error("This event could not be found.");
  return event;
}
function log(state, title, detail) {
  state.history.unshift({
    id: uid("history"),
    time: new Date().toISOString(),
    title,
    detail,
  });
  return state;
}

function resourceAvailability(state, event, resource) {
  if (!resource.skills.includes(event.activity))
    return {
      available: 0,
      reason: `Not qualified for ${event.activity.toLowerCase()}.`,
      eligible: false,
    };
  const facility = getFacility(state, event.facilityId);
  if (!facility || resource.venue !== facility.venue)
    return {
      available: 0,
      reason: "Based at a different venue.",
      eligible: false,
    };
  if ((resource.unavailable || []).some((period) => overlaps(period, event)))
    return {
      available: 0,
      reason: "Unavailable during this event.",
      eligible: false,
    };
  const assignments = state.events
    .filter((other) => other.id !== event.id && overlaps(other, event))
    .flatMap((other) =>
      other.assignments.filter((item) => item.resourceId === resource.id),
    );
  if (resource.type === "Staff" && assignments.length)
    return {
      available: 0,
      reason: "Already assigned to another event at this time.",
      eligible: false,
    };
  // Equipment demand changes at booking boundaries. Use peak concurrent demand, not a sum of disjoint bookings.
  const concurrent = state.events.filter(
    (other) => other.id !== event.id && overlaps(other, event),
  );
  const points = [
    event.start,
    ...concurrent
      .map((other) => other.start)
      .filter((time) => time > event.start && time < event.end),
  ];
  const used = Math.max(
    0,
    ...points.map((time) =>
      concurrent
        .filter((other) => other.start <= time && other.end > time)
        .reduce(
          (total, other) =>
            total +
            other.assignments
              .filter((item) => item.resourceId === resource.id)
              .reduce((sum, item) => sum + item.quantity, 0),
          0,
        ),
    ),
  );
  const available =
    resource.type === "Staff"
      ? resource.capacity
      : Math.max(0, resource.capacity - used);
  return {
    available,
    eligible: available > 0,
    reason: available
      ? `Available · up to ${available} ${resource.type === "Staff" ? "attendees" : "units"}`
      : "All units are in use during this event.",
  };
}

export function eligibleResources(state, event, type = "Staff") {
  return state.resources
    .filter((resource) => resource.type === type)
    .map((resource) => ({
      ...resource,
      ...resourceAvailability(state, event, resource),
    }))
    .sort(
      (a, b) =>
        Number(b.eligible) - Number(a.eligible) || a.name.localeCompare(b.name),
    );
}

function facilityAvailability(state, event, facility) {
  if (!facility.activities.includes(event.activity))
    return {
      available: false,
      reason: `Not suitable for ${event.activity.toLowerCase()}.`,
    };
  if (facility.capacity < event.attendees)
    return {
      available: false,
      reason: `Capacity ${facility.capacity}; ${event.attendees} attendees need space.`,
    };
  if (
    state.closures.some(
      (closure) =>
        closure.facilityId === facility.id && overlaps(closure, event),
    )
  )
    return { available: false, reason: "Closed during this event." };
  if (
    state.events.some(
      (other) =>
        other.id !== event.id &&
        other.facilityId === facility.id &&
        overlaps(other, event),
    )
  )
    return {
      available: false,
      reason: "Another event is booked at this time.",
    };
  return {
    available: true,
    reason: `Available · capacity ${facility.capacity}`,
  };
}

export function getFacilityOptions(state, event, excludeId) {
  return state.facilities
    .filter((facility) => facility.id !== excludeId)
    .map((facility) => ({
      ...facility,
      ...facilityAvailability(state, event, facility),
    }))
    .sort(
      (a, b) =>
        Number(b.available) - Number(a.available) ||
        a.name.localeCompare(b.name),
    );
}

export function getCoverage(state, event) {
  const issues = [];
  let staff = 0;
  let equipment = 0;
  const needed = requiredEquipment[event.activity];
  for (const assignment of event.assignments) {
    const resource = getResource(state, assignment.resourceId);
    if (!resource) {
      issues.push("An assigned resource could not be found.");
      continue;
    }
    const availability = resourceAvailability(state, event, resource);
    const count = availability.eligible
      ? Math.min(assignment.quantity, availability.available)
      : 0;
    if (assignment.quantity > availability.available)
      issues.push(`${resource.name}: ${availability.reason}`);
    if (resource.type === "Staff") staff += count;
    if (resource.id === needed) equipment += count;
  }
  const facility = getFacility(state, event.facilityId);
  const facilityCheck = facility
    ? facilityAvailability(state, event, facility)
    : { available: false, reason: "No facility selected." };
  if (!facilityCheck.available) issues.push(facilityCheck.reason);
  if (staff < event.attendees)
    issues.push(`${event.attendees - staff} attendees need staff cover`);
  if (needed && equipment < event.attendees)
    issues.push(`${event.attendees - equipment} equipment units needed`);
  const covered = Math.min(
    event.attendees,
    staff,
    needed ? equipment : event.attendees,
    facilityCheck.available ? event.attendees : 0,
  );
  return {
    covered,
    shortfall: event.attendees - covered,
    ready: issues.length === 0,
    issues,
    staffCovered: Math.min(event.attendees, staff),
    staffShortfall: Math.max(0, event.attendees - staff),
    equipmentCovered: needed
      ? Math.min(event.attendees, equipment)
      : event.attendees,
    equipmentShortfall: needed ? Math.max(0, event.attendees - equipment) : 0,
  };
}
export const getEventIssues = (state, event) =>
  getCoverage(state, event).issues;

export function assignResource(state, eventId, resourceId, quantity) {
  const event = findEvent(state, eventId);
  const resource = getResource(state, resourceId);
  if (!resource) throw new Error("Choose a resource.");
  if (!Number.isInteger(quantity) || quantity < 0)
    throw new Error("Enter a whole number of places.");
  const availability = resourceAvailability(state, event, resource);
  if (
    quantity > 0 &&
    (!availability.eligible || quantity > availability.available)
  )
    throw new Error(`${resource.name}: ${availability.reason}`);
  const otherQuantity = event.assignments
    .filter(
      (item) =>
        item.resourceId !== resource.id &&
        getResource(state, item.resourceId)?.type === resource.type,
    )
    .reduce((sum, item) => sum + item.quantity, 0);
  if (otherQuantity + quantity > event.attendees)
    throw new Error(
      `This event only needs ${Math.max(0, event.attendees - otherQuantity)} more ${resource.type === "Staff" ? "staff-covered places" : "equipment units"}.`,
    );
  const next = copy(state);
  const target = findEvent(next, eventId);
  target.assignments = target.assignments.filter(
    (item) => item.resourceId !== resourceId,
  );
  if (quantity) target.assignments.push({ resourceId, quantity });
  return log(
    next,
    quantity ? "Resource assigned" : "Assignment removed",
    `${resource.name} · ${event.title} · ${quantity} ${resource.type === "Staff" ? "places" : "units"}`,
  );
}

function assertEventFacility(state, event) {
  const facility = getFacility(state, event.facilityId);
  if (!facility) throw new Error("Choose a facility.");
  const result = facilityAvailability(state, event, facility);
  if (!result.available) throw new Error(`${facility.name}: ${result.reason}`);
}
function assertAssignments(state, event) {
  for (const assignment of event.assignments) {
    const resource = getResource(state, assignment.resourceId);
    if (!resource) throw new Error("An assigned resource could not be found.");
    const check = resourceAvailability(state, event, resource);
    if (!check.eligible || check.available < assignment.quantity)
      throw new Error(`${resource.name}: ${check.reason}`);
  }
}

export function rescheduleEvent(state, eventId, changes) {
  const original = findEvent(state, eventId);
  const event = {
    ...original,
    ...changes,
    id: original.id,
    assignments: original.assignments,
  };
  assertPeriod(event);
  assertEventFacility(state, event);
  assertAssignments(state, event);
  const next = copy(state);
  Object.assign(findEvent(next, eventId), {
    date: event.date,
    start: event.start,
    end: event.end,
    facilityId: event.facilityId,
  });
  return log(
    next,
    "Event rescheduled",
    `${event.title} · ${event.date} · ${event.start}–${event.end} · ${getFacility(state, event.facilityId).name}`,
  );
}

export function affectedByClosure(state, period) {
  return state.events.filter(
    (event) =>
      event.facilityId === period.facilityId && overlaps(period, event),
  );
}
export function closeFacility(state, period) {
  assertPeriod(period);
  const facility = getFacility(state, period.facilityId);
  if (!facility) throw new Error("Choose a facility.");
  if (!String(period.reason || "").trim())
    throw new Error("Choose a reason for the closure.");
  if (
    state.closures.some(
      (closure) =>
        closure.facilityId === facility.id && overlaps(closure, period),
    )
  )
    throw new Error("This facility already has a closure during that time.");
  const affected = affectedByClosure(state, period);
  const next = copy(state);
  for (const original of affected) {
    const targetId = period.moves?.[original.id];
    if (!targetId || targetId === facility.id)
      throw new Error(`Choose an alternative facility for ${original.title}.`);
    const event = findEvent(next, original.id);
    event.facilityId = targetId;
    assertEventFacility(next, event);
    assertAssignments(next, event);
  }
  next.closures.push({
    id: uid("closure"),
    facilityId: period.facilityId,
    date: period.date,
    start: period.start,
    end: period.end,
    reason: period.reason.trim(),
    ...(typeof period.notes === "string" && period.notes.trim()
      ? { notes: period.notes.trim() }
      : {}),
  });
  return log(
    next,
    "Facility closure applied",
    `${facility.name} · ${period.start}–${period.end} · ${affected.length} ${affected.length === 1 ? "event moved" : "events moved"}`,
  );
}

export function addEvent(state, fields) {
  const event = {
    ...fields,
    id: uid("event"),
    title: String(fields.title || "").trim(),
    assignments: [],
  };
  assertPeriod(event);
  if (!event.title) throw new Error("Enter an event name.");
  if (!["Public", "Private"].includes(event.type))
    throw new Error("Choose Public or Private.");
  if (!Number.isInteger(event.attendees) || event.attendees < 1)
    throw new Error("Enter at least one attendee as a whole number.");
  assertEventFacility(state, event);
  const next = copy(state);
  next.events.push(event);
  return log(
    next,
    "Event created",
    `${event.title} · ${event.date} · ${event.start}–${event.end}`,
  );
}

export function affectedByAbsence(state, period) {
  return state.events.filter(
    (event) =>
      overlaps(period, event) &&
      event.assignments.some(
        (assignment) => assignment.resourceId === period.resourceId,
      ),
  );
}
export function markUnavailable(state, period) {
  assertPeriod(period);
  const resource = getResource(state, period.resourceId);
  if (!resource) throw new Error("Choose a resource.");
  if (!String(period.reason || "").trim())
    throw new Error("Choose a reason for unavailability.");
  if (
    (resource.unavailable || []).some((existing) => overlaps(period, existing))
  )
    throw new Error("This resource is already unavailable during that time.");
  const affected = affectedByAbsence(state, period);
  const next = copy(state);
  for (const original of affected) {
    const replacementId = period.replacements?.[original.id];
    const replacement = getResource(next, replacementId);
    if (
      !replacement ||
      replacement.id === resource.id ||
      replacement.type !== resource.type
    )
      throw new Error(`Choose a replacement for ${original.title}.`);
    const event = findEvent(next, original.id);
    const assignment = event.assignments.find(
      (item) => item.resourceId === resource.id,
    );
    const quantity = assignment.quantity;
    event.assignments = event.assignments.filter(
      (item) => item.resourceId !== resource.id,
    );
    const existing = event.assignments.find(
      (item) => item.resourceId === replacementId,
    );
    const total = quantity + (existing?.quantity || 0);
    const availability = resourceAvailability(next, event, replacement);
    if (!availability.eligible || total > availability.available)
      throw new Error(
        `${replacement.name} cannot cover ${original.title}: ${availability.reason}`,
      );
    if (existing) existing.quantity = total;
    else event.assignments.push({ resourceId: replacementId, quantity });
  }
  getResource(next, resource.id).unavailable.push({
    date: period.date,
    start: period.start,
    end: period.end,
    reason: period.reason.trim(),
  });
  return log(
    next,
    "Unavailability applied",
    `${resource.name} · ${period.start}–${period.end} · ${affected.length} ${affected.length === 1 ? "assignment replaced" : "assignments replaced"}`,
  );
}
