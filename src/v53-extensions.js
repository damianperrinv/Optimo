/* Targeted operational gaps on the original V53. Source scripts remain intact. */
(() => {
  'use strict';
  if(window.OptimoV53Operations||!window.OptimoV53Guide)return;
  const guide=window.OptimoV53Guide,storeKey='optimo-actual-v53-operations-v1';
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone=v=>JSON.parse(JSON.stringify(v));
  const read=()=>{try{return JSON.parse(localStorage.getItem(storeKey));}catch{return null;}};
  const state=read()||{version:1,copies:[],overrides:{},bookings:{},changes:[],counter:0};
  let resourceAdapter=null,draft=null,privateContext=null;
  const sources=()=>guide.sourceRecords(),sourceSessions=()=>sources().sessions,sourcePrivates=()=>sources().privates,sourceResources=()=>sources().resources;
  const referenceDay=guide.snapshot().referenceDay;
  const dateKey=key=>String(key).split('@')[1]?.slice(0,10);
  const addDays=(iso,n)=>{const d=new Date(`${iso}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
  const minutes=t=>{const [h,m]=String(t).split(':').map(Number);return h*60+m;};
  const format=t=>`${String(Math.floor(t/60)).padStart(2,'0')}:${String(t%60).padStart(2,'0')}`;
  const range=time=>String(time).split(/[–—-]/).map(minutes);
  const overlaps=(a,b)=>{const x=range(a),y=range(b);return x[0]<y[1]&&y[0]<x[1];};
  const validDate=iso=>/^\d{4}-\d{2}-\d{2}$/.test(iso||'');
  const sourceFor=row=>(row.private?sourcePrivates():sourceSessions()).find(s=>s.id===row.sourceId);
  const resourceByName=(name,venue)=>sourceResources().find(r=>r.name===name)||sourceResources().find(r=>r.name===`${name} · ${venue}`);
  const namesFor=row=>row.resources||row.linkedSupply?.map(s=>s.name)||sourceFor(row)?.resources||sourceFor(row)?.linkedSupply?.map(s=>s.name)||[];
  const can=name=>window.OptimoPermissions?.can?.(name)!==false;
  const audit=entry=>window.OptimoAudit?.record?.(entry);
  function persist(){localStorage.setItem(storeKey,JSON.stringify(state));}
  function refresh(){guide.refresh();window.dispatchEvent(new CustomEvent('optimo:v53:operations',{detail:snapshot()}));}
  function record(action,entity,before,after,scope,outcome='Applied'){
    const entry={area:'Events',action,entity,before:clone(before),after:clone(after),scope:clone(scope),outcome};
    state.changes.unshift({id:`change-${Date.now()}-${state.changes.length}`,at:new Date().toISOString(),action,entity,scope:clone(scope),outcome});
    audit(entry);persist();
  }
  function restoreCopies(){for(const s of state.copies)if(!sourceSessions().some(x=>x.id===s.id))sourceSessions().push(clone(s));}
  restoreCopies();
  function booking(id){
    if(state.bookings[id])return state.bookings[id];
    const p=sourcePrivates().find(p=>p.id===id);if(!p)throw new Error('Choose a private booking.');
    const rows=projectOccurrences(guide.rawOccurrences()).filter(r=>r.private&&r.sourceId===id&&r.origin!=='unrostered-scenario');
    return {id,recurrence:p.recurrence||'casual',allocations:rows.map((r,i)=>({id:`${id}-allocation-${i+1}`,originalKey:r.originalKey||r.key,date:r.iso,start:range(r.time)[0]===undefined?'09:00':format(range(r.time)[0]),end:format(range(r.time)[1]),packageName:p.packageName||p.name,venue:r.venue,facility:r.facility,resources:[...r.resources],attention:r.attention,status:r.status,assigned:r.assigned,detail:r.detail}))};
  }
  function projectOccurrences(input){
    let rows=input.map(r=>({...r,originalKey:r.originalKey||r.key,resources:[...namesFor(r)],linkedSupply:clone(r.linkedSupply||sourceFor(r)?.linkedSupply||[])}));
    for(const [id,b] of Object.entries(state.bookings)){
      const p=sourcePrivates().find(p=>p.id===id);if(!p)continue;
      rows=rows.filter(r=>!(r.private&&r.sourceId===id));
      for(const a of b.allocations){
        const originalKey=a.originalKey||`${id}@${a.date}#${a.id}`,override=state.overrides[originalKey]||{};
        rows.push({key:`${id}@${a.date}#${a.id}`,originalKey,sourceId:id,iso:a.date,date:a.date,time:`${a.start}–${a.end}`,name:b.allocations.some(x=>x.packageName!==a.packageName)?`${p.name} · ${a.packageName}`:p.name,venue:a.venue,business:p.business,facility:a.facility,private:true,bookings:1,att:p.att,assigned:a.assigned??(p.attention?2:3),status:a.status||(p.attention?'attention':'covered'),attention:a.attention??!!p.attention,resources:[...a.resources],linkedSupply:[],preliminary:false,detail:a.detail||`${a.packageName} · ${b.recurrence} booking`,origin:'private-allocation',allocationId:a.id,packageName:a.packageName,recurrence:b.recurrence,...override});
      }
    }
    rows=rows.map(row=>{
      const patch=state.overrides[row.originalKey]||{};
      const next={...row,...patch};next.iso=patch.iso||patch.date||row.iso;next.date=next.iso;
      if(next.iso!==row.iso)next.key=`${row.sourceId}@${next.iso}#${row.originalKey.split('@')[1]}`;
      if(!next.private&&patch.assigned!==undefined){next.attention=Number(next.assigned)<Number(next.att||0)||next.status==='notassigned';if(!next.attention&&['attention','notassigned'].includes(next.status))next.status=Number(next.att||0)?'covered':'nobookings';}
      return next;
    });
    return resourceAdapter?.projectOccurrences?resourceAdapter.projectOccurrences(rows):rows;
  }
  const occurrences=()=>projectOccurrences(guide.rawOccurrences());
  function applyOccurrence(key,patch,options={}){
    const before=occurrences().find(r=>r.key===key||r.originalKey===key);if(!before)throw new Error('The selected dated occurrence is unavailable.');
    state.overrides[before.originalKey]={...(state.overrides[before.originalKey]||{}),...clone(patch)};
    persist();
    const after=occurrences().find(r=>r.originalKey===before.originalKey);
    if(options.audit!==false)record(options.action||'Update occurrence',before.name,before,after,{occurrence:before.key,date:before.iso});
    if(options.refresh!==false)refresh();
    return after;
  }
  function availability(name,target,{excludeKey=null,excludeKeys=[],pending=[],allowVenueReview=false}={}){
    const configured=target.linkedSupply?.find(s=>s.name===name),known=occurrences().some(row=>namesFor(row).includes(name));
    const r=resourceByName(name,target.venue)||(configured?.type!=='Resource'&&(configured||known)?{name,human:false,cat:configured?.type||'Equipment',venue:target.venue}:null);
    if(!r)return {available:false,reason:'Resource is not in the active catalogue.'};
    const instant=`${target.iso||target.date}T${String(target.time).slice(0,5)}`,transfer=(resourceAdapter?.resourceState?.(name)?.moves||[]).find(move=>move.venue===target.venue&&instant>=move.from&&instant<move.to);
    if(r.venue&&target.venue&&r.venue!==target.venue&&!transfer&&!allowVenueReview)return {available:false,reason:'Resource is at another venue; replace it or review a temporary venue transfer.'};
    if(resourceAdapter?.isBlocked?.(name,target.iso||target.date,target.time))return {available:false,reason:'Blocked or inactive in this period.'};
    if(resourceAdapter?.isAvailable?.(name,target)===false)return {available:false,reason:'Unavailable in this period.'};
    const hits=[...occurrences(),...pending].filter(row=>row.key!==excludeKey&&row.originalKey!==excludeKey&&!excludeKeys.includes(row.key)&&!excludeKeys.includes(row.originalKey)&&!row.preliminary&&row.origin!=='unrostered-scenario'&&(row.iso||row.date)===(target.iso||target.date)&&overlaps(row.time,target.time)&&namesFor(row).some(n=>n===name||resourceByName(n,row.venue)?.name===r.name));
    if(hits.length){
      const supply=target.linkedSupply?.find(s=>s.name===name||resourceByName(s.name,target.venue)?.name===r.name),knownCapacity=occurrences().flatMap(row=>row.linkedSupply||[]).filter(s=>s.name===name||resourceByName(s.name,target.venue)?.name===r.name).map(s=>Number(s.capacity||0)),capacity=Number(supply?.capacity||Math.max(0,...knownCapacity)),used=Number(supply?.used||target.att||1);
      const pooled=!r.human&&(r.cat?.includes('Facilities')||r.cat?.includes('Equipment'))&&capacity>0;
      const usedOther=hits.reduce((sum,row)=>sum+Number((row.linkedSupply||sourceFor(row)?.linkedSupply||[]).find(s=>s.name===name)?.used||row.att||1),0);
      if(!pooled||usedOther+used>capacity)return {available:false,reason:`Conflicts with ${hits[0].name} · ${hits[0].time}`,conflicts:hits.map(r=>r.key)};
    }
    // Native diaries include undated internal commitments. They are anchored to
    // the source reference day only, and never invented on arbitrary dates.
    if((target.iso||target.date)===referenceDay){const internal=(r.assign||[]).find(a=>!['public','private','prelim'].includes(a[2])&&overlaps(a[0],target.time));if(internal)return {available:false,reason:`${internal[1]} · ${internal[0]}`};}
    return {available:true,reason:'Available for the complete slot.'};
  }
  const normalizedSkill=value=>String(value||'').toLowerCase().replace(/snorkell?ing|snorkeling/g,'snorkel').replace(/e[ -]?bik(?:ing|es?|e)/g,'ebike').replace(/e[ -]?foil/g,'efoil').replace(/[^a-z0-9]+/g,' ');
  function eligibleReplacement(original,name,target){
    const source=resourceByName(original,target.venue),candidate=resourceByName(name,target.venue);
    if(!source||!candidate||!!source.human!==!!candidate.human)return false;
    if(source.business&&candidate.business&&source.business!==candidate.business)return false;
    if(!source.human)return normalizedSkill(source.cat)===normalizedSkill(candidate.cat);
    const activity=normalizedSkill(target.name||target.activity||target.packageName),skill=[['efoil','efoil'],['ebike','ebike'],['kayak','kayak'],['climbing','climbing'],['snorkel','snorkel'],['sup','sup'],['dive','div'],['paddle','sup']].find(([word])=>activity.includes(word))?.[1];
    return skill?normalizedSkill(candidate.skills).includes(skill):normalizedSkill(source.cat)===normalizedSkill(candidate.cat);
  }
  function candidates(original,target,excludeKey){
    const r=resourceByName(original,target.venue);if(!r)return [];
    return sourceResources().filter(x=>x.name!==r.name&&x.venue===target.venue&&eligibleReplacement(original,x.name,target)&&availability(x.name,target,{excludeKey}).available);
  }
  const native={create:window.openCreateSession,move:window.openMoveSession,private:window.openPrivate,bulkApply:window.v50ApplyBulkAssign,renderEvent:window.renderEvent};
  function drawer(title,subtitle,body,footer){window.openWideDrawer('EVENT OPERATIONS',title,subtitle,body,footer);document.getElementById('drawerBody').dataset.operational='true';}
  const field=(label,body)=>`<label class="ops-field"><span>${label}</span>${body}</label>`;
  const button=(action,label,primary=false)=>`<button class="btn ${primary?'pri':''}" data-ops-action="${action}">${label}</button>`;
  function error(message){let node=document.getElementById('opsError');if(!node){node=document.createElement('div');node.id='opsError';node.className='note bad';document.getElementById('drawerBody').prepend(node);}node.textContent=message;}
  function openCopy(id,args={}){
    const s=sourceSessions().find(s=>s.id===String(id).split('@')[0]);if(!s)throw new Error('Choose a public session to copy.');
    const occurrence=occurrences().find(row=>row.key===String(id))||occurrences().find(row=>row.key===`${s.id}@${s.date}`);
    draft={kind:'copy',template:{...clone(s),linkedSupply:clone(occurrence?.linkedSupply||s.linkedSupply)},sourceId:s.id,sourceKey:occurrence?.key||`${s.id}@${s.date}`,fromReschedule:!!args.fromReschedule,from:occurrence?.iso||s.date||referenceDay,to:occurrence?.iso||s.date||referenceDay,times:occurrence?.time||s.time,weekdays:[0,1,2,3,4,5,6],rows:[],step:1};renderCopy();
  }
  function renderCopy(){
    const s=(draft.template||sourceSessions().find(s=>s.id===draft.sourceId));
    if(draft.step===1){drawer('Copy session to multiple dates',`${s.activity} · ${s.venue} · bookings are not copied`,
      `<div class="guidebar"><div class="gstep on">1 · Dates & times</div><div class="gstep">2 · Supply per copy</div><div class="gstep">3 · Apply</div></div><div class="ops-grid">${field('From','<input id="opsCopyFrom" type="date" value="'+draft.from+'">')}${field('Through','<input id="opsCopyTo" type="date" value="'+draft.to+'">')}${field('Time slots · one per line','<textarea id="opsCopyTimes" rows="3" placeholder="09:00–10:00">'+esc(draft.times)+'</textarea>')}</div><fieldset class="ops-weekdays"><legend>Repeat on</legend>${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((day,i)=>`<label><input type="checkbox" name="opsCopyWeekday" value="${i}" ${draft.weekdays.includes(i)?'checked':''}>${day}</label>`).join('')}</fieldset><p class="small muted">Create a copy at every selected date and time. Review each copied resource before applying.</p>`,`${button('copy-native','Advanced copy options')}<span class="sp"></span>${button('copy-generate','Review copies',true)}`);return;}
    drawer('Review supply for each copied session',`${draft.rows.length} proposed copies · ${s.activity}`,`<div class="guidebar"><div class="gstep done">1 · Dates & times</div><div class="gstep on">2 · Supply per copy</div><div class="gstep">3 · Apply</div></div>${draft.rows.map((row,i)=>supplyCard(row,i,s)).join('')}`,`${button('copy-back','Back')}<span class="sp"></span>${button('copy-apply',`Create ${draft.rows.length} sessions`,true)}`);
  }
  function resolvedSupply(row,source){return (source.linkedSupply||[]).flatMap(s=>{const decision=row.decisions?.[s.name];if(decision==='exclude')return [];return [{...s,name:decision||s.name,used:draft.kind==='copy'?0:Number(s.used||0)}];});}
  function supplyCard(row,index,source){
    const target={...row,iso:row.date,time:`${row.start}–${row.end}`,venue:row.venue||source.venue,name:source.activity||source.name,linkedSupply:source.linkedSupply};
    return `<section class="ops-copy-card" data-copy-index="${index}"><h3>${esc(row.date)} · ${esc(row.start)}–${esc(row.end)}</h3>${(source.linkedSupply||[]).map(s=>{
      const decision=row.decisions?.[s.name],chosen=decision&&decision!=='exclude'?decision:s.name,check=decision==='exclude'?{available:true,reason:'Excluded from this copy.'}:decision&&!eligibleReplacement(s.name,chosen,target)?{available:false,reason:'Required activity skill or resource category does not match.'}:availability(chosen,target,{excludeKey:draft.kind==='move'?draft.sourceKey:null});
      return `<div class="ops-supply-row"><div><b>${esc(s.name)}</b><small>${esc(s.type)} · ${esc(check.reason)}</small></div><select aria-label="Supply decision ${index+1} ${esc(s.name)}" data-ops-supply="${index}" data-name="${esc(s.name)}"><option value="" ${!decision?'selected':''}>${check.available?'Keep':'Resolve conflict'}</option><option value="exclude" ${decision==='exclude'?'selected':''}>Exclude from this ${draft.kind==='move'?'occurrence':'copy'}</option>${candidates(s.name,target,draft.kind==='move'?draft.sourceKey:null).map(c=>`<option value="${esc(c.name)}" ${decision===c.name?'selected':''}>${esc(c.name)} · ${esc(c.venue)}</option>`).join('')}${decision&&!['exclude',...candidates(s.name,target,draft.sourceKey).map(c=>c.name)].includes(decision)?`<option selected value="${esc(decision)}">${esc(decision)} · needs review</option>`:''}</select><span class="badge ${check.available?'b-good':'b-warn'}">${check.available?'Ready':'Conflict'}</span></div>`;
    }).join('')}</section>`;
  }
  function generateCopies(){
    const from=document.getElementById('opsCopyFrom').value,to=document.getElementById('opsCopyTo').value,times=document.getElementById('opsCopyTimes').value.trim().split(/[\n,]+/).map(t=>t.trim()).filter(Boolean),weekdays=[...document.querySelectorAll('[name="opsCopyWeekday"]:checked')].map(x=>Number(x.value));
    if(!validDate(from)||!validDate(to)||to<from||!times.length||!weekdays.length)throw new Error('Choose a valid date period, repeat days and at least one time slot.');
    if(times.some(t=>!/^\d{2}:\d{2}\s*[–—-]\s*\d{2}:\d{2}$/.test(t)||range(t)[1]<=range(t)[0]||range(t)[1]>1440))throw new Error('Enter complete time slots such as 09:00–10:00.');
    const rows=[];for(let date=from;date<=to;date=addDays(date,1)){if(rows.length>120)throw new Error('Review up to 120 copies at once. Narrow the pattern.');if(weekdays.includes(new Date(`${date}T12:00Z`).getUTCDay()))for(const time of times){const [start,end]=range(time);rows.push({date,start:format(start),end:format(end),decisions:{}});}}
    if(!rows.length)throw new Error('No dates match the repeat pattern.');
    if(new Set(rows.map(r=>r.date+r.start+r.end)).size!==rows.length)throw new Error('Remove duplicate time slots from the pattern.');
    Object.assign(draft,{from,to,times:times.join('\n'),weekdays,rows,step:2});renderCopy();
  }
  function validateSupply(row,source){
    const supply=resolvedSupply(row,source),target={...row,iso:row.date,time:`${row.start}–${row.end}`,venue:row.venue||source.venue,name:source.activity||source.name,linkedSupply:source.linkedSupply};
    for(const original of source.linkedSupply||[]){const chosen=row.decisions?.[original.name];if(chosen&&chosen!=='exclude'&&!eligibleReplacement(original.name,chosen,target))throw new Error(`${row.date} ${row.start}: ${chosen} does not match the required activity skill or resource category for ${original.name}.`);}
    for(const s of supply){const check=availability(s.name,target,{excludeKey:draft.kind==='move'?draft.sourceKey:null});if(!check.available)throw new Error(`${row.date} ${row.start}: resolve ${s.name} — ${check.reason}`);}
    if(!supply.some(s=>s.type==='Facility'))throw new Error('Each session needs a facility. Replace the facility rather than excluding it.');
    return supply;
  }
  function applyCopies(){
    const source=(draft.template||sourceSessions().find(s=>s.id===draft.sourceId)),plans=draft.rows.map(row=>({row,supply:validateSupply(row,source)}));
    // Check copied human/equipment reservations against other copies in this batch.
    for(let i=0;i<plans.length;i++)for(let j=i+1;j<plans.length;j++)if(plans[i].row.date===plans[j].row.date&&overlaps(`${plans[i].row.start}–${plans[i].row.end}`,`${plans[j].row.start}–${plans[j].row.end}`)&&plans[i].supply.some(s=>sourceResources().find(r=>r.name===s.name)?.human&&plans[j].supply.some(x=>x.name===s.name)))throw new Error('Overlapping copies reserve the same person. Use non-overlapping slots or different replacements.');
    const created=plans.map(({row,supply})=>({...clone(source),id:`ops-session-${Date.now()}-${++state.counter}`,date:row.date,time:`${row.start}–${row.end}`,bookings:0,att:0,assigned:0,status:'nobookings',preliminary:false,detail:'Additional session · copied configuration; no bookings yet',linkedSupply:supply,facility:supply.find(s=>s.type==='Facility')?.name||source.facility,requirements:supply.map(s=>[s.type,s.name]),copiedFrom:source.id}));
    state.copies.push(...created);restoreCopies();record('Create patterned sessions',source.activity,[],created,{dates:[...new Set(created.map(s=>s.date))],copies:created.length});
    if(draft.fromReschedule&&typeof v32CreatedTargets!=='undefined')created.forEach(s=>v32CreatedTargets.push({id:s.id,date:s.date,time:s.time,venue:s.venue,activity:s.activity,cap:Math.min(...s.linkedSupply.map(x=>Number(x.capacity)||999)),kind:'same',package:s.activity,act:s.activity,free:Math.min(...s.linkedSupply.map(x=>Number(x.capacity)||999))}));
    refresh();drawer('Sessions created',`${created.length} sessions are now in Event operations`,`<div class="note good">${created.length} session configurations created. Existing bookings were not copied.</div>${created.map(s=>`<p><b>${esc(s.date)} · ${esc(s.time)}</b> · ${esc(s.activity)}</p>`).join('')}`,`${button('result-calendar','Open created dates',true)}${draft.fromReschedule?button('return-reschedule','Return to booking moves'):''}`);
  }
  function openMove(id,args={}){
    const source=sourceSessions().find(s=>s.id===String(id).split('@')[0]);if(!source)throw new Error('Choose a public session.');
    const key=String(id).includes('@')?id:`${source.id}@${args.date||guide.snapshot().eventPresentation.from||source.date}`,row=occurrences().find(r=>r.key===key)||occurrences().find(r=>r.sourceId===source.id);
    if(!row)throw new Error('Choose an existing occurrence.');
    draft={kind:'move',template:{...clone(source),linkedSupply:clone(row.linkedSupply||source.linkedSupply)},sourceId:source.id,sourceKey:row.key,original:clone(row),step:1,rows:[{date:args.date||row.iso,start:args.start||format(range(row.time)[0]),end:args.end||format(range(row.time)[1]),venue:args.venue||row.venue,decisions:{}}]};renderMove();
  }
  function moveCalendar(row){const dates=Array.from({length:7},(_,i)=>addDays(row.date,i)),hours=Array.from({length:12},(_,i)=>i+7);return `<div class="ops-move-calendar"><div class="ops-move-grid"><div class="ops-calendar-axis">Time</div>${dates.map(date=>`<div class="ops-calendar-date">${esc(date)}</div>`).join('')}${hours.map(hour=>`<div class="ops-calendar-axis">${String(hour).padStart(2,'0')}:00</div>${dates.map(date=>`<div tabindex="0" role="button" aria-label="Move session to ${date} ${String(hour).padStart(2,'0')}:00" data-ops-drop-date="${date}" data-ops-drop-time="${String(hour).padStart(2,'0')}:00">${date===row.date&&minutes(row.start)>=hour*60&&minutes(row.start)<(hour+1)*60?`<div class="ops-drag-session" draggable="true">${esc(draft.original.name)}<small>${esc(row.start)}–${esc(row.end)}</small></div>`:''}</div>`).join('')}`).join('')}</div></div>`;}
  function renderMove(){const row=draft.rows[0],s=(draft.template||sourceSessions().find(s=>s.id===draft.sourceId));drawer('Move complete session',`${draft.original.name} · all ${draft.original.bookings||0} bookings and ${draft.original.att||0} attendees move together`,`<div class="note">Drag the session to a date/time, or choose an exact start below. Review replacement supply before applying.</div><div class="ops-grid">${field('Date',`<input id="opsMoveDate" type="date" value="${row.date}">`)}${field('Start',`<input id="opsMoveStart" type="time" value="${row.start}">`)}${field('End',`<input id="opsMoveEnd" type="time" value="${row.end}">`)}${field('Venue',`<select id="opsMoveVenue">${[...new Set(sourceResources().map(r=>r.venue))].map(v=>`<option ${v===row.venue?'selected':''}>${esc(v)}</option>`).join('')}</select>`)}</div>${moveCalendar(row)}${supplyCard(row,0,s)}`,`${button('move-native','Advanced move options')}<span class="sp"></span>${button('move-apply',draft.nativeBulkEdit?'Save supply decisions':'Apply complete session move',true)}`);}
  function updateMoveDate(date,start){const row=draft.rows[0],duration=minutes(row.end)-minutes(row.start);row.date=date;row.start=start;row.end=format(minutes(start)+duration);row.decisions={};renderMove();}
  function applyMove(){const row=draft.rows[0],source=(draft.template||sourceSessions().find(s=>s.id===draft.sourceId)),supply=validateSupply(row,source),before=draft.original;const after=applyOccurrence(before.key,{iso:row.date,time:`${row.start}–${row.end}`,venue:row.venue,linkedSupply:supply.map(s=>({...s,used:(before.linkedSupply||[]).find(x=>x.name===s.name)?.used||s.used})),resources:supply.map(s=>s.name),facility:supply.find(s=>s.type==='Facility')?.name||source.facility},{audit:false,refresh:false});record('Move complete session',before.name,before,after,{from:before.iso,to:row.date,bookings:before.bookings});refresh();drawer('Session moved',`${after.iso} · ${after.time}`,`<div class="note good">The session and its ${before.bookings||0} bookings now use the reviewed date, time and supply.</div>`,button('result-calendar','Open moved occurrence',true));}
  function ensureBooking(id){if(!state.bookings[id]){state.bookings[id]=clone(booking(id));persist();}return state.bookings[id];}
  function openPrivate(id,args={}){
    const p=sourcePrivates().find(p=>p.id===String(id).split('@')[0]);if(!p)throw new Error('Choose a private booking.');
    const b=booking(p.id),date=String(args.date||guide.snapshot().eventPresentation.from||b.allocations[0]?.date||referenceDay).slice(0,10);
    privateContext={id:p.id,date,view:args.view||'day',selected:new Set(b.allocations.filter(a=>a.date===date).map(a=>a.id))};renderPrivate();
  }
  function renderPrivate(){
    const p=sourcePrivates().find(p=>p.id===privateContext.id),b=booking(p.id),visible=b.allocations.filter(a=>privateContext.view==='whole'||a.date===privateContext.date),groups=new Map();
    for(const a of visible){const key=a.date+'|'+a.packageName;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(a);}
    drawer(`${p.ref} · ${p.name}`,`${p.customer}${p.referrer?' · Referrer: '+p.referrer:''}`,
      `<div class="ops-private-summary"><span class="badge b-purple">Private booking</span><span class="badge b-grey">${esc(b.recurrence[0].toUpperCase()+b.recurrence.slice(1))}</span><span class="badge b-good">${esc(p.status||'Confirmed')}</span><span>${b.allocations.length} allocations · ${new Set(b.allocations.map(a=>a.date)).size} dates</span></div><div class="ops-private-toolbar"><div class="seg"><button data-ops-action="private-day" class="${privateContext.view==='day'?'on':''}">Selected day</button><button data-ops-action="private-whole" class="${privateContext.view==='whole'?'on':''}">Whole booking</button></div>${field('Allocation date',`<input id="opsPrivateDay" type="date" value="${privateContext.date}">`)}${button('private-add','Add package / dates')}</div>${visible.length?[...groups.entries()].map(([key,items])=>`<section class="ops-private-package" data-package="${esc(items[0].packageName)}"><header><h3>${esc(items[0].date)} · ${esc(new Set(b.allocations.map(a=>a.packageName)).size>1?items[0].packageName:p.name)}</h3><span class="small muted">${items.length} time slot${items.length===1?'':'s'}</span></header>${items.map(a=>`<div class="ops-private-allocation" data-allocation-id="${a.id}"><label><input type="checkbox" data-ops-allocation="${a.id}" ${privateContext.selected.has(a.id)?'checked':''}> <b>${esc(a.start)}–${esc(a.end)}</b></label><div>${a.resources.map(name=>`<span class="chip">${esc(name)}</span>`).join('')}</div><button class="btn sm" data-ops-action="private-replace" data-id="${a.id}">Replace supply</button><button class="btn sm" data-ops-action="private-move-one" data-id="${a.id}">Move slot</button></div>`).join('')}</section>`).join(''):'<div class="note">No allocations on this date. Open Whole booking to inspect its other dates.</div>'}<p class="small muted">Package allocations stay grouped within each date. Select individual slots, all work on a date, or matching packages across the booking when moving.</p>`,`${button('private-native','Booking details')}${button('private-native-reschedule','Advanced rescheduling')}<span class="sp"></span>${button('private-move','Move selected allocations',true)}`);
  }
  function openPrivatePattern(){const p=sourcePrivates().find(p=>p.id===privateContext.id),b=booking(p.id),a=b.allocations.find(a=>a.date===privateContext.date)||b.allocations[0];drawer('Add package allocations',`${p.ref} · ${p.name}`,`<div class="ops-grid">${field('Booking recurrence',`<select id="opsPrivateRecurrence">${['casual','regular','seasonal'].map(r=>`<option ${b.recurrence===r?'selected':''}>${r}</option>`).join('')}</select>`)}${field('Package / activity',`<input id="opsPrivatePackage" value="${esc(a?.packageName||p.name)}">`)}${field('From',`<input type="date" id="opsPrivateFrom" value="${privateContext.date}">`)}${field('Through',`<input type="date" id="opsPrivateTo" value="${privateContext.date}">`)}${field('Repeat',`<select id="opsPrivateRepeat"><option value="1">Every day</option><option value="7">Every week</option></select>`)}${field('Start',`<input type="time" id="opsPrivateStart" value="${a?.start||'09:00'}">`)}${field('End',`<input type="time" id="opsPrivateEnd" value="${a?.end||'10:00'}">`)}</div>${field('Allocated facilities and resources',`<select multiple id="opsPrivateSupply" size="8">${sourceResources().map(r=>`<option value="${esc(r.name)}" ${(a?.resources||p.resources).includes(r.name)?'selected':''}>${esc(r.name)} · ${esc(r.venue)}</option>`).join('')}</select>`)}<p class="small muted">This adds dated allocations to the same private booking. Existing package slots remain in place.</p>`,`${button('private-back','Back')}<span class="sp"></span>${button('private-pattern-apply','Add dated allocations',true)}`);}
  function applyPrivatePattern(){
    const value=id=>document.getElementById(id).value,from=value('opsPrivateFrom'),to=value('opsPrivateTo'),start=value('opsPrivateStart'),end=value('opsPrivateEnd'),packageName=value('opsPrivatePackage').trim(),supply=[...document.getElementById('opsPrivateSupply').selectedOptions].map(o=>o.value),step=Number(value('opsPrivateRepeat'));
    if(!validDate(from)||!validDate(to)||to<from||!packageName||minutes(end)<=minutes(start)||!supply.length)throw new Error('Choose valid dates, a complete time slot, package name and allocated supply.');
    const p=sourcePrivates().find(p=>p.id===privateContext.id),b=ensureBooking(p.id),before=clone(b),added=[];
    for(let date=from;date<=to;date=addDays(date,step)){
      if(added.length>=120)throw new Error('Add up to120 dated allocations at a time.');
      const target={iso:date,time:`${start}–${end}`,venue:p.venue};
      for(const name of supply){const check=availability(name,target);if(!check.available)throw new Error(`${date}: ${name} — ${check.reason}`);}
      added.push({id:`${p.id}-ops-${Date.now()}-${added.length}`,date,start,end,packageName,venue:p.venue,facility:supply.find(name=>sourceResources().find(r=>r.name===name)?.cat?.includes('Facilities'))||'',resources:[...supply]});
    }
    b.recurrence=value('opsPrivateRecurrence');b.allocations.push(...added);record('Add private package allocations',p.ref,before,b,{from,to,packages:[packageName],repeatDays:step});privateContext.view='whole';refresh();renderPrivate();
  }
  function openPrivateMove(ids){
    const b=ensureBooking(privateContext.id),selected=ids||[...privateContext.selected];if(!selected.length)throw new Error('Select the allocation slots to move.');
    const first=b.allocations.find(a=>selected.includes(a.id));if(!first)throw new Error('The selected allocation is no longer available.');
    draft={kind:'privateMove',id:b.id,selected,scope:'selected',date:first.date,start:first.start,anchor:clone(first),decisions:{}};renderPrivateMove();
  }
  function privateMoveTargets(){const b=booking(draft.id),chosen=b.allocations.filter(a=>draft.selected.includes(a.id)),packages=new Set(chosen.map(a=>a.packageName));return b.allocations.filter(a=>draft.scope==='day'?a.date===draft.anchor.date:draft.scope==='series'?packages.has(a.packageName):draft.selected.includes(a.id));}
  function allocationMetadata(a){const facility=a.resources.map(name=>resourceByName(name,a.venue)).find(r=>r?.cat?.includes('Facilities'));return {...a,facility:facility?.name||a.facility,venue:facility?.venue||a.venue};}
  function movedPrivatePlans(){const days=Math.round((new Date(`${draft.date}T12:00Z`)-new Date(`${draft.anchor.date}T12:00Z`))/86400000),delta=minutes(draft.start)-minutes(draft.anchor.start);return privateMoveTargets().map(a=>allocationMetadata({...clone(a),date:addDays(a.date,days),start:format(minutes(a.start)+delta),end:format(minutes(a.end)+delta),resources:a.resources.map(name=>draft.decisions[`${a.id}|${name}`]||name)}));}
  function renderPrivateMove(){const p=sourcePrivates().find(p=>p.id===draft.id),targets=privateMoveTargets(),plans=movedPrivatePlans();drawer('Move private booking allocations',`${p.ref} · ${targets.length} allocations in scope`,`<div class="ops-grid">${field('Move scope',`<select id="opsPrivateMoveScope"><option value="selected" ${draft.scope==='selected'?'selected':''}>Selected slots only</option><option value="day" ${draft.scope==='day'?'selected':''}>All allocations on ${draft.anchor.date}</option><option value="series" ${draft.scope==='series'?'selected':''}>Matching packages on every date</option></select>`)}${field('Target date for first slot',`<input id="opsPrivateMoveDate" type="date" value="${draft.date}">`)}${field('Target start for first slot',`<input id="opsPrivateMoveStart" type="time" value="${draft.start}">`)}</div><p class="small muted">Relative times and the spacing between dates stay together. Required supply is validated for every allocation.</p>${plans.map((a,i)=>`<section class="ops-copy-card"><h3>${esc(a.date)} · ${esc(a.start)}–${esc(a.end)} · ${esc(a.packageName)}</h3>${a.resources.map((name,j)=>{const original=targets[i].resources[j],check=availability(name,{iso:a.date,time:`${a.start}–${a.end}`,venue:a.venue,name:a.packageName},{excludeKey:targets[i].originalKey||`${p.id}@${targets[i].date}#${a.id}`});return `<div class="ops-supply-row"><div><b>${esc(original)}</b><small>${esc(check.reason)}</small></div><select data-ops-private-supply="${a.id}" data-name="${esc(original)}" aria-label="Replacement for ${esc(original)} on ${a.date}"><option value="">Keep current supply</option>${candidates(original,{iso:a.date,time:`${a.start}–${a.end}`,venue:a.venue,name:a.packageName},targets[i].originalKey||`${p.id}@${targets[i].date}#${a.id}`).map(r=>`<option value="${esc(r.name)}" ${name===r.name?'selected':''}>${esc(r.name)}</option>`).join('')}</select><span class="badge ${check.available?'b-good':'b-warn'}">${check.available?'Ready':'Conflict'}</span></div>`;}).join('')}</section>`).join('')}`,`${button('private-back','Back')}<span class="sp"></span>${button('private-move-apply','Apply allocation move',true)}`);}
  function applyPrivateMove(){const b=ensureBooking(draft.id),before=clone(b),plans=movedPrivatePlans(),old=privateMoveTargets(),excludeKeys=old.flatMap(a=>[a.originalKey,`${b.id}@${a.date}#${a.id}`].filter(Boolean));for(const a of plans){if(minutes(a.start)<0||minutes(a.end)>1440||minutes(a.end)<=minutes(a.start))throw new Error('All moved allocations must remain within one operating day.');for(const [index,name] of a.resources.entries()){const original=old.find(item=>item.id===a.id)?.resources[index],target={iso:a.date,time:`${a.start}–${a.end}`,venue:a.venue,name:a.packageName};if(name!==original&&!eligibleReplacement(original,name,target))throw new Error(`${name} does not match the required activity skill or resource category.`);const check=availability(name,target,{excludeKeys,pending:plans.filter(other=>other.id!==a.id).map(other=>({key:`planned-${other.id}`,iso:other.date,time:`${other.start}–${other.end}`,venue:other.venue,name:other.packageName,private:true,att:sourcePrivates().find(p=>p.id===b.id)?.att,resources:other.resources}))});if(!check.available)throw new Error(`${a.date}: ${name} — ${check.reason}`);}}
    b.allocations=b.allocations.map(a=>plans.find(p=>p.id===a.id)||a);record('Move private allocations',sourcePrivates().find(p=>p.id===b.id).ref,before,b,{scope:draft.scope,allocationIds:plans.map(a=>a.id),firstDate:draft.date});privateContext.date=draft.date;privateContext.view=draft.scope==='series'?'whole':'day';refresh();renderPrivate();}
  function openPrivateReplacement(id){const b=ensureBooking(privateContext.id),a=b.allocations.find(a=>a.id===id);if(!a)throw new Error('Choose an allocation.');draft={kind:'privateReplacement',id:b.id,allocationId:id,scope:'selected',decisions:{}};renderPrivateReplacement();}
  function renderPrivateReplacement(){const b=booking(draft.id),a=b.allocations.find(a=>a.id===draft.allocationId),targetFacility=a.resources.map(name=>resourceByName(draft.decisions[name]||name,a.venue)).find(r=>r?.cat?.includes('Facilities')),targetVenue=targetFacility?.venue||a.venue;drawer('Replace allocated supply',`${a.date} · ${a.start}–${a.end} · ${a.packageName}`,`${field('Replacement scope',`<select id="opsPrivateReplaceScope"><option value="selected" ${draft.scope==='selected'?'selected':''}>This slot only</option><option value="day" ${draft.scope==='day'?'selected':''}>All matching supply on this date</option><option value="series" ${draft.scope==='series'?'selected':''}>Matching supply on every booking date</option></select>`)}${a.resources.map(name=>`<div class="ops-supply-row"><b>${esc(name)}</b><select data-ops-replacement="${esc(name)}" aria-label="Replace ${esc(name)}"><option value="">Keep current supply</option>${sourceResources().filter(r=>{const old=resourceByName(name,a.venue);return old&&(old.cat?.includes('Facilities')||r.venue===targetVenue)&&eligibleReplacement(name,r.name,{venue:targetVenue,name:a.packageName})&&r.name!==name;}).map(r=>`<option ${draft.decisions[name]===r.name?'selected':''} value="${esc(r.name)}">${esc(r.name)} · ${esc(r.venue)}</option>`).join('')}</select></div>`).join('')}<p class="small muted">Every selected date is checked before replacement. A private allocation cannot be left partly replaced.</p>`,`${button('private-back','Back')}<span class="sp"></span>${button('private-replace-apply','Apply supply replacement',true)}`);}
  function applyPrivateReplacement(){const b=ensureBooking(draft.id),anchor=b.allocations.find(a=>a.id===draft.allocationId),before=clone(b);if(!Object.values(draft.decisions).some(Boolean))throw new Error('Choose at least one replacement.');const targets=b.allocations.filter(a=>draft.scope==='series'?true:draft.scope==='day'?a.date===anchor.date:a.id===anchor.id),plans=targets.map(a=>allocationMetadata({...a,resources:a.resources.map(name=>draft.decisions[name]||name)})),excludeKeys=targets.flatMap(a=>[a.originalKey,`${b.id}@${a.date}#${a.id}`].filter(Boolean));for(const a of plans)for(const [index,name] of a.resources.entries()){const original=targets.find(item=>item.id===a.id)?.resources[index],target={iso:a.date,time:`${a.start}–${a.end}`,venue:a.venue,name:a.packageName};if(name!==original&&!eligibleReplacement(original,name,target))throw new Error(`${name} does not match the required activity skill or resource category.`);const check=availability(name,target,{excludeKeys,pending:plans.filter(other=>other.id!==a.id).map(other=>({key:`planned-${other.id}`,iso:other.date,time:`${other.start}–${other.end}`,venue:other.venue,name:other.packageName,private:true,att:sourcePrivates().find(p=>p.id===b.id)?.att,resources:other.resources}))});if(!check.available)throw new Error(`${a.date}: ${name} — ${check.reason}`);}
    for(const plan of plans){const originalKey=plan.originalKey||`${b.id}@${plan.date}#${plan.id}`;state.overrides[originalKey]={...(state.overrides[originalKey]||{}),resources:plan.resources,facility:plan.facility,venue:plan.venue,attention:false,status:'covered',detail:'All required private supply replaced'};}b.allocations=b.allocations.map(a=>plans.find(p=>p.id===a.id)||a);record('Replace private supply',sourcePrivates().find(p=>p.id===b.id).ref,before,b,{scope:draft.scope,allocationIds:targets.map(a=>a.id)});refresh();renderPrivate();}
  state.cases||=[];state.followUps||=[];state.bookingLedger||={};state.bookingMoves||=[];
  let publicContextKey=null,pendingPackageReview=null;
  const selectedDestinations=new Map(),nativeBookingRows=window.v48BookingsForSession,nativePublicOpen=window.openReschedulePublic,nativePublicApply=window.v34FinishPublicMoves,nativeManager=window.v33OpenBookingManager;
  function resolveOccurrenceKey(id){const str=String(id);if(str.includes('@'))return str;const date=guide.snapshot().eventPresentation.from;return occurrences().find(r=>r.sourceId===str&&r.iso===date)?.key||occurrences().find(r=>r.sourceId===str)?.key;}
  function ledger(key){
    if(state.bookingLedger[key])return state.bookingLedger[key];
    const row=occurrences().find(r=>r.key===key),source=sourceFor(row||{});if(!row||!source||!Number(row.bookings))return [];
    const base=nativeBookingRows({...source,bookings:row.bookings,att:row.att,status:row.status}),total=Number(row.att||0),n=base.length;
    return base.map((b,i)=>({...b,att:Math.floor(total/n)+(i<total%n?1:0),sourceKey:key,activity:row.name,src:`${row.iso} · ${row.time} · ${row.venue}`}));
  }
  function contextBookingRows(ctx){const keys=ctx?.mode==='bulk'?[...eventSelected].map(resolveOccurrenceKey):[publicContextKey||resolveOccurrenceKey(ctx?.id||'s1')];return keys.flatMap(key=>ledger(key));}
  function nativeAssignmentPlan(key,items){
    const row=occurrences().find(r=>r.key===resolveOccurrenceKey(key));if(!row)throw new Error('The selected assignment occurrence is unavailable.');
    const supply=clone(row.linkedSupply||[]);
    for(const item of items){if(item.skillMode&&!can('overrideSkill'))throw new Error('Skill override permission is required.');const check=availability(item.name,row,{excludeKey:row.key,allowVenueReview:true});if(!check.available)throw new Error(`${item.name}: ${check.reason}`);const existing=supply.find(s=>s.name===item.name);if(existing)existing.used=Number(existing.used||0)+Number(item.qty||0);else supply.push({type:sourceResources().find(r=>r.name===item.name)?.human?'Resource':'Equipment',name:item.name,used:Number(item.qty||0),capacity:Number(item.cap||item.qty||0)});}
    const assigned=Math.min(Number(row.att||0),Number(row.assigned||0)+items.reduce((sum,item)=>sum+Number(item.qty||0),0)),remaining=Math.max(0,Number(row.att||0)-assigned);
    return {row,patch:{assigned,linkedSupply:supply,resources:supply.map(s=>s.name),status:remaining?'attention':Number(row.att||0)?'covered':'nobookings',attention:!!remaining,detail:remaining?`${remaining} attendee places still require resource coverage`:'All required resource coverage assigned'}};
  }
  function commitAssignmentPlans(plans,action){
    const before=plans.map(p=>p.row),after=plans.map(p=>applyOccurrence(p.row.key,p.patch,{audit:false,refresh:false}));
    const issues=after.filter(r=>r.attention);if(issues.length)state.cases.unshift({id:`operation-${Date.now()}`,kind:'assignment',title:action,status:'open',remaining:issues.length,scope:{dates:[...new Set(after.map(r=>r.iso))]},items:issues.map(r=>({key:r.key,name:r.name,date:r.iso,private:false}))});
    record(action,`${plans.length} dated occurrences`,before,after,{dates:[...new Set(after.map(r=>r.iso))]});refresh();return after;
  }
  function applyNativeAssignment(){try{const ctx=v44AssignCtx;if(!ctx?.items?.length)throw new Error('Choose at least one resource to assign.');const items=ctx.items.map(item=>({...item,skillMode:item.skillMode||ctx.skillModes?.[item.name]})),primary=resolveOccurrenceKey(ctx.id),plans=[nativeAssignmentPlan(primary,items)];for(const item of items)for(const id of ctx.extras?.[item.name]||[])plans.push(nativeAssignmentPlan(resolveOccurrenceKey(id),[item]));commitAssignmentPlans(plans,'Assign resources');window.closeDrawer();}catch(e){error(e.message);}}
  function applyNativeBulk(){try{const plans=v50BulkAssign.ids.map(key=>nativeAssignmentPlan(key,[...v50DirectItems(key),...v50Inherited(key)]));commitAssignmentPlans(plans,'Assign resources across occurrences');native.bulkApply();}catch(e){error(e.message);}}
  function applyNativeBulkMoves(){try{
    const previous=draft,plans=v32MoveBulkState.rows.map(target=>{
      const key=resolveOccurrenceKey(target.id),original=occurrences().find(row=>row.key===key),source=sourceFor(original);
      if(!original||!source)throw new Error('A selected session is no longer available.');
      const duration=range(original.time)[1]-range(original.time)[0],row={...target,end:target.end||format(minutes(target.start)+duration),decisions:target.decisions||{}};
      draft={kind:'move',sourceKey:key};const supply=validateSupply(row,{...source,linkedSupply:original.linkedSupply});return {original,row,supply};
    });draft=previous;
    const after=plans.map(plan=>applyOccurrence(plan.original.key,{iso:plan.row.date,time:`${plan.row.start}–${plan.row.end}`,venue:plan.row.venue,facility:plan.supply.find(s=>s.type==='Facility')?.name,linkedSupply:plan.supply,resources:plan.supply.map(s=>s.name)},{audit:false,refresh:false}));
    record('Move selected complete sessions',`${plans.length} occurrences`,plans.map(p=>p.original),after,{dates:[...new Set(after.map(r=>r.iso))]});v32MoveBulkState=null;refresh();drawer('Session moves applied',`${plans.length} dated occurrences moved`,after.map(row=>`<p>${esc(row.iso)} · ${esc(row.time)} · ${esc(row.name)}</p>`).join(''),button('close','Close',true));
  }catch(e){error(e.message);}}
  function makeDestination(slot,sourceRow){
    const found=occurrences().find(row=>!row.private&&row.iso===slot.date&&row.time===slot.time&&row.venue===slot.venue&&row.name===slot.package);if(found)return found;
    const template=sourceSessions().find(s=>s.activity===slot.package&&s.venue===slot.venue)||sourceSessions().find(s=>s.activity===slot.package)||sourceFor(sourceRow),id=`ops-destination-${Date.now()}-${++state.counter}`;
    const supply=(template.linkedSupply||[]).filter(s=>{const r=sourceResources().find(r=>r.name===s.name);return r?.venue===slot.venue;}).map(s=>({...s,used:0}));
    const created={...clone(template),id,date:slot.date,time:slot.time,activity:slot.package,venue:slot.venue,bookings:0,att:0,assigned:0,status:'nobookings',preliminary:false,linkedSupply:supply,facility:supply.find(s=>s.type==='Facility')?.name||sourceResources().find(r=>r.cat?.includes('Facilities')&&r.venue===slot.venue)?.name||template.facility,detail:'Destination session created from reviewed booking move'};
    state.copies.push(created);restoreCopies();return occurrences().find(r=>r.key===`${id}@${slot.date}`);
  }
  function applyPublicMoves(){
    try{
      const ctx=v31RescheduleCtx,bookings=contextBookingRows(ctx),moves=bookings.filter(b=>v31RescheduleSelections[b.ref]);if(!moves.length)throw new Error('Choose at least one booking destination.');
      const plans=moves.map(b=>{const selection=v31RescheduleSelections[b.ref],cached=selectedDestinations.get(b.ref),sourceRow=occurrences().find(r=>r.key===b.sourceKey),source=sourceFor(sourceRow),slot=cached?.slot||window.v49ReschedSlots(source).find(s=>s.id===selection.slotId);if(!slot)throw new Error(`Review the destination for ${b.ref} again.`);if((selection.keepPrice||cached?.keepPrice)&&!can('keepPrice'))throw new Error('Keeping the existing price requires permission.');if(slot.kind==='data'||slot.kind==='manager'||slot.compatible===false)throw new Error(`${b.ref}: complete the different booking-data requirements in Booking Manager.`);return {b,slot,sourceRow,keepPrice:selection.keepPrice||cached?.keepPrice||false};});
      const capacities=new Map();for(const plan of plans){const key=plan.slot.id,used=(capacities.get(key)||0)+plan.b.att;capacities.set(key,used);if(used>Number(plan.slot.cap||999999))throw new Error(`${plan.slot.date} ${plan.slot.time}: selected attendees exceed the destination availability.`);}
      const before=[],after=[];
      for(const plan of plans){const sourceRow=occurrences().find(r=>r.key===plan.b.sourceKey);let destination=makeDestination(plan.slot,sourceRow);if(destination.key===sourceRow.key)throw new Error('Choose a different destination occurrence.');
        before.push(clone(sourceRow),clone(destination));
        const srcLedger=clone(ledger(sourceRow.key)),destLedger=clone(ledger(destination.key));state.bookingLedger[sourceRow.key]=srcLedger.filter(b=>b.ref!==plan.b.ref);state.bookingLedger[destination.key]=[...destLedger,{...plan.b,sourceKey:destination.key,activity:destination.name,src:`${destination.iso} · ${destination.time} · ${destination.venue}`,alloc:'Needs allocation'}];
        const srcAtt=Math.max(0,Number(sourceRow.att||0)-plan.b.att),srcAssigned=Math.min(srcAtt,Number(sourceRow.assigned||0));
        after.push(applyOccurrence(sourceRow.key,{att:srcAtt,bookings:Math.max(0,Number(sourceRow.bookings||0)-1),assigned:srcAssigned,status:srcAssigned<srcAtt?'attention':srcAtt?'covered':'nobookings',attention:srcAssigned<srcAtt,detail:srcAssigned<srcAtt?`${srcAtt-srcAssigned} attendee places need coverage`:'Booking moves applied; remaining demand covered'},{audit:false,refresh:false}));
        destination=occurrences().find(r=>r.key===destination.key);const destAtt=Number(destination.att||0)+plan.b.att,destAssigned=Number(destination.assigned||0);
        after.push(applyOccurrence(destination.key,{att:destAtt,bookings:Number(destination.bookings||0)+1,assigned:destAssigned,status:destAssigned<destAtt?'attention':'covered',attention:destAssigned<destAtt,detail:destAssigned<destAtt?'Moved bookings require resource allocation review':'Booking moves applied'},{audit:false,refresh:false}));
        state.bookingMoves.push({ref:plan.b.ref,from:sourceRow.key,to:destination.key,attendees:plan.b.att,keepPrice:plan.keepPrice,at:new Date().toISOString()});
      }
      const undecided=bookings.filter(b=>!v31RescheduleSelections[b.ref]);if(undecided.length)state.cases.unshift({id:`operation-${Date.now()}`,kind:'bookingMoves',title:'Undecided public bookings',status:'open',remaining:undecided.length,scope:{source:ctx.id},items:undecided.map(b=>({key:b.sourceKey,name:b.activity,bookingRef:b.ref,date:dateKey(b.sourceKey),private:false}))});
      record('Reschedule public bookings',`${plans.length} bookings`,before,after,{bookings:plans.map(p=>p.b.ref),existingPriceRetained:plans.filter(p=>p.keepPrice).map(p=>p.b.ref)});nativePublicApply();refresh();
    }catch(e){error(e.message);}
  }
  function openFollowUp(id){if(!id){drawer('Booking Manager follow-ups','Saved financial and customer-data actions',state.followUps.length?state.followUps.map(f=>`<button class="btn" data-ops-action="booking-followup" data-id="${esc(f.id)}">${esc(f.bookingRef)} · ${esc(f.reason)} · ${esc(f.status)}</button>`).join(''):'<div class="note">No Booking Manager follow-ups recorded.</div>',button('close','Close'));return;}const f=state.followUps.find(f=>f.id===id);if(!f)throw new Error('This booking follow-up is unavailable.');drawer('Booking Manager follow-up',`${f.bookingRef} · ${f.status}`,`<div class="note warn">${esc(f.reason)}</div><p>The operational prototype records this handoff. Update financials or required customer data in Booking Manager, then mark the follow-up complete here.</p><p>${esc(f.destination?.date||'')} · ${esc(f.destination?.time||'')} · ${esc(f.destination?.package||'')}</p>${field('Completion notes',`<textarea id="opsFollowUpNotes" rows="3">${esc(f.notes||'')}</textarea>`)}`,`${button('close','Close')}<span class="sp"></span><button class="btn pri" data-ops-action="followup-complete" data-id="${esc(id)}" ${f.status==='completed'?'disabled':''}>Mark follow-up complete</button>`);}
  function caseOpenItems(c){return c.items.filter(item=>item.bookingRef?!state.bookingMoves.some(move=>move.ref===item.bookingRef&&(move.from===item.key||occurrences().find(r=>r.originalKey===item.key)?.key===move.from)):occurrences().find(r=>r.key===item.key||r.originalKey===item.key)?.attention);}
  function openOperationCase(id){if(!id){const cases=snapshot().cases;drawer('Operational follow-up cases','Saved partial assignments and undecided booking work',cases.length?cases.map(c=>`<button class="btn" data-ops-action="operation-case" data-id="${esc(c.id)}">${esc(c.title)} · ${c.remaining} outstanding · ${esc(c.status)}</button>`).join(''):'<div class="note">No operational follow-up cases recorded.</div>',button('close','Close'));return;}const c=state.cases.find(c=>c.id===id);if(!c)throw new Error('This operation case is unavailable.');const live=caseOpenItems(c);drawer(c.title,`${live.length} dated items still need operational review`,`<div class="ops-case-list">${c.items.map(item=>`<button class="btn" data-ops-action="case-item" data-key="${esc(item.key)}">${esc(item.date||dateKey(item.key))} · ${esc(item.name)}${item.bookingRef?' · '+esc(item.bookingRef):''}</button>`).join('')}</div>`,button('close','Close'));}
  function snapshot(){
    return {version:1,copies:state.copies.map(s=>({id:s.id,date:s.date,time:s.time,name:s.activity})),privateBookings:Object.values(state.bookings).map(b=>({id:b.id,recurrence:b.recurrence,allocations:b.allocations.length,dates:[...new Set(b.allocations.map(a=>a.date))]})),cases:state.cases.map(c=>{const remaining=caseOpenItems(c).length;return {...clone(c),remaining,status:remaining?'open':'resolved'};}),followUps:clone(state.followUps),changes:clone(state.changes),bookingMoves:clone(state.bookingMoves),resourceOperations:resourceAdapter?.snapshot?.()||null};
  }
  const catalog=[{id:'copySessions',title:'Copy session with a date pattern',group:'Events',pick:'session',description:'Create real dated sessions with individual replacement/exclusion decisions for every copied resource.'},{id:'moveSession',title:'Move complete session on calendar',group:'Events',pick:'session',description:'Drag or choose an exact time, review conflicting supply, and move all bookings together.'},{id:'privateAllocations',title:'Private booking allocations',group:'Private bookings',pick:'private',description:'Selected-day and whole-booking allocations grouped by package, with individual/date/series moves and supply replacement.'},{id:'operationCase',title:'Operational follow-up case',group:'Planning tools',pick:null,description:'Review saved partial assignment or undecided booking work.'},{id:'bookingFollowUp',title:'Booking Manager follow-up',group:'Planning tools',pick:null,description:'Track required financial or customer-data work and record its completion.'}];
  function handles(id){return ['createSessions','private','capacity',...catalog.map(c=>c.id),...(resourceAdapter?.catalog||[]).map(c=>c.id)].includes(id);}
  function navigate(id,args={}){try{if(id==='copySessions'||id==='createSessions')openCopy(args.id||args.sessionId,args);else if(id==='moveSession')openMove(args.id||args.sessionId,args);else if(id==='private'||id==='privateAllocations')openPrivate(args.id||args.privateId,args);else if(id==='capacity')window.v47OpenCapacity(args.id||args.sessionId,args.supplyName||null,{date:args.date});else if(id==='operationCase')openOperationCase(args.id);else if(id==='bookingFollowUp')openFollowUp(args.id);else return resourceAdapter.navigate(id,args);return {ok:true,action:id,simulated:false};}catch(e){return {ok:false,action:id,error:e.message};}}
  function calculateCapacity({requirements=[],attendees=0}={}){
    const evaluated=requirements.map(requirement=>{const scheduled=requirement.scheduledResources||requirement.scheduled||[];const unrostered=requirement.rostered===false||requirement.unrostered===true;return {id:requirement.id||requirement.category||requirement.type,unrostered,capacity:scheduled.reduce((sum,r)=>sum+Number(r.capacity||0)*Number(r.quantity??1),0)};});
    const known=evaluated.filter(r=>!r.unrostered),saleable=known.length?Math.min(...known.map(r=>r.capacity)):0,operational=evaluated.length?Math.min(...evaluated.map(r=>r.capacity)):0;
    return {saleable,operational,attendees:Number(attendees),shortfall:Math.max(0,Number(attendees)-operational),active:true,unrostered:evaluated.some(r=>r.unrostered),requirements:evaluated};
  }
  const api={occurrences,applyOccurrence,persist,refresh,sourceSessions,sourcePrivates,sourceResources,state:()=>state,snapshot,availability,calculateCapacity,booking,openCopy,openMove,openPrivate,openOperationCase,openFollowUp,applyNativeAssignment,applyNativeBulk,applyNativeBulkMoves,applyPublicMoves,
    registerResourceAdapter(adapter){resourceAdapter=adapter;refresh();},resourceState:name=>resourceAdapter?.resourceState?.(name)||null};
  window.OptimoV53Operations=Object.freeze(api);
  guide.registerOperations({projectOccurrences,snapshot,
    sessionRecord(base){const row=occurrences().find(r=>!r.private&&r.sourceId===base.id&&r.originalKey===`${base.id}@${base.date}`);return row?{...base,date:row.iso,time:row.time,bookings:row.bookings,att:row.att,assigned:row.assigned,status:row.status,detail:row.detail}:base;},
    privateRecord(base){const b=state.bookings[base.id],rows=occurrences().filter(r=>r.private&&r.sourceId===base.id),dates=[...new Set(rows.map(r=>r.iso))].sort();return {...base,recurrence:b?.recurrence||base.recurrence,date:dates[0]||base.date,dates,attention:rows.length?rows.some(r=>r.attention):!!base.attention};},
    get catalog(){return [...catalog,...(resourceAdapter?.catalog||[])];},handles,navigate});
  window.openCreateSession=(id,fromReschedule=false)=>openCopy(id,{fromReschedule});
  window.openMoveSession=(id)=>openMove(id);
  if(window.v493MoveSessionReview)window.v493MoveSessionReview=function(id){openMove(id,{date:document.getElementById('v493MoveDate')?.value,start:document.getElementById('v493MoveStart')?.value,venue:document.getElementById('v493MoveVenue')?.value});};
  if(window.openBulkMoveSessionEdit)window.openBulkMoveSessionEdit=function(id){const target=v32MoveBulkState.rows.find(r=>r.id===id);openMove(id,target);draft.nativeBulkEdit=true;Object.assign(draft.rows[0],target);renderMove();};
  window.openPrivate=(id)=>openPrivate(id);
  const nativeAssignRender=window.v44RenderAssign,nativeAssignReview=window.v44ReviewAssignment;
  if(nativeAssignRender)window.v44RenderAssign=function(...args){
    const result=nativeAssignRender(...args),ctx=v44AssignCtx;
    const review=document.querySelector('#drawerFoot [onclick="v44ReviewAssignment()"]');
    if(review&&ctx?.items?.some(item=>Number(item.qty)>0)){review.disabled=false;review.classList.remove('off');}
    return result;
  };
  if(nativeAssignReview)window.v44ReviewAssignment=function(...args){
    if(!v44AssignCtx?.items?.some(item=>Number(item.qty)>0)){error('Choose at least one resource to assign.');return;}
    const result=nativeAssignReview(...args),remaining=Math.max(0,Number(v44AssignCtx.need||0)-v44AssignCtx.items.reduce((sum,item)=>sum+Number(item.qty||0),0));
    if(remaining){document.getElementById('drawerBody')?.insertAdjacentHTML('afterbegin',`<div class="note warn" role="status"><b>${remaining} places will remain unallocated.</b> Apply the selected coverage now and keep the remaining shortfall in a saved operational case.</div>`);const apply=[...document.querySelectorAll('#drawerFoot button')].find(node=>(node.getAttribute('onclick')||'').includes("toast('Resource assignment applied"));if(apply)apply.textContent='Apply partial assignment';}
    decorateNative();return result;
  };
  window.v50ApplyBulkAssign=applyNativeBulk;
  if(nativePublicOpen)window.openReschedulePublic=function(id){publicContextKey=resolveOccurrenceKey(id);return nativePublicOpen(String(id).split('@')[0]);};
  window.v48BookingRows=contextBookingRows;
  if(nativeBookingRows)window.v48BookingsForSession=function(s){const key=resolveOccurrenceKey(s.__occurrenceKey||s.id);return key?ledger(key):nativeBookingRows(s);};
  if(nativePublicApply)window.v34FinishPublicMoves=applyPublicMoves;
  for(const name of ['v49SelectResched','v50SelectSame']){const original=window[name];if(original)window[name]=function(ref,slot,keepPrice=false){if(keepPrice&&!can('keepPrice')){error('Keeping the existing price requires permission.');return;}selectedDestinations.set(ref,{slot:clone(slot),keepPrice});return original(ref,slot,keepPrice);};}
  for(const name of ['v49PackageDecision','v50PackageDecision']){const original=window[name];if(original)window[name]=function(ref,slot){pendingPackageReview={ref,slot:clone(slot)};return original(ref,slot);};}
  if(nativeManager)window.v33OpenBookingManager=function(ref){const existing=state.followUps.find(f=>f.bookingRef===ref&&f.status==='open');if(existing){openFollowUp(existing.id);return;}const f={id:`booking-followup-${Date.now()}`,bookingRef:ref,sourceKey:publicContextKey,reason:pendingPackageReview?.slot?.compatible===false||pendingPackageReview?.slot?.kind==='data'?'Required attendee, questionnaire or waiver data differs. Complete the change in Booking Manager.':'Review the booking financials or requested change in Booking Manager.',destination:clone(pendingPackageReview?.slot||{}),status:'open',createdAt:new Date().toISOString()};state.followUps.unshift(f);record('Create Booking Manager follow-up',ref,null,f,{booking:ref},'Booking Manager update required');refresh();openFollowUp(f.id);};
  const nativeCreateApply=window.v49CreateSessions;
  if(nativeCreateApply)window.v49CreateSessions=function(){const st=v32CreateState;draft={kind:'copy',sourceId:st.id,sourceKey:resolveOccurrenceKey(st.id),fromReschedule:st.fromReschedule,rows:st.rows.map(row=>({...row,decisions:row.replacement?{[row.replacement.from]:row.replacement.to}:{}})),step:2};try{applyCopies();}catch(e){error(e.message);}};
  const nativePrivateFinish=window.v33FinishPrivateReschedule;
  if(nativePrivateFinish)window.v33FinishPrivateReschedule=function(){try{const ctx=v33PrivateCtx,changes=[];for(const [id,choice] of Object.entries(ctx?.choices||{})){const b=ensureBooking(id),before=clone(b),anchor=b.allocations.find(a=>a.date===guide.snapshot().eventPresentation.from)||b.allocations[0],targetDate=choice.date||choice.day?.match(/\d{4}-\d{2}-\d{2}/)?.[0];if(!targetDate)throw new Error('Choose an exact dated private destination.');const [start,end]=range(choice.time);const changed={...anchor,date:targetDate,start:format(start),end:format(end),venue:choice.venue||anchor.venue};for(const name of changed.resources){const check=availability(name,{iso:changed.date,time:`${changed.start}–${changed.end}`,venue:changed.venue},{excludeKeys:[anchor.originalKey,`${id}@${anchor.date}#${anchor.id}`].filter(Boolean)});if(!check.available)throw new Error(`${name}: ${check.reason}`);}changes.push({b,before,anchor,changed});}for(const c of changes){c.b.allocations=c.b.allocations.map(a=>a.id===c.anchor.id?c.changed:a);record('Reschedule private booking',c.b.id,c.before,c.b,{date:c.changed.date,allocation:c.changed.id});}nativePrivateFinish();refresh();}catch(e){error(e.message);}};
  const nativeCapacity={open:window.v47OpenCapacity,render:window.v48RenderCapacity,select:window.v48SelectCapacity,history:window.v48ShowCapacityEdits};
  let openingCapacityKey=null;
  function capacityOccurrence(id,date){
    const rows=occurrences().filter(row=>!row.private),str=String(id||'');
    return rows.find(row=>row.key===str)||rows.find(row=>row.originalKey===str)||rows.find(row=>row.sourceId===str.split('@')[0]&&row.iso===(date||dateKey(str)||guide.snapshot().eventPresentation.from));
  }
  function capacityAnchor(ctx){return capacityOccurrence(ctx.occurrenceKey||openingCapacityKey||ctx.id,ctx.date);}
  function capacityProjection(key,render){
    const row=capacityOccurrence(key),index=sourceSessions().findIndex(s=>s.id===row?.sourceId),source=sourceSessions()[index];
    if(!row||!source)throw new Error('Choose an existing dated session occurrence.');
    sourceSessions()[index]={...source,date:row.iso,time:row.time,venue:row.venue,activity:row.name,att:row.att,assigned:row.assigned,status:row.status,detail:row.detail,linkedSupply:clone(row.linkedSupply||[]),__occurrenceKey:row.key,__instanceDate:row.iso,__baseId:row.sourceId};
    try{return render(row.sourceId);}finally{sourceSessions()[index]=source;}
  }
  function capacityTargets(ctx){
    const anchor=capacityAnchor(ctx);if(!anchor)return [];
    if(ctx.scope!=='day')return (anchor.linkedSupply||[]).some(s=>s.name===ctx.name)?[anchor]:[];
    return occurrences().filter(row=>!row.private&&row.iso===anchor.iso&&range(row.time)[0]>=range(anchor.time)[0]&&(ctx.type!=='Facility'||row.venue===anchor.venue)&&(row.linkedSupply||[]).some(s=>s.name===ctx.name));
  }
  function capacityHistory(s){
    const row=capacityOccurrence(s.__occurrenceKey||s.id,s.__instanceDate||s.date),keys=[row?.key,row?.originalKey,`${String(s.__baseId||s.id).split('@')[0]}@${s.__instanceDate||s.date}`].filter(Boolean);
    return Object.values(v48CapOverrides).filter(entry=>[...(entry.occurrenceKeys||entry.sessionKeys||[]),...(entry.originalKeys||[])].some(key=>keys.includes(key))||(!entry.sessionKeys&&!entry.occurrenceKeys&&entry.sessionIds?.includes(String(s.id).split('@')[0])));
  }
  if(nativeCapacity.open){
    window.v47OpenCapacity=function(id,name=null,args={}){
      const row=capacityOccurrence(id,args.date);if(!row)throw new Error('Choose the dated session to adjust.');
      openingCapacityKey=row.key;
      try{const result=capacityProjection(row.key,sourceId=>nativeCapacity.open(sourceId,name));Object.assign(v48CapCtx,{occurrenceKey:row.key,date:row.iso});return result;}finally{openingCapacityKey=null;}
    };
    window.v47SupplyRecords=function(s){return (s.linkedSupply||[]).map(item=>{const entries=capacityHistory(s).filter(entry=>entry.name===item.name),last=entries.at(-1),configured=item.configuredCapacity??sourceSessions().find(x=>x.id===String(s.id).split('@')[0])?.linkedSupply?.find(x=>x.name===item.name)?.capacity??item.capacity;return {type:item.type,name:item.name,cap:last?.to??item.capacity,configured,used:Number(item.used||0)};});};
    window.v48SessionEdited=capacityHistory;
    window.sessionSupplyHtml=function(s){return window.v47SupplyRecords(s).map(item=>{const edited=capacityHistory(s).some(entry=>entry.name===item.name);return `<div class="v48-supply-row"><span class="badge ${item.type==='Facility'?'b-purple':item.type==='Equipment'?'b-info':'b-grey'}">${esc(item.type)}</span><div><b>${esc(item.name)}</b><div class="meta">${item.used} currently allocated${edited?` · configured ${item.configured}`:''}</div></div><b>${item.cap}</b><div>${edited?`<button class="v48-cap-edited" onclick="v48ShowCapacityEdits('${esc(s.__occurrenceKey||s.id)}')">✎ ${item.configured} → ${item.cap}</button>`:'<span class="small muted">capacity</span>'}</div></div>`;}).join('')||'<span class="small muted">No linked supply.</span>';};
    window.v48RenderCapacity=function(...args){return capacityProjection(v48CapCtx?.occurrenceKey||openingCapacityKey||v48CapCtx?.id,()=>nativeCapacity.render(...args));};
    window.v48SelectCapacity=function(...args){return capacityProjection(v48CapCtx.occurrenceKey||openingCapacityKey||v48CapCtx.id,()=>nativeCapacity.select(...args));};
    window.v48ShowCapacityEdits=function(id){const row=capacityOccurrence(id);return row?capacityProjection(row.key,sourceId=>nativeCapacity.history(sourceId)):null;};
    window.v48CapacitySessions=function(ctx){return capacityTargets(ctx).map(row=>({...sourceFor(row),date:row.iso,time:row.time,venue:row.venue,activity:row.name,bookings:row.bookings,att:row.att,assigned:row.assigned,status:row.status,linkedSupply:clone(row.linkedSupply||[]),__occurrenceKey:row.key,__instanceDate:row.iso,__baseId:row.sourceId}));};
    window.v49CapacityRows=function(ctx){return window.v48CapacitySessions(ctx).map(s=>{const a=(s.linkedSupply||[]).find(item=>item.name===ctx.name),used=Number(a?.used||0);return {s,a,used,dealloc:Math.max(0,used-Number(ctx.value))};});};
    window.v48ApplyCapacity=function(){try{
      if(!can('capacityOverride'))throw new Error('Capacity override permission is required.');
      const ctx=clone(v48CapCtx),before=capacityTargets(ctx),anchor=capacityAnchor(ctx),value=Number(ctx.value);
      if(!anchor||!before.length)throw new Error('The selected occurrence no longer uses this supply.');
      if(!Number.isFinite(value)||value<0)throw new Error('Enter a capacity of zero or greater.');
      const releases=new Map(),after=before.map(row=>{
        const supply=clone(row.linkedSupply||[]),selected=supply.find(item=>item.name===ctx.name),released=Math.max(0,Number(selected.used||0)-value),assigned=Math.max(0,Number(row.assigned||0)-released);
        releases.set(row.key,released);selected.configuredCapacity=selected.configuredCapacity??ctx.configured??selected.capacity;selected.capacity=value;selected.used=Math.min(Number(selected.used||0),value);
        return applyOccurrence(row.key,{assigned,linkedSupply:supply,status:released&&assigned<Number(row.att||0)?'attention':row.status,detail:released?`${released} attendee allocations released after capacity reduction; ${Math.max(0,Number(row.att||0)-assigned)} places need coverage`:row.detail},{audit:false,refresh:false});
      });
      const key=`${anchor.key}|${ctx.name}|${Date.now()}`;
      v48CapOverrides[key]={name:ctx.name,type:ctx.type,from:ctx.old,to:value,configured:ctx.configured,scope:ctx.scope,scopeLabel:ctx.scope==='day'?'Rest of day':'This timeslot',sessionIds:[...new Set(before.map(row=>row.sourceId))],sessionKeys:before.map(row=>row.key),occurrenceKeys:before.map(row=>row.key),originalKeys:before.map(row=>row.originalKey)};
      state.capacityOverrides=clone(v48CapOverrides);
      record('Adjust operational capacity',ctx.name,before,after,{occurrence:anchor.key,date:anchor.iso,scope:ctx.scope,occurrenceKeys:before.map(row=>row.key),capacity:value});refresh();
      drawer('Capacity updated',`${ctx.name} · ${ctx.old} → ${value}`,`<div class="note good">Operational capacity updated for ${after.length} dated occurrence${after.length===1?'':'s'}.</div>${after.map(row=>`<p><b>${esc(row.iso)} · ${esc(row.time)} · ${esc(row.name)}</b><br>${releases.get(row.key)?`${releases.get(row.key)} allocations released · ${Math.max(0,Number(row.att||0)-Number(row.assigned||0))} places need coverage`:'No booking allocations displaced'}</p>`).join('')}`,`<button class="btn pri" onclick="openSession('${esc(anchor.key)}')">Return to session</button>`);
      return {ok:true,occurrenceKeys:before.map(row=>row.key)};
    }catch(e){error(e.message);return {ok:false,error:e.message};}};
    window.v47ApplyCapacity=window.v48ApplyCapacity;
  }
  if(state.capacityOverrides&&typeof v48CapOverrides!=='undefined')Object.assign(v48CapOverrides,state.capacityOverrides);
  function decorateNative(){
    document.querySelectorAll('#drawerFoot [onclick],#drawer .df [onclick],#modalFoot [onclick]').forEach(node=>{const handler=node.getAttribute('onclick')||'';if(handler.includes("toast('Resource assignment applied"))node.setAttribute('onclick','OptimoV53Operations.applyNativeAssignment()');if(handler.includes('v32MoveBulkState=null;toast'))node.setAttribute('onclick','OptimoV53Operations.applyNativeBulkMoves()');if(/Keep existing price/i.test(node.textContent)&&!can('keepPrice')){node.disabled=true;node.title='Permission to retain existing prices is required.';}});
    document.querySelectorAll('.hybrid-period-occurrence[data-family="public"]').forEach(node=>{node.draggable=true;node.dataset.opsDragKey=node.dataset.occurrenceKey;});
    document.querySelectorAll('.hybrid-period-day-track').forEach(node=>node.dataset.opsCalendarDrop='true');
  }
  let decoratePending=false;new MutationObserver(()=>{if(!decoratePending){decoratePending=true;requestAnimationFrame(()=>{decoratePending=false;decorateNative();});}}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',event=>{
    const modalPrice=event.target.closest('button');if(modalPrice&&/Keep existing price/i.test(modalPrice.textContent)&&pendingPackageReview){if(!can('keepPrice')){event.preventDefault();event.stopImmediatePropagation();error('Keeping the existing price requires permission.');return;}selectedDestinations.set(pendingPackageReview.ref,{slot:clone(pendingPackageReview.slot),keepPrice:true});}
  },true);
  document.addEventListener('click',event=>{const node=event.target.closest('[data-ops-action]');if(!node)return;event.preventDefault();const action=node.dataset.opsAction;try{
    if(action==='close')window.closeDrawer();
    else if(action==='copy-generate')generateCopies();
    else if(action==='copy-back'){draft.step=1;renderCopy();}
    else if(action==='copy-apply')applyCopies();
    else if(action==='copy-native')native.create(draft.sourceId,draft.fromReschedule);
    else if(action==='move-apply'){if(draft.nativeBulkEdit){const target=v32MoveBulkState.rows.find(r=>r.id===draft.sourceId);Object.assign(target,draft.rows[0]);window.openMoveBulkReviewV32();}else applyMove();}
    else if(action==='move-native')native.move(draft.sourceId);
    else if(action==='result-calendar'){const dates=draft.kind==='copy'?draft.rows.map(r=>r.date):[draft.rows[0].date];window.closeDrawer();guide.navigate('events',{view:'calendar',scope:dates.length===1?'day':'period',from:dates.sort()[0],to:dates.sort().at(-1)});}
    else if(action==='return-reschedule')window.renderRescheduleWorkspace();
    else if(action==='private-day'){privateContext.view='day';renderPrivate();}
    else if(action==='private-whole'){privateContext.view='whole';renderPrivate();}
    else if(action==='private-add')openPrivatePattern();
    else if(action==='private-pattern-apply')applyPrivatePattern();
    else if(action==='private-back')renderPrivate();
    else if(action==='private-native')native.private(privateContext.id);
    else if(action==='private-native-reschedule')window.v33StartPrivateReschedule([privateContext.id]);
    else if(action==='private-move')openPrivateMove();
    else if(action==='private-move-one')openPrivateMove([node.dataset.id]);
    else if(action==='private-move-apply')applyPrivateMove();
    else if(action==='private-replace')openPrivateReplacement(node.dataset.id);
    else if(action==='private-replace-apply')applyPrivateReplacement();
    else if(action==='booking-followup')openFollowUp(node.dataset.id);
    else if(action==='operation-case')openOperationCase(node.dataset.id);
    else if(action==='followup-complete'){const f=state.followUps.find(f=>f.id===node.dataset.id),before=clone(f);f.status='completed';f.notes=document.getElementById('opsFollowUpNotes').value;f.completedAt=new Date().toISOString();record('Complete Booking Manager follow-up',f.bookingRef,before,f,{booking:f.bookingRef},'Follow-up marked complete');refresh();openFollowUp(f.id);}
    else if(action==='case-item'){const row=occurrences().find(r=>r.key===node.dataset.key||r.originalKey===node.dataset.key);if(row)guide.navigate(row.private?'private':'session',{id:row.key,date:row.iso});}
  }catch(e){error(e.message);}});
  document.addEventListener('change',event=>{const node=event.target;try{
    if(node.dataset.opsSupply!==undefined){draft.rows[Number(node.dataset.opsSupply)].decisions[node.dataset.name]=node.value;draft.kind==='copy'?renderCopy():renderMove();}
    else if(['opsMoveDate','opsMoveStart','opsMoveEnd','opsMoveVenue'].includes(node.id)){const row=draft.rows[0];row.date=document.getElementById('opsMoveDate').value;row.start=document.getElementById('opsMoveStart').value;row.end=document.getElementById('opsMoveEnd').value;row.venue=document.getElementById('opsMoveVenue').value;row.decisions={};renderMove();}
    else if(node.id==='opsPrivateDay'){privateContext.date=node.value;privateContext.selected=new Set(booking(privateContext.id).allocations.filter(a=>a.date===node.value).map(a=>a.id));renderPrivate();}
    else if(node.dataset.opsAllocation){node.checked?privateContext.selected.add(node.dataset.opsAllocation):privateContext.selected.delete(node.dataset.opsAllocation);}
    else if(node.id==='opsPrivateMoveScope'){draft.scope=node.value;renderPrivateMove();}
    else if(node.id==='opsPrivateMoveDate'){draft.date=node.value;renderPrivateMove();}
    else if(node.id==='opsPrivateMoveStart'){draft.start=node.value;renderPrivateMove();}
    else if(node.dataset.opsPrivateSupply){draft.decisions[`${node.dataset.opsPrivateSupply}|${node.dataset.name}`]=node.value;renderPrivateMove();}
    else if(node.id==='opsPrivateReplaceScope'){draft.scope=node.value;renderPrivateReplacement();}
    else if(node.dataset.opsReplacement){draft.decisions[node.dataset.opsReplacement]=node.value;renderPrivateReplacement();}
  }catch(e){error(e.message);}});
  document.addEventListener('dragstart',event=>{const node=event.target.closest('.ops-drag-session,[data-ops-drag-key]');if(!node)return;event.dataTransfer.setData('text/optimo-session',node.dataset.opsDragKey||draft?.sourceKey||'');event.dataTransfer.effectAllowed='move';});
  document.addEventListener('dragover',event=>{if(event.target.closest('[data-ops-drop-date],[data-ops-calendar-drop]')){event.preventDefault();event.dataTransfer.dropEffect='move';}});
  document.addEventListener('drop',event=>{const exact=event.target.closest('[data-ops-drop-date]'),track=event.target.closest('[data-ops-calendar-drop]');if(!exact&&!track)return;event.preventDefault();const key=event.dataTransfer.getData('text/optimo-session');if(!key)return;try{if(exact){updateMoveDate(exact.dataset.opsDropDate,exact.dataset.opsDropTime);}else{const day=track.closest('[data-date]').dataset.date,rect=track.getBoundingClientRect(),scale=parseFloat(getComputedStyle(track).getPropertyValue('--hybrid-hour'))||108,first=Number(track.dataset.startMinute)||8*60;const start=format(Math.max(0,Math.round((first+(event.clientY-rect.top)/scale*60)/15)*15));openMove(key,{date:day,start});}}catch(e){error(e.message);}});
  document.addEventListener('click',event=>{const target=event.target.closest('[data-ops-drop-date]');if(target&&draft?.kind==='move')updateMoveDate(target.dataset.opsDropDate,target.dataset.opsDropTime);});
  decorateNative();
})();
