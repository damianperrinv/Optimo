/* Facilities additions. The original r7 source remains intact; all moves use its allocation checks. */
(function (w) {
  'use strict';
  if (!w.E || !w.VIEWS || w.OptimoR7Extensions) return;
  var E = w.E, native = {}, uid = 0;
  ['apply','undo','boardDrop','boardUndoDrop','boardTakeOut','dropAsk','setPick','addToPlan','setGuest','card','guestCard','review','message','restore','expire','finishFlag','after','closuresList','bmView','leftList','listRows','guestList','laterLines'].forEach(function (name) { native[name] = E[name]; });
  var productionContract = {
    operation: 'Move a public event session to another facility',
    prototype: 'Allocation changes are applied locally. Target facility timeslot and package records are explicitly simulated in the operation ledger.',
    transaction: ['Validate target facility, resource availability, capacity and permission again on the server.', 'Create or reuse the target facility timeslot for the event date and time.', 'Create a replacement package version containing the target facility allocation and the existing resource items.', 'Preserve the original package and booking prices; transfer every guest booking and allocation atomically.', 'Record questionnaire/waiver differences for Booking Manager and publish the audit event.', 'Retire unused source allocations only after the transaction commits; support idempotency and rollback.']
  };
  function cp(o) { return o == null ? o : JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function meta(st) { return st.optimoExtensions || (st.optimoExtensions = {version:1,pendingMoves:[],publicOperations:[],internalTasks:[],choices:{},notifications:[],communication:{}}); }
  function permissions() { return w.OptimoPermissions || (w.OptimoPermissions = {keepPrice:true}); }
  function allowed() { return permissions().keepPrice !== false; }
  function part(st,id) { return (st.parts || []).find(function (p) { return p.id === id; }); }
  function key(p) { return p.session || p.booking + '@' + p.date0; }
  function booking(st,k) { return E.booking(st,String(k || '').split('@')[0]); }
  function fixedSeasonal(st,k,billing) {var b=booking(st,k);return billing==='seasonal' && !!(b && (b.series || b.billing==='seasonal' || b.priceBasis==='seasonal'));}
  function mins(t) { var a=String(t).split(':'); return (+a[0])*60+(+a[1]); }
  function time(m) { return String(Math.floor(m/60)).padStart(2,'0')+':'+String(m%60).padStart(2,'0'); }
  function dayDelta(a,b) { return Math.round((Date.parse(a+'T12:00:00Z')-Date.parse(b+'T12:00:00Z'))/86400000); }
  function overlap(a,b) { return a.date === b.date && mins(a.start)<mins(b.end) && mins(b.start)<mins(a.end); }
  function stamp(st) { return E.now(st).iso; }
  function audit(action,entity,before,after,scope,outcome) {
    var api=w.OptimoAudit;
    if (!api) { try { api=w.parent && w.parent.OptimoAudit; } catch (_) {} }
    if (api && typeof api.record === 'function') api.record({area:'Facilities',action:action,entity:entity,before:cp(before),after:cp(after),scope:cp(scope),outcome:outcome || 'applied'});
  }
  function cloneState(st) { var s=cp(st); E.touch(s); return s; }
  function active(p) { return !p.status; }
  function choice(st,cid,k) {
    var x=meta(st), id=cid+'|'+k, b=booking(st,k), p=st.plans[cid] && (st.plans[cid].picks[k] || st.plans[cid].entries[k]);
    var base={price:b && b.series?'keep':p && p.price || 'charge',billing:b && b.series?'seasonal':'perOccurrence',notify:!!x.communication[cid],questionnaire:false,waiver:false,linkedUse:{}};
    return Object.assign(base,x.choices[id] || {});
  }
  function setChoice(cid,k,patch) {
    var st=w.ST, x=meta(st), id=cid+'|'+k, current=choice(st,cid,k);
    if(patch.billing==='seasonal' && !fixedSeasonal(st,k,'seasonal'))return {ok:false,reason:'This booking does not have fixed seasonal billing.'};
    if (patch.price === 'keep' && !allowed() && !fixedSeasonal(st,k,current.billing)) return {ok:false,reason:'Your user right does not permit keeping the original price.'};
    var priorUse=cp(current.linkedUse);
    x.choices[id]=Object.assign(current,cp(patch || {}));
    if (patch.linkedUse) x.choices[id].linkedUse=Object.assign({},priorUse,patch.linkedUse);
    if (patch.price && st.plans[cid] && st.plans[cid].picks[k]) native.setPick(st,cid,k,{price:patch.price});
    E.touch(st); return {ok:true,choice:cp(x.choices[id])};
  }
  function selected(st,input,anchor) {
    var spaces=(st.parts || []).filter(function (p) { return p.kind==='space' && active(p); });
    if (anchor.session) return [anchor];
    var same=spaces.filter(function (p) { return p.booking===anchor.booking; });
    if (input.scope==='day') return same.filter(function (p) { return p.date0===anchor.date0; });
    if (input.scope==='linked') return same.filter(function (p) { return (input.partIds || [anchor.id]).indexOf(p.id)>=0; });
    if (input.scope==='dates' || input.scope==='series') return same.filter(function (p) { return p.key===anchor.key && (input.scope==='series'?p.date0>=anchor.date0:p.date0>=(input.from || anchor.date0) && p.date0<=(input.to || anchor.date0)); });
    return [anchor];
  }
  function previewMove(input,source) {
    var st=source || w.ST, anchor=part(st,input && input.partId), target=input && input.target;
    if (!anchor || anchor.kind!=='space' || !active(anchor)) return {ok:false,reason:'Select a live facility allocation.'};
    if (!target || !E.space(st,target.space) || !/^\d{4}-\d{2}-\d{2}$/.test(target.date || '') || !Number.isFinite(Date.parse(target.date+'T12:00:00Z')) || new Date(target.date+'T12:00:00Z').toISOString().slice(0,10)!==target.date || !/^\d{2}:\d{2}$/.test(target.start || '') || +target.start.slice(0,2)>23 || +target.start.slice(3)>59) return {ok:false,reason:'Choose a valid facility, date and start time.'};
    var config=Object.assign({scope:'occurrence',price:'keep',billing:booking(st,key(anchor)) && booking(st,key(anchor)).series?'seasonal':'perOccurrence',notify:false},cp(input));
    if(config.billing==='seasonal' && !fixedSeasonal(st,key(anchor),'seasonal'))return {ok:false,reason:'This booking does not have fixed seasonal billing.'};
    if (!anchor.session && config.price==='keep' && !allowed() && !fixedSeasonal(st,key(anchor),config.billing)) return {ok:false,reason:'Keeping the original price requires the Keep price user right. Choose Update price.'};
    var sel=selected(st,config,anchor);
    if (!sel.length || !sel.some(function (p) { return p.id===anchor.id; })) return {ok:false,reason:'Include the selected allocation in the move scope.'};
    var clone=cloneState(st), oldIds=clone.boardPlan.drops.map(function (d) { return d.id; }), delta=dayDelta(target.date,anchor.date), shift=mins(target.start)-mins(anchor.start), warnings=[], rows=[], prices={}, failure;
    sel.sort(function (a,b) { return a.date.localeCompare(b.date) || a.start.localeCompare(b.start); }).forEach(function (p) {
      if (failure) return;
      var next={space:p.res===anchor.res?target.space:p.res,date:E.addDays(p.date,delta),start:time(mins(p.start)+shift)};
      if (next.date<st.meta.dataFrom || next.date>st.meta.dataTo) { failure='The selected dates extend beyond this prototype’s loaded schedule ('+E.fd(st.meta.dataFrom)+' to '+E.fd(st.meta.dataTo)+').'; return; }
      if (mins(p.start)+shift<0 || mins(p.end)+shift>1440) { failure='The time shift would move an allocation outside its calendar day.'; return; }
      var chk=E.dragCheck(clone,p.id,next);
      if (!chk.ok) { failure=(E.fd(next.date)+': '+(chk.reason || chk.tip || 'This placement is not available.')); return; }
      if (chk.tone==='warn' && chk.tip) warnings.push(chk.tip);
      var result=native.boardDrop(clone,p.id,next,{others:'one',series:'one',price:config.price});
      if (!result || !result.ok) { failure=result && result.reason || 'The placement could not be staged.'; return; }
      rows.push({partId:p.id,title:p.label || p.part,key:key(p),kind:p.session?'public':'private',before:{space:p.res,date:p.date,start:p.start,end:p.end},after:{space:next.space,date:next.date,start:chk.start || next.start,end:chk.end}});
    });
    if (failure) return {ok:false,reason:failure};
    var drops=clone.boardPlan.drops.filter(function (d) { return oldIds.indexOf(d.id)<0; });
    if (!drops.length) return {ok:false,reason:'Choose a different date, time or facility to create a move.'};
    var moves=drops.flatMap(function (d) { return d.moves; });
    Array.from(new Set(rows.map(function (r) { return r.key; }))).forEach(function (k) { prices[k]=E.bookingPrice(st,k,moves); });
    var isPublic=!!anchor.session, session=isPublic?E.session(st,anchor.session):null, ev=session?E.event(st,session.event):null, sourceBooking=booking(st,key(anchor));
    if(config.scope==='series' && sourceBooking && sourceBooking.series && sourceBooking.series.to>st.meta.dataTo)warnings.push('The loaded series dates are shown below. Dates after '+E.fd(st.meta.dataTo)+' remain a Season update follow-up in Booking Manager.');
    return {ok:true,partId:anchor.id,scope:config.scope,config:config,rows:rows,moves:moves,drops:drops,prices:prices,warnings:Array.from(new Set(warnings)),resourceMoves:moves.filter(function (m) { return !!m.res; }),publicOperation:isPublic?{sessionId:session.id,eventId:session.event,sourceFacility:anchor.res,targetFacility:target.space,date:target.date,start:target.start,end:time(mins(target.start)+mins(anchor.end)-mins(anchor.start)),pricePerGuest:ev && ev.pricePerGuest,guestBookingIds:st.bookings.filter(function (b) { return b.session===session.id; }).map(function (b) { return b.id; }),facilityTimeslot:'Create or reuse target facility timeslot',package:'Create replacement package version; preserve guest prices',status:'preview'}:null,_state:clone};
  }
  function stageMove(input) {
    var st=w.ST, result=previewMove(input,st); if (!result.ok) return result;
    var id='fm-'+Date.now().toString(36)+'-'+(++uid), x=meta(st), before=cp(st.boardPlan.drops);
    result.drops.forEach(function (d) { d.optimoMoveId=id; });
    st.boardPlan.drops=result._state.boardPlan.drops; st.seq=result._state.seq;
    x.pendingMoves.push({id:id,dropIds:result.drops.map(function (d) { return d.id; }),config:cp(result.config),rows:cp(result.rows),publicOperation:cp(result.publicOperation),status:'draft',at:stamp(st)});
    E.touch(st); audit('Stage facility move',result.rows[0].title,before,result.rows,{scope:result.scope,dates:result.rows.map(function (r) { return r.after.date; })},'draft');
    var clean=cp(result); delete clean._state; return Object.assign(clean,{id:id});
  }
  function normalizeLater(st,cid) {
    var p=st.plans[cid]; if (!p) return;
    [p.entries,p.picks].forEach(function (dict) { Object.keys(dict || {}).forEach(function (k) { var d=dict[k]; if (d.outcome==='later') d.later=Object.assign({},d.later || {},{ask:'none',send:false,hold:null,other:null}); Object.keys(d.guests || {}).forEach(function (gid) { var g=d.guests[gid]; if (g.outcome==='later') g.later=Object.assign({},g.later || {},{send:false}); }); }); });
  }
  function migrateWaiting(st) {
    var x=meta(st), removed=[];
    (st.flags || []).filter(function (f) { return f.kind==='waiting' || f.kind==='unconfirmed'; }).forEach(function (f) {
      var id='allocation-'+(f.historyId || f.closureId)+'-'+f.id;
      if (!x.internalTasks.some(function (t) { return t.id===id; })) x.internalTasks.push({id:id,kind:'allocation',key:f.key,cid:f.closureId,bookingId:f.bookingId,guestId:f.guestId || null,title:f.name || f.bookingId,text:'Allocation decision needed',date:f.date || String(f.key).split('@')[1] || null,status:f.status==='open'?'open':'resolved',historyId:f.historyId,at:stamp(st)});
      if (f.holdId) st.holds=(st.holds || []).filter(function (h) { return h.id!==f.holdId; });
      var b=E.booking(st,f.bookingId); if (b && b.status==='unconfirmed') b.status='confirmed';
      var history=(st.history || []).find(function(r){return r.id===f.historyId;});
      if(history){if(history.review)(history.review.rows || []).forEach(function(row){if(row.key===f.key){row.what='Move out; arrange replacement internally';row.finish=(row.finish || []).filter(function(text){return !/Waiting|Unconfirmed/.test(text);}).concat(['Allocation decision needed']);}});if(history.messages)history.messages[f.key]={none:'No customer confirmation is required. Operations will arrange the replacement.',lines:[],staff:[]};}
      removed.push(f.id);
    });
    if (removed.length) { st.flags=st.flags.filter(function (f) { return removed.indexOf(f.id)<0; }); E.touch(st); }
    return removed.length;
  }
  function blockedBy(c,p) { return p.kind==='space' && c.spaces.indexOf(p.res)>=0 && p.date>=c.date && p.date<=(c.endDate || c.date) && (c.when!=='part' || mins(p.start)<mins(c.to) && mins(c.from)<mins(p.end)); }
  function linkedDefaults(st,cid,k) {
    var c=E.closure(st,cid), rows=(st.parts || []).filter(function (p) { return key(p)===k; });
    return rows.map(function (p) { var host=p.kind==='res' && rows.find(function (q) { return q.key===p.with && q.kind==='space'; }); return {part:cp(p),blocked:blockedBy(c,p),used:!blockedBy(c,p) && !(host && blockedBy(c,host))}; });
  }
  function addFlag(st,rec,opts) {
    st.seq.f=(st.seq.f || 0)+1; var id='fl'+st.seq.f; while (st.flags.some(function (f) { return f.id===id; })) { st.seq.f++; id='fl'+st.seq.f; }
    var b=E.booking(st,opts.bookingId), isPublic=!!(b && b.session), s=isPublic?E.session(st,b.session):null;
    var flag=Object.assign({id:id,kind:'details',who:null,bookingId:opts.bookingId,key:opts.key,closureId:rec.closureId,historyId:rec.id,guestId:isPublic?opts.bookingId:null,status:'open',doneAt:null,doneBy:null,date:s && s.date || String(opts.key).split('@')[1],start:s && s.start || '',name:s && s.label || b && b.name || opts.bookingId,sub:b && (b.hirer || b.name) || '',typeWord:isPublic?'Activity':b && E.typeWord(b),tone:isPublic?'session':b && E.typeTone(b),lines:[],partIds:[],short:'Details to collect',text:'Booking details require review',amount:null},opts);
    st.flags.push(flag); rec.flagsAdded.push(id); return flag;
  }
  function policyFor(st,cid,k,drafts) {
    var draft=(drafts || []).find(function (d) { return d.rows.some(function (r) { return r.key===k; }); });
    return draft?draft.config:choice(st,cid,k);
  }
  function notificationState(st,cid) {
    var x=meta(st),drafts=x.pendingMoves.filter(function(d){return d.status==='draft';}),keys=cid==='board'?Array.from(new Set(st.boardPlan.drops.map(function(d){return d.key;}))):Object.keys(st.plans[cid] && st.plans[cid].entries || {});
    var selected=keys.filter(function(k){return !!x.communication[cid] || !!policyFor(st,cid,k,drafts).notify;});
    return {n:selected.length,total:keys.length,all:selected.length>0 && selected.length===keys.length,mixed:selected.length>0 && selected.length<keys.length};
  }
  function finalize(st,cid,result,before,drafts,simulated) {
    var rec=st.history.find(function (r) { return r.id===result.historyId; }), x=meta(st), errors=[]; if (!rec) return errors;
    var plan=before.plans[cid], c=cid==='board'?null:E.closure(before,cid);
    if (plan && c) Object.keys(plan.entries).forEach(function (k) {
      var entry=plan.entries[k]; if (entry.outcome!=='notused' && entry.outcome!=='later') return;
      var options=choice(before,cid,k), defaults=linkedDefaults(before,cid,k);
      defaults.forEach(function (row) {
        var used=Object.prototype.hasOwnProperty.call(options.linkedUse || {},row.part.id)?options.linkedUse[row.part.id]:row.used;
        if (!used || row.blocked) return;
        var current=part(st,row.part.id); if (current) { Object.assign(current,cp(row.part)); if (!row.part.status) delete current.status; }
      });
    });
    E.touch(st);
    if (plan && c) Object.keys(plan.entries).forEach(function (k) {
      var entry=plan.entries[k]; if (entry.outcome!=='notused' && entry.outcome!=='later') return;
      var options=choice(before,cid,k);
      linkedDefaults(before,cid,k).forEach(function (row) {
        var p=part(st,row.part.id); if (!p || p.status || row.blocked) return;
        var hit=E.occupied(st,{exceptKey:k}).find(function (other) { return other.res===p.res && overlap(p,other); });
        if (hit) errors.push((p.label || p.part)+' is still utilised but conflicts with '+(hit.label || 'another allocation')+'. Change that allocation or its utilisation choice.');
      });
    });
    migrateWaiting(st);
    (x.internalTasks || []).forEach(function (t) { if (t.status==='open' && t.historyId!==rec.id && t.cid===cid && rec.keys.indexOf(t.key)>=0) { t.status='resolved';t.resolvedBy=rec.id;t.resolvedAt=stamp(st); } });
    var affectedKeys=rec.keys || [], remove=[];
    (st.flags || []).filter(function (f) { return f.historyId===rec.id; }).forEach(function (f) {
      var policy=policyFor(before,cid,f.key,drafts);
      if ((f.kind==='fee' || f.kind==='credit') && (policy.price==='keep' || policy.billing==='seasonal')) remove.push(f.id);
      else if ((f.kind==='fee' || f.kind==='credit') && policy.billing==='monthly') { f.kind='fee';f.short='Next invoice to update';f.text='Reflect this allocation change in the next monthly invoice';f.optimoBilling='monthly';f.popLine='Update the next monthly invoice to reflect the changed allocations. No immediate charge or credit is recorded here.';f.lines=['Monthly billing: update the next invoice; no immediate charge or credit is recorded here.']; }
    });
    st.flags=st.flags.filter(function (f) { return remove.indexOf(f.id)<0; }); rec.flagsAdded=rec.flagsAdded.filter(function (id) { return remove.indexOf(id)<0; });
    affectedKeys.forEach(function (k) {
      var policy=policyFor(before,cid,k,drafts), b=booking(before,k), session=E.session(before,k), ids=session?before.bookings.filter(function (b) { return b.session===k; }).map(function (b) { return b.id; }):b?[b.id]:[];
      if (policy.questionnaire || policy.waiver) ids.forEach(function (id) { addFlag(st,rec,{bookingId:id,key:k,short:'Questionnaire / waiver review',text:[policy.questionnaire?'Questionnaire changes':null,policy.waiver?'Waiver changes':null].filter(Boolean).join(' and ')+' require Booking Manager updates',lines:['The allocation has moved. Complete the package-specific details in Booking Manager.']}); });
    });
    var seasonBookings=[];
    (drafts || []).filter(function(d){return d.config.scope==='series';}).forEach(function(d){var anchor=part(before,d.config.partId),b=anchor && E.booking(before,anchor.booking);if(!b || !b.series || b.series.to<=before.meta.dataTo || seasonBookings.indexOf(b.id)>=0)return;seasonBookings.push(b.id);addFlag(st,rec,{kind:'season',bookingId:b.id,key:key(anchor),short:'Season dates to update',text:'Update the remaining season dates after '+E.fd(before.meta.dataTo),lines:['The loaded dates have moved. Apply the same facility, time and date shift to the remaining season in Booking Manager.'],partIds:d.rows.map(function(r){return r.partId;})});});
    (rec.snapshot.parts || []).filter(function (p) { return p.kind==='space' && p.session; }).forEach(function (old) {
      var current=part(st,old.id); if (!current || current.status || current.res===old.res && current.date===old.date && current.start===old.start && current.end===old.end) return;
      var session=E.session(st,current.session); if (!session) return;
      var operationId='public-move-'+rec.id+'-'+session.id, ev=E.event(before,session.event), index=x.publicOperations.length+1;
      var operation={id:operationId,historyId:rec.id,kind:'publicFacilityMove',sessionId:session.id,title:session.label,status:'simulated',at:stamp(st),from:{facility:old.res,date:old.date,start:old.start,end:old.end},to:{facility:current.res,date:current.date,start:current.start,end:current.end},facilityTimeslot:{id:'SIM-SLOT-'+index,facilityId:current.res,date:current.date,start:current.start,end:current.end},package:{id:'SIM-PKG-'+index,eventId:session.event,facilityId:current.res,pricePerGuest:ev && ev.pricePerGuest,preservedPrice:true,guestBookingIds:before.bookings.filter(function (b) { return b.session===session.id; }).map(function (b) { return b.id; })},production:false};
      Object.assign(session,{space:current.res,date:current.date,start:current.start,end:current.end,optimoSimulatedTimeslot:operation.facilityTimeslot.id,optimoSimulatedPackage:operation.package.id});
      if (!x.publicOperations.some(function (o) { return o.id===operationId; })) x.publicOperations.push(operation);
      if (!simulated) audit('Simulate target public timeslot and replacement package',session.label,operation.from,operation,{sessionId:session.id,guestBookings:operation.package.guestBookingIds},'simulated');
    });
    var notified=[];
    affectedKeys.forEach(function (k) {
      var policy=policyFor(before,cid,k,drafts), notify=policy.notify || !!meta(before).communication[cid];
      if (rec.messages && rec.messages[k]) {
        if (notify) { var message=cp(rec.messages[k]); if (plan && plan.entries[k] && plan.entries[k].outcome==='later') message={subject:'Allocation update',lines:['The original allocation has been removed. Our operations team will arrange the replacement.'],staff:[]}; x.notifications.push({id:'notification-'+rec.id+'-'+k,historyId:rec.id,key:k,status:'prepared',message:message});notified.push(k); }
        else rec.messages[k]={none:'Applied silently. No client notification was requested.',lines:[],staff:[]};
      }
    });
    rec.optimoNotification=notified.length?'Notification prepared':'Applied silently';
    rec.told={hirers:0,guests:0,staff:0,staffList:[],words:rec.optimoNotification,text:rec.optimoNotification};
    (drafts || []).forEach(function (d) { var target=x.pendingMoves.find(function (p) { return p.id===d.id; }); if (target) { target.status='applied';target.historyId=rec.id; } });
    rec.optimoPolicies=affectedKeys.map(function (k) { return {key:k,policy:cp(policyFor(before,cid,k,drafts))}; });
    rec.review=E.review(before,cid);
    if (rec.review) rec.lines=rec.review.rows.map(function(row){return row.name+': '+row.what;});
    (rec.optimoPolicies || []).forEach(function(item){if(plan && plan.entries[item.key] && plan.entries[item.key].outcome==='later'){Object.keys(rec.changedLines || {}).forEach(function(id){rec.changedLines[id]=(rec.changedLines[id] || []).map(function(line){return typeof line==='string'?line.replace(/waiting for an answer/gi,'allocation pending internally'):line;});});}});
    x.communication[cid]=false;
    Object.keys(x.choices).filter(function(id){return id.indexOf(cid+'|')===0;}).forEach(function(id){x.choices[id].notify=false;});
    E.touch(st); return errors;
  }
  E.apply=function (st,cid) {
    normalizeLater(st,cid); migrateWaiting(st);
    var before=cloneState(st), drafts=meta(st).pendingMoves.filter(function (d) { return d.status==='draft' && d.dropIds.some(function (id) { return st.boardPlan.drops.some(function (drop) { return drop.id===id; }); }); });
    var keys=cid==='board'?Array.from(new Set(st.boardPlan.drops.map(function (d) { return d.key; }))):Object.keys(st.plans[cid] && st.plans[cid].entries || {});
    if (keys.some(function (k) { var policy=policyFor(st,cid,k,drafts); return policy.price==='keep' && !fixedSeasonal(st,k,policy.billing) && !E.session(st,k) && !allowed(); })) return {ok:false,reason:'Keeping the original price requires the Keep price user right. Choose Update price before applying.'};
    var simulation=cloneState(st), probe=native.apply(simulation,cid); if (!probe || !probe.ok) return probe;
    var errors=finalize(simulation,cid,probe,before,drafts,true); if (errors.length) return {ok:false,reason:errors[0]};
    var result=native.apply(st,cid); if (result && result.ok) { finalize(st,cid,result,before,drafts,false); var record=st.history.find(function(r){return r.id===result.historyId;});result.flags=record?record.flagsAdded.length:result.flags;audit('Apply facility plan',cid,before.parts,st.parts,{cid:cid,keys:keys,policies:keys.map(function (k) { return policyFor(before,cid,k,drafts); })},'applied'); }
    return result;
  };
  E.undo=function (st,hid) {
    var before=cp(st.parts), result=native.undo(st,hid); if (!result || !result.ok) return result;
    var x=meta(st); x.internalTasks.forEach(function (t) { if (t.historyId===hid) t.status='undone';if (t.resolvedBy===hid) {t.status='open';delete t.resolvedBy;delete t.resolvedAt;} });
    x.publicOperations.forEach(function (o) { if (o.historyId===hid) o.status='undone'; });x.pendingMoves.forEach(function (d) { if (d.historyId===hid) {d.status='draft';delete d.historyId;} });x.notifications.forEach(function (n) { if (n.historyId===hid) n.status='cancelled'; });
    migrateWaiting(st); E.touch(st);audit('Undo facility plan',hid,before,st.parts,{historyId:hid},'applied');return result;
  };
  E.boardUndoDrop=function (st) { var last=st.boardPlan.drops.at(-1);if (last && last.optimoMoveId) {var removed=st.boardPlan.drops.filter(function (d) {return d.optimoMoveId===last.optimoMoveId;});st.boardPlan.drops=st.boardPlan.drops.filter(function (d) {return d.optimoMoveId!==last.optimoMoveId;});meta(st).pendingMoves=meta(st).pendingMoves.filter(function (d) {return d.id!==last.optimoMoveId;});E.touch(st);audit('Remove draft facility move',last.optimoMoveId,removed,[],{moveId:last.optimoMoveId},'draft');return {ok:true,text:'Draft move removed.'};}return native.boardUndoDrop(st); };
  E.boardTakeOut=function (st,id) {var d=st.boardPlan.drops.find(function (d) {return d.id===id;});if (d && d.optimoMoveId) {var move=meta(st).pendingMoves.find(function (m) {return m.id===d.optimoMoveId;});st.boardPlan.drops=st.boardPlan.drops.filter(function (x) {return x.optimoMoveId!==d.optimoMoveId;});if(move)move.status='removed';E.touch(st);return {ok:true,text:'Grouped facility move removed.'};}return native.boardTakeOut(st,id);};
  E.boardDrop=function(st,id,target,config){config=Object.assign({},config || {});if(config.price==='keep' && !allowed())return {ok:false,reason:'The Keep price user right is required.'};if(!allowed() && !config.price)config.price='charge';return native.boardDrop(st,id,target,config);};
  E.dropAsk=function(){var out=native.dropAsk.apply(E,arguments);if(out && out.price && !allowed())out.price.def='charge';return out;};
  E.setPick=function (st,cid,k,patch) { if(patch && patch.price==='keep' && !allowed() && !fixedSeasonal(st,k,choice(st,cid,k).billing))return {ok:false,reason:'The Keep price user right is required.'};var result=native.setPick(st,cid,k,patch);if(patch && patch.price){var x=meta(st),id=cid+'|'+k;x.choices[id]=Object.assign({},x.choices[id] || {},{price:patch.price});}normalizeLater(st,cid);return result; };
  E.setGuest=function (st,cid,k,gid,patch) {if(patch && patch.price==='keep' && !allowed())return {ok:false,reason:'The Keep price user right is required.'};var result=native.setGuest(st,cid,k,gid,patch);normalizeLater(st,cid);return result;};
  E.addToPlan=function (st,cid,k) {normalizeLater(st,cid);return native.addToPlan(st,cid,k);};
  function laterPolicy(card) {if(card && card.outcome==='later'){card.later={lines:[{ok:true,text:'Remove the affected allocation now and keep an internal task to arrange a replacement.'},{small:'No request for customer acceptance, held space or confirmation deadline is created.'}],info:'The operations team remains responsible for this allocation.',after:{lead:'After Apply',flag:'Allocation decision needed'},notAsked:''};if(card.foot){card.foot.info='An internal allocation task remains after Apply.';card.foot.tells='';}}return card;}
  E.card=function (st,cid,k) {var out=laterPolicy(native.card.apply(E,arguments)),policy=choice(st,cid,k);if(out && out.outcome==='notused' && (policy.price==='keep' || policy.billing==='seasonal' || policy.billing==='monthly')){out.notUsed=policy.billing==='monthly'?'The affected allocation is not used. Any chosen price change is recorded for the next monthly invoice.':policy.billing==='seasonal'?'The affected allocation is not used. The fixed seasonal price remains unchanged.':'The affected allocation is not used. The original booking price is retained.';out.notUsedParts=[[out.notUsed,false]];}if(out && policy.billing==='seasonal'){out.price=null;out.pills=(out.pills || []).map(function(p){return p[0]==='Price changes'?['Fixed seasonal price','good']:p;});}if(out && out.foot){out.foot.tells='';if(/told when you apply/.test(out.foot.info || ''))out.foot.info='Choose notification or silent Apply during Review.';}return out;};E.guestCard=function () {var out=laterPolicy(native.guestCard.apply(E,arguments));if(out && out.foot)out.foot.tells='';return out;};
  E.review=function (st,cid) {
    var review=native.review(st,cid);if(!review)return review;var plan=st.plans[cid], deferred=0, updates=new Set();
    (review.rows || []).forEach(function (row) {var entry=plan && plan.entries[row.key], policy=policyFor(st,cid,row.key,meta(st).pendingMoves.filter(function(d){return d.status==='draft';}));if(entry && entry.outcome==='later'){row.what='Move out; arrange replacement internally';row.finish=['Allocation decision needed'];deferred++;}if(policy.price==='keep' || policy.billing==='seasonal')row.finish=(row.finish || []).filter(function(f){return !/^(Credit to give|Fee to update)/.test(f);});if(policy.billing==='monthly')row.finish=(row.finish || []).map(function(f){return /^(Credit to give|Fee to update)/.test(f)?'Next monthly invoice to update':f;});(row.guests || []).forEach(function(g){if(/Asked|Waiting for|not asked/.test(g.what || '')){g.what='Move out; arrange replacement internally';g.finish=['Allocation decision needed'];deferred++;}});});
    (review.rows || []).forEach(function(row){var policy=policyFor(st,cid,row.key,meta(st).pendingMoves.filter(function(d){return d.status==='draft';})),session=E.session(st,row.key);if(policy.questionnaire || policy.waiver){row.finish=Array.from(new Set((row.finish || []).concat(['Questionnaire / waiver updates in Booking Manager'])));if(session)st.bookings.filter(function(b){return b.session===session.id;}).forEach(function(b){updates.add(b.id);});else updates.add(row.id || row.key);}if((row.finish || []).some(function(text){return text!=='Allocation decision needed';})){if(session)st.bookings.filter(function(b){return b.session===session.id;}).forEach(function(b){updates.add(b.id);});else updates.add(row.id || row.key);}(row.guests || []).forEach(function(guest){if((guest.finish || []).some(function(text){return text!=='Allocation decision needed';}))updates.add(guest.id || guest.name);});});
    var afterBits=[];if(updates.size)afterBits.push(updates.size+' Booking Manager '+(updates.size===1?'update':'updates'));if(deferred)afterBits.push(deferred+' internal allocation '+(deferred===1?'task':'tasks'));
    review.after=afterBits.length?{lead:afterBits.join(' and ')+' remain after Apply.',rest:deferred?'Operations handles allocation tasks without customer confirmation.':'Booking Manager follow-ups stay open until completed.'}:null;
    var notify=notificationState(st,cid).n>0;review.foot=(review.foot || '').replace(/\s*[·,]?\s*tells\s+.*$/,'')+(notify?' · notification prepared':' · apply silently');if(review.told){review.told.text=notify?'Notification prepared':'No client notification';review.told.hirers=0;review.told.guests=0;review.told.staff=0;}return review;
  };
  E.message=function (st,cid,k) {var p=st.plans[cid], d=p && (p.entries[k] || p.picks[k]),notify=!!meta(st).communication[cid] || !!policyFor(st,cid,k,meta(st).pendingMoves.filter(function(move){return move.status==='draft';})).notify;if(d && d.outcome==='later')return {subject:'Allocation update',lines:['The original allocation is removed. Operations will arrange a replacement.'],staff:[],none:notify?'':'Applied silently. No client notification requested.'};if(!notify)return {none:'Applied silently. No client notification requested.',lines:[],staff:[]};return native.message(st,cid,k);};
  E.restore=function () {var st=native.restore.apply(E,arguments);if(st)migrateWaiting(st);return st;};E.expire=function(st){migrateWaiting(st);return native.expire(st);};
  E.finishFlag=function(st,id,opts){var before=cp(st.flags.find(function(f){return f.id===id;})),result=native.finishFlag(st,id,opts);if(result && result.ok)audit('Complete Booking Manager follow-up',before && before.bookingId,before,st.flags.find(function(f){return f.id===id;}),{flagId:id},'applied');return result;};
  E.after=function(st,cid){var out=native.after(st,cid);if(!out)return out;var tasks=meta(st).internalTasks.filter(function(t){return t.cid===cid && t.status==='open';});if(tasks.length){var keys=tasks.map(function(t){return t.key;});out.done.rows=out.done.rows.filter(function(r){return keys.indexOf(r.key)<0;});out.done.n=out.done.rows.length;out.done.names=out.done.rows.map(function(r){return r.name;}).join(', ');var total=tasks.length+(out.need?out.need.n:0);out.pill=total+' still need work';out.pillTone='w';out.banner.lead='Plan applied.';out.banner.rest=tasks.length+' internal allocation '+(tasks.length===1?'task':'tasks')+' and '+(out.need?out.need.n:0)+' Booking Manager follow-ups remain.';}return out;};
  E.closuresList=function(st){var rows=native.closuresList(st);rows.forEach(function(row){var n=meta(st).internalTasks.filter(function(t){return t.cid===row.id && t.status==='open';}).length;if(n)row.state={text:n+' internal allocation '+(n===1?'task':'tasks'),tone:'w'};});return rows;};
  E.bmView=function(st,id){var out=native.bmView(st,id);if(out)(out.flags || []).forEach(function(flag){var raw=st.flags.find(function(f){return f.id===flag.id;});if(raw && raw.optimoBilling==='monthly'){flag.button='Next invoice updated';flag.line='Update the next monthly invoice in Booking Manager; no immediate charge is taken here.';}});return out;};
  function decisionRow(st,cid,row){var d=st.plans[cid] && st.plans[cid].entries[row.key],policy=choice(st,cid,row.key);if(!d)return row;if(d.outcome==='later'){row.tag='Allocation pending';row.tagTitle='Operations must arrange the replacement; no customer response is required.';if(row.decided){row.decided.text='Move out; arrange replacement internally';row.decided.flag='Allocation decision needed';}}else if(policy.price==='keep' || policy.billing==='seasonal'){if(/Credit|Fee/.test(row.tag || '')){row.tag=policy.billing==='seasonal'?'Fixed seasonal price':'Price retained';row.tagTitle='No immediate financial update is required.';}if(row.decided && /Credit|Fee/.test(row.decided.flag || ''))row.decided.flag=policy.billing==='seasonal'?'Fixed seasonal price':'Price retained';}else if(policy.billing==='monthly'){if(/Credit|Fee/.test(row.tag || '')){row.tag='Next invoice';row.tagTitle='Update the next monthly invoice.';}if(row.decided && /Credit|Fee/.test(row.decided.flag || ''))row.decided.flag='Next monthly invoice to update';}return row;}
  E.leftList=function(st,cid){var out=native.leftList(st,cid);if(out)(out.items || []).forEach(function(row){decisionRow(st,cid,row);});return out;};
  E.listRows=function(st,cid){return native.listRows(st,cid).map(function(row){return decisionRow(st,cid,row);});};
  E.guestList=function(st,cid,k){var out=native.guestList(st,cid,k),p=st.plans[cid] && (st.plans[cid].entries[k] || st.plans[cid].picks[k]);if(out)(out.items || []).forEach(function(row){var gp=p && p.guests && p.guests[row.id];if(gp && gp.outcome==='later'){row.tag='Allocation pending';if(row.status){row.status.l1='Arrange replacement internally';row.status.l2='';}}});return out;};
  E.laterLines=function(){return laterPolicy({outcome:'later',foot:{}}).later;};
  function resumeTask(id) {var task=meta(w.ST).internalTasks.find(function(t){return t.id===id && t.status==='open';});if(!task)return {ok:false,reason:'This internal task is no longer open.'};var result=E.reopen(w.ST,task.cid,task.key,task.guestId);if(result.ok){w.go('closure',{cid:result.cid,sel:result.key,guestSel:result.guestId,closureMode:result.mode,calDate:result.date});w.save();w.render();}return result;}
  function tracking(st) {
    var x=meta(st);return (st.closures || []).map(function(c){var hits=E.hits(st,c.id) || [],progress=E.progress(st,c.id),internal=x.internalTasks.filter(function(t){return t.cid===c.id && t.status==='open';}),flags=E.flags(st).filter(function(f){return f.closureId===c.id;}),draft=c.status==='planning' || (st.plans[c.id] && (st.plans[c.id].reopen || []).length>0);
      return {id:c.id,mode:c.mode,title:E.closureTitle(st,c.id),reason:c.reason,date:c.date,endDate:c.endDate || c.date,spaces:c.spaces.map(function(id){return E.space(st,id).name;}),status:draft?'Planning':internal.length || flags.length?'Action needed':'Complete',affected:hits.length,decided:progress.done,total:progress.total,internal:cp(internal),followUps:flags.length,appliedAt:c.appliedAt,historyIds:cp(c.historyIds),route:{action:'closureCase',args:{cid:c.id}}};});
  }
  function snapshot() {if(!w.ST)return {ready:false};migrateWaiting(w.ST);var x=meta(w.ST);return cp({ready:true,pendingMoves:x.pendingMoves.filter(function(d){return d.status==='draft' && d.dropIds.some(function(id){return w.ST.boardPlan.drops.some(function(p){return p.id===id;});});}),publicOperations:x.publicOperations,internalTasks:x.internalTasks.filter(function(t){return t.status==='open';}),closureTracking:tracking(w.ST),notifications:x.notifications,productionContract:productionContract});}
  function btn(text,act,data,cls) {return '<button type="button" class="btn '+(cls || '')+'" data-act="'+act+'"'+Object.keys(data || {}).map(function(k){return ' data-'+k.replace(/[A-Z]/g,function(c){return '-'+c.toLowerCase();})+'="'+esc(data[k])+'"';}).join('')+'>'+esc(text)+'</button>';}
  function options(items,value) {return items.map(function(p){return '<option value="'+esc(p[0])+'"'+(p[0]===value?' selected':'')+(p[2]?' disabled':'')+'>'+esc(p[1])+'</option>';}).join('');}
  function selectField(label,field,items,value) {return '<label><span>'+esc(label)+'</span><select data-act="r7xField" data-field="'+field+'" data-t="r7x-'+field+'">'+options(items,value)+'</select></label>';}
  function openMove(id,target) {
    var p=part(w.ST,id) || (w.ST.parts || []).find(function(p){return p.kind==='space' && active(p) && p.date===w.UI.boardDate;});if(!p)return;
    var b=booking(w.ST,key(p));w.UI.r7xMove={partId:p.id,target:Object.assign({space:p.res,date:p.date,start:p.start},target || {}),scope:'occurrence',price:allowed()?'keep':'charge',billing:b && b.series?'seasonal':'perOccurrence',notify:false,questionnaire:false,waiver:false,partIds:[p.id],from:p.date0,to:p.date0};w.UI.boardAsk=null;w.UI.boardPop=null;
    w.afterRender(function(){var field=document.querySelector('[data-t="r7x-partId"]');if(field)field.focus({preventScroll:true});});
  }
  function moveDialog() {
    var input=w.UI.r7xMove;if(!input)return '';var p=part(w.ST,input.partId);if(!p)return '';var b=booking(w.ST,key(p)), result=previewMove(input), clean=result.ok?result:null;
    var allocations=(w.ST.parts || []).filter(function(q){return q.kind==='space' && active(q) && (b?q.booking===b.id:q.session===p.session);});
    var content='<div class="r7x-modal" role="dialog" aria-modal="true" aria-labelledby="r7x-title" data-t="r7x-move-dialog"><div class="r7x-modal-head"><div><small>FACILITY ALLOCATION</small><h2 id="r7x-title">Move '+esc(b?b.name:E.session(w.ST,p.session).label)+'</h2></div>'+btn('Close','r7xMoveCancel',{},'sm')+'</div><div class="r7x-modal-body"><div class="r7x-form">'+selectField('Allocation','partId',allocations.map(function(q){return[q.id,(q.label || q.part)+' · '+E.fd(q.date)+' '+q.start];}),input.partId)+selectField('Target facility','space',(w.ST.spaces || []).map(function(s){return[s.id,(E.venue(w.ST,s.venue) || {}).name+' · '+s.name];}),input.target.space)+'<label><span>Date</span><input type="date" value="'+esc(input.target.date)+'" min="'+esc(w.ST.meta.dataFrom)+'" max="'+esc(w.ST.meta.dataTo)+'" data-act="r7xField" data-field="date" data-t="r7x-date"></label><label><span>Start time</span><input type="time" step="900" value="'+esc(input.target.start)+'" data-act="r7xField" data-field="start" data-t="r7x-start"></label></div>';
    if(p.session)content+='<p class="r7x-note">The whole public session and every guest booking move together. The preview below includes a simulated target facility timeslot and replacement package with the original price.</p>';
    else content+='<details class="r7x-advanced"'+(input.scope!=='occurrence'?' open':'')+'><summary>Move scope and billing</summary><div class="r7x-form">'+selectField('Apply to','scope',[['occurrence','This allocation only'],['day','All allocations on this booking day'],['linked','Choose linked allocations'],['dates','This allocation across selected dates'],['series','This allocation for the rest of the series']],input.scope)+selectField('Billing basis','billing',[['perOccurrence','Price per occurrence']].concat(b && b.series?[['seasonal','Fixed seasonal price']]:[]).concat([['monthly','Monthly invoicing']]),input.billing)+'</div>'+(input.scope==='dates'?'<div class="r7x-form"><label>From<input type="date" value="'+esc(input.from)+'" data-act="r7xField" data-field="from"></label><label>To<input type="date" value="'+esc(input.to)+'" data-act="r7xField" data-field="to"></label></div>':'')+(input.scope==='linked'?'<div class="r7x-checklist">'+allocations.map(function(q){return '<label><input type="checkbox" data-act="r7xLink" data-part="'+esc(q.id)+'"'+(input.partIds.indexOf(q.id)>=0?' checked':'')+(q.id===p.id?' disabled':'')+'> '+esc((q.label || q.part)+' · '+E.fd(q.date)+' '+q.start)+'</label>';}).join('')+'</div>':'')+'<p class="r7x-note">Other selected dates shift by the same number of days; relative allocation times stay together. Every target is checked before anything joins the plan.</p></details>';
    content+='<div class="r7x-form">'+(!p.session?selectField('Price decision','price',[['keep',allowed()?'Keep the original price':'Keep the original price · user right required',!allowed()],['charge','Update price in Booking Manager']],input.price):'')+'<label class="r7x-check"><input type="checkbox" data-act="r7xField" data-field="notify"'+(input.notify?' checked':'')+'> Prepare a client notification</label></div><div class="r7x-checklist"><label><input type="checkbox" data-act="r7xField" data-field="questionnaire"'+(input.questionnaire?' checked':'')+'> The target package needs different questionnaire details</label><label><input type="checkbox" data-act="r7xField" data-field="waiver"'+(input.waiver?' checked':'')+'> The target package needs a different waiver</label></div>';
    if(!result.ok)content+='<div class="r7x-warning" role="status">'+esc(result.reason)+'</div>';
    else content+='<div class="r7x-preview" data-t="r7x-move-preview"><h3>'+clean.rows.length+' allocation'+(clean.rows.length===1?'':'s')+' will move</h3><ul>'+clean.rows.map(function(r){return '<li><b>'+esc(r.title)+'</b><span>'+esc(E.fd(r.before.date)+' '+r.before.start+' · '+E.space(w.ST,r.before.space).name)+' → '+esc(E.fd(r.after.date)+' '+r.after.start+' · '+E.space(w.ST,r.after.space).name)+'</span></li>';}).join('')+'</ul>'+(!p.session?'<div class="r7x-note" data-t="r7x-price-preview">'+Object.keys(clean.prices).map(function(k){var pr=clean.prices[k],label=booking(w.ST,k);return '<p><b>'+esc(label && label.name || 'Allocation')+'</b>: '+esc(E.money(pr.new))+(pr.changes?' (was '+esc(E.money(pr.old))+')':' · same calculated allocation price')+'</p>';}).join('')+'<p>'+(input.billing==='seasonal'?'Facility-rate comparison only; the fixed seasonal booking price is unchanged.':input.price==='keep'?'The original booking price is retained.':input.billing==='monthly'?'The selected price update goes to the next monthly invoice.':'The selected price update requires Booking Manager.')+'</p></div>':'')+ (clean.resourceMoves.length?'<p>'+clean.resourceMoves.length+' linked resource allocation'+(clean.resourceMoves.length===1?' follows':'s follow')+'.</p>':'')+clean.warnings.map(function(t){return '<p class="r7x-warning">'+esc(t)+'</p>';}).join('')+(clean.publicOperation?'<div class="r7x-note"><b>Public event operation preview</b><p>Create or reuse the '+esc(E.space(w.ST,input.target.space).name)+' timeslot; create a replacement package for '+clean.publicOperation.guestBookingIds.length+' guest bookings. Price per guest stays '+esc(E.money(clean.publicOperation.pricePerGuest))+'. These package/timeslot records are simulated locally.</p></div>':'')+(input.billing==='monthly'?'<p class="r7x-note">Any chosen price update is recorded for the next monthly invoice.</p>':input.billing==='seasonal'?'<p class="r7x-note">The fixed seasonal price is preserved.</p>':'')+'</div>';
    var stageButton=btn('Add move to plan','r7xMoveStage',{},'pri');if(!result.ok)stageButton=stageButton.replace('<button ','<button disabled aria-disabled="true" ');
    var output=content+'</div><div class="r7x-modal-foot"><span>Nothing changes until Review and Apply.</span>'+btn('Cancel','r7xMoveCancel',{},'sm')+stageButton+'</div></div><div class="r7x-backdrop" data-act="r7xMoveCancel"></div>';var holder=document.createElement('div');holder.innerHTML=output;holder.querySelectorAll('input[data-field]:not([data-t])').forEach(function(node){node.setAttribute('data-t','r7x-'+node.getAttribute('data-field'));});return holder.innerHTML;
  }
  function closurePanel() {
    if(w.UI.view!=='closure' || !w.UI.sel || !w.UI.cid)return '';var cid=w.UI.cid,k=w.UI.sel,p=E.pickOf(w.ST,cid,k);if(!p)return '';var c=choice(w.ST,cid,k), rows=linkedDefaults(w.ST,cid,k), notUsed=p.outcome==='notused' || p.outcome==='later';
    return '<section class="r7x-policy card" data-t="r7x-closure-policy"><details'+(notUsed?' open':'')+'><summary>Linked allocations, billing and booking details</summary>'+ (notUsed?'<p>Choose which other allocations are still utilised. Facilities inside the closure must remain deallocated.</p><div class="r7x-checklist">'+rows.map(function(row){var used=Object.prototype.hasOwnProperty.call(c.linkedUse || {},row.part.id)?c.linkedUse[row.part.id]:row.used;return '<label><input type="checkbox" data-act="r7xUse" data-part="'+esc(row.part.id)+'"'+(used?' checked':'')+(row.blocked?' disabled':'')+'> '+esc(row.part.label || row.part.part)+' · '+esc(row.part.start+'–'+row.part.end)+(row.blocked?' · affected facility · not used':' · still utilised')+'</label>';}).join('')+'</div>':'')+'<div class="r7x-form">'+selectField('Billing basis','closureBilling',[['perOccurrence','Price per occurrence']].concat(fixedSeasonal(w.ST,k,'seasonal')?[['seasonal','Fixed seasonal price']]:[]).concat([['monthly','Monthly invoicing']]),c.billing)+selectField('Price decision','closurePrice',[['keep',allowed() || fixedSeasonal(w.ST,k,c.billing)?'Keep the original price':'Keep the original price · user right required',!allowed() && !fixedSeasonal(w.ST,k,c.billing)],['charge','Update price in Booking Manager']],c.price)+'</div><p class="r7x-note">'+(c.billing==='seasonal'?'A fixed seasonal price stays the same when one allocation is not used.':c.billing==='monthly'?'A chosen price change is left for the next monthly invoice.':'A chosen price change creates a Booking Manager follow-up.')+'</p><div class="r7x-checklist"><label><input type="checkbox" data-act="r7xChoice" data-field="questionnaire"'+(c.questionnaire?' checked':'')+'> Questionnaire details change</label><label><input type="checkbox" data-act="r7xChoice" data-field="waiver"'+(c.waiver?' checked':'')+'> Waiver requirements change</label></div></details></section>';
  }
  function trackingHtml() {
    var rows=tracking(w.ST);return '<section class="r7x-tracking card" data-t="r7x-closure-tracking"><h3>Closure and clear-space tracking</h3><p>Every applied closure keeps its affected work and follow-up status.</p>'+(rows.length?'<div class="r7x-table"><table><thead><tr><th>Plan / period</th><th>Spaces</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+rows.map(function(c){return '<tr><td><b>'+esc(c.title)+'</b><small>'+esc(c.date+(c.endDate!==c.date?' to '+c.endDate:''))+'</small></td><td>'+esc(c.spaces.join(', '))+'</td><td><b>'+esc(c.status)+'</b><small>'+c.decided+' / '+c.total+' decided · '+c.internal.length+' internal tasks · '+c.followUps+' Booking Manager follow-ups</small></td><td>'+btn(c.status==='Planning'?'Continue plan':'Inspect applied work','r7xCase',{cid:c.id},'sm')+'</td></tr>';}).join('')+'</tbody></table></div>':'<p>No space plans have been created.</p>')+'</section>';
  }
  function taskHtml(cid) {
    var tasks=meta(w.ST).internalTasks.filter(function(t){return t.status==='open' && (!cid || t.cid===cid);});return tasks.length?'<section class="r7x-tasks card" data-t="r7x-internal-tasks"><h3>Internal allocation work to finish</h3><p>These tasks belong to operations; no customer confirmation or held space is required.</p>'+tasks.map(function(t){return '<div><span><b>'+esc(t.title)+'</b><small>'+esc(t.text)+'</small></span>'+btn('Resolve allocation','r7xResume',{id:t.id},'sm')+'</div>';}).join('')+'</section>':'';
  }
  function ledgerHtml() {var operations=meta(w.ST).publicOperations.filter(function(o){return o.status!=='undone';});return operations.length?'<details class="r7x-ledger card" data-t="r7x-public-ledger"><summary>Public facility operation ledger · '+operations.length+' simulated changes</summary><p>Allocation changes are real within this prototype. Package and facility timeslot records below are local simulations for the production integration discussion.</p>'+operations.map(function(o){return '<div><b>'+esc(o.title)+'</b><small>'+esc(o.to.date+' '+o.to.start+' · '+E.space(w.ST,o.to.facility).name)+'</small><p>'+esc(o.facilityTimeslot.id+' · '+o.package.id)+' · original price preserved · '+o.package.guestBookingIds.length+' guest bookings</p></div>';}).join('')+'</details>':'';}
  var originalBoard=w.VIEWS.board;
  w.VIEWS.board=function(){migrateWaiting(w.ST);var holder=document.createElement('div');holder.innerHTML=originalBoard();var scr=holder.querySelector('.scr-board'), toolbar=scr && scr.querySelector('.tbar');if(!scr)return holder.innerHTML;
    if(toolbar)toolbar.insertAdjacentHTML('beforeend',btn('Move between dates','r7xMoveOpen',{},'sm'));
    scr.querySelectorAll('.tl-blk[data-part]').forEach(function(node){node.insertAdjacentHTML('beforeend','<span class="r7x-drag-handle" draggable="true" data-x-drag="'+esc(node.getAttribute('data-part'))+'" title="Drag to a day or facility in Week">↔</span>');});
    var info=w.OptimoR7Guide.snapshot().schedule;
    scr.querySelectorAll('.r7g-record-actions').forEach(function(cell,index){var record=info.records[index];if(record && record.partId && record.planState==='live')cell.insertAdjacentHTML('beforeend',btn('Move','r7xMoveOpen',{partId:record.partId},'sm'));});
    var week=w.UI.boardMode==='week'?E.boardWeek(w.ST,w.UI.boardDate,{venue:w.UI.boardVenue || 'all'}):null;
    (week && week.venues || []).forEach(function(v){v.rows.forEach(function(row){row.cells.forEach(function(cell){var node=scr.querySelector('[data-t="wk-cell-'+row.space+'-'+cell.date+'"]');if(!node)return;node.setAttribute('data-x-space',row.space);node.setAttribute('data-x-date',cell.date);Array.from(node.querySelectorAll('.wchip')).forEach(function(chip,i){var source=cell.chips[i];if(source && !source.drop && !source.moved){chip.setAttribute('draggable','true');chip.setAttribute('data-x-drag',source.partId);chip.setAttribute('data-act','r7xMoveOpen');chip.setAttribute('data-part-id',source.partId);chip.setAttribute('tabindex','0');chip.setAttribute('role','button');chip.title+=' · Drag to another day/facility, or select to move';}});});});});
    var pop=scr.querySelector('[data-t="part-pop"] .pop-b');if(pop && String(w.UI.boardPop).indexOf('part:')===0)pop.insertAdjacentHTML('beforeend','<div class="r7x-pop-actions">'+btn('Move allocation / change date','r7xMoveOpen',{partId:w.UI.boardPop.slice(5)},'sm')+'</div>');
    if(toolbar && w.UI.boardMode!=='week' && w.UI.guideBoardDisplay!=='list')toolbar.insertAdjacentHTML('afterend','<div class="r7x-day-targets" aria-label="Cross-day drop targets"><span>Drag ↔ to another day:</span>'+[-1,1,2,3,7].map(function(n){var date=E.addDays(w.UI.boardDate,n);return '<div data-x-date="'+date+'" tabindex="0">'+esc(E.fd(date))+'</div>';}).join('')+'<small>Use Move between dates for a specific date and scope.</small></div>');
    return holder.innerHTML+taskHtml()+ledgerHtml()+moveDialog();};
  ['closure','closures','review','boardReview','after','history'].forEach(function(name){var original=w.VIEWS[name];w.VIEWS[name]=function(){migrateWaiting(w.ST);var html=original();if(name==='closure'){var holder=document.createElement('div');holder.innerHTML=html;var card=holder.querySelector('.cd-card'),actions=card && card.querySelector('.acts');if(actions)actions.insertAdjacentHTML('beforebegin',closurePanel());else holder.insertAdjacentHTML('beforeend',closurePanel());if(!allowed())holder.querySelectorAll('[data-act="cdPrice"][data-v="keep"],[data-act="gsPrice"][data-v="keep"]').forEach(function(node){node.disabled=true;node.setAttribute('aria-disabled','true');node.title='The Keep price user right is required.';});html=holder.innerHTML;}if(name==='closures')html+=trackingHtml();if(name==='review' || name==='boardReview'){var cid=name==='boardReview'?'board':w.UI.cid,notify=notificationState(w.ST,cid);html='<section class="r7x-communication card"><label><input type="checkbox" data-act="r7xNotify" data-cid="'+esc(cid)+'" aria-checked="'+(notify.mixed?'mixed':notify.all?'true':'false')+'"'+(notify.all?' checked':'')+'> Prepare client notifications with this plan</label><p>'+notify.n+' of '+notify.total+' planned items have a notification selected. Select or clear this checkbox to change all of them. Notifications are prepared locally; this prototype does not send messages.</p></section>'+html;if(notify.mixed)w.afterRender(function(){var box=document.querySelector('[data-act="r7xNotify"]');if(box)box.indeterminate=true;});}if(name==='after' || name==='closures' || name==='history')html+=taskHtml(name==='after'?w.UI.cid:null)+ledgerHtml();var focus=document.createElement('div');focus.innerHTML=html;focus.querySelectorAll('input[data-act^="r7x"]:not([data-t])').forEach(function(node){node.setAttribute('data-t',node.getAttribute('data-act')+'-'+(node.getAttribute('data-field') || node.getAttribute('data-part') || node.getAttribute('data-cid') || ''));});return focus.innerHTML;};});
  w.ACT.r7xMoveOpen=function(d){openMove(d.partId);};w.ACT.r7xMoveCancel=function(){w.UI.r7xMove=null;};
  w.ACT.r7xField=function(d,el){var input=w.UI.r7xMove;if(d.field==='closureBilling' || d.field==='closurePrice'){var patch={};patch[d.field==='closureBilling'?'billing':'price']=el.value;setChoice(w.UI.cid,w.UI.sel,patch);return;}if(!input || !el)return;var value=el.type==='checkbox'?el.checked:el.value;if(d.field==='partId'){openMove(value);return;}if(['space','date','start'].indexOf(d.field)>=0)input.target[d.field]=value;else input[d.field]=value;};
  w.ACT.r7xLink=function(d,el){var input=w.UI.r7xMove;if(!input)return;input.partIds=input.partIds.filter(function(id){return id!==d.part;});if(el.checked)input.partIds.push(d.part);};
  w.ACT.r7xMoveStage=function(){var result=stageMove(w.UI.r7xMove);if(!result.ok){w.toast(result.reason,null,null,{tone:'warn'});return;}w.UI.r7xMove=null;w.UI.boardPop=null;};
  w.ACT.r7xChoice=function(d,el){var patch={};patch[d.field]=el.checked;setChoice(w.UI.cid,w.UI.sel,patch);};w.ACT.r7xUse=function(d,el){var linked={};linked[d.part]=el.checked;setChoice(w.UI.cid,w.UI.sel,{linkedUse:linked});};
  w.ACT.r7xNotify=function(d,el){var x=meta(w.ST);x.communication[d.cid]=el.checked;if(d.cid==='board')x.pendingMoves.filter(function(move){return move.status==='draft';}).forEach(function(move){move.config.notify=el.checked;});Object.keys(x.choices).filter(function(id){return id.indexOf(d.cid+'|')===0;}).forEach(function(id){x.choices[id].notify=el.checked;});};w.ACT.r7xResume=function(d){return resumeTask(d.id);};w.ACT.r7xCase=function(d){var c=E.closure(w.ST,d.cid);if(c)w.go(c.status==='planning'?'closure':'after',{cid:c.id,closureMode:'list'});};
  w.UI_DEFAULTS.r7xMove=null;
  var dragged=null;
  document.addEventListener('pointerdown',function(e){if(e.target.closest('[data-x-drag]') && e.target.closest('.r7x-drag-handle'))e.stopPropagation();},true);
  document.addEventListener('dragstart',function(e){var node=e.target.closest('[data-x-drag]');if(!node)return;dragged=node.getAttribute('data-x-drag');e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('application/x-optimo-facility-part',dragged);},true);
  document.addEventListener('dragover',function(e){var node=e.target.closest('[data-x-date]');if(!node || !dragged)return;e.preventDefault();node.classList.add('r7x-drop-target');e.dataTransfer.dropEffect='move';});
  document.addEventListener('dragleave',function(e){var node=e.target.closest('[data-x-date]');if(node)node.classList.remove('r7x-drop-target');});
  document.addEventListener('drop',function(e){var node=e.target.closest('[data-x-date]');if(!node || !dragged)return;e.preventDefault();e.stopPropagation();var p=part(w.ST,dragged);if(p)openMove(p.id,{date:node.getAttribute('data-x-date'),space:node.getAttribute('data-x-space') || p.res,start:p.start});dragged=null;w.save();w.render();},true);
  document.addEventListener('dragend',function(){dragged=null;document.querySelectorAll('.r7x-drop-target').forEach(function(n){n.classList.remove('r7x-drop-target');});});
  document.addEventListener('keydown',function(e){var modal=document.querySelector('[data-t="r7x-move-dialog"]');if(!modal)return;if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();w.UI.r7xMove=null;w.save();w.render();return;}if(e.key!=='Tab')return;var controls=Array.from(modal.querySelectorAll('button,input,select,summary,[tabindex]')).filter(function(node){return !node.disabled && node.getClientRects().length;});var at=controls.indexOf(document.activeElement);if(at<0 || !e.shiftKey && at===controls.length-1 || e.shiftKey && at===0){e.preventDefault();controls[e.shiftKey?controls.length-1:0].focus();}},true);
  document.addEventListener('keydown',function(e){var node=e.target.closest('[data-x-drag][role=button]');if(node && (e.key==='Enter' || e.key===' ')){e.preventDefault();openMove(node.getAttribute('data-x-drag'));w.render();}});
  if(w.OptimoR7Guide){var guideSnapshot=w.OptimoR7Guide.snapshot,guideNavigate=w.OptimoR7Guide.navigate;w.OptimoR7Guide.snapshot=function(){var out=guideSnapshot(),s=snapshot();out.facilityExtensions=s;(s.internalTasks || []).forEach(function(t){out.workItems.push({id:t.id,source:'r7',area:'Facilities',family:E.session(w.ST,t.key)?'public':'private',title:t.title,date:t.date,status:'Allocation needed',description:t.text,route:{action:'internalTask',args:{id:t.id}}});});return out;};w.OptimoR7Guide.navigate=function(action,args){if(action==='internalTask')return resumeTask(args.id);if(action==='home' && document.body.classList.contains('hybrid-embedded')){w.parent.postMessage({type:'optimo:find-task'},'*');return {ok:true,view:w.UI.view};}return guideNavigate(action,args);};}
  w.OptimoR7Extensions={previewMove:function(input){var r=previewMove(input);delete r._state;return r;},stageMove:stageMove,snapshot:snapshot,resumeTask:resumeTask,setClosureChoice:setChoice,productionContract:cp(productionContract)};
  Object.defineProperty(w.OptimoR7Extensions,'permissions',{enumerable:true,get:permissions});
})(window);
