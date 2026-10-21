/* Additive guidance for the complete r7 prototype. No allocation rules are replaced. */
(function (root) {
  'use strict';
  if (root.OptimoR7Guide || !root.VIEWS || !root.ACT || !root.E || !root.O) return;

  var originalViews = Object.keys(root.VIEWS);
  var originalActions = Object.keys(root.ACT);
  var stages = ['Details', 'Affected work', 'Decisions', 'Review', 'Follow-up'];
  var meta = {
    board: ['Facilities', 'Details', 'Facility schedule', 'Inspect spaces, bookings, related parts, resources and pending moves.'],
    close: ['Facilities', 'Details', 'Define the disruption', 'Choose close or clear, affected spaces, the period and the reason.'],
    closures: ['Facilities', 'Affected work', 'Closure plans', 'Continue a case, inspect its progress or follow up after applying it.'],
    closure: ['Facilities', 'Affected work', 'Resolve affected bookings', 'Use list, calendar, week, comparison and guest tools to decide each affected booking.'],
    review: ['Facilities', 'Review', 'Review the closure plan', 'Check bookings, dependencies, prices, messages and work that remains after Apply.'],
    boardReview: ['Facilities', 'Review', 'Review schedule changes', 'Check the grouped changes and their consequences before applying them.'],
    after: ['Facilities', 'Follow-up', 'After applying the plan', 'Keep completed work separate from waiting decisions, money, details and other follow-ups.'],
    bm: ['Facilities', 'Follow-up', 'Booking follow-up', 'Finish the selected follow-up and return to its original plan.'],
    history: ['Facilities', 'Follow-up', 'Facility change history', 'Inspect previous changes and the actual availability of Undo.'],
    opReview: ['Operations', 'Review', 'Review the operations plan', 'Review event and resource changes together, including unresolved decisions and messages.'],
    opAfter: ['Operations', 'Follow-up', 'After applying the operations plan', 'See what was done, what needs Booking Manager and what still needs attention in Events.'],
    opBm: ['Operations', 'Follow-up', 'Booking follow-up', 'Complete the selected financial, details or customer-response follow-up.'],
    opHistory: ['Operations', 'Follow-up', 'Operations change history', 'Inspect event and resource changes, follow-ups and guarded Undo.'],
    evBoard: ['Events', 'Details', 'Event operations', 'Inspect public sessions, private bookings, preliminary work, held places and coverage.'],
    evAssign: ['Events', 'Decisions', 'Assign people and equipment', 'Choose quantities, check schedules and resolve takeovers, travel or manager overrides.'],
    evGuests: ['Events', 'Decisions', 'Move guest bookings', 'Choose whole guest bookings and suitable sessions; retain price and details decisions.'],
    evCopy: ['Events', 'Decisions', 'Copy a session', 'Choose a fit and what to copy, then check resources before adding it to the plan.'],
    evMove: ['Events', 'Decisions', 'Move a session', 'Find a suitable date, time and place, and explicitly handle resource swaps.'],
    evBulk: ['Events', 'Decisions', 'Move several items', 'Apply a common rule, inspect each result and retain exceptions.'],
    evPriv: ['Events', 'Decisions', 'Change a private booking', 'Keep related slots, guest details, resource swaps, holds and outcomes in view.'],
    rsBoard: ['Resources', 'Details', 'Resource operations', 'Inspect people, boats and pools, including internal, preliminary and unavailable work.'],
    rsPerson: ['Resources', 'Details', 'One resource’s week', 'Check existing work and availability before choosing an action.'],
    rsJobNew: ['Resources', 'Details', 'Define resource availability', 'Set the scope and reason before reviewing every dependent item.'],
    rsVenue: ['Resources', 'Details', 'Move to another venue', 'Review work left behind, work picked up, travel and partial-pool quantities.'],
    rsJob: ['Resources', 'Affected work', 'Resolve affected resource work', 'Use recommended or manual replacements, linked event decisions and calendar checks.'],
    rsShare: ['Resources', 'Decisions', 'Share workload', 'Choose the period and people, distribute selected work and inspect the result.']
  };

  function copy(value) {
    if (value == null) return value;
    try { return JSON.parse(JSON.stringify(value)); } catch (e) { return null; }
  }
  function call(api, name, args, fallback) {
    if (!api || typeof api[name] !== 'function') return fallback;
    try { var value = api[name].apply(api, args || []); return value == null ? fallback : value; }
    catch (e) { return fallback; }
  }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function failCount(check) { return check && check.fail ? Object.keys(check.fail).length : 0; }
  function ui() { return root.UI || {}; }
  function context() {
    var u = ui(), m = meta[u.view] || ['Workspace', 'Details', 'Task launchpad', 'Choose where to work or return to the task you were doing.'];
    var out = { area: m[0], stage: m[1], title: m[2], description: m[3], entity: '', view: u.view || null };
    if (u.view === 'closure' && u.closureMode && u.closureMode !== 'list') out.stage = 'Decisions';
    if (u.view === 'rsJob' && u.rsjMode === 'calendar') out.stage = 'Decisions';
    if (/^(closure|review|after)$/.test(u.view || '') && u.cid) out.entity = call(root.E, 'closureTitle', [root.ST, u.cid], '');
    if (/^ev/.test(u.view || '') && (u.evfSid || u.evmSid)) {
      var session = call(root.O, 'session', [root.OS, u.evmSid || u.evfSid], null);
      if (session) out.entity = call(root.O, 'sessionLong', [root.OS, session.id], session.name || session.label || '');
    }
    if (/^rs/.test(u.view || '') && u.rsjId) {
      var job = (root.OS && root.OS.jobs || []).find(function (item) { return item.id === u.rsjId; });
      if (job) out.entity = job.title || job.name || '';
    }
    return out;
  }
  function pending() {
    var st = root.ST, os = root.OS;
    var board = st ? call(root.E, 'boardPending', [st], null) : null;
    var boardCheck = board ? call(root.E, 'applyCheck', [st, 'board'], null) : null;
    var cases = (st && st.closures || []).filter(function (c) { return c.status === 'planning' || c.reopened; }).map(function (c) {
      var progress = call(root.E, 'progress', [st, c.id], { done: 0, total: 0 });
      var check = call(root.E, 'applyCheck', [st, c.id], null);
      return { id: c.id, title: call(root.E, 'closureTitle', [st, c.id], c.reason || 'Closure'), mode: c.mode, date: c.date, endDate: c.endDate || c.date, reason: c.reason || '', progress: progress, blocked: failCount(check), check: check, status: c.status };
    });
    var op = os ? call(root.O, 'pending', [os], { n: 0, decide: 0, lines: [] }) : { n: 0, decide: 0, lines: [] };
    var opCheck = os ? call(root.O, 'applyCheck', [os], null) : null;
    return {
      facilities: { board: board, boardCheck: boardCheck, cases: cases,
        draftMoves: board ? board.n : 0, decided: cases.reduce(function (n, c) { return n + c.progress.done; }, 0),
        toDecide: cases.reduce(function (n, c) { return n + Math.max(0, c.progress.total - c.progress.done); }, 0),
        blocked: failCount(boardCheck) + cases.reduce(function (n, c) { return n + c.blocked; }, 0) },
      operations: { draft: op, check: opCheck, blocked: failCount(opCheck), toDecide: op.decide || 0 }
    };
  }
  function model(family, record) {
    var api = root.OptimoBookingModel;
    if (api && typeof api[family === 'public' ? 'publicEvent' : family === 'private' ? 'privateBooking' : 'block'] === 'function') return api[family === 'public' ? 'publicEvent' : family === 'private' ? 'privateBooking' : 'block'](record || {});
    var r = record || {}, recurrence = r.series ? 'seasonal' : r.type === 'regular' ? 'regular' : 'casual';
    return { family: family, label: family === 'public' ? 'Public event' : family === 'private' ? 'Private booking' : 'Block', confirmation: /provisional|unconfirmed/.test(r.status || '') || family === 'block' && r.status === 'planning' ? 'provisional' : 'confirmed', recurrence: family === 'private' ? recurrence : null, publication: r.preliminary ? 'draft' : 'published', reason: family === 'block' ? r.reason || 'Closure' : null, tone: family };
  }
  function facilityFlag(record) {
    var booking = call(root.E, 'booking', [root.ST, record.bookingId], null), isPublic = !!(booking && (booking.session || booking.type === 'activity'));
    var concept = model(isPublic ? 'public' : 'private', Object.assign({}, booking || {}, { recurrence: booking && booking.series ? 'seasonal' : booking && booking.type }));
    return Object.assign({}, record, concept, { id: record.id, flagId: record.id, bookingId: record.bookingId, bookingName: booking && (booking.name || booking.hirer) || record.sub || '', title: record.name || booking && booking.name || record.bookingId, date: record.date || null, start: record.start || null, source: 'facility', route: { action: 'followUp', args: { kind: 'facility', id: record.id, bookingId: record.bookingId, cid: record.closureId, key: record.key } } });
  }
  function operationFlag(row) {
    var raw = (root.OS && root.OS.flags || []).find(function (flag) { return flag.id === (row.id || row.flag); }) || row;
    var bookingId = row.bookingId || row.booking || raw.booking, booking = call(root.O, 'booking', [root.OS, bookingId], null);
    var session = booking && booking.session ? call(root.O, 'session', [root.OS, booking.session], null) : call(root.O, 'session', [root.OS, raw.key], null);
    var slot = !session && raw.key ? call(root.O, 'slot', [root.OS, raw.key.indexOf('/') >= 0 ? raw.key : bookingId + '/' + raw.key], null) : null;
    var concept = model(session ? 'public' : 'private', Object.assign({}, booking || {}, { bookings: session ? (root.OS.bookings || []).filter(function (b) { return b.session === session.id; }).length : 1 }));
    return Object.assign({}, row, concept, { id: raw.id || row.flag, flagId: raw.id || row.flag, bookingId: bookingId, bookingName: booking && (booking.customer || booking.name) || row.name || '', title: row.name || booking && (booking.customer || booking.name) || bookingId, text: raw.text || row.text || '', key: raw.key, date: session && session.date || slot && slot.date || null, start: session && session.start || slot && slot.start || null, source: 'operations', route: { action: 'followUp', args: { kind: 'operations', id: raw.id || row.flag, bookingId: bookingId, key: raw.key } } });
  }
  function attentionItem(item) {
    var concept = model(item.kind === 'private' ? 'private' : 'public', item);
    return Object.assign({}, item, concept, { id: 'attention:' + item.key, title: item.title, reason: item.reason, kind: item.kind, route: { action: 'attention', args: { key: item.key, kind: item.kind, booking: item.booking } } });
  }
  function followUp() {
    var facilityFlags = root.ST ? call(root.E, 'flags', [root.ST], []) : [];
    var open = facilityFlags.filter(function (f) { return !f.status || f.status === 'open'; }).map(facilityFlag);
    var op = root.OS ? call(root.O, 'toFinish', [root.OS], { n: 0, rows: [] }) : { n: 0, rows: [] };
    op = Object.assign({}, op, { rows: (op.rows || []).map(operationFlag) });
    var attention = root.OS ? call(root.O, 'needs', [root.OS], { n: 0, items: [] }) : { n: 0, items: [] };
    attention = Object.assign({}, attention, { items: (attention.items || []).map(attentionItem) });
    return {
      facilities: { n: open.length, flags: open, needs: root.ST ? call(root.E, 'needs', [root.ST], null) : null },
      operations: op,
      eventAttention: attention
    };
  }
  function addDays(date, number) {
    return call(root.E, 'addDays', [date, number], date);
  }
  function facilityRecord(block, space, venue, date) {
    var st = root.ST, part = (st.parts || []).find(function (p) { return p.id === block.partId; });
    var hold = block.holdId && (st.holds || []).find(function (h) { return h.id === block.holdId; });
    var bookingId = part && part.booking || hold && hold.bookingId || (/^BK-/.test(block.key || '') ? String(block.key).split('@')[0] : null);
    var booking = bookingId ? call(root.E, 'booking', [st, bookingId], null) : null;
    var sessionId = part && part.session || (block.kind === 'session' || block.tone === 'session' ? block.key : null);
    var session = sessionId ? call(root.E, 'session', [st, sessionId], null) : null;
    var guestBookings = session ? (st.bookings || []).filter(function (b) { return b.session === sessionId && b.status !== 'notused'; }) : [];
    var seed = session ? Object.assign({}, session, { bookingsCount: guestBookings.length + (session.otherBookings || 0), attendees: guestBookings.reduce(function (n, b) { return n + (b.guests || b.attendees || 0); }, session.otherGuests || 0) }) : Object.assign({}, booking || {}, { recurrence: booking && booking.series ? 'seasonal' : booking && booking.type });
    if (block.kind === 'hold') seed.status = 'provisional';
    var concept = model(session ? 'public' : 'private', seed);
    return Object.assign({}, concept, {
      id: date + ':' + space.space + ':' + block.id, sourceId: block.id, key: block.key, kind: block.kind,
      title: session && session.label || booking && booking.name || block.out && block.out.title || block.title,
      partLabel: part && (part.part || part.label) || block.title, bookingId: bookingId, sessionId: sessionId,
      bookingsCount: session ? seed.bookingsCount : null, attendees: session ? seed.attendees : null,
      date: date, start: block.start, end: block.end, venueId: venue.id, venue: venue.name,
      spaceId: space.space, space: space.name, partId: block.partId || null,
      flag: block.flag || null, holdId: block.holdId || null, dropId: block.dropId || null,
      planState: block.kind === 'plan' ? 'planned' : block.kind === 'was' ? 'previous' : block.kind === 'hold' ? 'held' : 'live',
      stateLabel: block.kind === 'plan' ? 'Not applied yet' : block.kind === 'was' ? 'Previous position' : block.kind === 'hold' ? 'Held for an answer' : 'Live schedule',
      route: block.flag && block.kind === 'hold' ? { action: 'followUp', args: { kind: 'facility', id: block.flag.id } }
        : { action: 'facilityRecord', args: { partId: block.partId, date: date, dropId: block.dropId, kind: block.kind } }
    });
  }
  function schedule() {
    var st = root.ST, u = ui(), date = u.boardDate || st && st.meta.boardDate;
    if (!st || !date) return { date: date || null, period: 'day', display: 'calendar', from: null, to: null, records: [] };
    var period = u.boardMode === 'week' ? 'week' : 'day', end = addDays(date, period === 'week' ? 6 : 0), records = [];
    for (var at = date; at <= end; at = addDays(at, 1)) {
      var day = call(root.E, 'boardDay', [st, at, { venue: u.boardVenue || 'all', find: u.boardFind || '' }], null);
      (day && day.venues || []).forEach(function (venue) { (venue.rows || []).forEach(function (space) {
        (space.blocks || []).forEach(function (block) { records.push(facilityRecord(block, space, venue, at)); });
        (space.hatches || []).forEach(function (hatch, index) {
          var closure = (st.closures || []).find(function (c) { return c.mode === 'close' && c.spaces.indexOf(space.space) >= 0 && c.date <= at && (c.endDate || c.date) >= at && (hatch.kind === 'plan' ? c.status === 'planning' : c.status !== 'planning') && String(hatch.text || '').toLowerCase().indexOf(String(c.reason || '').toLowerCase()) >= 0; });
          var concept = model('block', closure || { status: hatch.kind === 'plan' ? 'planning' : 'applied', reason: hatch.text || 'Closure' });
          records.push(Object.assign({}, concept, { id: at + ':' + space.space + ':block:' + (closure && closure.id || index), kind: 'block', title: 'Block', date: at,
            start: hatch.from || day.axis.from, end: hatch.to || day.axis.to, venueId: venue.id, venue: venue.name, spaceId: space.space, space: space.name,
            cid: closure && closure.id || null, planState: hatch.kind === 'plan' ? 'planned' : 'live', stateLabel: hatch.kind === 'plan' ? 'Closure not applied yet' : 'Closed',
            route: closure ? { action: 'closureCase', args: { cid: closure.id } } : null }));
        });
      }); });
      if (addDays(at, 1) <= at) break;
    }
    records.sort(function (a, b) { return a.date.localeCompare(b.date) || a.start.localeCompare(b.start) || a.venue.localeCompare(b.venue) || a.space.localeCompare(b.space); });
    return { date: date, period: period, display: u.guideBoardDisplay === 'list' ? 'list' : 'calendar', from: date, to: end,
      venue: u.boardVenue || 'all', search: u.boardFind || '', records: records,
      dataFrom: st.meta.dataFrom, dataTo: st.meta.dataTo };
  }
  function workItems(follow, plans) {
    var list = [];
    (follow.eventAttention.items || []).forEach(function (item) { list.push(Object.assign({}, item, { source: 'r7', area: 'Events', status: 'Needs attention', description: item.reason })); });
    follow.facilities.flags.forEach(function (item) { list.push(Object.assign({}, item, { id: 'facility:' + item.id, source: 'r7', area: 'Facilities', status: 'To finish', description: item.text })); });
    follow.operations.rows.forEach(function (item) { list.push(Object.assign({}, item, { id: 'operations:' + item.id, source: 'r7', area: 'Operations', status: 'To finish', description: item.text })); });
    plans.facilities.cases.forEach(function (item) { list.push({ id: 'closure:' + item.id, source: 'r7', area: 'Facilities', family: item.mode === 'clear' ? 'internal' : 'block', mode: item.mode, title: item.title, date: item.date, endDate: item.endDate, reason: item.reason, status: item.blocked ? 'Blocked' : 'Plan in progress', description: Math.max(0, item.progress.total - item.progress.done) + ' bookings to decide', route: { action: 'closureCase', args: { cid: item.id } } }); });
    (root.OS && root.OS.jobs || []).filter(function (job) { return job.status !== 'applied'; }).forEach(function (job) {
      var detail = call(root.O, job.kind === 'share' ? 'shareView' : 'jobList', [root.OS, job.id], null);
      var resource = call(root.O, 'who', [root.OS, job.who], ''), fallback = [resource, job.reason || (job.kind === 'share' ? 'Share workload' : job.kind === 'venue' ? 'Move venue' : job.kind === 'handover' ? 'Hand over work' : 'Availability change')].filter(Boolean).join(' · ');
      list.push({ id: 'job:' + job.id, jobId: job.id, source: 'r7', area: 'Resources', title: job.title || detail && detail.title || job.name || fallback, date: job.when && job.when.date, endDate: job.when && (job.when.endDate || job.when.date), status: 'Plan in progress', description: job.whenText || detail && detail.sub || '', progress: detail && detail.progress || null, route: { action: 'resourceJob', args: { id: job.id } } });
    });
    return list;
  }
  function snapshot() {
    var u = ui(), ctx = context(), plans = pending(), follow = followUp();
    return copy({ view: u.view || null, org: u.orgId || null, title: ctx.title, context: ctx,
      pending: plans, followUp: follow, schedule: schedule(), workItems: workItems(follow, plans),
      counts: { originalViews: originalViews.length, originalActions: originalActions.length,
        views: Object.keys(root.VIEWS).length, actions: Object.keys(root.ACT).length,
        facilityEngineFunctions: Object.keys(root.E).length, operationsEngineFunctions: Object.keys(root.O).length },
      returnTo: u.guideReturnView ? { view: u.guideReturnView, org: u.guideReturnOrg } : null });
  }
  function button(text, action, args, cls) {
    return '<button type="button" class="r7g-button' + (cls ? ' ' + cls : '') + '" data-act="guideNav" data-route="' + esc(action) + '" data-args="' + esc(JSON.stringify(args || {})) + '" data-t="r7g-' + esc(action) + '">' + esc(text) + '</button>';
  }
  function nativeAction(name, args) {
    if (typeof root.ACT[name] !== 'function') return false;
    root.ACT[name](args || {});
    return true;
  }
  function operations(from) {
    if (ui().orgId !== 'rsg') nativeAction('nav', { view: from === 'resources' ? 'rsBoard' : 'evBoard', area: from === 'resources' ? 'resources' : 'events' });
  }
  function navigate(action, args) {
    args = args || {};
    if (!root.UI || !root.ST || !root.OS) return { ok: false, reason: 'The prototype is still loading.' };
    var u = root.UI, ok = true;
    switch (action) {
      case 'home':
        if (u.view !== 'guideHome') {
          u.guideReturnView = u.view; u.guideReturnOrg = u.orgId; u.guideReturnScope = {};
          Object.keys(u).forEach(function (key) { if (!/^guide/.test(key) && ['toast', 'modal', 'menu'].indexOf(key) < 0) u.guideReturnScope[key] = copy(u[key]); });
        }
        root.go('guideHome'); break;
      case 'resume':
        if (u.guideReturnView && root.VIEWS[u.guideReturnView]) root.go(u.guideReturnView, copy(u.guideReturnScope) || {});
        else ok = false;
        break;
      case 'facilities': nativeAction('nav', { view: 'board' }); break;
      case 'boardView':
        if (args.period === 'day' || args.period === 'week') nativeAction('bdMode', { mode: args.period });
        if (args.display === 'calendar' || args.display === 'list') u.guideBoardDisplay = args.display;
        if (args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date)) u.boardDate = args.date;
        if (u.view !== 'board') root.go('board');
        break;
      case 'facilityRecord':
        if (args.dropId || args.kind === 'plan') { root.go('boardReview'); break; }
        var part = (root.ST.parts || []).find(function (p) { return p.id === args.partId; });
        if (!part) { ok = false; break; }
        root.go('board', { boardDate: args.date || part.date, boardMode: 'day', boardVenue: 'all', boardFind: '', boardPop: 'part:' + part.id });
        break;
      case 'closures': nativeAction('nav', { view: 'closures' }); break;
      case 'facilityHistory': root.go('history'); break;
      case 'opEvents': nativeAction('nav', { view: 'evBoard', area: 'events' }); break;
      case 'opResources': nativeAction('nav', { view: 'rsBoard', area: 'resources' }); break;
      case 'opReview': operations(args.from || u.opFrom); nativeAction('opReview'); break;
      case 'opHistory': operations(args.from || u.opFrom); root.go('opHistory'); break;
      case 'attention':
        var target = call(root.O, 'session', [root.OS, args.key], null) || call(root.O, 'slot', [root.OS, args.key], null);
        if (!target) { ok = false; break; }
        root.go('evBoard', { opFrom: 'events', evbMode: 'day', evbDate: target.date, evbVenue: 'all', evbArea: 'all', evbType: 'all', evbOnly: 'all', evbFind: '', evbSel: args.key, evbAsk: null, evbPeek: null });
        break;
      case 'followUp':
        if (args.kind === 'facility') {
          var ff = call(root.E, 'flags', [root.ST], []).find(function (flag) { return flag.id === args.id; });
          if (!ff) { ok = false; break; }
          root.go('board', { boardDate: ff.date || u.boardDate, boardMode: 'day', boardVenue: 'all', boardFind: '', boardPop: 'flag:' + ff.id });
        } else {
          var of = (root.OS.flags || []).find(function (flag) { return flag.id === args.id && flag.status === 'open'; });
          var ob = of && call(root.O, 'booking', [root.OS, of.booking], null);
          if (!of || !ob) { ok = false; break; }
          operations(args.from || u.opFrom);
          nativeAction('opBmOpen', { id: ob.id });
          root.afterRender(function () { var node = document.querySelector('.scr-opbm [data-flag-id="' + String(of.id).replace(/"/g, '') + '"]'); if (node) { var row = node.closest('.bm-flag'); if (row) { row.classList.add('r7g-target'); row.scrollIntoView({ block: 'nearest' }); } } });
        }
        break;
      case 'resourceJob':
        var jobId = args.id || args.jobId, job = (root.OS.jobs || []).find(function (j) { return j.id === jobId; });
        if (!job) { ok = false; break; }
        root.go(job.kind === 'share' ? 'rsShare' : 'rsJob', { opFrom: 'resources', rsjId: job.id, rsjSel: args.key || null, rsjMode: args.mode === 'calendar' ? 'calendar' : 'list' });
        break;
      case 'closeSpace':
      case 'clearSpace':
        if (args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date)) u.boardDate = args.date;
        nativeAction('bdOpenClose', { mode: action === 'clearSpace' ? 'clear' : 'close' }); break;
      case 'boardReview': root.go('boardReview'); break;
      case 'closureCase':
        if (args.cid && call(root.E, 'closure', [root.ST, args.cid], null)) nativeAction('csOpen', { cid: args.cid });
        else ok = false;
        break;
      case 'closureReview':
        if ((args.cid || u.cid) && call(root.E, 'closure', [root.ST, args.cid || u.cid], null)) nativeAction('cuReview', { cid: args.cid || u.cid });
        else ok = false;
        break;
      default: ok = false;
    }
    if (!ok) return { ok: false, reason: 'That task needs a selected booking or plan.' };
    root.save(); root.render();
    return { ok: true, view: root.UI.view, org: root.UI.orgId };
  }
  function stat(number, label, tone) { return '<span class="r7g-stat' + (tone ? ' ' + tone : '') + '"><b>' + esc(number) + '</b> ' + esc(label) + '</span>'; }
  function contextHeader() {
    var s = snapshot(), p = s.pending, f = s.followUp, c = s.context, currentOps = /^(Events|Resources|Operations)$/.test(c.area);
    var summary = currentOps
      ? stat(p.operations.draft.n || 0, 'changes in plan') + stat(p.operations.toDecide, 'to decide') + (p.operations.blocked ? stat(p.operations.blocked, 'blocked', 'warn') : '') + stat(f.operations.n, 'to finish after Apply')
      : stat(p.facilities.draftMoves, 'board moves in plan') + stat(p.facilities.cases.length, 'active closure plans') + (p.facilities.toDecide ? stat(p.facilities.toDecide, 'bookings to decide') : '') + (p.facilities.blocked ? stat(p.facilities.blocked, 'blocked', 'warn') : '') + stat(f.facilities.n, 'to finish');
    var review = currentOps && p.operations.draft.n ? button('Review operations plan', 'opReview')
      : !currentOps && ui().cid && p.facilities.cases.some(function (x) { return x.id === ui().cid; }) ? button('Review this closure', 'closureReview', { cid: ui().cid })
      : !currentOps && p.facilities.draftMoves ? button('Review board changes', 'boardReview') : '';
    return '<section class="r7g-context" data-guide-view="' + esc(s.view) + '" aria-label="Task context"><div class="r7g-context-top"><div><div class="r7g-kicker">' + esc(c.area) + ' · ' + esc(c.stage) + '</div><h2>' + esc(c.title) + '</h2><p>' + esc(c.entity || c.description) + '</p></div><div class="r7g-context-actions">' + button(document.body.classList.contains('hybrid-embedded') ? 'More planning tools' : 'Task launchpad', 'home') + review + '</div></div><div class="r7g-summary" aria-label="Current plan state">' + summary + '</div></section>';
  }
  function conceptChips(record) {
    return '<span class="r7g-family ' + esc(record.family) + '">' + esc(record.label) + '</span>' +
      (record.recurrence ? '<span class="r7g-recurrence">' + esc(record.recurrence.charAt(0).toUpperCase() + record.recurrence.slice(1)) + '</span>' : '') +
      '<span class="r7g-confirmation ' + esc(record.confirmation) + '">' + (record.confirmation === 'provisional' ? 'Provisional' : 'Confirmed') + '</span>' +
      (record.publication === 'draft' ? '<span class="r7g-recurrence">Not published</span>' : '');
  }
  function conceptLegend() {
    return '<div class="r7g-booking-legend" aria-label="Booking colour and state legend">' +
      '<span><i class="public"></i>Public event</span><span><i class="private"></i>Private booking</span><span><i class="block"></i>Block · reason shown</span>' +
      '<span><i class="provisional"></i>Provisional</span><small>Casual, Regular and Seasonal describe recurrence. Confirmation is shown separately.</small></div>';
  }
  function facilityList(info) {
    var rows = info.records.map(function (record) {
      var action = record.route ? button(record.family === 'block' ? 'Open plan' : record.planState === 'planned' ? 'Review move' : 'Details', record.route.action, record.route.args) : '';
      var flags = record.flag ? button(record.flag.short || 'Follow up', 'followUp', { kind: 'facility', id: record.flag.id }, 'r7g-attention-button') : '';
      return '<tr data-t="r7g-record-' + esc(record.id) + '" data-family="' + esc(record.family) + '" data-confirmation="' + esc(record.confirmation) + '" data-recurrence="' + esc(record.recurrence || '') + '">' +
        '<td>' + esc(call(root.E, 'fd', [record.date], record.date)) + '</td><td><b>' + esc(record.start) + '–' + esc(record.end) + '</b></td>' +
        '<td><b>' + esc(record.title) + '</b><small>' + esc(record.family === 'block' ? record.reason : record.partLabel) + '</small><div class="r7g-record-concepts">' + conceptChips(record) + '</div></td>' +
        '<td>' + esc(record.space) + '<small>' + esc(record.venue) + '</small></td>' +
        '<td><span class="r7g-plan-state">' + esc(record.stateLabel) + '</span>' + (record.bookingsCount != null ? '<small>' + esc(record.bookingsCount) + ' guest bookings' + (record.attendees != null ? ' · ' + esc(record.attendees) + ' guests' : '') + '</small>' : '') + flags + '</td>' +
        '<td class="r7g-record-actions">' + (record.partId && record.planState !== 'planned' ? '<span data-t="blk-' + esc(record.partId) + '">' + action + '</span>' : action) + '</td></tr>';
    }).join('');
    return '<section class="r7g-schedule-list" aria-label="Facility ' + esc(info.period) + ' list" data-t="r7g-facility-list"><div class="r7g-list-caption"><b>' + (info.period === 'week' ? 'Week schedule' : 'Day schedule') + '</b><span>' + esc(info.from) + (info.to !== info.from ? ' to ' + esc(info.to) : '') + '</span></div>' +
      '<div class="r7g-list-scroll" data-keep-scroll="r7g-facility-list"><table><thead><tr><th scope="col">Date</th><th scope="col">Time</th><th scope="col">Booking / block · family, recurrence and confirmation</th><th scope="col">Space / venue</th><th scope="col">Planning and follow-up</th><th scope="col">Action</th></tr></thead><tbody>' +
      (rows || '<tr><td colspan="6" class="r7g-list-empty">No scheduled bookings or blocks match this period and filter.</td></tr>') + '</tbody></table></div>' + conceptLegend() + '</section>';
  }
  function annotateConcept(node, record) {
    if (!node || !record) return;
    node.classList.add('r7g-booking');
    node.setAttribute('data-family', record.family);
    node.setAttribute('data-confirmation', record.confirmation);
    node.setAttribute('data-recurrence', record.recurrence || '');
    node.setAttribute('title', [node.getAttribute('title'), record.title, record.label, record.recurrence, record.confirmation, record.reason, record.stateLabel].filter(Boolean).join(' · '));
  }
  function adaptBoard(html) {
    var holder = document.createElement('div'); holder.innerHTML = html;
    var scr = holder.querySelector('.scr-board'); if (!scr) return html;
    var info = schedule(), nativePeriod = scr.querySelector('.tbar [data-act="bdMode"]');
    if (nativePeriod) {
      var seg = nativePeriod.closest('.seg'), fieldset = document.createElement('fieldset');
      fieldset.className = 'r7g-view-group'; fieldset.setAttribute('data-t', 'r7g-period-controls');
      fieldset.innerHTML = '<legend>Period</legend>';
      seg.parentNode.insertBefore(fieldset, seg); fieldset.appendChild(seg);
      seg.querySelectorAll('[data-act="bdMode"]').forEach(function (item) { item.setAttribute('data-guide-t', 'r7g-period-' + item.getAttribute('data-mode')); });
      var display = document.createElement('fieldset'); display.className = 'r7g-view-group'; display.setAttribute('data-t', 'r7g-display-controls');
      display.innerHTML = '<legend>Display</legend><div class="seg" role="group" aria-label="Schedule display">' + ['calendar', 'list'].map(function (mode) {
        return button(mode === 'calendar' ? 'Calendar' : 'List', 'boardView', { display: mode }).replace('data-t="r7g-boardView"', 'data-t="r7g-display-' + mode + '" aria-pressed="' + (info.display === mode) + '"');
      }).join('') + '</div>';
      fieldset.parentNode.insertBefore(display, fieldset.nextSibling);
    }
    if (info.display === 'list') { var wrap = scr.querySelector('.bwrap'); if (wrap) wrap.innerHTML = facilityList(info); }
    else {
      info.records.forEach(function (record) {
        var nodes;
        if (record.family === 'block') nodes = scr.querySelectorAll('[data-t="hatch-' + record.spaceId + '"]');
        else if (record.kind === 'plan') nodes = scr.querySelectorAll('[data-t="drop-' + record.dropId + '"]');
        else if (record.kind === 'hold') nodes = scr.querySelectorAll('[data-t="hold-' + record.holdId + '"]');
        else nodes = scr.querySelectorAll('[data-part="' + record.partId + '"]');
        nodes.forEach(function (node) { if (record.family !== 'block' || node.textContent.toLowerCase().indexOf(String(record.reason || '').toLowerCase()) >= 0) annotateConcept(node, record); });
      });
      if (info.period === 'week') {
        var week = call(root.E, 'boardWeek', [root.ST, info.date, { venue: info.venue }], null);
        (week && week.venues || []).forEach(function (venue) { venue.rows.forEach(function (row) { row.cells.forEach(function (cell) {
          var node = scr.querySelector('[data-t="wk-cell-' + row.space + '-' + cell.date + '"]'); if (!node) return;
          var chipNodes = node.querySelectorAll('.wchip');
          (cell.chips || []).forEach(function (chip, index) {
            var record = info.records.find(function (record) { return record.partId === chip.partId && record.date === cell.date && record.spaceId === row.space && (chip.drop ? record.kind === 'plan' : record.kind !== 'plan'); });
            if (record) annotateConcept(chipNodes[index], record);
          });
          if (cell.closed && !cell.noData) annotateConcept(node, info.records.find(function (record) { return record.family === 'block' && record.date === cell.date && record.spaceId === row.space; }));
        }); }); });
      }
      scr.querySelectorAll('.cal>.legend').forEach(function (legend) { legend.outerHTML = conceptLegend(); });
    }
    var partPop = scr.querySelector('[data-t="part-pop"]'), partId = String(ui().boardPop || '').indexOf('part:') === 0 ? String(ui().boardPop).slice(5) : '';
    if (partPop && partId) {
      var selected = info.records.find(function (record) { return record.partId === partId; });
      if (selected) { var typePill = partPop.querySelector('.pm .pill'); if (typePill) typePill.outerHTML = '<span class="r7g-record-concepts">' + conceptChips(selected) + '</span>'; }
    }
    return holder.innerHTML;
  }
  function operationConcept(key) {
    var session = call(root.O, 'session', [root.OS, key], null);
    if (session) return model('public', Object.assign({}, session, { bookingsCount: (root.OS.bookings || []).filter(function (b) { return b.session === session.id && b.status !== 'notused'; }).length }));
    var slot = call(root.O, 'slot', [root.OS, key], null), booking = slot && call(root.O, 'booking', [root.OS, String(key).split('/')[0]], null);
    if (booking) return model('private', booking);
    var hold = (root.OS.holds || []).find(function (hold) { return key === 'hold-' + hold.id; });
    if (hold) { var heldBooking = call(root.O, 'booking', [root.OS, hold.booking], null); return model(heldBooking && heldBooking.session ? 'public' : 'private', Object.assign({}, heldBooking || {}, { status: 'provisional', confirmation: 'provisional', provisional: true, bookingsCount: 0 })); }
    return null;
  }
  function adaptSemantics(html) {
    var holder = document.createElement('div'); holder.innerHTML = html;
    var st = root.ST, os = root.OS, byHook = {};
    (os.sessions || []).forEach(function (s) { byHook[s.id] = s.id; });
    (os.privates || []).forEach(function (b) { (b.slots || []).forEach(function (slot) { var key = b.id + '/' + slot.key; byHook[key.replace(/\//g, '-')] = key; }); });
    (os.holds || []).forEach(function (hold) { byHook['hold-' + hold.id] = 'hold-' + hold.id; });
    holder.querySelectorAll('.evb-blk[data-key],.evb-chip[data-key],.rs-b[data-key],.rsj-b[data-key],.fc-ghost[data-key]').forEach(function (node) {
      var concept = operationConcept(node.getAttribute('data-key')); if (concept) annotateConcept(node, concept);
    });
    holder.querySelectorAll('[data-t^="ev-fc-blk-"],.evb-blk.held[data-t],.rs-b.held[data-t]').forEach(function (node) {
      var hook = node.getAttribute('data-t'), key = hook.indexOf('ev-fc-blk-') === 0 ? byHook[hook.slice(10)] : Object.keys(byHook).find(function (key) { return key.indexOf('hold-') === 0 && hook.slice(-key.length) === key; });
      var concept = key && operationConcept(byHook[key] || key); if (concept) annotateConcept(node, concept);
    });
    holder.querySelectorAll('[data-t^="cblk-"]').forEach(function (node) {
      var part = (st.parts || []).find(function (part) { return 'cblk-' + part.id === node.getAttribute('data-t'); });
      if (!part) return;
      var booking = part.booking ? call(root.E, 'booking', [st, part.booking], null) : null, session = part.session ? call(root.E, 'session', [st, part.session], null) : null;
      annotateConcept(node, model(session ? 'public' : 'private', Object.assign({}, session || booking || {}, { recurrence: booking && booking.series ? 'seasonal' : booking && booking.type })));
    });
    holder.querySelectorAll('.pill.session,.tp.session,.pill.season,.tp.season,.pill.casual,.tp.casual').forEach(function (node) {
      if (node.classList.contains('r7g-family')) return;
      var isPublic = node.classList.contains('session'), parent = node.closest('[data-key]'), key = parent && parent.getAttribute('data-key');
      var booking = !isPublic && key ? call(root.E, 'booking', [st, key.split('@')[0]], null) : null;
      var concept = model(isPublic ? 'public' : 'private', Object.assign({}, booking || {}, { recurrence: booking && booking.series ? 'seasonal' : booking && booking.type || (node.classList.contains('season') ? 'regular' : 'casual') }));
      node.textContent = concept.label + (concept.recurrence ? ' · ' + concept.recurrence.charAt(0).toUpperCase() + concept.recurrence.slice(1) : '');
      node.setAttribute('data-family', concept.family); node.classList.add('r7g-type');
    });
    // These are native type labels, not generic information or warning badges.
    holder.querySelectorAll('.evf-pn-ti>.pill,.scr-opbm .bm-h>.pill').forEach(function (node) {
      if (/^Public session(?: booking)?$/.test(node.textContent.trim())) { node.textContent = 'Public event'; node.classList.add('r7g-type'); node.setAttribute('data-family', 'public'); }
      else if (node.textContent.trim() === 'Private booking') { node.classList.add('r7g-type'); node.setAttribute('data-family', 'private'); }
    });
    holder.querySelectorAll('.cal .legend>span').forEach(function (node) {
      var swatch = node.querySelector('i'); if (!swatch) return;
      var label = swatch.classList.contains('session') ? 'Public event' : swatch.classList.contains('season') ? 'Private booking · Regular / Seasonal' : swatch.classList.contains('casual') ? 'Private booking · Casual' : null;
      if (label) { Array.from(node.childNodes).forEach(function (child) { if (child !== swatch) child.remove(); }); node.appendChild(document.createTextNode(label)); }
    });
    return holder.innerHTML;
  }
  function homeHtml() {
    var s = snapshot(), p = s.pending, f = s.followUp;
    return '<div class="r7g-home"><div class="r7g-home-heading"><div class="r7g-kicker">OPERATIONS, TOGETHER</div><h1>What needs to happen next?</h1><p>Start with a task. The full calendars, comparison tools, decisions and plan review stay available as you work.</p>' +
      (s.returnTo ? button('Continue previous task', 'resume', {}, 'primary') : '') + '</div>' +
      '<div class="r7g-home-grid"><section class="r7g-home-card"><div class="r7g-kicker">FACILITIES</div><h2>Spaces and booking changes</h2><p>See availability, move related parts and manage disruptions across spaces and dates.</p><div class="r7g-summary">' + stat(p.facilities.draftMoves, 'board moves') + stat(p.facilities.cases.length, 'active cases') + stat(p.facilities.toDecide, 'to decide') + stat(p.facilities.blocked, 'blocked') + stat(f.facilities.n, 'to finish') + '</div><div class="r7g-task-buttons">' + button('Open facility schedule', 'facilities', {}, 'primary') + button('Close a space', 'closeSpace') + button('Move bookings out; keep space open', 'clearSpace') + button('Continue closure plans', 'closures') + (p.facilities.draftMoves ? button('Review board changes', 'boardReview') : '') + button('Facility history and follow-ups', 'facilityHistory') + '</div>' +
      (p.facilities.cases.length ? '<div class="r7g-case-list"><h3>Plans in progress</h3>' + p.facilities.cases.map(function (c) { return '<div><span><b>' + esc(c.title) + '</b><small>' + esc(c.progress.done) + ' of ' + esc(c.progress.total) + ' decided' + (c.blocked ? ' · ' + esc(c.blocked) + ' blocked' : '') + '</small></span>' + button('Continue', 'closureCase', { cid: c.id }) + '</div>'; }).join('') + '</div>' : '') + '</section>' +
      '<section class="r7g-home-card"><div class="r7g-kicker">EVENTS & RESOURCES</div><h2>Experiences and their cover</h2><p>Manage public sessions, private bookings, people, boats and pools without losing linked work.</p><div class="r7g-summary">' + stat(f.eventAttention.n || 0, 'need attention') + stat(p.operations.draft.n || 0, 'changes in plan') + stat(p.operations.toDecide, 'to decide') + stat(p.operations.blocked, 'blocked') + stat(f.operations.n, 'to finish') + '</div><div class="r7g-task-buttons">' + button('Open event operations', 'opEvents', {}, 'primary') + button('Open resource operations', 'opResources') + (p.operations.draft.n ? button('Review operations plan', 'opReview') : '') + button('Operations history and follow-ups', 'opHistory') + '</div><div class="r7g-workflow-note"><h3>The detailed tools stay in context</h3><p>Select a session for assignments, guest moves, copy, move or bulk changes. Select a resource for absence, handover, workload sharing or venue moves. Decisions join the shared operations plan.</p></div></section></div>' +
      '<details class="r7g-help"><summary>How this prototype is organised</summary><p>Facilities uses the council example; Events and Resources use the resort example. They are separate organisations and datasets in the original r7 prototype. Navigation retains that boundary and does not pretend to synchronise their allocations.</p><p>Draft decisions, blocked changes, applied work, waiting customer responses and post-Apply follow-ups remain distinct. Booking Manager and message delivery are prototype stand-ins; their full decision and follow-up screens remain available.</p></details></div>';
  }
  function viewCatalog() {
    return originalViews.map(function (name) { var m = meta[name] || []; return { id: name, title: m[2] || name, group: m[0] || 'Workspace', stage: m[1] || 'Details', description: m[3] || '', native: true }; });
  }
  function workflowCatalog() {
    return [
      ['facilities', 'Facility schedule', 'Facilities', 'Day/week availability, linked bookings and drag planning.'],
      ['closeSpace', 'Close one or more spaces', 'Facilities', 'All-day, part-day and multi-day disruption planning.'],
      ['clearSpace', 'Move bookings out', 'Facilities', 'Clear the chosen spaces while keeping them open.'],
      ['closures', 'Continue a closure plan', 'Facilities', 'Review impact and decide every affected booking.'],
      ['facilityHistory', 'Facility history and follow-up', 'Facilities', 'Applied changes, waiting answers, fees, credits, details and Undo.'],
      ['opEvents', 'Event operations', 'Events', 'Assignments, guest moves, copying, rescheduling and bulk decisions.'],
      ['opResources', 'Resource operations', 'Resources', 'Availability, handovers, workload sharing, boats, pools and venue moves.'],
      ['opReview', 'Review operations plan', 'Operations', 'Inspect all staged event and resource decisions before applying.'],
      ['opHistory', 'Operations history and follow-up', 'Operations', 'Applied work, remaining issues, customer responses and Undo.']
    ].map(function (r) { return { id: r[0], title: r[1], group: r[2], description: r[3] }; });
  }

  root.UI_DEFAULTS.guideReturnView = null;
  root.UI_DEFAULTS.guideReturnOrg = null;
  root.UI_DEFAULTS.guideReturnScope = null;
  root.UI_DEFAULTS.guideBoardDisplay = 'calendar';
  root.NAV_OF.guideHome = 'today';
  root.TITLES.guideHome = function () { return ['Today']; };
  root.FRAME_NO.guideHome = function () { return null; };
  root.VIEWS.guideHome = homeHtml;
  var nativeBoardView = root.VIEWS.board;
  root.VIEWS.board = function () { return adaptBoard(nativeBoardView()); };
  root.ACT.guideNav = function (data) {
    var args = {};
    try { args = JSON.parse(data.args || '{}'); } catch (e) { /* use empty args */ }
    navigate(data.route, args);
    return false;
  };
  // Keep an explicitly invalid typed credit from falling back to the engine's stored amount.
  var nativeCreditFinish = root.ACT.opBmFinish;
  root.ACT.opBmFinish = function (data, el, event) {
    var flag = data && (root.OS.flags || []).find(function (flag) { return flag.id === data.flagId; });
    var typed = data && ui().opBmAmt ? ui().opBmAmt[data.flagId] : undefined;
    if (flag && flag.kind === 'credit' && typed !== undefined && (String(typed).trim() === '' || !isFinite(Number(typed)) || Number(typed) < 0)) {
      root.toast('Enter a credit of 0 or more.', null, null, { tone: 'warn' });
      return;
    }
    return nativeCreditFinish(data, el, event);
  };

  var nativeSide = root.coreSide;
  root.coreSide = function () {
    return nativeSide().replace(/<div\b[^>]*data-t="nav-today"[^>]*>Today<\/div>/, '<button type="button" class="it go' + (ui().view === 'guideHome' ? ' on' : '') + '" data-act="guideNav" data-route="home" data-t="nav-today"' + (ui().view === 'guideHome' ? ' aria-current="page"' : '') + '>Today</button>');
  };
  var nativeViewHtml = root.coreViewHtml;
  root.coreViewHtml = function () { var html = nativeViewHtml(); return ui().view === 'guideHome' ? html : contextHeader() + adaptSemantics(html); };
  // The launchpad belongs to the current scope; all native routes keep the original organisation-following rule.
  var nativeOrgFollow = root.coreOrgFollow;
  root.coreOrgFollow = function () { if (ui().view !== 'guideHome') return nativeOrgFollow(); };

  root.OptimoR7Guide = { snapshot: snapshot, navigate: navigate, stages: stages.slice() };
  Object.defineProperty(root.OptimoR7Guide, 'viewCatalog', { enumerable: true, get: viewCatalog });
  Object.defineProperty(root.OptimoR7Guide, 'workflowCatalog', { enumerable: true, get: workflowCatalog });
  if (root.coreBooted && root.UI) root.render();
})(window);
