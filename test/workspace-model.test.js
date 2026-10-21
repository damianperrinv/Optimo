import test from 'node:test';
import assert from 'node:assert/strict';
import '../src/booking-model.js';
import { buildWorkQueue } from '../src/workspace-model.js';

const model = globalThis.OptimoBookingModel;
const loaded = { v53: true, r7: true };
const scope = { from: '2026-10-20', to: '2026-10-21' };

function session(overrides = {}) {
  return { id: 'kayak-1', name: 'Kayak discovery', date: '2026-10-20', time: '09:00', venue: 'Riverside', attendees: 12, assigned: 8, ...overrides };
}
function facilityCase(overrides = {}) {
  return { id: 'closure-1', title: 'Lake Zone A maintenance', date: '2026-10-20', progress: { done: 1, total: 3 }, blocked: false, ...overrides };
}

test('conditional public events confirm on the first booking without changing their family', () => {
  for (const conditional of [{ provisional: true }, { confirmOnFirstBooking: true }, { confirmation: 'provisional' }]) {
    const empty = model.publicEvent({ ...conditional, bookings: 0 });
    const booked = model.publicEvent({ ...conditional, bookings: 1 });
    assert.equal(empty.confirmation, 'provisional');
    assert.equal(booked.confirmation, 'confirmed');
    assert.equal(empty.family, 'public');
    assert.equal(booked.family, 'public');
    assert.equal(booked.tone, empty.tone);
    assert.equal(booked.confirmOnFirstBooking, true);
  }
});

test('explicitly confirmed public events remain confirmed with zero bookings', () => {
  assert.equal(model.publicEvent({ confirmation: 'confirmed', bookings: 0 }).confirmation, 'confirmed');
  assert.equal(model.publicEvent({ confirmation: 'confirmed', confirmOnFirstBooking: true, bookings: 0 }).confirmation, 'confirmed');
  assert.equal(model.publicEvent({ confirmation: 'confirmed', provisional: true, bookings: 0 }).confirmation, 'confirmed');
});

test('public confirmation uses booking count rather than attendee estimates when both exist', () => {
  const item = model.publicEvent({ confirmOnFirstBooking: true, bookingsCount: 0, attendees: 18 });
  assert.equal(item.bookings, 0);
  assert.equal(item.confirmation, 'provisional');
  assert.equal(model.publicEvent({ confirmOnFirstBooking: true, bookingsCount: 1, attendees: 18 }).confirmation, 'confirmed');
});

test('publication draft is independent of booking confirmation', () => {
  const confirmedDraft = model.publicEvent({ preliminary: true, confirmation: 'confirmed', bookings: 0 });
  assert.equal(confirmedDraft.publication, 'draft');
  assert.equal(confirmedDraft.confirmation, 'confirmed');
  const provisionalPublished = model.publicEvent({ confirmation: 'provisional', bookings: 0, publication: 'published' });
  assert.equal(provisionalPublished.publication, 'published');
  assert.equal(provisionalPublished.confirmation, 'provisional');
  const firstBookingInDraft = model.publicEvent({ publication: 'draft', confirmOnFirstBooking: true, bookings: 1 });
  assert.equal(firstBookingInDraft.publication, 'draft');
  assert.equal(firstBookingInDraft.confirmation, 'confirmed');
});

test('private recurrence is metadata; all private booking types share the private colour family', () => {
  for (const [input, recurrence] of [[{ recurrence: 'seasonal' }, 'seasonal'], [{ bookingType: 'Regular booking' }, 'regular'], [{ type: 'recurring' }, 'regular'], [{ type: 'Casual' }, 'casual']]) {
    const item = model.privateBooking(input);
    assert.equal(item.family, 'private');
    assert.equal(item.tone, 'private');
    assert.equal(item.recurrence, recurrence);
    assert.equal(model.colours[item.tone], model.colours.private);
  }
  assert.notEqual(model.colours.public, model.colours.private);
  assert.notEqual(model.colours.private, model.colours.block);
  assert.deepEqual(model.legend.map(item => item.family), ['public', 'private', 'block']);
});

test('blocks retain their reason and confirmation without becoming a booking family', () => {
  const block = model.describe({ family: 'block', reason: 'Wet weather', status: 'planning' });
  assert.equal(block.family, 'block');
  assert.equal(block.reason, 'Wet weather');
  assert.equal(block.confirmation, 'provisional');
  assert.equal(block.tone, 'block');
  assert.equal(model.block({ reason: 'Safety inspection' }).confirmation, 'confirmed');
  assert.equal(model.block({}).reason, 'Closure');
  assert.equal(model.describe({ kind: 'public' }).family, 'public');
  assert.equal(model.describe({ kind: 'private', recurrence: 'seasonal' }).family, 'private');
  assert.equal(model.describe({ label: 'Staff briefing' }).family, 'internal');
});

test('queue cannot report all clear until both source workspaces have loaded', () => {
  const notLoaded = buildWorkQueue();
  assert.equal(notLoaded.loaded, 0);
  assert.equal(notLoaded.complete, false);
  assert.equal(notLoaded.clear, false);
  const partlyLoaded = buildWorkQueue({}, {}, { v53: true, r7: false });
  assert.equal(partlyLoaded.loaded, 1);
  assert.equal(partlyLoaded.complete, false);
  assert.equal(partlyLoaded.clear, false);
  const bothLoaded = buildWorkQueue({}, {}, loaded);
  assert.equal(bothLoaded.loaded, 2);
  assert.equal(bothLoaded.complete, true);
  assert.equal(bothLoaded.clear, true);
});

test('unloaded source snapshots do not contribute stale queue items', () => {
  const v = { sessions: [session()], outstanding: { impactContext: { resource: 'Mindy', items: [{}] } } };
  const r = { pending: { facilities: { cases: [facilityCase()] } }, followUp: { facilities: { flags: [{ id: 'flag-1', status: 'open' }] } } };
  const noSources = buildWorkQueue(v, r);
  assert.deepEqual([noSources.issues.length, noSources.drafts.length, noSources.followUps.length], [0, 0, 0]);
  const onlyV = buildWorkQueue(v, r, { v53: true, r7: false });
  assert.equal(onlyV.issues.length, 1);
  assert.equal(onlyV.drafts.length, 0);
  assert.equal(onlyV.followUps.length, 0);
});

test('queue surfaces actionable public cover gaps and private decisions, excluding covered or unpublished sessions', () => {
  const v = {
    sessions: [session(), session({ id: 'covered', assigned: 12 }), session({ id: 'draft', preliminary: true }), session({ id: 'empty', attendees: 0, assigned: 0 })],
    privates: [{ id: 'party', name: 'Group celebration', attention: true, attentionReason: 'Choose a replacement space' }, { id: 'ready-party', name: 'Ready party', attention: false }],
  };
  const queue = buildWorkQueue(v, {}, loaded);
  assert.equal(queue.issues.length, 2);
  const publicIssue = queue.issues.find(row => row.family === 'public');
  assert.equal(publicIssue.detail, '4 guest places still need resource cover');
  assert.equal(publicIssue.action, 'assign');
  assert.deepEqual(publicIssue.args, { id: 'kayak-1' });
  const privateIssue = queue.issues.find(row => row.family === 'private');
  assert.equal(privateIssue.detail, 'Choose a replacement space');
  assert.equal(privateIssue.action, 'private');
  assert.deepEqual(privateIssue.args, { id: 'party' });
  assert.equal(queue.clear, false);
});

test('date filters are inclusive while undated work remains visible for resolution', () => {
  const v = { sessions: [session({ id: 'before', date: '2026-10-19' }), session({ id: 'first', date: '2026-10-20' }), session({ id: 'last', date: '2026-10-21' }), session({ id: 'after', date: '2026-10-22' }), session({ id: 'undated', date: null })] };
  const r = { pending: { facilities: { cases: [facilityCase({ id: 'case-in', date: '2026-10-21' }), facilityCase({ id: 'case-out', date: '2026-10-22' }), facilityCase({ id: 'case-undated', date: null })] } }, followUp: { facilities: { flags: [{ id: 'dated', date: '2026-10-21' }, { id: 'out', date: '2026-10-19' }, { id: 'no-date' }] } } };
  const queue = buildWorkQueue(v, r, loaded, scope);
  assert.deepEqual(queue.issues.map(row => row.args.id), ['first', 'last', 'undated']);
  assert.deepEqual(queue.drafts.map(row => row.args.cid), ['case-in', 'case-undated']);
  assert.deepEqual(queue.followUps.map(row => row.args.id), ['dated', 'no-date']);
});

test('selection and an open detail panel are working context, not proposed changes', () => {
  const v = { selectedPublic: 3, selectedPrivate: 1, selected: { public: ['a', 'b', 'c'], private: ['p'] }, drawerTitle: 'Assign resources', drawer: { open: true }, outstanding: { impactContext: { resource: 'Mindy Lewis', items: [{ id: 'a' }, { id: 'b' }] } } };
  const r = { pending: { facilities: { draftMoves: 0, cases: [] }, operations: { draft: { n: 0 }, toDecide: 0 } } };
  const queue = buildWorkQueue(v, r, loaded);
  assert.equal(queue.drafts.length, 0);
  assert.equal(queue.followUps.length, 0);
  assert.equal(queue.clear, true);
});

test('facility cases choose the next real decision or review action and retain blocked state', () => {
  const r = { pending: { facilities: { cases: [facilityCase(), facilityCase({ id: 'ready', title: 'Ready closure', progress: { done: 2, total: 2 } }), facilityCase({ id: 'blocked', title: 'Blocked closure', progress: { done: 2, total: 2 }, blocked: 1 })] } } };
  const queue = buildWorkQueue({}, r, loaded);
  const open = queue.drafts.find(row => row.args.cid === 'closure-1');
  assert.equal(open.action, 'closureCase');
  assert.equal(open.status, '2 to decide');
  const readyCase = queue.drafts.find(row => row.args.cid === 'ready');
  assert.equal(readyCase.action, 'closureReview');
  assert.equal(readyCase.status, 'Ready for review');
  const blockedCase = queue.drafts.find(row => row.args.cid === 'blocked');
  assert.equal(blockedCase.action, 'closureCase');
  assert.equal(blockedCase.status, 'Blocked');
  assert.equal(blockedCase.blocked, true);
  assert.equal(queue.blocked, 1);
});

test('applied follow-ups stay separate from proposed changes and closed flags leave the queue', () => {
  const r = {
    pending: { facilities: { draftMoves: 2, boardCheck: { ok: true } }, operations: { draft: { n: 3, text: 'Three resource changes' }, toDecide: 0 } },
    followUp: {
      facilities: { flags: [{ id: 'money', bookingId: 'BK-12', bookingName: 'Company day', text: 'Refund review', status: 'open' }, { id: 'closed', bookingId: 'BK-13', status: 'done' }] },
      operations: { rows: [{ flagId: 'contact', kind: 'private', bookingId: 'BK-14', title: 'Call the organiser', reason: 'Customer response needed' }] },
    },
  };
  const queue = buildWorkQueue({}, r, loaded);
  assert.equal(queue.drafts.length, 2);
  assert.deepEqual(new Set(queue.drafts.map(row => row.action)), new Set(['boardReview', 'opReview']));
  assert.equal(queue.followUps.length, 2);
  assert.equal(queue.followUps.every(row => row.action === 'followUp'), true);
  assert.equal(queue.followUps.some(row => row.args.id === 'closed'), false);
  assert.equal(queue.followUps.find(row => row.args.id === 'contact').args.kind, 'operations');
  assert.equal(queue.followUps.find(row => row.args.id === 'money').args.bookingId, 'BK-12');
  assert.equal(queue.clear, false);
});

test('resource impact selections do not become drafts, while an undecided operations plan does', () => {
  const v = { outstanding: { impactContext: { resource: 'Mindy Lewis', items: [{ id: 'a' }, { id: 'b' }] } } };
  const r = { pending: { operations: { draft: { n: 0 }, toDecide: 2, blocked: false } } };
  const queue = buildWorkQueue(v, r, loaded);
  assert.equal(queue.drafts.length, 1);
  assert.equal(queue.drafts.some(row => row.source === 'v53'), false);
  assert.equal(queue.drafts[0].action, 'opReview');
  assert.equal(queue.drafts[0].status, '2 to decide');
  assert.equal(queue.clear, false);
});

test('provisional event count follows confirmation and date scope rather than publication', () => {
  const v = { sessions: [
    session({ id: 'conditional-empty', bookingsCount: 0, confirmOnFirstBooking: true, attendees: 0, assigned: 0 }),
    session({ id: 'conditional-booked', bookingsCount: 1, confirmOnFirstBooking: true }),
    session({ id: 'explicit-confirmed', bookingsCount: 0, confirmation: 'confirmed', attendees: 0, assigned: 0 }),
    session({ id: 'draft-confirmed', bookingsCount: 0, preliminary: true, confirmation: 'confirmed', attendees: 0, assigned: 0 }),
    session({ id: 'outside', date: '2026-10-22', bookingsCount: 0, confirmOnFirstBooking: true, attendees: 0, assigned: 0 }),
  ] };
  assert.equal(buildWorkQueue(v, {}, loaded, scope).provisional, 1);
  assert.equal(buildWorkQueue(v, {}, { v53: false, r7: true }, scope).provisional, 0);
});

test('r7 attention rows retain booking-specific navigation and are de-duplicated by source identity', () => {
  const row = { key: 'BK-88/climb', kind: 'private', booking: 'BK-88', title: 'Climbing party', reason: 'Instructor needed', date: '2026-10-20', start: '13:00', venueName: 'Riverside' };
  const queue = buildWorkQueue({}, { followUp: { eventAttention: { items: [row, row] } } }, loaded);
  assert.equal(queue.issues.length, 1);
  assert.equal(queue.issues[0].action, 'attention');
  assert.equal(queue.issues[0].family, 'private');
  assert.deepEqual(queue.issues[0].args, { key: 'BK-88/climb', kind: 'private', booking: 'BK-88' });
  assert.equal(queue.issues[0].venue, 'Riverside');
});

test('event attention without a coverage gap opens event decisions rather than resource assignment', () => {
  const v = { sessions: [
    session({ id: 'closed-space', status: 'attention', assigned: 12, detail: 'Lake Zone A is closed; choose another space' }),
    session({ id: 'waiting-decision', status: 'notassigned', assigned: 12, detail: 'Check the event requirements' }),
    session({ id: 'staff-gap', status: 'attention', assigned: 8 }),
    session({ id: 'covered', status: 'covered', assigned: 12 }),
    session({ id: 'draft-attention', preliminary: true, status: 'attention', assigned: 12 }),
  ] };
  const queue = buildWorkQueue(v, {}, loaded);
  assert.equal(queue.issues.length, 3);
  const closure = queue.issues.find(row => row.args.id === 'closed-space');
  assert.equal(closure.action, 'session');
  assert.equal(closure.actionLabel, 'Review event');
  assert.equal(closure.status, 'Needs a decision');
  assert.equal(closure.detail, 'Lake Zone A is closed; choose another space');
  assert.equal(queue.issues.find(row => row.args.id === 'waiting-decision').action, 'session');
  assert.equal(queue.issues.find(row => row.args.id === 'staff-gap').action, 'assign');
  assert.equal(queue.clear, false);
});

test('multi-day closure plans remain in the queue whenever their interval overlaps the chosen dates', () => {
  const r = { pending: { facilities: { cases: [
    facilityCase({ id: 'spans', date: '2026-10-18', endDate: '2026-10-23' }),
    facilityCase({ id: 'ends-on-first', date: '2026-10-18', endDate: '2026-10-20' }),
    facilityCase({ id: 'starts-on-last', date: '2026-10-21', endDate: '2026-10-23' }),
    facilityCase({ id: 'ends-before', date: '2026-10-18', endDate: '2026-10-19' }),
    facilityCase({ id: 'starts-after', date: '2026-10-22', endDate: '2026-10-23' }),
  ] } } };
  const queue = buildWorkQueue({}, r, loaded, scope);
  assert.deepEqual(new Set(queue.drafts.map(row => row.args.cid)), new Set(['spans', 'ends-on-first', 'starts-on-last']));
  assert.equal(queue.drafts.find(row => row.args.cid === 'spans').endDate, '2026-10-23');
});

test('facility follow-up colours use public session versus private booking metadata, not the presence of a booking id', () => {
  const r = { followUp: { facilities: { flags: [
    { id: 'guest-session', bookingId: 'GUEST-12', tone: 'session', text: 'Contact kayak guests', status: 'open' },
    { id: 'seasonal', bookingId: 'BK-31', tone: 'season', text: 'Review seasonal booking details', status: 'open' },
    { id: 'casual', bookingId: 'BK-32', tone: 'casual', text: 'Review casual booking payment', status: 'open' },
    { id: 'unclassified', bookingId: 'REF-33', text: 'Check a source record', status: 'open' },
  ] } } };
  const queue = buildWorkQueue({}, r, loaded);
  assert.equal(queue.followUps.find(row => row.args.id === 'guest-session').family, 'public');
  assert.equal(queue.followUps.find(row => row.args.id === 'seasonal').family, 'private');
  assert.equal(queue.followUps.find(row => row.args.id === 'casual').family, 'private');
  assert.equal(queue.followUps.find(row => row.args.id === 'unclassified').family, 'internal');
  assert.equal(queue.followUps.every(row => row.action === 'followUp'), true);
});

test('normalized follow-up family is authoritative over conflicting original kind and tone metadata', () => {
  const r = { followUp: {
    facilities: { flags: [
      { id: 'normalized-public', bookingId: 'BK-41', family: 'public', kind: 'private', tone: 'season', status: 'open' },
      { id: 'normalized-block', bookingId: 'BK-42', family: 'block', kind: 'public', tone: 'session', status: 'open' },
    ] },
    operations: { rows: [
      { id: 'normalized-private', bookingId: 'BK-43', family: 'private', kind: 'public' },
      { id: 'normalized-internal', bookingId: 'BK-44', family: 'internal', kind: 'private' },
    ] },
  } };
  const queue = buildWorkQueue({}, r, loaded);
  assert.equal(queue.followUps.find(row => row.args.id === 'normalized-public').family, 'public');
  assert.equal(queue.followUps.find(row => row.args.id === 'normalized-block').family, 'block');
  assert.equal(queue.followUps.find(row => row.args.id === 'normalized-private').family, 'private');
  assert.equal(queue.followUps.find(row => row.args.id === 'normalized-internal').family, 'internal');
});

test('booking arrays support the same first-booking confirmation rule as numeric counts', () => {
  assert.equal(model.publicEvent({ confirmOnFirstBooking: true, bookings: [] }).confirmation, 'provisional');
  const confirmed = model.publicEvent({ confirmOnFirstBooking: true, bookings: [{ id: 'guest-1' }] });
  assert.equal(confirmed.confirmation, 'confirmed');
  assert.equal(confirmed.bookings, 1);
});

test('attention occurrences deduplicate the same source and date against base snapshots without hiding later occurrences', () => {
  const v = {
    sessions: [session()],
    privates: [{ id: 'party-1', name: 'Team party', date: '2026-10-20', attention: true }],
    attentionOccurrences: [
      { sourceId: 'kayak-1', key: 'kayak-1@2026-10-20', iso: '2026-10-20', date: 'Tue 20 Oct', name: 'Kayak discovery', attendees: 12, assigned: 8 },
      { sourceId: 'party-1', key: 'party-1@2026-10-20', iso: '2026-10-20', date: 'Tue 20 Oct', name: 'Team party', private: true, reason: 'Space needed' },
      { sourceId: 'kayak-1', key: 'kayak-1@2026-10-21', iso: '2026-10-21', date: 'Wed 21 Oct', name: 'Kayak discovery', attendees: 12, assigned: 4 },
    ],
  };
  const queue = buildWorkQueue(v, {}, loaded);
  assert.equal(queue.issues.length, 3);
  assert.equal(queue.issues.filter(row => row.date === '2026-10-20').length, 2);
  assert.equal(queue.issues.filter(row => row.date === '2026-10-21').length, 1);
  assert.equal(queue.issues.some(row => row.id === 'v53-occurrence-kayak-1@2026-10-20'), false);
  assert.equal(queue.issues.some(row => row.id === 'v53-occurrence-party-1@2026-10-20'), false);
});

test('a dated extra public coverage gap routes to assignment of that exact occurrence', () => {
  const key = 'kayak-1@2026-10-22';
  const row = { sourceId: 'kayak-1', key, iso: '2026-10-22', name: 'Kayak discovery', time: '11:00', venue: 'Riverside', attendees: 12, assigned: 4 };
  const queue = buildWorkQueue({ attentionOccurrences: [row, row] }, {}, loaded);
  assert.equal(queue.issues.length, 1);
  assert.equal(queue.issues[0].family, 'public');
  assert.equal(queue.issues[0].action, 'bulkAssign');
  assert.deepEqual(queue.issues[0].args, { ids: [key] });
  assert.equal(queue.issues[0].date, '2026-10-22');
  assert.equal(queue.issues[0].detail, '8 guest places still need resource cover');
  assert.equal(queue.issues[0].status, 'Needs cover');
});

test('private attention occurrences retain their source booking and occurrence date for resolution', () => {
  for (const privateMetadata of [{ private: true }, { kind: 'private' }, { canonical: { family: 'private' } }]) {
    const item = { sourceId: 'party-1', key: 'party-1@2026-10-22', iso: '2026-10-22', date: 'Thu 22 Oct', name: 'Team party', reason: 'Choose a replacement space', ...privateMetadata };
    const queue = buildWorkQueue({ attentionOccurrences: [item] }, {}, loaded);
    assert.equal(queue.issues.length, 1);
    assert.equal(queue.issues[0].family, 'private');
    assert.equal(queue.issues[0].action, 'private');
    assert.deepEqual(queue.issues[0].args, { id: 'party-1', date: '2026-10-22' });
    assert.equal(queue.issues[0].detail, 'Choose a replacement space');
  }
});

test('extra occurrence scope uses ISO dates before display labels and includes both range boundaries', () => {
  const occurrence = (day, extra = {}) => ({ sourceId: 'kayak-1', key: `kayak-1@2026-10-${day}`, iso: `2026-10-${day}`, date: `Display label ${day} Oct`, name: 'Kayak discovery', attendees: 8, assigned: 0, ...extra });
  const v = { attentionOccurrences: [occurrence('19'), occurrence('20'), occurrence('21'), occurrence('22'), occurrence('20', { key: 'preliminary@2026-10-20', sourceId: 'preliminary', preliminary: true })] };
  const queue = buildWorkQueue(v, {}, loaded, scope);
  assert.deepEqual(queue.issues.map(row => row.date), ['2026-10-20', '2026-10-21']);
  assert.deepEqual(queue.issues.map(row => row.args.ids[0]), ['kayak-1@2026-10-20', 'kayak-1@2026-10-21']);
});

test('an uncovered future occurrence prevents all-clear even when the base event is covered', () => {
  const v = {
    sessions: [session({ assigned: 12, status: 'covered' })],
    attentionOccurrences: [{ sourceId: 'kayak-1', key: 'kayak-1@2026-10-25', iso: '2026-10-25', name: 'Kayak discovery', attendees: 12, assigned: 0 }],
  };
  const allDates = buildWorkQueue(v, {}, loaded);
  assert.equal(allDates.issues.length, 1);
  assert.equal(allDates.clear, false);
  const onlyBaseDate = buildWorkQueue(v, {}, loaded, { from: '2026-10-20', to: '2026-10-20' });
  assert.equal(onlyBaseDate.issues.length, 0);
  assert.equal(onlyBaseDate.clear, true);
});

test('dated public attention without a cover gap opens the exact occurrence for other decisions', () => {
  const queue = buildWorkQueue({ attentionOccurrences: [{ sourceId: 'kayak-1', key: 'kayak-1@2026-10-22', iso: '2026-10-22', name: 'Kayak discovery', attendees: 8, assigned: 8, detail: 'The space is closed' }] }, {}, loaded);
  assert.equal(queue.issues[0].action, 'session');
  assert.deepEqual(queue.issues[0].args, { id: 'kayak-1@2026-10-22', date: '2026-10-22' });
  assert.equal(queue.issues[0].detail, 'The space is closed');
  assert.equal(queue.issues[0].status, 'Needs a decision');
});

test('provisional count trusts canonical booking confirmation rather than recomputing from attendee totals', () => {
  const v = { sessions: [
    session({ id: 'planned-places-no-bookings', confirmOnFirstBooking: true, attendees: 12, assigned: 12, canonical: model.publicEvent({ confirmOnFirstBooking: true, bookingsCount: 0 }) }),
    session({ id: 'booked-before-attendee-sync', confirmOnFirstBooking: true, attendees: 0, assigned: 0, canonical: model.publicEvent({ confirmOnFirstBooking: true, bookingsCount: 1 }) }),
    session({ id: 'outside-range', date: '2026-10-22', attendees: 12, assigned: 12, canonical: model.publicEvent({ confirmOnFirstBooking: true, bookingsCount: 0 }) }),
  ] };
  assert.equal(buildWorkQueue(v, {}, loaded, scope).provisional, 1);
  assert.equal(buildWorkQueue(v, {}, loaded).provisional, 2);
});

test('native facility board validation failures block review even without an ok property', () => {
  const r = { pending: { facilities: { draftMoves: 2, boardCheck: { good: ['move-1'], fail: { 'move-2': 'The destination overlaps another booking' } } } } };
  const queue = buildWorkQueue({}, r, loaded);
  assert.equal(queue.drafts.length, 1);
  assert.equal(queue.drafts[0].action, 'boardReview');
  assert.equal(queue.drafts[0].blocked, true);
  assert.equal(queue.drafts[0].status, 'Blocked');
  assert.equal(queue.blocked, 1);
  assert.equal(queue.clear, false);
});

test('persistent resource cases retain resolved history and prevent all-clear while work is outstanding',()=>{
 const ready={v53:true,r7:true};
 const v={resourceOperations:{cases:[{id:'ru1',resource:'Hassan',reason:'Sick leave',from:'2026-08-24T09:00',to:'2026-08-26T18:00',outstanding:['s1@2026-08-24']}]}};
 const q=buildWorkQueue(v,{},ready);assert.equal(q.clear,false);assert.equal(q.openCases,1);assert.equal(q.cases[0].action,'resourceCase');assert.deepEqual(q.cases[0].args,{id:'ru1'});
 v.resourceOperations.cases[0].outstanding=[];const resolved=buildWorkQueue(v,{},ready);assert.equal(resolved.clear,true);assert.equal(resolved.cases.length,1);assert.equal(resolved.cases[0].status,'Resolved');
});
test('V53 financial and details follow-ups remain actionable until completed',()=>{
 const v={operations:{followUps:[{id:'f1',bookingRef:'BK-1',reason:'Waiver to collect',status:'open'},{id:'f2',bookingRef:'BK-2',reason:'Fee update',status:'completed'}]}};
 const q=buildWorkQueue(v,{}, {v53:true,r7:true});assert.equal(q.followUps.length,1);assert.equal(q.followUps[0].source,'v53');assert.equal(q.followUps[0].action,'bookingFollowUp');assert.deepEqual(q.followUps[0].args,{id:'f1'});
});
test('internal facility allocation tasks use authoritative public-family metadata and exact resume links',()=>{
 const r={facilityExtensions:{internalTasks:[{id:'t1',title:'Yoga replacement',status:'open',date:'2026-10-17'}]},workItems:[{id:'t1',family:'public'}]};
 const q=buildWorkQueue({},r,{v53:true,r7:true});assert.equal(q.issues[0].family,'public');assert.equal(q.issues[0].action,'internalTask');assert.deepEqual(q.issues[0].args,{id:'t1'});
});
