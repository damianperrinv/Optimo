import { icon } from "./icons.js";
import {
  SEED_DATE,
  createSeed,
  getFacility,
  getResource,
  getCoverage,
  eligibleResources,
  getFacilityOptions,
  assignResource,
  rescheduleEvent,
  closeFacility,
  addEvent,
  markUnavailable,
  affectedByClosure,
  affectedByAbsence,
} from "./domain.js";

const $ = (s) => document.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const KEY = "optimo-hybrid-v1";
let state;
try {
  state = JSON.parse(localStorage.getItem(KEY));
  if (!state?.events || !state?.resources || !state?.closures)
    state = createSeed();
} catch {
  state = createSeed();
}
let ui = {
  page: "overview",
  date: SEED_DATE,
  venue: "all",
  search: "",
  onlyIssues: false,
  mode: "day",
  view: "board",
  resourceType: "Staff",
  facilityType: "all",
  mobileNav: false,
};
let drawer = null,
  undoState = null,
  toastTimer,
  previousFocus;
const venues = {
  riverside: "Riverside Adventure Centre",
  "north-pier": "North Pier Activity Centre",
};
const shortVenue = (id) => (id === "riverside" ? "Riverside" : "North Pier");
const initials = (name) =>
  name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
const dateObj = (d) => new Date(d + "T12:00:00");
const prettyDate = (d, opts = { day: "numeric", month: "long" }) =>
  dateObj(d).toLocaleDateString("en-GB", opts);
const shiftDate = (d, n) => {
  const dt = dateObj(d);
  dt.setDate(dt.getDate() + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};
const mins = (t) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};
const overlaps = (a, b, c, d) => mins(a) < mins(d) && mins(c) < mins(b);
const facility = (e) => getFacility(state, e.facilityId);
const coverage = (e) => getCoverage(state, e);
const eventsOn = (date = ui.date) =>
  state.events.filter((e) => e.date === date);
const issueEvents = () => eventsOn().filter((e) => !coverage(e).ready);
const pill = (text, tone = "neutral") =>
  `<span class="pill ${tone}"><span class="status-dot"></span>${esc(text)}</span>`;
const btn = (label, action, opts = {}) =>
  `<button type="${opts.type || "button"}" class="btn ${opts.class || ""}" ${action ? `data-action="${action}"` : ""} ${opts.id ? `data-id="${esc(opts.id)}"` : ""} ${opts.disabled ? "disabled" : ""} ${opts.label ? `aria-label="${esc(opts.label)}"` : ""}>${opts.icon ? icon(opts.icon, 16) : ""}${esc(label)}</button>`;
const eventTone = (e) => (e.type === "Private" ? "teal" : "purple");
const facilityIcon = (f) =>
  f.type === "Water" ? "water" : f.type === "Outdoor" ? "tree" : "facility";
function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    toast(
      "Changes are saved for this session only. Browser storage is unavailable.",
    );
    return false;
  }
}
function commit(next, message) {
  undoState = structuredClone(state);
  state = next;
  const saved = persist();
  closeDrawer();
  render();
  toast(message + (saved ? "" : " · session only"), true);
}
function toast(message, undo = false) {
  clearTimeout(toastTimer);
  $("#toast-root").innerHTML =
    `<div class="toast">${icon("check", 18)}<span>${esc(message)}</span>${undo ? '<button data-action="undo">Undo</button>' : ""}<button class="toast-close" data-action="dismiss-toast" aria-label="Dismiss notification">${icon("close", 16)}</button></div>`;
  toastTimer = setTimeout(() => ($("#toast-root").innerHTML = ""), 9000);
}
function filteredEvents() {
  return eventsOn()
    .filter(
      (e) =>
        (ui.venue === "all" || facility(e)?.venue === ui.venue) &&
        (!ui.onlyIssues || !coverage(e).ready) &&
        `${e.title} ${facility(e)?.name} ${e.type}`
          .toLowerCase()
          .includes(ui.search.toLowerCase()),
    )
    .sort((a, b) => a.start.localeCompare(b.start));
}

function render() {
  const issues = issueEvents().length;
  $("#app").innerHTML =
    `${ui.mobileNav ? '<button class="mobile-nav-scrim" data-action="mobile-menu" aria-label="Close menu"></button>' : ""}<aside class="sidebar ${ui.mobileNav ? "mobile-open" : ""}" aria-label="Main navigation">
 <a class="brand" href="#overview" data-action="nav" data-id="overview" aria-label="Optimo overview"><span class="brand-symbol"><i></i><i></i><i></i><i></i></span>optimo<span class="brand-period">.</span></a>
 <div class="workspace"><span class="workspace-avatar">R</span><div><strong>Your workspace</strong><small>Adventure & leisure</small></div><span class="workspace-dot"></span></div>
 <div class="nav-label">WORKSPACE</div><nav>${[
   ["overview", "grid", "Overview"],
   ["events", "calendar", "Events"],
   ["resources", "people", "Resources"],
   ["facilities", "facility", "Facilities"],
 ]
   .map(
     ([id, ic, name]) =>
       `<button data-action="nav" data-id="${id}" class="nav-item ${ui.page === id ? "active" : ""}" ${ui.page === id ? 'aria-current="page"' : ""}>${icon(ic, 20)}<span>${name}</span>${id === "events" && issues ? `<span class="nav-count">${issues}</span>` : ""}${ui.page === id ? '<i class="nav-active-dot"></i>' : ""}</button>`,
   )
   .join("")}</nav>
 <div class="sidebar-bottom"><div class="together-card"><span class="together-art">${icon("leaf", 28)}</span><strong>Good days start<br>with a clear plan.</strong><span>A little less juggling.<br>A lot more together.</span></div><button class="help-link" data-action="guide">${icon("help", 18)}<span>A little guidance</span>${icon("arrow", 16)}</button><div class="prototype-label"><span></span> INTERACTIVE CONCEPT <span class="version">01</span></div></div></aside>
 <div class="main-shell"><header class="topbar"><button class="icon-btn mobile-toggle" data-action="mobile-menu" aria-label="Toggle menu">${icon("menu")}</button><div class="breadcrumb">Workspace ${icon("chevron", 13)} <span>${ui.page[0].toUpperCase() + ui.page.slice(1)}</span></div><div class="topbar-right"><span class="demo-pill">Sample workspace</span><button class="icon-btn" data-action="history" aria-label="View recent activity">${icon("history", 19)}</button><div class="topbar-divider"></div><span class="user-avatar">AL</span><span class="user-name">Alex Lewis ${icon("down", 13)}</span></div></header>
 <main id="main-content">${ui.page === "overview" ? overview() : ui.page === "events" ? eventsView() : ui.page === "resources" ? resourcesView() : facilitiesView()}</main>
 <footer class="page-footer"><span>Everything in its place.</span><span>Optimo operations <span class="footer-dot">·</span> Hybrid concept</span></footer></div>`;
}

function heading(eyebrow, title, sub, action) {
  return `<div class="page-heading"><div><div class="eyebrow">${eyebrow}</div><h1>${title}</h1><p>${sub}</p></div>${action || ""}</div>`;
}
function dateControl() {
  return `<div class="date-control"><button class="icon-btn" data-action="previous-date" aria-label="Previous ${ui.mode === "week" ? "week" : "day"}">${icon("chevron", 15)}</button><label class="date-label">${icon("calendar", 16)}<span>${prettyDate(ui.date, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</span><input type="date" value="${ui.date}" data-control="date" aria-label="Selected date"></label><button class="icon-btn" data-action="next-date" aria-label="Next ${ui.mode === "week" ? "week" : "day"}">${icon("chevron", 15)}</button></div>`;
}
function venueSelect() {
  return `<div class="select-wrap">${icon("pin", 16)}<select aria-label="Venue" data-control="venue"><option value="all">All venues</option>${Object.entries(
    venues,
  )
    .map(
      ([id, name]) =>
        `<option value="${id}" ${ui.venue === id ? "selected" : ""}>${name}</option>`,
    )
    .join("")}</select>${icon("down", 13)}</div>`;
}
function searchBox(placeholder = "Search…") {
  return `<label class="search-box">${icon("search", 17)}<input type="search" placeholder="${placeholder}" value="${esc(ui.search)}" data-control="search" aria-label="${placeholder.replace("…", "")}"></label>`;
}
function periodSwitch() {
  return `<div class="segmented">${["day", "week"].map((mode) => `<button data-action="mode" data-id="${mode}" class="${ui.mode === mode ? "selected" : ""}" aria-pressed="${ui.mode === mode}">${mode === "day" ? "Day" : "Week"}</button>`).join("")}</div>`;
}
function toolbar(extra = "") {
  return `<div class="toolbar">${dateControl()}${venueSelect()}<span class="toolbar-spacer"></span>${extra}</div>`;
}

function overview() {
  const events = eventsOn(),
    issues = issueEvents(),
    ready = events.length - issues.length;
  const attendees = events.reduce((s, e) => s + e.attendees, 0),
    spaces = state.facilities.length;
  const next = events
    .slice()
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 4);
  return `${heading("YOUR OPERATIONS, TOGETHER", "A clearer view of your day.", "Less juggling. More great experiences.", `${dateControl()}`)}
 <div class="overview-hero"><div class="hero-copy"><span class="hero-kicker">${icon("sun", 16)} ${prettyDate(ui.date, { weekday: "long", day: "numeric", month: "long" })}</span><h2>Good plans.<br>Great days.</h2><p>${events.length ? `${ready} events are ready to go.${issues.length ? ` A few things need your attention.` : " Everything is in place."}` : "A fresh day, full of possibilities. Plan your first event."}</p><div class="hero-actions">${btn(issues.length ? "Let’s sort them out" : "View your events", "attention", { class: "hero-btn", icon: "arrow" })}<span>${issues.length ? `${issues.length} things to take care of` : "Your day, all together"}</span></div></div><div class="hero-illustration" aria-hidden="true"><div class="illustration-grid"></div><div class="art-circle art-circle-one"></div><div class="art-circle art-circle-two"></div><div class="mini-calendar"><div class="mini-calendar-head"><span></span><span></span></div><small>${prettyDate(ui.date, { month: "short" }).toUpperCase()}</small><strong>${dateObj(ui.date).getDate()}</strong><div class="calendar-check">${icon("check", 22)}</div></div><div class="art-label label-one">${icon("people", 15)} People in place <span>✓</span></div><div class="art-label label-two">${icon("facility", 15)} Space to make it happen</div><div class="sparkle">✳</div></div></div>
 <div class="metrics">${metric("Scheduled events", events.length, "Public sessions & private bookings", "calendar", "purple")}${metric("Expected guests", attendees, "Experiences to look forward to", "people", "blue")}${metric("Spaces to work with", spaces, "Across 2 venues", "facility", "green")}${metric("Need a little attention", issues.length, issues.length ? "Let’s get everything ready" : "Everything is looking good", "alert", "amber", true)}</div>
 <div class="overview-grid"><section class="card attention-card"><div class="card-heading"><div><span class="section-kicker">LET’S GET THE DAY READY</span><h2>A little attention</h2></div><span class="count-bubble amber">${issues.length}</span></div>${
   issues.length
     ? `<div class="attention-list">${issues
         .slice(0, 3)
         .map(
           (e) =>
             `<button class="attention-row" data-action="assign" data-id="${e.id}"><span class="attention-icon">${icon("people", 18)}</span><span class="attention-copy"><strong>${esc(e.title)}</strong><span>${e.start} <span class="middot">·</span> ${esc(coverage(e).issues[0] || `${coverage(e).shortfall} guests need staff cover`)}</span></span>${icon("arrow", 17)}</button>`,
         )
         .join(
           "",
         )}</div><div class="card-foot">${icon("help", 15)} We’ll guide you through it, one step at a time.</div>`
     : `<div class="all-clear">${icon("check", 30)}<h3>All set for a great day.</h3><p>Every event has the cover it needs.</p></div>`
 }</section>
 <section class="card spaces-card"><div class="card-heading"><div><span class="section-kicker">A PLACE FOR EVERYTHING</span><h2>Your spaces, at a glance</h2></div><button class="text-btn" data-action="nav" data-id="facilities">View spaces ${icon("arrow", 15)}</button></div><div class="space-snapshots">${state.facilities
   .filter((f) => f.venue === "riverside")
   .slice(0, 4)
   .map((f) => {
     const es = events.filter((e) => e.facilityId === f.id);
     return `<button class="space-snapshot" data-action="facility-detail" data-id="${f.id}"><span class="space-symbol ${f.type.toLowerCase()}">${icon(facilityIcon(f), 20)}</span><div><strong>${esc(f.name)}</strong><small>${es.length} event${es.length === 1 ? "" : "s"} scheduled</small></div><div class="mini-occupancy">${Array.from({ length: 10 }, (_, i) => `<i class="${es.some((e) => overlaps(e.start, e.end, `${String(i + 8).padStart(2, "0")}:00`, `${String(i + 9).padStart(2, "0")}:00`)) ? "occupied" : ""}"></i>`).join("")}</div>${icon("chevron", 15)}</button>`;
   })
   .join("")}</div></section></div>
 <section class="card upcoming-card"><div class="card-heading"><div><span class="section-kicker">ON THE SCHEDULE</span><h2>The day ahead</h2></div><button class="text-btn" data-action="nav" data-id="events">All events ${icon("arrow", 15)}</button></div>${next.length ? eventTable(next, true) : emptyState("A clear day ahead", "Create an event to start planning.", "New event", "new-event")}</section>`;
}
function metric(label, value, sub, ic, tone, attention = false) {
  return `<button class="metric ${attention ? "metric-attention" : ""}" data-action="${attention ? "attention" : ic === "facility" ? "nav" : ic === "people" ? "nav" : "nav"}" data-id="${ic === "facility" ? "facilities" : "events"}"><div class="metric-top"><span>${label}</span><span class="metric-icon ${tone}">${icon(ic, 17)}</span></div><strong>${value}<span>${attention && value ? "to resolve" : ""}</span></strong><small>${sub}</small></button>`;
}
function emptyState(title, sub, label, action) {
  return `<div class="empty-state">${icon("calendar", 32)}<h3>${title}</h3><p>${sub}</p>${label ? btn(label, action, { class: "primary", icon: "plus" }) : ""}</div>`;
}

function eventsView() {
  const es = filteredEvents(),
    issues = issueEvents().length;
  return `${heading("EVERY EXPERIENCE, TAKEN CARE OF", "Events", "Plan the day. See what’s covered. Keep everything moving.", btn("New event", "new-event", { class: "primary", icon: "plus" }))}
 <div class="view-tabs"><button class="active" data-action="events-all">All events <span>${eventsOn().length}</span></button><button data-action="attention" class="${ui.onlyIssues ? "attention-tab" : ""}">${icon("alert", 15)} Needs attention <span>${issues}</span></button><span></span><div class="small-note">${icon("check", 14)} Changes stay in this sample workspace</div></div>
 ${toolbar(`${searchBox("Search events…")}${periodSwitch()}`)}
 <div class="section-summary"><span><strong>${ui.onlyIssues ? "Needs attention" : ui.mode === "week" ? "Your week" : "Your day"}</strong><span class="middot">·</span>${ui.mode === "week" ? "7 days from " + prettyDate(ui.date) : `${es.length} event${es.length === 1 ? "" : "s"}`}</span>${ui.onlyIssues ? '<button class="text-btn" data-action="events-all">Show all events</button>' : `<span class="legend"><i class="legend-dot purple"></i>Public session <i class="legend-dot teal"></i>Private booking</span>`}</div>
 ${ui.mode === "week" ? eventWeek() : `<section class="card table-card">${es.length ? eventTable(es) : emptyState("Nothing on this schedule", ui.search || ui.onlyIssues ? "Try another filter or date." : "Make room for a new experience.", "New event", "new-event")}</section>`}`;
}
function eventTable(es, compact = false) {
  return `<div class="table-scroll"><table class="event-table"><thead><tr><th>TIME</th><th>EVENT</th><th>SPACE & VENUE</th><th>GUESTS</th><th>READINESS</th><th><span class="sr-only">Actions</span></th></tr></thead><tbody>${es
    .map((e) => {
      let c = coverage(e),
        f = facility(e);
      return `<tr><td><span class="time-start">${e.start}</span><small>${e.end}</small></td><td><button class="event-title" data-action="event" data-id="${e.id}"><span class="event-color ${eventTone(e)}"></span>${esc(e.title)}</button><small class="event-type">${e.type === "Private" ? "Private booking" : "Public session"}</small></td><td><strong class="cell-facility">${esc(f?.name)}</strong><small>${shortVenue(f?.venue)}</small></td><td><span class="guest-count">${icon("people", 14)} ${e.attendees}</span>${!compact ? `<small>${c.covered}/${e.attendees} covered</small>` : ""}</td><td>${pill(c.ready ? "Ready to go" : "Needs attention", c.ready ? "green" : "amber")}${!compact && !c.ready ? `<small>${esc(c.issues[0] || `${c.shortfall} guests need cover`)}</small>` : ""}</td><td>${btn(c.ready ? "View" : "Assign", c.ready ? "event" : "assign", { id: e.id, class: c.ready ? "subtle" : "outline-amber", icon: c.ready ? "chevron" : "plus" })}</td></tr>`;
    })
    .join("")}</tbody></table></div>`;
}
function eventWeek() {
  return `<div class="week-events">${Array.from({ length: 7 }, (_, i) => {
    const d = shiftDate(ui.date, i),
      es = state.events.filter(
        (e) =>
          e.date === d &&
          (ui.venue === "all" || facility(e)?.venue === ui.venue) &&
          (!ui.onlyIssues || !coverage(e).ready) &&
          e.title.toLowerCase().includes(ui.search.toLowerCase()),
      );
    return `<section class="week-day"><button class="week-day-heading" data-action="jump-day" data-id="${d}"><span>${prettyDate(d, { weekday: "short" })}</span><strong>${dateObj(d).getDate()}</strong><small>${es.length} events</small></button>${es.map((e) => `<button class="week-event ${eventTone(e)}" data-action="event" data-id="${e.id}"><span>${e.start}–${e.end}</span><strong>${esc(e.title)}</strong><small>${esc(facility(e)?.name)}</small>${!coverage(e).ready ? '<span class="week-issue">Needs attention</span>' : ""}</button>`).join("")}${!es.length ? '<p class="week-empty">Space for something good.</p>' : ""}</section>`;
  }).join("")}</div>`;
}

function facilitiesView() {
  const fs = state.facilities.filter(
    (f) =>
      (ui.venue === "all" || f.venue === ui.venue) &&
      (ui.facilityType === "all" || f.type === ui.facilityType) &&
      f.name.toLowerCase().includes(ui.search.toLowerCase()),
  );
  const closed = state.closures.filter((c) => c.date === ui.date).length;
  return `${heading("GOOD SPACES. GREAT POSSIBILITIES.", "Facilities", "See what’s happening in every space. Handle changes with confidence.", btn("Close a space", "closure", { class: "primary", icon: "lock" }))}
 <div class="facility-stats"><span>${icon("facility", 17)} <strong>${fs.length}</strong> spaces</span><span>${icon("calendar", 17)} <strong>${eventsOn().filter((e) => fs.some((f) => f.id === e.facilityId)).length}</strong> scheduled events</span><span>${icon(closed ? "lock" : "check", 17)} <strong>${closed}</strong> ${closed === 1 ? "closure" : "closures"} today</span><div class="facility-tip">${icon("help", 15)} Click an event or space to see the details.</div></div>
 ${toolbar(`${searchBox("Find a space…")}${periodSwitch()}`)}
 <div class="board-top"><div class="filter-chips">${["all", "Water", "Outdoor", "Indoor"].map((t) => `<button class="filter-chip ${ui.facilityType === t ? "selected" : ""}" data-action="facility-type" data-id="${t}">${t === "all" ? "All spaces" : t}</button>`).join("")}</div><div class="board-right"><span class="legend"><i class="legend-dot purple"></i>Public <i class="legend-dot teal"></i>Private <i class="legend-dot orange"></i>Closed</span><div class="segmented icon-segment">${[
   ["board", "board", "Schedule board"],
   ["cards", "grid", "Space cards"],
 ]
   .map(
     ([id, ic, label]) =>
       `<button data-action="facility-view" data-id="${id}" class="${ui.view === id ? "selected" : ""}" aria-label="${label}" aria-pressed="${ui.view === id}">${icon(ic, 16)}</button>`,
   )
   .join("")}</div></div></div>
 ${!fs.length ? `<section class="card">${emptyState("No spaces found", "Try another venue or search.", "", "")}</section>` : ui.view === "cards" ? facilityCards(fs) : ui.mode === "week" ? facilityWeek(fs) : facilityBoard(fs)}
 <div class="board-note">${icon("leaf", 16)} <span>Planning a closure? We’ll show you who’s affected and help find another space before anything changes.</span><button class="text-btn" data-action="closure">Plan a closure ${icon("arrow", 15)}</button></div>`;
}
function facilityBoard(fs) {
  return `<section class="card schedule-card"><div class="schedule-scroll"><div class="schedule-inner"><div class="schedule-head"><div class="schedule-label">SPACE <span>CAPACITY</span></div><div class="time-scale">${timeTicks()}</div></div>${Object.keys(
    venues,
  )
    .filter((v) => fs.some((f) => f.venue === v))
    .map(
      (v) =>
        `<div class="venue-group">${icon("pin", 14)} ${venues[v]} <span>${fs.filter((f) => f.venue === v).length} spaces</span></div>${fs
          .filter((f) => f.venue === v)
          .map(
            (f) =>
              `<div class="schedule-row"><button class="schedule-label" data-action="facility-detail" data-id="${f.id}"><span class="space-symbol ${f.type.toLowerCase()}">${icon(facilityIcon(f), 18)}</span><div><strong>${esc(f.name)}</strong><small>${f.type} space</small></div><span class="capacity-tag">${icon("people", 12)}${f.capacity}</span></button><div class="timeline-track" style="${trackStyle()}">${eventsOn()
                .filter((e) => e.facilityId === f.id)
                .map((e) => timelineBlock(e))
                .join("")}${state.closures
                .filter((c) => c.facilityId === f.id && c.date === ui.date)
                .map(
                  (c) =>
                    `<button class="timeline-block closure-block" style="${blockStyle(c)}" data-action="closure-detail" data-id="${c.id}" title="Closed: ${esc(c.reason)}"><strong>${icon("lock", 12)} Closed</strong><small>${esc(c.reason)}</small></button>`,
                )
                .join("")}</div></div>`,
          )
          .join("")}`,
    )
    .join(
      "",
    )}</div></div><div class="schedule-bottom"><span>${icon("clock", 14)} Schedule shown in venue local time</span><span>Unfilled space is available</span></div></section>`;
}
function timelineRange() {
  const periods = [
    ...eventsOn(),
    ...state.closures.filter((c) => c.date === ui.date),
    ...state.resources.flatMap((r) =>
      (r.unavailable || []).filter((p) => p.date === ui.date),
    ),
  ];
  return {
    start: Math.min(
      480,
      ...periods.map((e) => Math.floor(mins(e.start) / 60) * 60),
    ),
    end: Math.max(
      1080,
      ...periods.map((e) => Math.ceil(mins(e.end) / 60) * 60),
    ),
  };
}
function timeTicks() {
  const { start, end } = timelineRange();
  return Array.from(
    { length: (end - start) / 60 + 1 },
    (_, i) =>
      `<span style="left:${((i * 60) / (end - start)) * 100}%">${String(start / 60 + i).padStart(2, "0")}:00</span>`,
  ).join("");
}
function trackStyle() {
  const { start, end } = timelineRange();
  return `--grid-step:${(60 / (end - start)) * 100}%`;
}
function blockStyle(e) {
  const range = timelineRange(),
    length = range.end - range.start;
  return `left:${((mins(e.start) - range.start) / length) * 100}%;width:${((mins(e.end) - mins(e.start)) / length) * 100}%;`;
}

function timelineBlock(e, resource = false, lane = 0, resourceId = null) {
  const c = coverage(e);
  return `<button class="timeline-block ${eventTone(e)} ${!c.ready ? "has-issue" : ""}" style="${blockStyle(e)}${resource ? `top:${14 + lane * 69}px;bottom:auto;height:57px;` : ``}" data-action="event" data-id="${e.id}" title="${esc(e.title)} · ${e.start}–${e.end}"><strong>${!c.ready ? '<i class="block-issue"></i>' : ""}${esc(e.title)}</strong><small>${e.start}–${e.end}${resource ? ` · ${e.assignments.find((a) => a.resourceId === resourceId)?.quantity || e.attendees} ${getResource(state, resourceId)?.type === "Equipment" ? "units" : "guests"}` : ` · ${e.attendees} guests`}</small></button>`;
}
function facilityWeek(fs) {
  return `<section class="card week-facilities"><div class="week-facility-head"><span>SPACE</span>${Array.from(
    { length: 7 },
    (_, i) => {
      const d = shiftDate(ui.date, i);
      return `<button data-action="jump-day" data-id="${d}">${prettyDate(d, { weekday: "short" })}<strong>${prettyDate(d, { day: "numeric", month: "short" })}</strong></button>`;
    },
  ).join("")}</div>${fs
    .map(
      (f) =>
        `<div class="week-facility-row"><button data-action="facility-detail" data-id="${f.id}"><strong>${esc(f.name)}</strong><small>${shortVenue(f.venue)}</small></button>${Array.from(
          { length: 7 },
          (_, i) => {
            let d = shiftDate(ui.date, i),
              es = state.events.filter(
                (e) => e.facilityId === f.id && e.date === d,
              ),
              cs = state.closures.filter(
                (c) => c.facilityId === f.id && c.date === d,
              );
            return `<div>${es.map((e) => `<button class="week-event ${eventTone(e)}" data-action="event" data-id="${e.id}"><span>${e.start}</span><strong>${esc(e.title)}</strong></button>`).join("")}${cs.length ? '<span class="pill amber">Closure</span>' : ""}${!es.length && !cs.length ? '<span class="available-note">Available</span>' : ""}</div>`;
          },
        ).join("")}</div>`,
    )
    .join("")}</section>`;
}
function facilityCards(fs) {
  return `<div class="facility-card-grid">${fs
    .map((f) => {
      const es = eventsOn().filter((e) => e.facilityId === f.id),
        cs = state.closures.filter(
          (c) => c.facilityId === f.id && c.date === ui.date,
        );
      return `<section class="card facility-card"><div class="facility-card-art ${f.type.toLowerCase()}">${icon(facilityIcon(f), 46)}<span>${f.type} space</span></div><div class="facility-card-body"><div class="facility-card-heading"><h2>${esc(f.name)}</h2>${pill(cs.length ? "Closure planned" : "Open", cs.length ? "amber" : "green")}</div><p>${shortVenue(f.venue)} <span class="middot">·</span> Up to ${f.capacity} guests</p><div class="facility-card-count">${icon("calendar", 16)} ${es.length} events today <span>${es.reduce((s, e) => s + e.attendees, 0)} guests</span></div>${btn("View space", "facility-detail", { id: f.id, icon: "arrow", class: "full" })}</div></section>`;
    })
    .join("")}</div>`;
}

function resourceLanes(r) {
  const lanes = [];
  return eventsOn()
    .filter((e) => e.assignments.some((a) => a.resourceId === r.id))
    .sort((a, b) => a.start.localeCompare(b.start))
    .map((e) => {
      let lane = lanes.findIndex((end) => end <= e.start);
      if (lane === -1) lane = lanes.length;
      lanes[lane] = e.end;
      return { event: e, lane };
    });
}
function resourcesView() {
  const rs = state.resources.filter(
    (r) =>
      r.type === ui.resourceType &&
      (ui.venue === "all" || r.venue === ui.venue) &&
      `${r.name} ${r.skills.join(" ")}`
        .toLowerCase()
        .includes(ui.search.toLowerCase()),
  );
  return `${heading("THE RIGHT PEOPLE. THE RIGHT EQUIPMENT.", "Resources", "Give every experience the cover it needs.", btn("Mark unavailable", "absence", { class: "primary", icon: "calendar" }))}<div class="view-tabs"><button data-action="resource-type" data-id="Staff" class="${ui.resourceType === "Staff" ? "active" : ""}">${icon("people", 16)} People <span>${state.resources.filter((r) => r.type === "Staff").length}</span></button><button data-action="resource-type" data-id="Equipment" class="${ui.resourceType === "Equipment" ? "active" : ""}">${icon("equipment", 16)} Equipment <span>${state.resources.filter((r) => r.type === "Equipment").length}</span></button><span></span><span class="small-note">${icon("help", 14)} Select a resource to view their schedule</span></div>${toolbar(`${searchBox("Find a resource…")}`)}<div class="section-summary"><strong>${ui.resourceType === "Staff" ? "Your people" : "Your equipment"} <span class="summary-light">· ${rs.length} ${ui.resourceType === "Staff" ? "team members" : "resources"}</span></strong><span class="legend"><i class="legend-dot purple"></i>Public <i class="legend-dot teal"></i>Private <i class="legend-dot orange"></i>Unavailable</span></div><section class="card schedule-card"><div class="schedule-scroll"><div class="schedule-inner"><div class="schedule-head"><div class="schedule-label">${ui.resourceType === "Staff" ? "TEAM MEMBER" : "EQUIPMENT"}</div><div class="time-scale">${timeTicks()}</div></div>${rs
    .map(
      (r, i) =>
        `<div class="schedule-row resource-row" style="min-height:${Math.max(89, (Math.max(-1, ...resourceLanes(r).map((x) => x.lane)) + 1) * 69 + 25)}px"><button class="schedule-label" data-action="resource" data-id="${r.id}"><span class="resource-avatar avatar-${i % 4}">${r.type === "Staff" ? initials(r.name) : icon("equipment", 19)}</span><div><strong>${esc(r.name)}</strong><small>${r.type === "Staff" ? esc(r.skills.join(" · ")) : `${r.capacity} units in pool`}</small></div></button><div class="timeline-track" style="${trackStyle()}">${resourceLanes(
          r,
        )
          .map((x) => timelineBlock(x.event, true, x.lane, r.id))
          .join("")}${(r.unavailable || [])
          .filter((x) => x.date === ui.date)
          .map(
            (x) =>
              `<span class="timeline-block closure-block" style="${blockStyle(x)}"><strong>Unavailable</strong><small>${esc(x.reason)}</small></span>`,
          )
          .join(
            "",
          )}${!eventsOn().some((e) => e.assignments.some((a) => a.resourceId === r.id)) && !(r.unavailable || []).some((x) => x.date === ui.date) ? '<span class="free-label">Available for assignments</span>' : ""}</div></div>`,
    )
    .join(
      "",
    )}${!rs.length ? emptyState("No resources found", "Try a different search or venue.", "", "") : ""}</div></div><div class="schedule-bottom"><span>${icon("check", 14)} Availability is checked before every assignment</span><span>${prettyDate(ui.date, { weekday: "long", day: "numeric", month: "long" })}</span></div></section><div class="board-note">${icon("people", 17)}<span>Someone away? Review their events and choose cover in one simple flow.</span><button class="text-btn" data-action="absence">Arrange cover ${icon("arrow", 15)}</button></div>`;
}

function openDrawer(type, id, draft = {}) {
  previousFocus = document.activeElement;
  drawer = { type, id, step: 1, draft, error: "" };
  renderDrawer();
  $("#app").inert = true;
  document.body.classList.add("drawer-open");
  requestAnimationFrame(() => $("#overlay-root .drawer-close")?.focus());
}
function closeDrawer() {
  drawer = null;
  $("#overlay-root").innerHTML = "";
  $("#app").inert = false;
  document.body.classList.remove("drawer-open");
  previousFocus?.isConnected && previousFocus.focus();
}
function drawerFrame(kicker, title, sub, body, footer, wide = false) {
  return `<div class="drawer-backdrop" data-action="backdrop"><section class="drawer ${wide ? "wide" : ""}" role="dialog" aria-modal="true" aria-labelledby="drawer-title"><header class="drawer-heading"><div><span class="eyebrow">${kicker}</span><h2 id="drawer-title">${title}</h2>${sub ? `<p>${sub}</p>` : ""}</div><button class="icon-btn drawer-close" data-action="close-drawer" aria-label="Close panel">${icon("close", 21)}</button></header><div class="drawer-body">${drawer.error ? `<div class="form-error" role="alert">${icon("alert", 18)}${esc(drawer.error)}</div>` : ""}${body}</div>${footer ? `<footer class="drawer-footer">${footer}</footer>` : ""}</section></div>`;
}
const fact = (ic, label, value) =>
  `<div class="detail-fact">${icon(ic, 18)}<div><small>${label}</small><strong>${value}</strong></div></div>`;
function renderDrawer() {
  if (!drawer) return;
  const { type, id } = drawer;
  let html = "";
  if (type === "event") {
    const e = state.events.find((x) => x.id === id),
      c = coverage(e),
      f = facility(e);
    html = drawerFrame(
      `${e.type.toUpperCase()} ${e.type === "Private" ? "BOOKING" : "SESSION"}`,
      esc(e.title),
      `${prettyDate(e.date, { weekday: "long", day: "numeric", month: "long" })}`,
      `${pill(c.ready ? "Ready to go" : "Needs attention", c.ready ? "green" : "amber")}<div class="event-facts">${fact("clock", "Time", e.start + "–" + e.end)}${fact("pin", "Space", esc(f.name))}${fact("people", "Guests", e.attendees + " people")}${fact("facility", "Venue", shortVenue(f.venue))}</div>${!c.ready ? `<div class="callout amber"><span>${icon("alert", 20)}</span><div><strong>A little more cover needed</strong><p>${esc(c.issues.join(". "))}</p></div></div>` : ""}<div class="drawer-section-heading"><h3>People & equipment</h3>${btn("Assign", "assign", { id: e.id, icon: "plus", class: "small" })}</div><div class="assignment-list">${
        e.assignments.length
          ? e.assignments
              .map((a) => {
                let r = getResource(state, a.resourceId);
                return `<div class="assignment-row"><span class="resource-avatar avatar-1">${r.type === "Staff" ? initials(r.name) : icon("equipment", 18)}</span><div><strong>${esc(r.name)}</strong><small>${r.type === "Staff" ? "Staff cover" : "Equipment"} <span class="middot">·</span> ${a.quantity} ${r.type === "Staff" ? "guests" : "units"}</small></div><button class="remove-assignment" data-action="remove-assignment" data-resource="${r.id}" aria-label="Remove ${esc(r.name)} assignment">Remove</button></div>`;
              })
              .join("")
          : '<div class="inline-empty">No resources assigned yet.</div>'
      }</div><div class="coverage-summary"><div><span>Staff cover</span><strong>${c.staffCovered} of ${e.attendees} guests</strong></div><div class="progress-track"><span style="width:${Math.min(100, (c.staffCovered / e.attendees) * 100)}%"></span></div></div>${e.type === "Private" ? `<div class="simple-note">${icon("lock", 17)}<span>Private booking${e.contact ? ` · ${esc(e.contact)}` : ""}<br>Move the whole booking together.</span></div>` : ""}<div class="drawer-section-heading"><h3>Need to make a change?</h3></div><button class="action-card" data-action="move" data-id="${e.id}"><span class="action-card-icon">${icon("calendar", 20)}</span><span><strong>Move this event</strong><small>Find another time or space that works.</small></span>${icon("chevron", 17)}</button>`,
      `${btn("Close", "close-drawer")}${btn(c.ready ? "Manage resources" : "Assign resources", "assign", { id: e.id, class: "primary", icon: "people" })}`,
    );
  } else if (type === "assign") html = assignmentDrawer();
  else if (type === "closure") html = closureDrawer();
  else if (type === "absence") html = absenceDrawer();
  else if (type === "move") html = moveDrawer();
  else if (type === "new-event") html = newEventDrawer();
  else if (type === "facility") {
    const f = getFacility(state, id),
      es = eventsOn().filter((e) => e.facilityId === id),
      cs = state.closures.filter(
        (c) => c.facilityId === id && c.date === ui.date,
      );
    html = drawerFrame(
      "YOUR SPACES",
      esc(f.name),
      venues[f.venue],
      `<div class="facility-detail-art ${f.type.toLowerCase()}">${icon(facilityIcon(f), 60)}<span>${f.type} space</span></div><div class="event-facts">${fact("people", "Capacity", f.capacity + " guests")}${fact("calendar", "On this date", es.length + " events")}</div><h3>Made for</h3><div class="skill-tags">${f.activities.map((s) => `<span>${esc(s)}</span>`).join("")}</div><div class="drawer-section-heading"><h3>Schedule · ${prettyDate(ui.date)}</h3></div>${es.map((e) => `<button class="schedule-list-item" data-action="event" data-id="${e.id}"><span class="event-color ${eventTone(e)}"></span><div><strong>${esc(e.title)}</strong><small>${e.start}–${e.end} · ${e.attendees} guests</small></div>${icon("chevron", 16)}</button>`).join("") || '<div class="inline-empty">No events scheduled. Plenty of possibility.</div>'}${cs.map((c) => `<div class="callout amber">${icon("lock", 18)}<div><strong>Closed ${c.start}–${c.end}</strong><p>${esc(c.reason)}</p></div></div>`).join("")}`,
      `${btn("Close", "close-drawer")}${btn("Plan a closure", "closure", { id: f.id, class: "primary", icon: "lock" })}`,
    );
  } else if (type === "resource") {
    const r = getResource(state, id),
      es = eventsOn().filter((e) =>
        e.assignments.some((a) => a.resourceId === id),
      );
    html = drawerFrame(
      r.type === "Staff" ? "YOUR PEOPLE" : "YOUR EQUIPMENT",
      esc(r.name),
      shortVenue(r.venue),
      `<div class="resource-profile"><span class="resource-avatar avatar-1 large">${r.type === "Staff" ? initials(r.name) : icon("equipment", 32)}</span><div><strong>${r.type === "Staff" ? "Team member" : "Equipment pool"}</strong><p>Capacity: ${r.capacity} ${r.type === "Staff" ? "guests" : "units"}</p></div></div><h3>Skills & activities</h3><div class="skill-tags">${r.skills.map((s) => `<span>${esc(s)}</span>`).join("")}</div><div class="drawer-section-heading"><h3>Schedule · ${prettyDate(ui.date)}</h3><span class="muted">${es.length} events</span></div>${es.map((e) => `<button class="schedule-list-item" data-action="event" data-id="${e.id}"><span class="event-color ${eventTone(e)}"></span><div><strong>${esc(e.title)}</strong><small>${e.start}–${e.end} · ${esc(facility(e)?.name)}</small></div>${icon("chevron", 16)}</button>`).join("") || '<div class="inline-empty">Available for assignments on this date.</div>'}${(
        r.unavailable || []
      )
        .filter((x) => x.date === ui.date)
        .map(
          (x) =>
            `<div class="callout amber">${icon("calendar", 18)}<div><strong>Unavailable ${x.start}–${x.end}</strong><p>${esc(x.reason)}</p></div></div>`,
        )
        .join("")}`,
      `${btn("Close", "close-drawer")}${btn("Mark unavailable", "absence", { id: r.id, class: "primary", icon: "calendar" })}`,
    );
  } else if (type === "history")
    html = drawerFrame(
      "EVERY CHANGE, IN VIEW",
      "Recent activity",
      "A clear record of what’s changed in this workspace.",
      `${undoState ? `<div class="callout green">${icon("undo", 19)}<div><strong>Changed your mind?</strong><p>You can undo the last change made in this session.</p>${btn("Undo last change", "undo", { class: "small" })}</div></div>` : ""}${state.history.length ? `<div class="history-list">${state.history.map((h) => `<div class="history-item"><span>${icon("check", 16)}</span><div><strong>${esc(h.title)}</strong><p>${esc(h.detail)}</p><small>${new Date(h.time).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Colombo" })}</small></div></div>`).join("")}</div>` : '<div class="empty-state">' + icon("history", 32) + "<h3>A fresh start.</h3><p>Your changes will appear here.</p></div>"}`,
      btn("Done", "close-drawer", { class: "primary" }),
    );
  else if (type === "closure-detail") {
    const c = state.closures.find((x) => x.id === id);
    html = drawerFrame(
      "PLANNED CLOSURE",
      esc(getFacility(state, c.facilityId).name),
      prettyDate(c.date),
      `${pill("Closed", "amber")}<div class="event-facts">${fact("clock", "Closure period", c.start + "–" + c.end)}${fact("lock", "Reason", esc(c.reason))}</div><div class="callout green">${icon("check", 20)}<div><strong>Affected events have another space.</strong><p>Their times and guest numbers were kept the same.</p></div></div><p class="muted">View recent activity to see the change. The latest change in this session can be undone.</p>`,
      `${btn("Recent activity", "history")}${btn("Done", "close-drawer", { class: "primary" })}`,
    );
  } else if (type === "guide")
    html = drawerFrame(
      "A LITTLE GUIDANCE",
      "Operations, together.",
      "Familiar tools. A little less complexity.",
      `<div class="guide-intro">This hybrid combines the best ideas from both prototypes, with one simple rule: <strong>show what matters now, guide the next step.</strong></div>${[
        [
          "calendar",
          "Events",
          "See who needs cover. Assign available people and equipment, or move an event to a suitable time and space.",
        ],
        [
          "people",
          "Resources",
          "See the day across your team and equipment. Mark someone unavailable and arrange cover before applying the change.",
        ],
        [
          "facility",
          "Facilities",
          "See availability at a glance. Plan a closure, find affected events, and choose suitable alternative spaces.",
        ],
      ]
        .map(
          ([i, t, p]) =>
            `<div class="guide-item"><span class="action-card-icon">${icon(i, 22)}</span><div><h3>${t}</h3><p>${p}</p></div></div>`,
        )
        .join(
          "",
        )}<div class="callout amber">${icon("help", 20)}<div><strong>A prototype you can explore</strong><p>Sample data is saved in this browser. Changes don’t contact guests or update a live booking system. Reset to try a fresh scenario.</p></div></div><details class="advanced"><summary>Where did the advanced tools go?</summary><p>Multi-day disruption planning, guest splitting, financial adjustments and complex staff swaps belong in a later, guided layer. The everyday workflows come first here.</p></details>`,
      `${btn("Reset sample data", "reset", { class: "danger" })}${btn("Got it", "close-drawer", { class: "primary" })}`,
    );
  else if (type === "reset")
    html = drawerFrame(
      "START FRESH",
      "Reset the sample workspace?",
      "This clears your local changes and restores the original sample events.",
      `<div class="callout amber">${icon("history", 20)}<p>Events, assignments, closures and activity will return to the starting scenario. You can undo this reset during this session.</p></div>`,
      `${btn("Keep my changes", "close-drawer")}${btn("Reset workspace", "confirm-reset", { class: "danger" })}`,
    );
  $("#overlay-root").innerHTML = html;
}

function assignmentDrawer() {
  const e = state.events.find((x) => x.id === drawer.id),
    c = coverage(e),
    d = drawer.draft;
  d.resourceType ||=
    c.staffShortfall > 0
      ? "Staff"
      : c.equipmentShortfall > 0
        ? "Equipment"
        : "Staff";
  const needed =
    d.resourceType === "Staff" ? c.staffShortfall : c.equipmentShortfall;
  const covered =
    d.resourceType === "Staff" ? c.staffCovered : c.equipmentCovered;
  const candidates = eligibleResources(state, e, d.resourceType);
  const selected = candidates.find((r) => r.id === d.resourceId);
  if (!selected) {
    d.resourceId = "";
    d.quantity = Math.max(1, needed);
  }
  const existing =
    e.assignments.find((a) => a.resourceId === d.resourceId)?.quantity || 0;
  const q = Number(d.quantity || Math.max(1, needed));
  return drawerFrame(
    "GET THE COVER RIGHT",
    "Assign resources",
    `${esc(e.title)} · ${e.start}–${e.end}`,
    `<div class="coverage-callout ${c.ready ? "green" : "amber"}"><span class="coverage-number">${needed}</span><div><strong>${needed ? (d.resourceType === "Staff" ? "guests still need staff cover" : "equipment units still needed") : d.resourceType === "Staff" ? "Staff cover is in place" : "Equipment is in place"}</strong><p>${covered} of ${e.attendees} ${d.resourceType === "Staff" ? "guests covered" : "units covered"}</p></div>${icon(c.ready ? "check" : "people", 24)}</div><div class="drawer-section-heading"><h3>Choose a resource</h3></div><div class="segmented resource-segment">${["Staff", "Equipment"].map((t) => `<button data-action="assign-type" data-id="${t}" class="${d.resourceType === t ? "selected" : ""}">${t === "Staff" ? "People" : "Equipment"}</button>`).join("")}</div><p class="helper-text">${d.resourceType === "Staff" ? "Available team members with the right skills at this venue." : "Equipment quantities are checked against overlapping events."}</p><div class="candidate-list">${
      candidates
        .filter((r) => r.eligible && r.available > 0)
        .map(
          (r, i) =>
            `<label class="candidate ${d.resourceId === r.id ? "selected" : ""}"><input type="radio" name="assign-resource" value="${r.id}" ${d.resourceId === r.id ? "checked" : ""} data-draft="resourceId"><span class="resource-avatar avatar-${i % 4}">${r.type === "Staff" ? initials(r.name) : icon("equipment", 18)}</span><span class="candidate-copy"><strong>${esc(r.name)}</strong><small>${esc(r.skills.join(" · "))}</small><span class="candidate-status">${icon("check", 12)} ${e.assignments.some((a) => a.resourceId === r.id) ? `Already assigned · ${e.assignments.find((a) => a.resourceId === r.id).quantity} of ${r.available} maximum` : `${r.available} ${r.type === "Staff" ? "guest places" : "units"} available`}</span></span></label>`,
        )
        .join("") ||
      '<div class="inline-empty">No eligible resources are available for this event.</div>'
    }</div>${d.resourceId ? `<div class="quantity-box"><div><strong>${d.resourceType === "Staff" ? "Guest places" : "Equipment units"}</strong><small>${existing ? "Replaces this resource’s current quantity." : "Add the cover you need."}</small></div><input aria-label="Assignment quantity" type="number" min="1" max="${selected?.available || 1}" value="${q}" data-draft="quantity"></div><div class="simple-note">${icon("check", 17)}<span>After this assignment: <strong>${Math.max(0, needed - q + existing)} ${d.resourceType === "Staff" ? "guests still need staff cover" : "equipment units still needed"}</strong>.</span></div>` : ""}<details class="advanced"><summary>Why aren’t other resources shown?</summary><p>Resources must have the right skills, be at this venue and be available for the full event.</p>${
      candidates
        .filter((r) => !r.eligible || r.available <= 0)
        .map(
          (r) =>
            `<div class="unavailable-candidate"><strong>${esc(r.name)}</strong><span>${esc(r.reason || "Not enough availability")}</span></div>`,
        )
        .join("") || "<p>All matching resources are shown above.</p>"
    }</details>`,
    `${btn("Back to event", "event", { id: e.id })}${btn("Save assignment", "save-assignment", { class: "primary", icon: "check", disabled: !d.resourceId })}`,
  );
}

const inputField = (label, name, value, type = "text", extra = "") =>
  `<label class="form-field"><span>${label}</span><input type="${type}" name="${name}" value="${esc(value)}" data-draft="${name}" ${extra}></label>`;
const selectField = (label, name, value, options) =>
  `<label class="form-field"><span>${label}</span><select name="${name}" aria-label="${esc(label)}" data-draft="${name}">${options.map(([v, t]) => `<option value="${v}" ${v === value ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></label>`;
function steps(labels) {
  return `<div class="steps">${labels.map((s, i) => `<div class="${drawer.step === i + 1 ? "active" : drawer.step > i + 1 ? "complete" : ""}"><span>${drawer.step > i + 1 ? icon("check", 12) : i + 1}</span>${s}</div>`).join("")}</div>`;
}
function closureDrawer() {
  const d = drawer.draft;
  d.facilityId ||=
    drawer.id || state.facilities.find((f) => f.venue === "riverside").id;
  d.date ||= ui.date;
  d.start ||= "11:00";
  d.end ||= "13:00";
  d.reason ||= "Maintenance";
  d.moves ||= {};
  let affected = [];
  try {
    affected = affectedByClosure(state, d);
  } catch {}
  const f = getFacility(state, d.facilityId);
  let body = steps(["Closure details", "Affected events", "Review"]);
  if (drawer.step === 1)
    body += `<div class="callout green">${icon("leaf", 20)}<div><strong>A change of space, without the stress.</strong><p>We’ll check the impact and help you find alternatives before anything changes.</p></div></div><div class="form-stack">${selectField(
      "Which space?",
      "facilityId",
      d.facilityId,
      state.facilities.map((f) => [f.id, f.name + " · " + shortVenue(f.venue)]),
    )}${inputField("Date", "date", d.date, "date", "required")}<div class="two-fields">${inputField("From", "start", d.start, "time", "required")}${inputField("Until", "end", d.end, "time", "required")}</div>${selectField(
      "Reason",
      "reason",
      d.reason,
      [
        ["Maintenance", "Maintenance"],
        ["Weather conditions", "Weather conditions"],
        ["Safety inspection", "Safety inspection"],
        ["Private use", "Private use"],
        ["Other", "Other"],
      ],
    )}<details class="advanced"><summary>Add a note (optional)</summary><label class="form-field"><span>Internal note</span><textarea data-draft="notes" placeholder="Anything the team should know?">${esc(d.notes || "")}</textarea></label></details></div><div class="impact-preview">${icon("calendar", 20)}<span><strong>${affected.length} event${affected.length === 1 ? "" : "s"} affected</strong><small>During this closure period</small></span><strong>${affected.reduce((s, e) => s + e.attendees, 0)} <small>guests</small></strong></div>`;
  if (drawer.step === 2)
    body += `<h3>${affected.length ? "Let’s find another space." : "No events need to move."}</h3><p class="helper-text">${affected.length ? "Keep the same date, time and guest numbers. Choose a suitable alternative for each event." : "This closure won’t affect any scheduled events."}</p>${affected
      .map((e) => {
        const options = getFacilityOptions(state, e, d.facilityId).filter(
          (f) => f.id !== d.facilityId,
        );
        return `<div class="impact-event"><div class="impact-event-heading"><span class="event-color ${eventTone(e)}"></span><div><strong>${esc(e.title)}</strong><small>${e.start}–${e.end} · ${e.attendees} guests · ${e.type}</small></div></div><div class="move-from">${icon("pin", 14)} From ${esc(f.name)}</div><label class="form-field"><span>Move to</span><select data-move="${e.id}"><option value="">Choose another space…</option>${options.map((o) => `<option value="${o.id}" ${d.moves[e.id] === o.id ? "selected" : ""} ${!o.available ? "disabled" : ""}>${esc(o.name)}${o.available ? " · Available" : " · " + esc(o.reason)}</option>`).join("")}</select></label>${d.moves[e.id] ? `<div class="candidate-status">${icon("check", 13)} Time and guest numbers stay the same</div>` : ""}</div>`;
      })
      .join(
        "",
      )}<div class="simple-note">${icon("help", 17)}<span>Only spaces with matching activities and enough capacity can be selected. Combined moves are checked again when applied.</span></div>`;
  if (drawer.step === 3)
    body += `<div class="review-title">${icon("check", 23)}<h3>Everything in its new place.</h3></div><p class="helper-text">Review the changes below. Nothing has changed yet.</p><div class="review-summary">${fact("lock", "Space to close", esc(f.name))}${fact("calendar", "When", `${prettyDate(d.date)} · ${d.start}–${d.end}`)}${fact("help", "Reason", esc(d.reason))}</div><h3>${affected.length ? "Events to move" : "No events affected"}</h3>${affected.map((e) => `<div class="review-change"><strong>${esc(e.title)}</strong><small>${e.start}–${e.end} · ${e.attendees} guests</small><div><span>${esc(f.name)}</span>${icon("arrow", 16)}<strong>${esc(getFacility(state, d.moves[e.id])?.name)}</strong></div></div>`).join("")}<div class="callout green">${icon("check", 20)}<div><strong>Ready to apply</strong><p>The closure and event moves will be saved together. You can undo the change.</p></div></div>`;
  return drawerFrame(
    "FACILITIES · PLAN A CLOSURE",
    drawer.step === 1
      ? "A little room for change."
      : drawer.step === 2
        ? "Keep good plans on track."
        : "Review your changes.",
    esc(f.name),
    body,
    `${btn(drawer.step === 1 ? "Cancel" : "Back", drawer.step === 1 ? "close-drawer" : "flow-back")}${btn(drawer.step === 3 ? "Apply closure" : drawer.step === 2 ? "Review changes" : "Check affected events", drawer.step === 3 ? "apply-closure" : "closure-next", { class: "primary", icon: drawer.step === 3 ? "check" : "arrow" })}`,
  );
}

function absenceDrawer() {
  const d = drawer.draft;
  d.resourceId ||=
    drawer.id || state.resources.find((r) => r.type === "Staff").id;
  d.date ||= ui.date;
  d.start ||= "08:00";
  d.end ||= "18:00";
  d.reason ||= "Sick leave";
  d.replacements ||= {};
  const r = getResource(state, d.resourceId);
  let affected = [];
  try {
    affected = affectedByAbsence(state, d);
  } catch {}
  let body = steps(["Unavailable period", "Arrange cover", "Review"]);
  if (drawer.step === 1)
    body += `<p class="helper-text">Tell us who’s away and when. We’ll find their affected events and help you arrange cover.</p><div class="form-stack">${selectField(
      "Person or equipment",
      "resourceId",
      d.resourceId,
      state.resources.map((r) => [r.id, r.name]),
    )}${inputField("Date", "date", d.date, "date", "required")}<div class="two-fields">${inputField("From", "start", d.start, "time", "required")}${inputField("Until", "end", d.end, "time", "required")}</div>${selectField(
      "Reason",
      "reason",
      d.reason,
      [
        ["Sick leave", "Sick leave"],
        ["Annual leave", "Annual leave"],
        ["Maintenance", "Maintenance"],
        ["Other", "Other"],
      ],
    )}</div><div class="impact-preview">${icon("people", 20)}<span><strong>${affected.length} event${affected.length === 1 ? "" : "s"} need cover</strong><small>Assignments during this period</small></span></div>`;
  if (drawer.step === 2)
    body += `<h3>${affected.length ? "A helping hand for each event." : "No assignments affected."}</h3><p class="helper-text">${affected.length ? "Choose a suitable replacement. We’ll keep the event’s guest coverage." : "This resource can be marked unavailable without changing any events."}</p>${affected
      .map((e) => {
        const qty = e.assignments.find((a) => a.resourceId === r.id).quantity,
          options = eligibleResources(state, e, r.type).filter(
            (x) =>
              x.id !== r.id &&
              x.eligible &&
              x.available -
                (e.assignments.find((a) => a.resourceId === x.id)?.quantity ||
                  0) >=
                qty,
          );
        return `<div class="impact-event"><div class="impact-event-heading"><span class="event-color ${eventTone(e)}"></span><div><strong>${esc(e.title)}</strong><small>${e.start}–${e.end} · ${qty} ${r.type === "Staff" ? "guest places" : "units"} to replace</small></div></div><label class="form-field"><span>Cover with</span><select data-replacement="${e.id}"><option value="">Choose a replacement…</option>${options.map((o) => `<option value="${o.id}" ${d.replacements[e.id] === o.id ? "selected" : ""}>${esc(o.name)} · ${o.available} available</option>`).join("")}</select></label>${!options.length ? '<p class="warning-text">No suitable cover at this time. Move the event first, then arrange this absence.</p>' : ""}</div>`;
      })
      .join("")}`;
  if (drawer.step === 3)
    body += `<div class="review-summary">${fact("people", "Unavailable resource", esc(r.name))}${fact("calendar", "When", `${prettyDate(d.date)} · ${d.start}–${d.end}`)}${fact("help", "Reason", esc(d.reason))}</div><h3>${affected.length ? "Cover arranged" : "No affected assignments"}</h3>${affected.map((e) => `<div class="review-change"><strong>${esc(e.title)}</strong><small>${e.start}–${e.end}</small><div><span>${esc(r.name)}</span>${icon("arrow", 16)}<strong>${esc(getResource(state, d.replacements[e.id])?.name)}</strong></div></div>`).join("")}<div class="callout green">${icon("check", 20)}<div><strong>One clear change.</strong><p>Availability and replacement assignments will be saved together. No guest notifications are sent by this prototype.</p></div></div>`;
  return drawerFrame(
    "RESOURCES · ARRANGE COVER",
    drawer.step === 1
      ? "Away, but taken care of."
      : drawer.step === 2
        ? "Keep the day covered."
        : "Review your changes.",
    esc(r.name),
    body,
    `${btn(drawer.step === 1 ? "Cancel" : "Back", drawer.step === 1 ? "close-drawer" : "flow-back")}${btn(drawer.step === 3 ? "Apply changes" : drawer.step === 2 ? "Review cover" : "Check affected events", drawer.step === 3 ? "apply-absence" : "absence-next", { class: "primary", icon: drawer.step === 3 ? "check" : "arrow" })}`,
  );
}

function moveDrawer() {
  const e = state.events.find((x) => x.id === drawer.id),
    d = drawer.draft;
  d.date ||= e.date;
  d.start ||= e.start;
  d.end ||= e.end;
  d.facilityId ||= e.facilityId;
  let proposal = { ...e, ...d },
    options = getFacilityOptions(state, proposal);
  let body = steps(["New time & space", "Review"]);
  if (drawer.step === 1)
    body += `<div class="simple-note">${icon("calendar", 18)}<span>Currently: <strong>${prettyDate(e.date)} · ${e.start}–${e.end}</strong><br>${esc(facility(e).name)} · ${e.attendees} guests</span></div><div class="form-stack">${inputField("Date", "date", d.date, "date", "required")}<div class="two-fields">${inputField("Starts", "start", d.start, "time", "required")}${inputField("Ends", "end", d.end, "time", "required")}</div>${selectField(
      "Space",
      "facilityId",
      d.facilityId,
      options.map((f) => [
        f.id,
        f.name + (f.available ? " · Available" : " · " + f.reason),
      ]),
    )}</div><div class="callout green">${icon("check", 20)}<div><strong>Keep the important things together.</strong><p>Guest numbers and existing resources stay with the event. Their availability will be checked before moving.</p></div></div>`;
  else
    body += `<div class="review-change"><strong>${esc(e.title)}</strong><small>${e.attendees} guests · ${e.type}</small><div><span>${prettyDate(e.date)}<br>${e.start}–${e.end}<br>${esc(facility(e).name)}</span>${icon("arrow", 18)}<strong>${prettyDate(d.date)}<br>${d.start}–${d.end}<br>${esc(getFacility(state, d.facilityId)?.name)}</strong></div></div><div class="simple-note">${icon("help", 18)}<span>Resources are kept with this event. No guest notifications or payment changes are made by this prototype.</span></div>`;
  return drawerFrame(
    "EVENTS · MOVE AN EVENT",
    drawer.step === 1 ? "Find a better fit." : "Review the move.",
    esc(e.title),
    body,
    `${btn(drawer.step === 1 ? "Cancel" : "Back", drawer.step === 1 ? "close-drawer" : "flow-back")}${btn(drawer.step === 1 ? "Review move" : "Move event", drawer.step === 1 ? "move-next" : "apply-move", { class: "primary", icon: drawer.step === 1 ? "arrow" : "check" })}`,
  );
}

function newEventDrawer() {
  const d = drawer.draft;
  d.date ||= ui.date;
  d.start ||= "09:00";
  d.end ||= "10:00";
  d.type ||= "Public";
  d.activity ||= "Kayaking";
  d.attendees ||= 8;
  d.facilityId ||= state.facilities[0].id;
  return drawerFrame(
    "A NEW EXPERIENCE",
    "Make a little room.",
    "Start with the essentials. Assign your people and equipment next.",
    `<form id="new-event-form"><div class="form-stack">${inputField("Event name", "title", d.title || "", "text", 'required maxlength="80" placeholder="e.g. Morning kayak discovery"')}${selectField(
      "Booking type",
      "type",
      d.type,
      [
        ["Public", "Public session"],
        ["Private", "Private booking"],
      ],
    )}${selectField("Activity", "activity", d.activity, [
      ["Kayaking", "Kayaking"],
      ["Trail", "Trail"],
      ["Yoga", "Yoga"],
      ["Snorkelling", "Snorkelling"],
      ["Swimming", "Swimming"],
    ])}<div class="two-fields">${inputField("Date", "date", d.date, "date", "required")}${inputField("Guests", "attendees", d.attendees, "number", 'required min="1" max="500"')}</div><div class="two-fields">${inputField("Starts", "start", d.start, "time", "required")}${inputField("Ends", "end", d.end, "time", "required")}</div>${selectField(
      "Space",
      "facilityId",
      d.facilityId,
      state.facilities.map((f) => [f.id, f.name + " · up to " + f.capacity]),
    )}${d.type === "Private" ? inputField("Booking contact (optional)", "contact", d.contact || "", "text", 'maxlength="100"') : ""}</div></form><div class="simple-note">${icon("people", 18)}<span>Your event will appear as <strong>Needs attention</strong> until its resource requirements are covered.</span></div>`,
    `${btn("Cancel", "close-drawer")}<button class="btn primary" form="new-event-form" type="submit">${icon("plus", 16)}Create event</button>`,
  );
}

function guard(fn) {
  try {
    fn();
  } catch (e) {
    drawer.error = e.message;
    renderDrawer();
    $("#overlay-root .form-error")?.scrollIntoView({ block: "nearest" });
  }
}
function validatePeriod(d) {
  if (!d.date || !d.start || !d.end || d.start >= d.end)
    throw new Error(
      "Choose a valid date and an end time after the start time.",
    );
}
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-action]");
  if (!el) return;
  const action = el.dataset.action,
    id = el.dataset.id;
  if (action === "backdrop") {
    if (ev.target === el) closeDrawer();
    return;
  }
  ev.preventDefault();
  if (action === "nav") {
    ui.page = id;
    if (id === "resources") ui.mode = "day";
    ui.search = "";
    ui.onlyIssues = false;
    ui.mobileNav = false;
    closeDrawer();
    render();
    window.scrollTo(0, 0);
  } else if (action === "mobile-menu") {
    ui.mobileNav = !ui.mobileNav;
    render();
  } else if (action === "backdrop") {
    if (ev.target === el) closeDrawer();
  } else if (action === "close-drawer") closeDrawer();
  else if (action === "dismiss-toast") $("#toast-root").innerHTML = "";
  else if (action === "undo") {
    if (undoState) {
      state = undoState;
      undoState = null;
      persist();
      closeDrawer();
      render();
      toast("Last change undone.");
    }
  } else if (action === "attention") {
    ui.page = "events";
    ui.onlyIssues = true;
    ui.mode = "day";
    ui.search = "";
    render();
  } else if (action === "events-all") {
    ui.onlyIssues = false;
    render();
  } else if (action === "previous-date" || action === "next-date") {
    ui.date = shiftDate(
      ui.date,
      (action === "previous-date" ? -1 : 1) * (ui.mode === "week" ? 7 : 1),
    );
    render();
  } else if (action === "mode") {
    ui.mode = id;
    render();
  } else if (action === "jump-day") {
    ui.date = id;
    ui.mode = "day";
    render();
  } else if (action === "facility-type") {
    ui.facilityType = id;
    render();
  } else if (action === "facility-view") {
    ui.view = id;
    render();
  } else if (action === "resource-type") {
    ui.resourceType = id;
    render();
  } else if (action === "event") openDrawer("event", id);
  else if (action === "facility-detail") openDrawer("facility", id);
  else if (action === "resource") openDrawer("resource", id);
  else if (
    [
      "assign",
      "move",
      "closure",
      "absence",
      "new-event",
      "history",
      "guide",
      "reset",
      "closure-detail",
    ].includes(action)
  )
    openDrawer(action, id);
  else if (action === "confirm-reset") {
    ui.date = SEED_DATE;
    commit(createSeed(), "Sample workspace restored.");
  } else if (action === "assign-type") {
    drawer.draft.resourceType = id;
    drawer.draft.resourceId = "";
    drawer.error = "";
    renderDrawer();
  } else if (action === "remove-assignment")
    guard(() => {
      const eventId = drawer.id;
      commit(
        assignResource(state, eventId, el.dataset.resource, 0),
        "Assignment removed.",
      );
      openDrawer("event", eventId);
    });
  else if (action === "save-assignment")
    guard(() => {
      const d = drawer.draft;
      commit(
        assignResource(state, drawer.id, d.resourceId, Number(d.quantity)),
        "Resource assignment saved.",
      );
    });
  else if (action === "flow-back") {
    drawer.step--;
    drawer.error = "";
    renderDrawer();
  } else if (action === "closure-next")
    guard(() => {
      const d = drawer.draft;
      validatePeriod(d);
      const affected = affectedByClosure(state, d);
      if (drawer.step === 2 && affected.some((e) => !d.moves[e.id]))
        throw new Error(
          "Choose an alternative space for every affected event.",
        );
      if (drawer.step === 2) closeFacility(state, d);
      drawer.step++;
      drawer.error = "";
      renderDrawer();
    });
  else if (action === "apply-closure")
    guard(() =>
      commit(
        closeFacility(state, drawer.draft),
        "Closure applied. Affected events have been moved.",
      ),
    );
  else if (action === "absence-next")
    guard(() => {
      const d = drawer.draft;
      validatePeriod(d);
      const affected = affectedByAbsence(state, d);
      if (drawer.step === 2 && affected.some((e) => !d.replacements[e.id]))
        throw new Error("Choose cover for every affected event.");
      if (drawer.step === 2) markUnavailable(state, d);
      drawer.step++;
      drawer.error = "";
      renderDrawer();
    });
  else if (action === "apply-absence")
    guard(() =>
      commit(
        markUnavailable(state, drawer.draft),
        "Availability updated. Replacement cover is in place.",
      ),
    );
  else if (action === "move-next")
    guard(() => {
      validatePeriod(drawer.draft);
      rescheduleEvent(state, drawer.id, drawer.draft);
      drawer.step = 2;
      drawer.error = "";
      renderDrawer();
    });
  else if (action === "apply-move")
    guard(() => {
      const next = rescheduleEvent(state, drawer.id, drawer.draft);
      ui.date = drawer.draft.date;
      commit(next, "Event moved to its new time and space.");
    });
});
document.addEventListener("submit", (ev) => {
  if (ev.target.id !== "new-event-form") return;
  ev.preventDefault();
  guard(() => {
    const next = addEvent(state, {
      ...drawer.draft,
      attendees: Number(drawer.draft.attendees),
    });
    const e = next.events[next.events.length - 1];
    ui.date = e.date;
    ui.page = "events";
    ui.onlyIssues = false;
    ui.search = "";
    ui.venue = "all";
    commit(next, "Event created. Next, assign its resources.");
    openDrawer("event", e.id);
  });
});
document.addEventListener("input", (ev) => {
  const el = ev.target;
  if (el.dataset.control === "search") {
    const start = el.selectionStart;
    ui.search = el.value;
    render();
    const next = $('[data-control="search"]');
    next?.focus();
    next?.setSelectionRange(start, start);
  }
  if (el.dataset.draft && drawer) {
    drawer.draft[el.dataset.draft] = el.value;
  }
});
document.addEventListener("change", (ev) => {
  const el = ev.target;
  if (el.dataset.control) {
    ui[el.dataset.control] = el.value;
    render();
  }
  if (!drawer) return;
  if (el.dataset.move) {
    drawer.draft.moves[el.dataset.move] = el.value;
    renderDrawer();
  } else if (el.dataset.replacement) {
    drawer.draft.replacements[el.dataset.replacement] = el.value;
    renderDrawer();
  } else if (el.dataset.draft) {
    const key = el.dataset.draft;
    drawer.draft[key] = el.value;
    drawer.error = "";
    if (drawer.type === "assign" && key === "resourceId") {
      const e = state.events.find((e) => e.id === drawer.id),
        r = eligibleResources(state, e, drawer.draft.resourceType).find(
          (r) => r.id === el.value,
        );
      drawer.draft.quantity = Math.min(
        r.available,
        Math.max(
          1,
          e.assignments.find((a) => a.resourceId === r.id)?.quantity ||
            (r.type === "Staff"
              ? coverage(e).staffShortfall
              : coverage(e).equipmentShortfall),
        ),
      );
    }
    if (
      drawer.type === "closure" &&
      ["facilityId", "date", "start", "end"].includes(key)
    )
      drawer.draft.moves = {};
    if (
      drawer.type === "absence" &&
      ["resourceId", "date", "start", "end"].includes(key)
    )
      drawer.draft.replacements = {};
    if (
      el.tagName === "SELECT" ||
      el.type === "radio" ||
      el.type === "date" ||
      el.type === "time" ||
      drawer.type === "assign" ||
      drawer.type === "closure" ||
      drawer.type === "absence"
    )
      renderDrawer();
  }
});
document.addEventListener("keydown", (ev) => {
  if (!drawer) return;
  if (ev.key === "Escape") {
    closeDrawer();
    return;
  }
  if (ev.key === "Tab") {
    const focusable = [
      ...document.querySelectorAll(
        ".drawer button:not(:disabled),.drawer input:not(:disabled),.drawer select:not(:disabled),.drawer textarea,.drawer summary",
      ),
    ].filter((e) => e.getClientRects().length);
    const first = focusable[0],
      last = focusable.at(-1);
    if (ev.shiftKey && document.activeElement === first) {
      ev.preventDefault();
      last?.focus();
    } else if (!ev.shiftKey && document.activeElement === last) {
      ev.preventDefault();
      first?.focus();
    }
  }
});
render();
