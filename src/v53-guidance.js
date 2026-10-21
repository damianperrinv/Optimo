/* Additive orientation and navigation adapter for the complete V53–V56 prototype.
 * Inject as a classic script AFTER the original scripts. No source engine or
 * workflow functions are replaced. Calling navigate opens native workflows;
 * it never applies business changes or supplies a missing object automatically.
 */
(() => {
  'use strict';
  if (window.OptimoV53Guide) return;

  const byId = id => document.getElementById(id);
  const text = node => node?.textContent?.replace(/\s+/g, ' ').trim() || '';
  const safe = fn => { try { return fn(); } catch { return null; } };
  const call = (name, ...args) => {
    const fn = window[name];
    if (typeof fn !== 'function') throw new Error(`The ${name} entry point is unavailable in this source prototype.`);
    return fn(...args);
  };
  const allSessions = () => safe(() => Array.isArray(sessions) ? sessions : []) || [];
  const allPrivates = () => safe(() => Array.isArray(privates) ? privates : []) || [];
  const allResources = () => safe(() => [...resources, ...facilities]) || [];
  const publicSelection = () => safe(() => [...eventSelected]) || [];
  const privateSelection = () => safe(() => [...privateSelected]) || [];
  const baseId = id => String(id || '').split('@')[0];
  const publicLabel = s => `${s.date || ''} · ${s.time} · ${s.activity} · ${s.venue}`.replace(/^\s*·\s*/, '');
  const privateLabel = p => `${p.ref} · ${p.name} · ${p.time} · ${p.venue}`;
  const escapeHTML=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const readPolicies=()=>{try{return JSON.parse(localStorage.getItem('optimo-v53-confirmation-policies-v1'))||{};}catch{return {};}};
  let confirmationPolicies=readPolicies();
  // The source's undated private diary is a day fixture, not a recurring booking.
  // Capture its reference date once; changing the displayed date must not move it.
  const referenceDay=document.querySelector('#eventDateField input')?.value||allSessions().find(s=>s.date)?.date||'2026-08-24';
  const privateReferenceDays=new Map(allPrivates().map(p=>[p.id,p.date||referenceDay]));
  const referenceSessionIds=new Set(allSessions().map(s=>s.id));
  const eventPresentation={view:'calendar',grouping:'facility',scope:'day',from:referenceDay,to:referenceDay};
  let reassignScope=null,activePublicSessionId=null,operationsAdapter=null;
  const native={renderEvent:window.renderEvent,eventCalendar:window.eventCalendarHtml,periodRows:window.v49PeriodRows,daySources:window.v49DaySources,sessionForKey:window.v52SessionForKey,inspector:window.v54InspectorHTML,openSession:window.openSession,openReassign:window.v48OpenReassign,renderReassign:window.v50RenderReassign,reassignCoverage:window.v50ReassignCoverage,togglePublic:window.v49TogglePublic,togglePrivate:window.v49TogglePrivate};
  function canonical(record,family){
    const model=window.OptimoBookingModel;
    if(family==='public'){
      const policy=confirmationPolicies[baseId(record.id)];
      const overridden=policy?{...record,confirmation:policy==='confirmed'?'confirmed':undefined,provisional:policy==='provisional',confirmOnFirstBooking:policy==='provisional'}:record;
      return model?.publicEvent(overridden)||{family:'public',label:'Public event',confirmation:overridden.provisional&&Number(record.bookings||0)===0?'provisional':'confirmed',publication:record.preliminary?'draft':'published',recurrence:null};
    }
    if(family==='private')return model?.privateBooking(record)||{family:'private',label:'Private booking',confirmation:record.status==='provisional'?'provisional':'confirmed',recurrence:record.recurrence||'casual',publication:'published'};
    return model?.block(record)||{family:'block',label:'Block',confirmation:'confirmed',reason:record.reason||'Closure',recurrence:null,publication:'published'};
  }
  function knownPeriodRows(){return safe(()=>typeof window.v48PeriodRows==='function'?window.v48PeriodRows():[])||[];}
  function privateDates(id){return [...new Set([allPrivates().find(p=>p.id===id)?.date||privateReferenceDays.get(id),...knownPeriodRows().filter(row=>row.private&&row.sourceId===id&&row.iso).map(row=>row.iso)].filter(Boolean))].sort();}
  const dateLabel=iso=>new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short',timeZone:'UTC'});
  function occurrenceRows({filtered=false,preliminary=true,raw=false}={}){
    const rows=new Map();
    function put(source,date,isPrivate,overrides={},origin='dated-source'){
      if(!source||!/^\d{4}-\d{2}-\d{2}$/.test(date||''))return;
      const key=`${source.id}@${date}`;
      const row={key,sourceId:source.id,iso:date,date:dateLabel(date),private:isPrivate,time:source.time,venue:source.venue,name:isPrivate?source.name:source.activity,business:source.business,
        facility:isPrivate?(safe(()=>window.v49PrivateFacility(source))||''):source.facility,bookings:isPrivate?1:source.bookings,att:source.att,
        assigned:isPrivate?(source.attention?2:3):source.assigned,status:isPrivate?(source.attention?'attention':'covered'):source.status,
        preliminary:!isPrivate&&!!source.preliminary,detail:source.detail||(isPrivate?(source.attention?'Allocation needs review':'Confirmed'):''),origin,...overrides};
      row.attention=isPrivate?!!source.attention:['attention','notassigned'].includes(row.status);
      if(safe(()=>v48ImpactContext?.items?.some(item=>item.key===key)))row.attention=true;
      rows.set(key,row);
    }
    // Explicit period examples extend the base day. Base-day records win when
    // both fixtures describe the same source and date, so Day and Range agree.
    knownPeriodRows().forEach(row=>put(row.private?allPrivates().find(p=>p.id===row.sourceId):allSessions().find(s=>s.id===row.sourceId),row.iso,!!row.private,{time:row.time,venue:row.venue},'period-example'));
    allSessions().forEach(s=>put(s,s.date,false));
    allPrivates().filter(p=>p.status==='confirmed'||p.status==='provisional').forEach(p=>put(p,p.date||privateReferenceDays.get(p.id),true,{},p.date?'dated-source':'reference-day'));
    // Preserve the upload's explicit future operating-date / unrostered case.
    const future=safe(()=>typeof v50UnrosteredDate!=='undefined'?v50UnrosteredDate:null);
    if(future)allSessions().filter(s=>referenceSessionIds.has(s.id)).forEach(s=>put(s,future,false,s.preliminary?{}:{status:'notassigned',assigned:0,detail:'Roster/resource assignment has not yet been completed for this future operating date.'},'unrostered-scenario'));
    const projected=!raw&&operationsAdapter?.projectOccurrences?operationsAdapter.projectOccurrences([...rows.values()]):[...rows.values()];
    return projected.filter(row=>{
      if(row.preliminary&&!preliminary)return false;
      if(!filtered)return true;
      const source=row.private?allPrivates().find(p=>p.id===row.sourceId):allSessions().find(s=>s.id===row.sourceId);
      return !!source&&(row.private?safe(()=>window.v49PrivateMatches(source)):safe(()=>window.v49SessionMatches(source)));
    }).sort((a,b)=>a.iso.localeCompare(b.iso)||a.time.localeCompare(b.time)||a.name.localeCompare(b.name));
  }
  function occurrenceRecord(row){
    const source=row.private?allPrivates().find(p=>p.id===row.sourceId):allSessions().find(s=>s.id===row.sourceId);
    return {...source,date:row.iso,time:row.time,venue:row.venue,facility:row.facility||source?.facility,activity:row.private?source?.activity:row.name,name:row.private?row.name:source?.name,recurrence:row.recurrence||source?.recurrence,resources:row.resources||source?.resources,linkedSupply:row.linkedSupply||source?.linkedSupply,att:row.att,bookings:row.bookings,assigned:row.assigned,attention:row.attention,status:row.status,detail:row.detail,preliminary:row.preliminary,__occurrenceKey:row.key};
  }
  function occurrenceSnapshot(row){return {id:row.key,key:row.key,sourceId:row.sourceId,iso:row.iso,date:row.iso,time:row.time,name:row.name,venue:row.venue,facility:row.facility,private:row.private,preliminary:row.preliminary,attendees:Number(row.att||0),att:Number(row.att||0),assigned:Number(row.assigned||0),status:row.status,attention:row.attention,detail:row.detail,origin:row.origin,canonical:canonical(occurrenceRecord(row),row.private?'private':'public')};}
  function projectedSession(id,render){
    const [sourceId,datePart]=String(id).split('@'),date=datePart?.slice(0,10),index=allSessions().findIndex(s=>s.id===sourceId),source=allSessions()[index];
    const row=date?(occurrenceRows().find(item=>!item.private&&item.key===String(id))||occurrenceRows().find(item=>!item.private&&item.sourceId===sourceId&&item.iso===date)):null;
    if(!source||!row)return render(sourceId);
    // Render an occurrence without changing the source fixture or retaining a
    // synthetic date on it. Every original drawer function still runs.
    sessions[index]=occurrenceRecord(row);
    try{return render(sourceId);}finally{sessions[index]=source;}
  }
  function semanticBadges(model){return `<span class="hybrid-semantic-badges"><span class="hybrid-family-badge" data-family="${model.family}">${escapeHTML(model.label)}</span>${model.recurrence?`<span class="hybrid-recurrence-badge">${escapeHTML(model.recurrence[0].toUpperCase()+model.recurrence.slice(1))}</span>`:''}<span class="hybrid-confirmation-badge" data-confirmation="${model.confirmation}">${model.confirmation==='provisional'?'Provisional':'Confirmed'}</span>${model.publication==='draft'?'<span class="hybrid-publication-badge">Unpublished draft</span>':''}</span>`;}

  const workflowCatalog = Object.freeze([
    {id:'events',title:'Event operations',group:'Workspace',pick:null,description:'Calendar or List with independent day/date-range scope; calendar grouping retains facility and session timelines, public/private bookings, preliminary opportunities and multi-selection.'},
    {id:'resources',title:'Resource operations',group:'Workspace',pick:null,description:'People, equipment and venue-bound assets, rostered availability, detailed diaries, preliminary and committed work.'},
    {id:'session',title:'Session details & actions',group:'Events',pick:'session',description:'Inspect linked supply, attendee coverage, booking context, and all existing session actions.'},
    {id:'assign',title:'Assign resources',group:'Events',pick:'session',description:'Quantities, partial coverage, advanced search, skill overrides, source-work review and optional compatible later slots.'},
    {id:'capacity',title:'Adjust linked supply capacity',group:'Events',pick:'session',description:'Change one linked resource/facility capacity, preview released allocations, choose timeslot/rest-of-day scope and confirm.'},
    {id:'publicReschedule',title:'Reschedule public bookings',group:'Events',pick:'session',description:'Customer/referrer and unallocated-only list, multi-day targets, package/price/data review, undecided work and final review.',simulated:true},
    {id:'createSessions',title:'Create additional sessions',group:'Events',pick:'session',description:'Copy configuration without bookings, add proposed sessions, resolve copied-supply conflicts and return targets to rescheduling.',simulated:true},
    {id:'bulkAssign',title:'Assign across selected occurrences',group:'Events',pick:'session',description:'Per-occurrence direct/inherited coverage, quantities, future-slot selection, permissioned override and review all.',simulated:true},
    {id:'bulkMove',title:'Move selected sessions',group:'Events',pick:'session',description:'Common date/time/venue rules plus individual supply/facility exceptions and complete review.',simulated:true},
    {id:'private',title:'Private booking details',group:'Private bookings',pick:'private',description:'Customer/referrer, full booking assignment, booking status and native actions.'},
    {id:'privateReschedule',title:'Reschedule private bookings',group:'Private bookings',pick:'private',description:'Duration-aware multi-day calendar, exact start, linked supply, customer context and final review.',simulated:true},
    {id:'resource',title:'Resource details & schedule',group:'Resources',pick:'resource',description:'Skills, operating venues, scheduled work, preliminary density, upcoming allocation and detailed availability.'},
    {id:'unavailable',title:'Mark unavailable',group:'Resources',pick:'resource',description:'End-of-day/custom/multi-day/all-future periods, optional inactivation, automatic/partial/unresolved impact and event handoff.',simulated:true},
    {id:'reassign',title:'Re-assign selected work',group:'Resources',pick:'resource',description:'Choose a work period and dated occurrences, then retain full replacement quantities, source review and whole-private booking decisions. Undated work requires an explicit choice.',simulated:true},
    {id:'temporaryVenueMove',title:'Move resource to another venue',group:'Resources',pick:'resource',description:'Temporary move, source work and takeover review, travel, destination assignments and unresolved-source handoff.',simulated:true},
    {id:'rosterImport',title:'Import roster',group:'Planning tools',pick:null,description:'Roster period/business area, source workbook, validate-only/create-update mode, mapped preview and import summary.',simulated:true},
    {id:'notifications',title:'Review booking notifications',group:'Planning tools',pick:'session',description:'Channels, templates, contacts/participants, message preview and recipient review. Supports public or private selections.',simulated:true},
    {id:'sourceFacilities',title:'Original facility diary & history',group:'Planning tools',pick:null,description:'Retain the upload’s additive facility planner, closure/clearance cases, occurrence-aware moves and audit history.'},
  ]);

  const entryPoints = [
    'showScreen','setEventMode','setDayLayout','setResMode','setResourceView',
    'setSelectedResource','openSession','openAssignResource','v47OpenCapacity',
    'openReschedulePublic','openBulkReschedule','openCreateSession','v49AssignSelected',
    'openMoveSessionBulk','v32InitMoveBulk','openPrivate','v33StartPrivateReschedule',
    'openUnavailable','v48OpenReassign','v44OpenMoveResource','v48OpenRosterImport',
    'v44NotifyAttendees','v44NotifySelected','v46NotifyPrivate','v46NotifySelectedPrivates',
    'v52SessionForKey','v44ReviewNoSkill','v44ReviewMoveCandidate',
    'v50RenderBulkAssign','v50ReviewBulkAssign','v44ReviewAssignment',
  ];

  function currentView() {
    const active = document.querySelector('.screen.on');
    const id = active?.id || '';
    return id.includes('roster') ? 'rosterImport' : id.includes('resource') ? 'resources' : id.includes('facility') ? 'sourceFacilities' : 'events';
  }

  function snapshot() {
    const view = currentView();
    const active = document.querySelector('.screen.on');
    const dateInput = view === 'resources'
      ? document.querySelector('#resDateField input[type="date"]')
      : document.querySelector('#eventDateField input[type="date"]');
    const drawerOpen = !!byId('drawer')?.classList.contains('on');
    const modalOpen = !!byId('modalBack')?.classList.contains('on');
    const impact = safe(() => typeof v48ImpactContext !== 'undefined' && v48ImpactContext ? {
      resource: v48ImpactContext.name,
      items: (v48ImpactContext.items || []).map(item => ({id:item.id || item.key || null,date:item.date || item.iso || null,title:item.title || item.name || null})),
    } : null);
    const sessionChoices = allSessions().map(base => {const s=operationsAdapter?.sessionRecord?.(base)||base;return ({
      id:s.id,label:publicLabel(s),name:s.activity,date:s.date || null,time:s.time,venue:s.venue,
      attendees:Number(s.att || 0),assigned:Number(s.assigned || 0),preliminary:!!s.preliminary,
      status:s.status,detail:s.detail || '',canonical:canonical(s,'public'),
      provisional:canonical(s,'public').confirmation==='provisional',confirmOnFirstBooking:canonical(s,'public').confirmOnFirstBooking||false,
      ready:!s.preliminary&&Number(s.assigned||0)>=Number(s.att||0)&&!['attention','notassigned'].includes(s.status),
    });});
    const privateChoices = allPrivates().map(base => {const p=operationsAdapter?.privateRecord?.(base)||base;return ({id:p.id,label:privateLabel(p),name:p.name,ref:p.ref,venue:p.venue,time:p.time,customer:p.customer,attention:!!p.attention,date:p.date||privateReferenceDays.get(p.id)||null,dates:p.dates||privateDates(p.id),dateBasis:p.date?'Explicit source date':'Initial day diary reference',canonical:canonical(p,'private')});});
    const datedOccurrences=occurrenceRows({preliminary:false}).map(occurrenceSnapshot);
    const resourceChoices = allResources().map(r => ({id:r.name,label:`${r.name} · ${r.venue} · ${r.human ? 'Person' : r.cat?.includes('Facilities') ? 'Facility' : 'Equipment'}`,name:r.name,venue:r.venue,human:!!r.human,movable:r.movable !== false,category:r.cat || ''}));
    return {
      version:'v53-guidance-2',view,module:view === 'resources' ? 'resources' : view === 'sourceFacilities' ? 'facilities' : 'events',
      title:text(active?.querySelector('h1')) || 'Operations',
      date:dateInput?.value || null,
      mode:view === 'resources' ? safe(() => resMode) : safe(() => eventMode),
      layout:view === 'resources' ? safe(() => resourceView) : safe(() => dayLayout),
      sessions:sessionChoices,privates:privateChoices,resources:resourceChoices,
      referenceDay,occurrences:datedOccurrences,attentionOccurrences:datedOccurrences.filter(row=>row.attention),
      operations:operationsAdapter?.snapshot?.()||null,
      resourceOperations:operationsAdapter?.snapshot?.()?.resourceOperations||null,
      selectedPublic:publicSelection().length,selectedPrivate:privateSelection().length,
      selected:{public:publicSelection(),private:privateSelection(),resource:safe(() => selectedResource) || null},
      eventPresentation:{...eventPresentation},
      reassignScope:reassignScope?{resource:reassignScope.resource,from:reassignScope.from,to:reassignScope.to,datedCount:reassignScope.rows.filter(row=>row.date).length,undatedCount:reassignScope.rows.filter(row=>!row.date).length,selectedKeys:safe(()=>[...v50Reassign.selected].map(index=>v50Reassign.work[index]?.occurrenceKey).filter(Boolean))||[],selectedDates:safe(()=>[...new Set([...v50Reassign.selected].map(index=>v50Reassign.work[index]?.date).filter(Boolean))])||[],stage:reassignScope.stage}:null,
      drawerTitle:drawerOpen ? text(byId('drawerTitle')) : null,
      drawer:{open:drawerOpen,title:drawerOpen ? text(byId('drawerTitle')) : '',subtitle:drawerOpen ? text(byId('drawerSub')) : '',steps:drawerOpen ? [...document.querySelectorAll('#drawerBody .guidebar .gstep')].map(step => ({label:text(step),active:step.classList.contains('on'),done:step.classList.contains('done')})) : []},
      modal:{open:modalOpen,title:modalOpen ? text(byId('modalTitle')) : ''},
      outstanding:{public:sessionChoices.filter(s=>!s.preliminary&&s.attendees>s.assigned).length,private:privateChoices.filter(p=>p.attention).length,impactContext:impact,scope:'Current source-prototype arrays and selections; not a shared backend or r7 booking state.'},
      functionPresence:Object.fromEntries(entryPoints.map(name => [name,typeof window[name] === 'function'])),
      sourceBehavior:{persistentFacilityCases:true,sharedBackend:false,notificationDelivery:false,rosterWorkbookParser:false,operationalCommit:operationsAdapter?'Dated assignments, session copies/moves, booking moves, private allocations and resource cases commit to local prototype state.':'Original upload simulations; operational extensions are not loaded.',bulkAssignmentCommit:operationsAdapter?'Validated dated allocations persist locally with remaining operational cases and audit.':'Source result screen; full mutation is not implemented by the upload.',productionBackend:false},
    };
  }

  function resolveSession(args, allowOccurrence = false) {
    const id = args.id || args.sessionId;
    if (!id) throw new Error('Choose a public session first.');
    const item = allSessions().find(s => s.id === baseId(id));
    if (!item) throw new Error('The selected public session is not in this prototype.');
    if (allowOccurrence && String(id).includes('@') && typeof window.v52SessionForKey === 'function') {
      if (!window.v52SessionForKey(String(id))) throw new Error('This occurrence is not available in the current period.');
      return String(id);
    }
    return item.id;
  }

  function resolvePrivate(args) {
    const id = args.id || args.privateId;
    if (!id) throw new Error('Choose a private booking first.');
    const item = allPrivates().find(p => p.id === baseId(id));
    if (!item) throw new Error('The selected private booking is not in this prototype.');
    return item.id;
  }

  function resolveResource(args) {
    const name = args.id || args.name || args.resourceName;
    if (!name) throw new Error('Choose a person, equipment item or facility first.');
    const item = allResources().find(r => r.name === name);
    if (!item) throw new Error('The selected resource is not in this prototype.');
    return item;
  }

  function selectPublic(args) {
    let ids;
    if (Array.isArray(args.ids)) ids=args.ids.map(id=>resolveSession({id},true));
    else if (args.id || args.sessionId) ids=[resolveSession(args,true)];
    else ids=publicSelection();
    if (!ids.length) throw new Error('Select one or more public session occurrences first.');
    if (Array.isArray(args.ids) || args.replaceSelection) eventSelected.clear();
    ids.forEach(id=>eventSelected.add(id));
    return ids;
  }

  function selectPrivate(args) {
    let ids;
    if (Array.isArray(args.ids)) ids=args.ids.map(id=>resolvePrivate({id}));
    else if (args.id || args.privateId) ids=[resolvePrivate(args)];
    else ids=privateSelection().map(baseId);
    if (!ids.length) throw new Error('Select one or more private bookings first.');
    if (Array.isArray(args.ids) || args.replaceSelection) privateSelected.clear();
    ids.forEach(id=>privateSelected.add(id));
    return [...new Set(ids)];
  }

  function setDate(id,date) {
    if (!date) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Use a date in YYYY-MM-DD form.');
    const input=document.querySelector(id);
    if (!input) throw new Error('The date control is unavailable in this view.');
    input.value=date;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function enterEvents(args={}) {
    call('showScreen','event');
    if(args.view||args.layout||args.scope||args.mode||args.date||args.from||args.to||args.grouping)setEventPresentation(args);
  }

  function enterResources(args={}) {
    call('showScreen','resource');
    if (args.mode) call('setResMode',args.mode === 'period' ? 'period' : 'day');
    if (args.layout) call('setResourceView',args.layout === 'venue' ? 'venue' : 'resource');
    setDate('#resDateField input[type="date"]',args.date);
  }

  function navigate(id,args={}) {
    const aliases={sessionDetail:'session',privateDetail:'private',resourceDetail:'resource'};
    id=aliases[id] || id;
    const catalog=[...workflowCatalog,...(operationsAdapter?.catalog||[])].find(item=>item.id===id);
    if (!catalog) return {ok:false,error:'This operation is not in the workflow catalog.',snapshot:snapshot()};
    try {
      if(operationsAdapter?.handles?.(id)){const result=operationsAdapter.navigate(id,args);updateOrientation();return {...result,snapshot:snapshot()};}
      if(id==='events') enterEvents(args);
      else if(id==='resources') enterResources(args);
      else if(id==='session') {const key=resolveSession(args,true);const date=args.date||String(key).split('@')[1]?.slice(0,10);enterEvents(date?{date,scope:'day'}:{});call('openSession',key);}
      else if(id==='assign') {const key=resolveSession(args);enterEvents();call('openAssignResource',key,!!args.optional);}
      else if(id==='capacity') {const key=resolveSession(args);enterEvents();call('v47OpenCapacity',key,args.supplyName || null);}
      else if(id==='publicReschedule') {const key=resolveSession(args,true);const date=args.date||String(key).split('@')[1]?.slice(0,10);enterEvents(date?{date,scope:'day'}:{});call('openReschedulePublic',key);}
      else if(id==='createSessions') {const key=resolveSession(args);enterEvents();call('openCreateSession',key,!!args.fromReschedule);}
      else if(id==='bulkAssign') {selectPublic(args);enterEvents();call('v49AssignSelected');}
      else if(id==='bulkMove') {selectPublic(args);enterEvents();call('v32InitMoveBulk');call('openMoveSessionBulk');}
      else if(id==='private') {const key=resolvePrivate(args);enterEvents(args.date?{date:args.date,scope:'day'}:{});call('openPrivate',key);}
      else if(id==='privateReschedule') {const ids=selectPrivate(args);enterEvents(args.date?{date:args.date,scope:'day'}:{});call('v33StartPrivateReschedule',ids);}
      else if(['resource','unavailable','reassign','temporaryVenueMove'].includes(id)) {
        const item=resolveResource(args);
        if(id==='temporaryVenueMove' && item.movable===false) throw new Error('This asset is venue-bound. Use its facility or availability workflow.');
        enterResources();
        if(item.cat?.includes('Facilities') && typeof window.setAssetType==='function') call('setAssetType','facility');
        else if(typeof window.setAssetType==='function') call('setAssetType','resource');
        call('setSelectedResource',item.name);
        if(id==='unavailable') call('openUnavailable',item.name);
        if(id==='reassign') call('v48OpenReassign',item.name,{from:args.from,to:args.to});
        if(id==='temporaryVenueMove') call('v44OpenMoveResource',item.name);
      }
      else if(id==='rosterImport') call('v48OpenRosterImport',args.origin==='resource'?'resource':'event');
      else if(id==='notifications') {
        if(args.kind==='private') {
          const ids=selectPrivate(args);enterEvents();
          if(ids.length===1) call('v46NotifyPrivate',ids[0]);else call('v46NotifySelectedPrivates');
        } else {
          if(args.ids || (!args.id&&!args.sessionId)) {selectPublic(args);enterEvents();call('v44NotifySelected');}
          else {const key=resolveSession(args);enterEvents();call('v44NotifyAttendees',key);}
        }
      }
      else if(id==='sourceFacilities') call('showScreen','facility');
      lastTask={id,title:catalog.title};
      updateOrientation();
      return {ok:true,action:id,simulated:!!catalog.simulated,snapshot:snapshot()};
    } catch(error) {
      return {ok:false,action:id,error:error.message,requires:catalog.pick || null,snapshot:snapshot()};
    }
  }

  function setEventPresentation(args={}){
    const next={...eventPresentation};
    if(args.scope||args.mode){const scope=args.scope||args.mode;next.scope=['day','week','month'].includes(scope)?scope:'period';}
    if(args.view)next.view=args.view==='list'?'list':'calendar';
    else if(args.layout)next.view=args.layout==='list'?'list':'calendar';
    if(args.grouping)next.grouping=args.grouping==='time'?'time':'facility';
    else if(args.layout==='timeline')next.grouping='facility';
    else if(args.layout==='calendar')next.grouping='time';
    if(args.from||args.date)next.from=args.from||args.date;
    if(args.to)next.to=args.to;
    else if(args.from||args.date)next.to=next.scope==='day'?next.from:next.to<next.from?next.from:next.to;
    if(next.scope==='day')next.to=next.from;
    if(next.scope==='week'){const date=new Date(`${next.from}T12:00:00Z`);date.setUTCDate(date.getUTCDate()+6);next.to=date.toISOString().slice(0,10);}
    if(next.scope==='month'){const date=new Date(`${next.from}T12:00:00Z`);next.from=`${next.from.slice(0,7)}-01`;next.to=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0,12)).toISOString().slice(0,10);}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(next.from)||!/^\d{4}-\d{2}-\d{2}$/.test(next.to)||next.to<next.from)throw new Error('Choose a valid date range with the end on or after the start.');
    Object.assign(eventPresentation,next);
    safe(()=>{eventMode=next.scope==='day'?'day':'period';dayLayout=next.view==='list'?'list':next.grouping==='facility'&&native.inspector?'timeline':'calendar';});
    const date=document.querySelector('#eventDateField input[type="date"]');if(date)date.value=next.from;
    if(typeof window.setEventMode==='function')window.setEventMode(next.scope==='day'?'day':'period');else window.renderEvent();
    return snapshot();
  }

  function eventControlHTML(){
    const state=eventPresentation;
    return `<div class="hybrid-presentation-segment" aria-label="Event display"><button type="button" data-hybrid-event-view="calendar" class="${state.view==='calendar'?'on':''}" aria-pressed="${state.view==='calendar'}">Calendar</button><button type="button" data-hybrid-event-view="list" class="${state.view==='list'?'on':''}" aria-pressed="${state.view==='list'}">List</button></div><label class="hybrid-inline-field">Date scope<select id="hybridEventScope" aria-label="Event date scope"><option value="day" ${state.scope==='day'?'selected':''}>Day</option><option value="week" ${state.scope==='week'?'selected':''}>Week</option><option value="month" ${state.scope==='month'?'selected':''}>Month</option><option value="period" ${state.scope==='period'?'selected':''}>Custom</option></select></label><label class="hybrid-inline-field">${state.scope==='day'?'Date':'From'}<input id="hybridEventFrom" aria-label="Event start date" type="date" value="${state.from}"></label>${state.scope!=='day'?`<label class="hybrid-inline-field">Through<input id="hybridEventTo" aria-label="Event end date" type="date" value="${state.to}"></label>`:''}${state.view==='calendar'&&state.scope==='day'&&native.inspector?`<label class="hybrid-inline-field">Group calendar by<select id="hybridEventGrouping" aria-label="Calendar grouping"><option value="facility" ${state.grouping==='facility'?'selected':''}>Venue & facility</option><option value="time" ${state.grouping==='time'?'selected':''}>Sessions & time</option></select></label>`:''}`;
  }

  function periodCalendar(rows){
    const keys=[...new Set(rows.map(row=>row.iso).filter(Boolean))].sort();
    const min=time=>{const match=String(time).match(/(\d{1,2}):(\d{2})/);return match?Number(match[1])*60+Number(match[2]):480;};
    const visible=rows.filter(row=>!safe(()=>v49AttentionOnly)||row.attention);
    if(!keys.length)return '<div class="hybrid-empty-period">No dated occurrences are provided for this range. Change the date range to inspect existing work.</div>';
    const timeRange=row=>{const parts=String(row.time).split(/[–—-]/),start=min(parts[0]),end=parts[1]?min(parts[1]):start+60;return {start,end:Math.max(start+1,end)};};
    const first=Math.min(480,...visible.map(row=>Math.floor(timeRange(row).start/60)*60));
    const last=Math.max(1200,...visible.map(row=>Math.ceil(timeRange(row).end/60)*60));
    const scale=108;
    const days=keys.map(date=>{
      const ends=[];
      const items=visible.filter(row=>row.iso===date).sort((a,b)=>timeRange(a).start-timeRange(b).start).map(row=>{
        const range=timeRange(row);let lane=ends.findIndex(end=>end<=range.start);if(lane<0)lane=ends.length;ends[lane]=range.end;return {row,...range,lane};
      });
      return {date,items,lanes:Math.max(1,ends.length)};
    });
    return `<div class="hybrid-period-calendar-scroll"><div class="hybrid-period-calendar" style="min-width:${days.reduce((sum,day)=>sum+Math.max(210,day.lanes*155+35),0)}px;grid-template-columns:${days.map(day=>`minmax(${Math.max(210,day.lanes*155+35)}px,1fr)`).join(' ')}">${days.map(day=>`<section class="hybrid-period-day" data-date="${day.date}"><header>${escapeHTML(day.date)}<small>${day.items.length} occurrences · time calendar</small></header><div class="hybrid-period-day-track" data-start-minute="${first}" style="height:${(last-first)/60*scale}px;--hybrid-hour:${scale}px">${Array.from({length:(last-first)/60+1},(_,index)=>first/60+index).filter(hour=>hour%2===0).map(hour=>`<span class="hybrid-period-hour" style="top:${(hour*60-first)/60*scale}px">${String(hour).padStart(2,'0')}:00</span>`).join('')}${day.items.map(({row,start,end,lane})=>{
      const source=row.private?allPrivates().find(p=>p.id===row.sourceId):allSessions().find(s=>s.id===row.sourceId);if(!source)return '';
      const model=canonical(occurrenceRecord(row),row.private?'private':'public'),key=row.key||`${row.sourceId}@${day.date}`,height=Math.max(22,(end-start)/60*scale-4),left=lane/day.lanes*100,width=100/day.lanes;
      return `<article class="hybrid-period-occurrence ${height<75?'compact':''}" data-family="${model.family}" data-confirmation="${model.confirmation}" data-publication="${model.publication}" data-occurrence-key="${escapeHTML(key)}" data-lane="${lane}" style="top:${(start-first)/60*scale}px;height:${height}px;left:calc(${left}% + ${30*(1-lane/day.lanes)}px);width:calc(${width}% - ${35/day.lanes+4}px)"><label class="hybrid-occurrence-check"><input type="checkbox" aria-label="Select ${escapeHTML(row.name)} on ${day.date}" data-hybrid-occurrence="${escapeHTML(key)}" data-kind="${row.private?'private':'public'}" ${(row.private?privateSelection():publicSelection()).includes(key)?'checked':''}></label><button type="button" data-hybrid-open="${row.private?'private':'session'}" data-id="${row.sourceId}" data-occurrence-key="${escapeHTML(key)}" title="${escapeHTML(row.name)} · ${escapeHTML(row.time)} · ${escapeHTML(row.venue)} · ${model.label}${model.recurrence?' · '+model.recurrence:''} · ${model.confirmation}"><strong>${escapeHTML(row.name)}</strong><span>${escapeHTML(row.time)}</span><small>${escapeHTML(row.venue)} · ${escapeHTML(row.facility||source.facility||'')}</small>${semanticBadges(model)}${row.attention?'<em class="hybrid-attention-label">Needs attention</em>':''}</button></article>`;
    }).join('')}</div></section>`).join('')}</div></div>`;
  }

  function renderEventPresentation(){
    const mode=safe(()=>eventMode)||eventPresentation.scope;
    eventPresentation.scope=mode==='period'?(eventPresentation.scope==='day'?'period':eventPresentation.scope):'day';
    const date=document.querySelector('#eventDateField input[type="date"]')?.value;
    if(date&&eventPresentation.scope==='day')eventPresentation.from=eventPresentation.to=date;
    safe(()=>{dayLayout=eventPresentation.view==='list'?'list':eventPresentation.grouping==='facility'&&native.inspector?'timeline':'calendar';});
    native.renderEvent?.();
    const screen=byId('screen-event');if(!screen)return;
    screen.classList.toggle('hybrid-events-calendar',eventPresentation.view==='calendar');
    screen.classList.toggle('hybrid-events-list',eventPresentation.view==='list');
    screen.classList.toggle('hybrid-events-period',eventPresentation.scope!=='day');
    let controls=byId('hybridEventPresentation');
    if(!controls){controls=document.createElement('section');controls.id='hybridEventPresentation';controls.setAttribute('aria-label','Event presentation and date scope');screen.querySelector('.pghead')?.after(controls);}
    controls.innerHTML=eventControlHTML();
    byId('hybridPeriodCalendar')?.remove();
    if(eventPresentation.scope!=='day'){
      const rows=window.v49PeriodRows(),host=byId('eventPeriodContent');
      if(host){
        const summary=host.querySelector('.v49-event-kpis');
        if(summary)summary.outerHTML=window.v49Summary(rows.filter(row=>!row.private&&!row.preliminary).map(occurrenceRecord),rows.filter(row=>row.private).map(occurrenceRecord));
        host.querySelectorAll(':scope>.v49-period-date').forEach(node=>node.remove());
        for(const iso of [...new Set(rows.map(row=>row.iso))]){
          const dr=rows.filter(row=>row.iso===iso),visible=dr.filter(row=>!safe(()=>v49AttentionOnly)||row.attention);if(!visible.length)continue;
          const venues=[...new Set(visible.map(row=>row.venue))],issues=dr.filter(row=>row.attention).length;
          host.insertAdjacentHTML('beforeend',`<details class="v49-period-date" data-date="${iso}" open><summary><span>${escapeHTML(dateLabel(iso))}</span><span class="small muted">${dr.filter(row=>!row.preliminary).length} scheduled items</span><span class="sp"></span>${issues?`<span class="badge b-warn">${issues} need attention</span>`:'<span class="badge b-good">Ready</span>'}</summary><div class="body">${venues.map(venue=>{const vr=dr.filter(row=>row.venue===venue);return window.v49VenueAccordion(venue,vr.filter(row=>!row.private).map(occurrenceRecord),vr.filter(row=>row.private).map(occurrenceRecord),iso,'period');}).join('')}</div></details>`);
        }
      }
    }
    if(eventPresentation.scope!=='day'&&eventPresentation.view==='calendar'){
      const host=byId('eventPeriodContent');if(host){const calendar=document.createElement('div');calendar.id='hybridPeriodCalendar';calendar.innerHTML=periodCalendar(window.v49PeriodRows());host.append(calendar);}
    }
    decorateSemantics();
    schedule();
  }

  function datedWorkForResource(resource){
    const diary=(resource.assign||[]).filter(row=>row[2]==='public'||row[2]==='private');
    const occurrences=occurrenceRows({preliminary:false}).filter(row=>row.origin!=='unrostered-scenario');
    const matchedSource=new Set(),rows=[];
    for(const occurrence of occurrences){
      const source=occurrence.private?allPrivates().find(p=>p.id===occurrence.sourceId):allSessions().find(s=>s.id===occurrence.sourceId);if(!source)continue;
      const index=diary.findIndex(row=>row[1]===(occurrence.private?source.name:source.activity)&&row[3]===source.venue&&row[2]===(occurrence.private?'private':'public')&&row[0]===source.time);
      const directlyLinked=occurrence.private?(source.resources||[]).includes(resource.name):(source.linkedSupply||[]).some(supply=>supply.name===resource.name);
      if(index<0&&!directlyLinked)continue;
      if(index>=0)matchedSource.add(index);
      const linked=(source.linkedSupply||[]).find(supply=>supply.name===resource.name);
      const template=index>=0?diary[index]:[occurrence.time,occurrence.name,occurrence.private?'private':'public',occurrence.venue,occurrence.private?'Private booking · replacement resource required':`${Number(linked?.used||0)} attendee places`];
      const work=[occurrence.time||template[0],occurrence.name||template[1],occurrence.private?'private':'public',occurrence.venue||template[3],template[4]];
      work.date=occurrence.iso;work.occurrenceKey=occurrence.key||`${occurrence.sourceId}@${occurrence.iso}`;work.sourceId=occurrence.sourceId;work.family=occurrence.private?'private':'public';
      rows.push(work);
    }
    diary.forEach((assignment,index)=>{if(matchedSource.has(index))return;const work=[...assignment];work.date=null;work.occurrenceKey=`undated:${resource.name}:${index}`;work.family=assignment[2]==='private'?'private':'public';rows.push(work);});
    return rows.sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||a[0].localeCompare(b[0]));
  }

  function currentReassignment(){return safe(()=>v50Reassign)||null;}
  function rebuildReassignScope(preserve=true){
    const state=currentReassignment();if(!state||!reassignScope)return;
    const prior=new Map((state.work||[]).map((row,index)=>[row.occurrenceKey,{picked:state.selected?.has(index),direct:state.direct?.[index]||[]}]));
    const rows=datedWorkForResource(state.r).filter(row=>!row.date||(row.date>=reassignScope.from&&row.date<=reassignScope.to));
    state.work=rows;state.selected=new Set();state.direct={};
    rows.forEach((row,index)=>{const old=prior.get(row.occurrenceKey);if((preserve&&old?old.picked:!!row.date))state.selected.add(index);state.direct[index]=old?.direct||[];});
    state.index=[...state.selected][0]||0;
    reassignScope.rows=rows;reassignScope.stage=1;
  }

  function startDatedReassignment(name,args={}){
    const resource=allResources().find(item=>item.name===name);if(!resource)throw new Error('Choose a resource first.');
    const dated=datedWorkForResource(resource).filter(row=>row.date);
    const selectedDate=document.querySelector('#resDateField input[type="date"]')?.value;
    const from=args.from||selectedDate||dated[0]?.date||'';
    const to=args.to||from;
    if(!from||!to||to<from)throw new Error('Choose the work date range before reassigning work.');
    reassignScope={resource:name,from,to,rows:[],stage:1,initializing:true};
    native.openReassign(name);
    reassignScope.initializing=false;
    rebuildReassignScope(false);
    window.v50RenderReassign(1);
  }

  function decorateReassignment(step){
    if(!reassignScope)return;
    const state=currentReassignment();if(!state||state.name!==reassignScope.resource)return;
    reassignScope.stage=step;
    const body=byId('drawerBody');if(!body)return;
    let context=byId('hybridReassignScope');
    if(!context){context=document.createElement('section');context.id='hybridReassignScope';body.querySelector('.guidebar')?.after(context);if(!context.isConnected)body.prepend(context);}
    context.innerHTML=`<div class="hybrid-reassign-period-title"><strong>Work period</strong><span>${escapeHTML(reassignScope.from)} through ${escapeHTML(reassignScope.to)}</span></div>${step===1?`<div class="hybrid-reassign-period-fields"><label>From<input name="hybridReassignFrom" aria-label="Reassignment start date" type="date" value="${reassignScope.from}"></label><label>Through<input name="hybridReassignTo" aria-label="Reassignment end date" type="date" value="${reassignScope.to}"></label><button type="button" class="btn sm" data-hybrid-reassign-range>Show work in period</button></div><p>Choose dated occurrences in this period. Undated diary work is separate and is not selected automatically.</p>`:`<p>${state.selected.size} selected work item${state.selected.size===1?'':'s'} · dates and individual replacements are retained through review.</p>`}`;
    const selector=step===1?'.v48-reassign-row':step===2?'.v50-work-item':'.v50-review-row';
    const nodes=[...body.querySelectorAll(selector)],indices=step===1?state.work.map((_,index)=>index):[...state.selected].sort((a,b)=>a-b);
    nodes.forEach((node,index)=>{const row=state.work[indices[index]];if(!row)return;node.dataset.occurrenceKey=row.occurrenceKey;node.dataset.workDate=row.date||'';node.dataset.family=row.family||row[2];
      const checkbox=node.querySelector('input[type="checkbox"]');if(checkbox)checkbox.dataset.occurrenceKey=row.occurrenceKey;
      if(!node.querySelector('.hybrid-work-date')){const date=document.createElement('span');date.className='hybrid-work-date';date.textContent=row.date||'Date needed · outside the dated period';node.prepend(date);}
      if(step===1&&!row.date&&(!nodes[index-1]||state.work[indices[index-1]]?.date)){const label=document.createElement('div');label.className='hybrid-undated-title';label.textContent='Date needed — include only after an explicit operational decision';node.before(label);}
    });
    decorateSemantics();
  }

  function policyStrip(sessionId){
    const source=allSessions().find(item=>item.id===baseId(sessionId));if(!source)return;
    const occurrence=occurrenceRows().find(row=>!row.private&&row.key===String(sessionId));
    const session=occurrence?occurrenceRecord(occurrence):source;
    activePublicSessionId=String(sessionId);
    const body=byId('drawerBody');if(!body)return;
    let strip=byId('hybridSessionConfirmation');if(!strip){strip=document.createElement('section');strip.id='hybridSessionConfirmation';body.prepend(strip);}
    const policy=confirmationPolicies[session.id]||(session.provisional||session.confirmOnFirstBooking?'provisional':'confirmed');
    strip.innerHTML=`${occurrence?`<div class="hybrid-occurrence-context">${escapeHTML(occurrence.iso)} · ${escapeHTML(occurrence.time)} · ${escapeHTML(occurrence.venue)}</div>`:''}${semanticBadges(canonical(session,'public'))}<label>Confirmation setting<select id="hybridConfirmationPolicy" aria-label="Public event confirmation setting"><option value="confirmed" ${policy==='confirmed'?'selected':''}>Confirmed</option><option value="provisional" ${policy==='provisional'?'selected':''}>Provisional until first booking</option></select></label><p>${canonical(session,'public').bookings>0?'This event has bookings, so its derived confirmation status is Confirmed.':'An event set to provisional confirms when its first booking is received.'}${session.preliminary?' This is also an unpublished draft; publication and confirmation are separate.':''}</p>`;
    if(occurrence&&occurrence.iso!==source.date){
      body.querySelectorAll('[onclick]').forEach(node=>{const handler=node.getAttribute('onclick');if(handler?.includes(`openAssignResource('${source.id}'`))node.setAttribute('onclick',`OptimoV53Guide.navigate('bulkAssign',{ids:['${occurrence.key}']})`);});
    }
  }

  function decorateNode(node,model){
    if(!node||!model)return;
    node.dataset.family=model.family;node.dataset.confirmation=model.confirmation;node.dataset.publication=model.publication;
    if(model.recurrence)node.dataset.recurrence=model.recurrence;
  }
  function decorateSemantics(){
    document.querySelectorAll('#screen-event .v54-slot,#screen-event .resblock,#screen-event .v49-table tr.click').forEach(node=>{
      const handler=node.getAttribute('onclick')||[...node.querySelectorAll('[onclick]')].map(child=>child.getAttribute('onclick')).join(' ');
      let match=handler.match(/v54Select\('(public|private)','([^']+)'\)/),family=match?.[1],id=match?.[2];
      if(!id){match=handler.match(/open(Session|Private)\('([^']+)'\)/);if(match){family=match[1]==='Private'?'private':'public';id=match[2];}}
      const record=family==='private'?allPrivates().find(item=>item.id===baseId(id)):allSessions().find(item=>item.id===baseId(id));if(!record)return;
      const model=canonical(record,family||'public');decorateNode(node,model);
      const iso=node.closest('.v49-period-date')?.dataset.date||eventPresentation.from;
      node.dataset.occurrenceKey=`${record.id}@${iso}`;
      const description=`${model.label}${model.recurrence?' · '+model.recurrence:''} · ${model.confirmation}${model.publication==='draft'?' · Unpublished draft':''} · ${iso} · ${record.time}`;
      if(node.matches('.v54-slot,.resblock')){node.title=description+' · '+(record.activity||record.name)+' · '+record.venue;node.setAttribute('aria-label',node.title);}
      if(node.matches('tr')){const cell=node.querySelector('td:nth-child(3)');if(cell&&!cell.querySelector('.hybrid-semantic-badges'))cell.insertAdjacentHTML('beforeend',semanticBadges(model));}
      else if(!node.matches('.v54-slot')&&!node.querySelector('.hybrid-semantic-badges'))node.insertAdjacentHTML('beforeend',semanticBadges(model));
      if(eventPresentation.scope==='day'){
        const checkbox=node.matches('.v54-slot')?node.nextElementSibling:node.querySelector('input[type="checkbox"]');
        if(checkbox?.matches('input[type="checkbox"]'))checkbox.checked=(family==='private'?privateSelection():publicSelection()).some(key=>key===record.id||key===`${record.id}@${iso}`);
      }
    });
    const note=document.querySelector('.v54-toolbar-note');
    if(note){const title=note.querySelector('b'),copy=note.querySelector('.small');if(title&&title.textContent!=='Calendar · Venue & facility')title.textContent='Calendar · Venue & facility';if(copy&&copy.textContent!=='Select a block to review it; open full details for all actions.')copy.textContent='Select a block to review it; open full details for all actions.';}
    const inspector=byId('v54Inspector'),focus=safe(()=>v54Focus);
    if(inspector&&focus){const source=focus.kind==='private'?allPrivates().find(p=>p.id===focus.id):allSessions().find(s=>s.id===focus.id);if(source){
      const row=occurrenceRows().find(item=>item.sourceId===source.id&&item.iso===eventPresentation.from),record=row?occurrenceRecord(row):source;
      let strip=inspector.querySelector('.hybrid-inspector-semantics');if(!strip){strip=document.createElement('div');strip.className='hybrid-inspector-semantics';inspector.querySelector('.head')?.after(strip);}
      if(strip){const content=`<div class="hybrid-occurrence-context">${escapeHTML(row?.iso||eventPresentation.from)} · ${escapeHTML(record.time)}</div>${semanticBadges(canonical(record,focus.kind))}`;if(strip.innerHTML!==content)strip.innerHTML=content;}
      if(row&&!row.private&&row.iso!==source.date)inspector.querySelectorAll('[onclick]').forEach(node=>{if(node.getAttribute('onclick')?.includes(`openAssignResource('${source.id}'`))node.setAttribute('onclick',`OptimoV53Guide.navigate('bulkAssign',{ids:['${row.key}']})`);});
    }}
    document.querySelectorAll('#screen-resource .resblock').forEach(node=>{
      const title=text(node.querySelector('b'));
      if(node.classList.contains('private'))decorateNode(node,canonical(allPrivates().find(p=>p.name===title)||{},'private'));
      else if(node.classList.contains('public')||node.classList.contains('prelim')){const session=allSessions().find(s=>s.activity===title);if(session)decorateNode(node,canonical(session,'public'));}
      else if(node.classList.contains('unavailable')||node.classList.contains('blocked'))decorateNode(node,canonical({reason:text(node)},'block'));
    });
    document.querySelectorAll('.v55-bookblock').forEach(node=>{const classes=node.classList;decorateNode(node,canonical({type:classes.contains('seasonal')?'seasonal':classes.contains('regular')?'regular':'casual'},'private'));});
  }

  function installAdapters(){
    if(typeof native.periodRows==='function')window.v49PeriodRows=function(){return occurrenceRows({filtered:true,preliminary:!!safe(()=>v48ShowPreliminary)}).filter(row=>eventPresentation.scope==='day'||(row.iso>=eventPresentation.from&&row.iso<=eventPresentation.to));};
    if(typeof native.daySources==='function')window.v49DaySources=function(){const iso=document.querySelector('#eventDateField input')?.value||eventPresentation.from,rows=occurrenceRows({filtered:true,preliminary:!!safe(()=>v48ShowPreliminary)}).filter(row=>row.iso===iso);return {ss:rows.filter(row=>!row.private).map(occurrenceRecord),pp:rows.filter(row=>row.private).map(occurrenceRecord)};};
    if(typeof native.sessionForKey==='function')window.v52SessionForKey=function(key){const row=occurrenceRows().find(item=>!item.private&&item.key===String(key));return row?{...occurrenceRecord(row),id:row.key,__baseId:row.sourceId,__instanceDate:row.iso}:native.sessionForKey(key);};
    if(typeof native.eventCalendar==='function')window.eventCalendarHtml=function(){return periodCalendar(occurrenceRows({filtered:true,preliminary:!!safe(()=>v48ShowPreliminary)}).filter(row=>row.iso===eventPresentation.from));};
    if(typeof native.inspector==='function')window.v54InspectorHTML=function(...args){const focus=safe(()=>v54Focus);return focus?.kind==='public'?projectedSession(`${focus.id}@${eventPresentation.from}`,()=>native.inspector(...args)):native.inspector(...args);};
    if(typeof native.renderEvent==='function')window.renderEvent=renderEventPresentation;
    if(typeof native.openSession==='function')window.openSession=function(id,...args){const key=String(id).includes('@')?id:`${id}@${eventPresentation.from}`;const result=projectedSession(key,sourceId=>native.openSession(sourceId,...args));policyStrip(key);return result;};
    for(const family of ['Public','Private']){const original=native[`toggle${family}`];if(typeof original==='function')window[`v49Toggle${family}`]=function(id,on){const source=(family==='Public'?allSessions():allPrivates()).find(item=>item.id===baseId(id)),date=family==='Public'?source?.date:(source?.date||privateReferenceDays.get(source?.id)),key=!String(id).includes('@')&&eventPresentation.scope==='day'&&eventPresentation.from!==date?`${id}@${eventPresentation.from}`:id;return original(key,on);};}
    if(typeof native.openReassign==='function')window.v48OpenReassign=startDatedReassignment;
    if(typeof native.renderReassign==='function')window.v50RenderReassign=function(step,...args){const result=native.renderReassign(step,...args);if(!reassignScope?.initializing)decorateReassignment(step);return result;};
    if(typeof native.reassignCoverage==='function')window.v50ReassignCoverage=function(index,...args){
      const state=currentReassignment();if(!reassignScope||!state?.work?.[index])return native.reassignCoverage(index,...args);
      const selected=state.selected,date=state.work[index].date;
      state.selected=new Set([...selected].filter(key=>key===index||(date&&state.work[key]?.date===date)));
      try{return native.reassignCoverage(index,...args);}finally{state.selected=selected;}
    };
    renderEventPresentation();
  }

  let lastTask=null,lastSnapshot='',scheduled=false;
  function workflowHint(heading) {
    const value=heading.toLowerCase();
    if(value.includes('capacity')) return 'Review the individual linked item and occurrence scope before confirming capacity changes.';
    if(value.includes('private')) return 'Keep the complete private booking together. Resource replacement is a whole-booking decision.';
    if(value.includes('re-assign')||value.includes('replacement')) return 'Choose the work to move, compare replacement coverage, then review the plan. Other source work stays available.';
    if(value.includes('unavailable')||value.includes('impact')) return 'Review automatic, partial and unresolved coverage separately. Remaining work stays visible for follow-up.';
    if(value.includes('move')) return 'Review the selected scope, linked supply and source work before applying the move.';
    if(value.includes('assign')) return 'Plan coverage by occurrence. Advanced search, skill and cross-venue reviews remain available; partial coverage stays explicit.';
    if(value.includes('reschedul')) return 'Choose customer booking destinations, review package/data/price decisions, then apply agreed moves.';
    if(value.includes('create')) return 'Copy the source setup without bookings; resolve proposed supply conflicts before confirming new sessions.';
    return 'Follow the existing steps. Keep the current object and scope in view, then review the consequences before applying.';
  }

  function setContent(node,value) {if(node.textContent!==value) node.textContent=value;}
  function updateOrientation() {
    const main=document.querySelector('.main');
    if(!main)return;
    let bar=byId('hybridV53Orientation');
    if(!bar) {
      bar=document.createElement('section');bar.id='hybridV53Orientation';bar.className='hybrid-v53-orientation';bar.setAttribute('aria-label','Operations orientation');
      const heading=document.createElement('strong');heading.className='hybrid-v53-current';
      const copy=document.createElement('span');copy.className='hybrid-v53-scope';
      bar.append(heading,copy);main.prepend(bar);
    }
    const snap=snapshot();
    setContent(bar.querySelector('.hybrid-v53-current'),snap.title);
    const selected=[snap.selectedPublic?`${snap.selectedPublic} public occurrence${snap.selectedPublic===1?'':'s'} selected`:'',snap.selectedPrivate?`${snap.selectedPrivate} private booking${snap.selectedPrivate===1?'':'s'} selected`:''].filter(Boolean);
    bar.classList.toggle('has-selection',selected.length>0);
    setContent(bar.querySelector('.hybrid-v53-scope'),selected.length?selected.join(' · '):'Select the work you want to manage. Detailed decisions stay in their original guided workflows.');
    const drawer=byId('drawer');
    let task=byId('hybridV53DrawerGuide');
    if(drawer && !task){task=document.createElement('div');task.id='hybridV53DrawerGuide';task.className='hybrid-v53-drawer-guide';drawer.querySelector('.dh')?.after(task);}
    if(task){
      const title=snap.drawerTitle || lastTask?.title || 'Current task';
      task.hidden=!snap.drawer.open;
      const line=`${title} — ${workflowHint(title)}${snap.drawer.subtitle?' Scope: '+snap.drawer.subtitle:''}`;
      setContent(task,line);
    }
    decorateSemantics();
    const serialized=JSON.stringify(snap);
    if(serialized!==lastSnapshot){lastSnapshot=serialized;window.dispatchEvent(new CustomEvent('optimo:v53:snapshot',{detail:snap}));}
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;updateOrientation();});}
  function setConfirmationPolicy(id,policy){
    const session=allSessions().find(item=>item.id===baseId(id));
    if(!session||!['confirmed','provisional'].includes(policy))throw new Error('Choose a public event and a valid confirmation setting.');
    confirmationPolicies[session.id]=policy;
    try{localStorage.setItem('optimo-v53-confirmation-policies-v1',JSON.stringify(confirmationPolicies));}catch{}
    renderEventPresentation();
    if(byId('drawer')?.classList.contains('on'))policyStrip(activePublicSessionId||session.id);
    updateOrientation();
    return canonical(session,'public');
  }
  window.OptimoV53Guide=Object.freeze({snapshot,navigate,get workflowCatalog(){return [...workflowCatalog,...(operationsAdapter?.catalog||[])];},setEventPresentation,setConfirmationPolicy,
    registerOperations(adapter){operationsAdapter=adapter;renderEventPresentation();updateOrientation();},
    rawOccurrences(){return occurrenceRows({raw:true});},
    sourceRecords(){return {sessions:allSessions(),privates:allPrivates(),resources:allResources()};},
    refresh(){renderEventPresentation();safe(()=>window.renderResource());updateOrientation();}
  });
  document.addEventListener('click',event=>{
    const view=event.target.closest('[data-hybrid-event-view]');
    if(view){event.preventDefault();setEventPresentation({view:view.dataset.hybridEventView});return;}
    const open=event.target.closest('[data-hybrid-open]');
    if(open){event.preventDefault();const key=open.dataset.occurrenceKey;const date=key?.split('@')[1];navigate(open.dataset.hybridOpen,{id:open.dataset.hybridOpen==='session'?key||open.dataset.id:open.dataset.id,date});return;}
    const range=event.target.closest('[data-hybrid-reassign-range]');
    if(range){event.preventDefault();
      const from=document.querySelector('[name="hybridReassignFrom"]')?.value,to=document.querySelector('[name="hybridReassignTo"]')?.value;
      if(!from||!to||to<from){call('toast','Choose a valid work period.');return;}
      reassignScope.from=from;reassignScope.to=to;rebuildReassignScope(true);window.v50RenderReassign(1);
    }
  });
  document.addEventListener('change',event=>{
    const element=event.target;
    if(element.id==='hybridEventScope')setEventPresentation({scope:element.value});
    if(element.id==='hybridEventFrom')setEventPresentation({from:element.value});
    if(element.id==='hybridEventTo')setEventPresentation({to:element.value});
    if(element.id==='hybridEventGrouping')setEventPresentation({grouping:element.value});
    if(element.id==='hybridConfirmationPolicy')setConfirmationPolicy(activePublicSessionId,element.value);
    if(element.dataset.hybridOccurrence){const selection=element.dataset.kind==='private'?privateSelected:eventSelected;element.checked?selection.add(element.dataset.hybridOccurrence):selection.delete(element.dataset.hybridOccurrence);renderEventPresentation();}
  });
  new MutationObserver(schedule).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['class','style']});
  document.addEventListener('change',schedule,true);
  document.addEventListener('click',schedule,true);
  installAdapters();
  updateOrientation();
})();
