/* Persistent resource availability and dated customer-work impact, layered over V53. */
(() => {
  'use strict';
  const STORAGE = 'optimo-v53-resource-operations-v1';
  const h = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clone = value => JSON.parse(JSON.stringify(value));
  const engine = () => window.OptimoV53Operations;
  const today = () => document.querySelector('#resDateField input[type="date"]')?.value || window.OptimoV53Guide?.snapshot().referenceDay || '2026-08-24';
  const read = () => { try { const saved = JSON.parse(localStorage.getItem(STORAGE)); return saved?.version === 1 ? saved : {version:1,cases:[],resourceStates:{}}; } catch { return {version:1,cases:[],resourceStates:{}}; } };
  let state = read(), draft = null, activeCase = null;
  const save = () => localStorage.setItem(STORAGE, JSON.stringify(state));
  const sources = () => { const all = engine()?.sourceResources?.(); return Array.isArray(all) ? all : [...(all?.resources || []), ...(all?.facilities || [])]; };
  const resourcesOnly = () => sources().filter(r => !String(r.cat || '').includes('Facilities') && !r.facility);
  const rows = () => engine()?.occurrences?.() || [];
  const keyOf = row => row.key || `${row.sourceId || row.id}@${row.iso || row.date}`;
  const dateOf = row => String(row.iso || row.date || '').slice(0,10);
  function range(time) { const m=String(time||'').match(/(\d{1,2}):(\d{2})\s*[–-]\s*(\d{1,2}):(\d{2})/); return m ? [Number(m[1])*60+Number(m[2]),Number(m[3])*60+Number(m[4])] : null; }
  const overlap = (a,b) => !!a && !!b && a[0]<b[1] && b[0]<a[1];
  function stamps(row) { const r=range(row.time); return r ? [dateOf(row)+'T'+String(Math.floor(r[0]/60)).padStart(2,'0')+':'+String(r[0]%60).padStart(2,'0'), dateOf(row)+'T'+String(Math.floor(r[1]/60)).padStart(2,'0')+':'+String(r[1]%60).padStart(2,'0')] : [dateOf(row)+'T00:00',dateOf(row)+'T23:59']; }
  const has = (row,name) => (row.resources || []).includes(name) || (row.linkedSupply || []).some(s=>s.name===name);
  function bounds(d) { return {from:d.scope==='today' ? d.day+'T00:00' : d.from, to:d.scope==='today' ? d.day+'T23:59' : d.scope==='forever' ? '9999-12-31T23:59' : d.to}; }
  function inScope(row,d) { const b=bounds(d),t=stamps(row);return t[0]<b.to && t[1]>b.from; }
  function resourceState(name) { return clone(state.resourceStates[name] || {ranges:[]}); }
  function isBlocked(name,iso,time) {
    const status=state.resourceStates[name];if(!status)return false;
    const target=typeof iso==='object'?iso:{iso,time:time||'00:00–23:59'};const t=stamps(target);
    return !!(status.inactiveFrom && t[1]>status.inactiveFrom) || (status.ranges||[]).some(b=>b.blockNew && t[0]<b.to && t[1]>b.from);
  }
  function isAvailable(name,row) {
    if(isBlocked(name,row))return false;
    const t=stamps(row),move=(state.resourceStates[name]?.moves||[]).filter(m=>t[0]<m.to&&t[1]>m.from).at(-1);
    if(!move)return true;
    const arrival=new Date(new Date(move.from+'Z').getTime()+Number(move.travel||0)*60000).toISOString().slice(0,16);
    return row.venue===move.venue && t[0]>=arrival;
  }
  function norm(v) { return String(v || '').toLowerCase().replace(/snorkell?ing|snorkeling/g,'snorkel').replace(/e[ -]?bik(?:ing|es?|e)/g,'ebike').replace(/e[ -]?foil/g,'efoil').replace(/[^a-z0-9]+/g,' '); }
  function skillFor(row,source) {
    const activity=norm(row.name || row.activity);const checks=[['efoil','efoil'],['ebike','ebike'],['kayak','kayak'],['climbing','climbing'],['snorkel','snorkel'],['sup','sup'],['dive','div'],['paddle','sup']];
    const found=checks.find(([word])=>activity.includes(word));
    return found?.[1] || '';
  }
  function eligible(candidate,source,row) {
    if(candidate.name===source.name || !!candidate.human!==!!source.human)return false;
    if(candidate.business && source.business && candidate.business!==source.business)return false;
    if(candidate.human) { const skill=skillFor(row,source);return skill ? norm(candidate.skills).includes(skill) : norm(candidate.cat)===norm(source.cat); }
    const config=norm(source.name).split(' ').filter(w=>!['st','regis','desert','rock','nujuma','edition','quantity'].includes(w));
    return config.length>0 && config.some(word=>word.length>3 && norm(candidate.skills+' '+candidate.name).includes(word));
  }
  function capacity(resource,row) {
    const known=rows().flatMap(r=>r.linkedSupply||[]).filter(s=>s.name===resource.name).map(s=>Number(s.capacity)||0);
    const explicit=Number(resource.capacity)||Number(String(resource.skills||'').match(/quantity\s*(\d+)/i)?.[1]);
    return Math.max(explicit||0,...known,resource.human ? (resource.business==='Galaxea'?6:resource.business==='Akun'?8:4) : 1);
  }
  function venueFor(candidate,row) {
    const instant=stamps(row)[0];
    const move=(state.resourceStates[candidate.name]?.moves||[]).filter(m=>instant>=m.from&&instant<m.to).at(-1);
    return move?.venue||candidate.venue;
  }
  function availability(candidate,row,reservations=[],ignoreKeys=new Set()) {
    if(!isAvailable(candidate.name,row))return {available:0,reason:'Blocked, inactive, travelling or temporarily at another venue'};
    if(venueFor(candidate,row)!==row.venue)return {available:0,reason:'Another venue · use the resource transfer workflow'};
    const cap=capacity(candidate,row),target=range(row.time),day=dateOf(row),key=keyOf(row);let used=0;
    for(const r of rows()) {
      if(ignoreKeys.has(keyOf(r)) || dateOf(r)!==day || !overlap(target,range(r.time)) || !has(r,candidate.name) || r.preliminary)continue;
      const linked=(r.linkedSupply||[]).find(s=>s.name===candidate.name);
      if(keyOf(r)!==key && (candidate.human || r.private))return {available:0,reason:`Busy · ${r.name} · ${r.time}`};
      used += r.private ? cap : Number(linked?.used ?? linked?.capacity ?? (r.assigned || r.att || r.attendees || cap));
    }
    // The source diary also includes operational duties without a customer event.
    if(day==='2026-08-24')for(const a of candidate.assign||[]) {
      if(a[2]==='prelim'||!overlap(target,range(a[0])))continue;
      const mapped=rows().some(r=>dateOf(r)===day && has(r,candidate.name) && r.time===a[0] && norm(r.name)===norm(a[1])) || state.cases.some(c=>c.resource===candidate.name && c.rows.some(r=>r.iso===day && r.time===a[0] && norm(r.name)===norm(a[1])));
      if(!mapped)return {available:0,reason:`Busy · ${a[1]} · ${a[0]}`};
    }
    for(const r of reservations)if(r.name===candidate.name && r.key!==key && r.iso===day && overlap(target,range(r.time))) {
      if(candidate.human || r.private)return {available:0,reason:'Reserved by another replacement in this plan'};
      used+=r.qty;
    }
    const available=Math.max(0,cap-used);return {available,capacity:cap,reason:available?'Eligible, rostered at this venue and available':'No unallocated capacity remains'};
  }
  function candidates(source,row,reservations=[]) { return resourcesOnly().filter(r=>eligible(r,source,row)).map(r=>({...r,...availability(r,row,reservations)})).sort((a,b)=>b.available-a.available || a.name.localeCompare(b.name)); }
  function affected(d) { return rows().filter(row=>has(row,d.name) && inScope(row,d)).sort((a,b)=>dateOf(a).localeCompare(dateOf(b)) || String(a.time).localeCompare(String(b.time)) || keyOf(a).localeCompare(keyOf(b))); }
  function removedNeed(row,name) {
    if(row.private)return 1;
    const entry=(row.linkedSupply||[]).find(s=>s.name===name);
    return Math.max(0,Math.min(Number(row.att ?? row.attendees ?? 0),Number(entry?.used ?? entry?.capacity ?? row.assigned ?? 0)));
  }
  function plan(d) {
    const source=resourcesOnly().find(r=>r.name===d.name);if(!source)throw new Error('Choose a resource from Resource Operations.');
    const reservations=[],result=[],errors=[];
    let work=d.removeSlots?affected(d):[];
    // An explicit recurring-private decision can extend replacement beyond the closure period.
    for(const [key,choice] of Object.entries(d.privateChoices||{}))if(choice.allDates && choice.name) {
      const anchor=rows().find(r=>keyOf(r)===key);if(!anchor)continue;
      rows().filter(r=>r.private && r.sourceId===anchor.sourceId && dateOf(r)>=bounds(d).from.slice(0,10) && has(r,d.name)).forEach(r=>{if(!work.some(x=>keyOf(x)===keyOf(r)))work.push(r);});
    }
    work=work.sort((a,b)=>Number(b.private)-Number(a.private)||dateOf(a).localeCompare(dateOf(b))||String(a.time).localeCompare(String(b.time)));
    for(const row of work) {
      const key=keyOf(row),need=removedNeed(row,d.name),replacements=[];
      if(row.private) {
        const anchor=Object.entries(d.privateChoices||{}).find(([k,c])=>c.allDates && c.name && rows().find(r=>keyOf(r)===k)?.sourceId===row.sourceId);
        const chosen=d.privateChoices?.[key]?.name || anchor?.[1]?.name || '';
        if(chosen) {
          const candidate=candidates(source,row,reservations).find(c=>c.name===chosen);
          if(!candidate || candidate.available<=0)errors.push(`${row.name} · ${dateOf(row)} ${row.time}: ${chosen} cannot replace this whole resource assignment${candidate ? ' ('+candidate.reason+')' : ''}.`);
          else replacements.push({name:chosen,qty:1,capacity:candidate.capacity || capacity(candidate,row),type:source.human?'Resource':'Equipment'});
        }
      } else if(need>0) {
        let left=need;
        for(const candidate of candidates(source,row,reservations).filter(c=>c.available>0)) {
          const qty=Math.min(left,candidate.available);if(qty<=0)continue;
          replacements.push({name:candidate.name,qty,capacity:candidate.capacity||capacity(candidate,row),type:source.human?'Resource':'Equipment'});left-=qty;if(!left)break;
        }
      }
      replacements.forEach(r=>reservations.push({...r,key,iso:dateOf(row),time:row.time,private:!!row.private}));
      const covered=row.private ? Number(replacements.length>0) : replacements.reduce((n,r)=>n+r.qty,0);
      result.push({key,originalKey:row.originalKey||key,allocationId:row.allocationId,sourceId:row.sourceId,iso:dateOf(row),time:row.time,name:row.name,ref:row.ref,venue:row.venue,private:!!row.private,need,covered,replacements,outcome:need===0?'released':covered>=need?'full':covered?'partial':'unresolved',before:clone(row),extended:!inScope(row,d)});
    }
    return {rows:result.sort((a,b)=>a.iso.localeCompare(b.iso)||a.time.localeCompare(b.time)),errors};
  }
  function validate(d) { if(!['today','period','forever'].includes(d.scope))throw new Error('Choose today, a period or forever.');const b=bounds(d);if(!d.name)throw new Error('Choose a resource.');if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.from)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.to)||b.to<=b.from)throw new Error('Choose a valid start and later end time.');if(d.inactive && d.scope!=='forever')throw new Error('Only a forever closure can make a resource inactive.'); }
  function show(title,sub,body,foot) { if(typeof window.openWideDrawer==='function')window.openWideDrawer('RESOURCE OPERATIONS',title,sub,`<div class="v53r-root">${body}</div>`,foot); }
  const button=(label,action,extra='',primary=false)=>`<button class="btn ${primary?'pri':''}" data-v53r-action="${action}" ${extra}>${h(label)}</button>`;
  const steps=step=>`<div class="guidebar">${['Period & options','Dated impact','Saved case'].map((s,i)=>`<div class="gstep ${i===step?'on':i<step?'done':''}">${i+1} · ${s}</div>`).join('')}</div>`;
  function openUnavailable(name,options={}) {
    if(!engine())throw new Error('Resource operations are still loading.');
    const source=resourcesOnly().find(r=>r.name===name);if(!source)throw new Error('Choose a person or equipment resource.');
    if(!draft || draft.name!==name || options.reset)draft={name,day:options.date||today(),scope:'today',from:(options.date||today())+'T00:00',to:(options.date||today())+'T23:59',reason:source.human?'Sick leave':'Maintenance',removeSlots:true,blockNew:true,inactive:false,privateChoices:{}};
    Object.assign(draft,options);const d=draft,status=resourceState(name),impact=affected(d);
    show(`${name} unavailable`,'Choose the period and how existing slots and new bookings should be handled.',`${steps(0)}<div class="section"><div class="sh"><h3>Unavailable period</h3></div><div class="sb"><div class="v53r-scopes">${[['today',`Today · ${d.day}`],['period','A period'],['forever','Forever']].map(([value,label])=>`<label><input type="radio" name="v53r-scope" data-v53r-field="scope" value="${value}" ${d.scope===value?'checked':''}> ${h(label)}</label>`).join('')}</div><div class="two mt"><div class="fld"><label for="v53r-from">${d.scope==='today'?'Operating date':'From'}</label><input id="v53r-from" type="${d.scope==='today'?'date':'datetime-local'}" data-v53r-field="${d.scope==='today'?'day':'from'}" value="${h(d.scope==='today'?d.day:d.from)}"></div>${d.scope==='period'?`<div class="fld"><label for="v53r-to">Until</label><input id="v53r-to" type="datetime-local" data-v53r-field="to" value="${h(d.to)}"></div>`:`<div class="v53r-period-hint">${d.scope==='forever'?'All future allocations from the selected start time.':'The entire selected operating day.'}</div>`}</div><div class="fld mt"><label for="v53r-reason">Reason</label><input id="v53r-reason" data-v53r-field="reason" value="${h(d.reason)}" maxlength="240"></div><div class="v53r-options"><label><input type="checkbox" data-v53r-field="removeSlots" ${d.removeSlots?'checked':''}><span><b>Remove existing resource slots</b><small>Release this resource from the affected allocations and reallocate eligible public work.</small></span></label><label><input type="checkbox" data-v53r-field="blockNew" ${d.blockNew?'checked':''}><span><b>Block new bookings and assignments</b><small>Prevent this resource being allocated during the chosen period.</small></span></label><label class="${d.scope==='forever'?'':'v53r-disabled'}"><input type="checkbox" data-v53r-field="inactive" ${d.inactive?'checked':''} ${d.scope==='forever'?'':'disabled'}><span><b>Make resource inactive</b><small>Available only for a forever closure.</small></span></label></div></div></div><div class="note"><b>${impact.length} dated allocation${impact.length===1?'':'s'} use this resource in the period.</b> ${d.removeSlots?'Public replacement capacity is calculated from eligible supply and conflicting allocations. Private bookings ask for a whole-resource replacement.':'Existing slots and their allocations will be retained.'}</div>${status.ranges.length?`<div class="v53r-history-note">${status.ranges.length} saved availability change${status.ranges.length===1?'':'s'} for this resource. ${button('View cases','cases',`data-name="${h(name)}"`)}</div>`:''}<div id="v53r-error" role="alert"></div>`,button('Cancel','close')+'<span class="sp"></span>'+button('Review dated impact','review','',true));
    return {ok:true,draft:clone(d),affected:impact.length};
  }
  function renderRow(item,source,p) {
    const choice={...(draft.privateChoices[item.key]||{}),name:item.replacements[0]?.name||draft.privateChoices[item.key]?.name||''},cs=item.private?candidates(source,item.before):[],repeat=rows().filter(r=>r.private && r.sourceId===item.sourceId && dateOf(r)>=bounds(draft).from.slice(0,10) && has(r,draft.name)).length;
    return `<article class="v53r-impact ${item.outcome}"><div class="v53r-impact-top"><div><b>${h(item.name)}</b><div class="meta">${h(item.ref||'')} ${h(item.iso)} · ${h(item.time)} · ${h(item.venue)}</div></div><span class="badge ${item.outcome==='full'||item.outcome==='released'?'b-good':'b-warn'}">${item.private?'Private · ':''}${{full:'Fully replaced',partial:'Partially replaced',unresolved:'Unresolved',released:'Slot released'}[item.outcome]}</span></div>${item.private?`<label class="fld"><span>Replacement for the whole resource assignment</span><select data-v53r-private="${h(item.key)}"><option value="">Leave unallocated · resolve in Event Operations</option>${cs.map(c=>`<option value="${h(c.name)}" ${choice.name===c.name?'selected':''} ${c.available?'':'disabled'}>${h(c.name)} · ${c.available?'Available':c.reason}</option>`).join('')}</select></label>${repeat>1?`<label class="v53r-repeat"><input type="checkbox" data-v53r-repeat="${h(item.key)}" ${choice.allDates?'checked':''}> Replace on all ${repeat} remaining dates of this booking; validate every date.</label>`:''}${item.extended?'<div class="meta">Included by the all-dates replacement choice.</div>':''}`:`<div class="v53r-replacement">${item.replacements.length?item.replacements.map(r=>`<span><b>${h(r.name)}</b> · ${r.qty} place${r.qty===1?'':'s'}</span>`).join(''):'No eligible, free replacement at this venue.'}${item.need?`<small>${item.covered} of ${item.need} removed resource places replaced${item.need>item.covered?`; ${item.need-item.covered} remain unallocated`:''}.</small>`:'<small>No committed attendee allocation; release the resource slot.</small>'}</div>`}</article>`;
  }
  function review() {
    try { validate(draft);const p=plan(draft),source=resourcesOnly().find(r=>r.name===draft.name);draft.stage='review';
      const counts={full:p.rows.filter(r=>r.outcome==='full').length,partial:p.rows.filter(r=>r.outcome==='partial').length,unresolved:p.rows.filter(r=>r.outcome==='unresolved').length};
      show(`Dated impact · ${draft.name}`,`${bounds(draft).from.replace('T',' ')} → ${draft.scope==='forever'?'Forever':bounds(draft).to.replace('T',' ')}`,`${steps(1)}<div class="v53r-metrics"><div><b>${p.rows.length}</b><span>Affected allocations</span></div><div><b>${counts.full}</b><span>Fully replaced</span></div><div><b>${counts.partial}</b><span>Partially replaced</span></div><div><b>${counts.unresolved}</b><span>Unresolved</span></div></div><div class="note">${draft.removeSlots?'Public changes use available eligible resource capacity. Choose replacements for private bookings, or leave them unallocated for Event Operations.':'Existing allocations will be kept; this case records the availability options only.'} ${draft.blockNew?'New bookings will be blocked.':'New bookings remain allowed.'} ${draft.inactive?'The resource will become inactive.':''}</div><div class="v53r-impact-list">${p.rows.map(r=>renderRow(r,source,p)).join('')||'<div class="v53r-empty">No existing allocations will change.</div>'}</div>${p.errors.length?`<div class="v53r-error" role="alert">${p.errors.map(h).join('<br>')}</div>`:''}<div id="v53r-error" role="alert"></div>`,button('Back','back')+'<span class="sp"></span>'+button('Apply unavailability','apply',p.errors.length?'disabled':'',true));
      return {ok:true,plan:clone(p)};
    } catch(error) { report(error);return {ok:false,error:error.message}; }
  }
  function patchFor(item,name) {
    const before=item.before,supply=clone(before.linkedSupply||[]).filter(s=>s.name!==name),resourceNames=(before.resources||[]).filter(n=>n!==name);
    for(const replacement of item.replacements) {
      const old=supply.find(s=>s.name===replacement.name);
      if(old)old.used=Number(old.used||0)+(item.private?Number(before.att??before.attendees??1):replacement.qty);
      else supply.push({type:replacement.type,name:replacement.name,used:item.private?Number(before.att??before.attendees??1):replacement.qty,capacity:replacement.capacity});
      if(!resourceNames.includes(replacement.name))resourceNames.push(replacement.name);
    }
    const attendees=Number(before.att ?? before.attendees ?? 0),assigned=item.private?(item.covered?Number(before.assigned??attendees):0):Math.max(0,Math.min(attendees,Number(before.assigned||0)-item.need+item.covered));
    const outstanding=item.private?!item.covered:assigned<attendees;
    return {resources:resourceNames,linkedSupply:supply,assigned,attention:outstanding,status:outstanding?'attention':before.preliminary?'preliminary':attendees?'covered':'nobookings',detail:outstanding?`${name} removed; ${item.private?'replacement resource required':`${attendees-assigned} attendee places still need coverage`}`:`${name} replaced${item.replacements.length?' by '+item.replacements.map(r=>r.name).join(', '):''}; resource change recorded`};
  }
  function apply(options) {
    if(options) { if(!draft)openUnavailable(options.name,options);else Object.assign(draft,options); }
    try {
      validate(draft);const p=plan(draft);if(p.errors.length)throw new Error(p.errors.join('\n'));
      if(!engine()?.applyOccurrence)throw new Error('Dated allocation persistence is unavailable.');
      const beforeState=clone(state),id='RU-'+Date.now().toString(36).toUpperCase(),b=bounds(draft),now=new Date().toISOString();
      const item={id,createdAt:now,resource:draft.name,scope:draft.scope,from:b.from,to:b.to,reason:draft.reason,removeSlots:!!draft.removeSlots,blockNew:!!draft.blockNew,inactive:!!draft.inactive,privateChoices:clone(draft.privateChoices||{}),rows:[]};
      for(const impact of p.rows) {
        const patch=patchFor(impact,draft.name);engine().applyOccurrence(impact.key,patch,{audit:false,refresh:false});
        item.rows.push({...impact,after:{...impact.before,...patch}});
      }
      const status=state.resourceStates[draft.name] || {ranges:[]};status.ranges ||= [];
      status.ranges.push({id,from:b.from,to:b.to,blockNew:!!draft.blockNew,slotsRemoved:!!draft.removeSlots,reason:draft.reason});if(draft.inactive)status.inactiveFrom=b.from;
      state.resourceStates[draft.name]=status;state.cases.unshift(item);save();engine().persist?.();engine().refresh?.();
      window.OptimoAudit?.record?.({area:'resources',action:'Mark resource unavailable',entity:draft.name,before:beforeState.resourceStates[draft.name]||null,after:clone(item),scope:{from:b.from,to:b.to,kind:draft.scope},outcome:`${p.rows.length} dated allocations processed; ${p.rows.filter(r=>r.outcome==='unresolved'||r.outcome==='partial').length} need review`});
      draft=null;openCase(id);return {ok:true,caseId:id,case:clone(item)};
    } catch(error) { report(error);return {ok:false,error:error.message}; }
  }
  function currentOccurrence(saved) {
    const original=saved.originalKey||saved.before?.originalKey||saved.key,allocation=saved.allocationId||saved.before?.allocationId;
    return rows().find(row=>keyOf(row)===saved.key||row.originalKey===original||(allocation&&row.sourceId===saved.sourceId&&row.allocationId===allocation)) || (saved.private&&!allocation?rows().find(row=>row.private&&row.sourceId===saved.sourceId&&dateOf(row)===saved.iso&&row.time===saved.time):null);
  }
  function unresolved(item) {
    return item.rows.filter(r=>{const current=currentOccurrence(r);if(!current)return true;if(r.private)return !current.resources?.length || current.attention || current.status==='attention' || (!r.replacements.length && !(current.resources||[]).some(n=>{const candidate=resourcesOnly().find(s=>s.name===n),source=resourcesOnly().find(s=>s.name===item.resource);return candidate&&source&&eligible(candidate,source,current);}));return Number(current.assigned||0)<Number(current.att??current.attendees??0);});
  }
  function cases(name) {
    activeCase=null;const items=state.cases.filter(c=>!name || c.resource===name);
    show('Resource availability cases',name?`Availability history · ${name}`:'Saved changes and the remaining operational work.',`<div class="v53r-case-list">${items.map(item=>{const remaining=unresolved(item);return `<article class="v53r-case"><div><b>${h(item.resource)}</b><div class="meta">${h(item.id)} · ${h(item.from.replace('T',' '))} → ${item.scope==='forever'?'Forever':h(item.to.replace('T',' '))}</div><div class="meta">${h(item.reason)} · ${item.removeSlots?'Slots removed':'Slots retained'} · ${item.blockNew?'New bookings blocked':'New bookings allowed'}${item.inactive?' · Inactive':''}</div></div><span class="badge ${remaining.length?'b-warn':'b-good'}">${remaining.length?remaining.length+' need action':'Resolved'}</span>${button('Open case','case',`data-id="${h(item.id)}"`)}</article>`;}).join('')||'<div class="v53r-empty">No resource availability cases have been recorded.</div>'}</div>`,button('Close','close'));
    return {ok:true,cases:items.map(item=>({...clone(item),outstanding:unresolved(item).map(r=>r.key)}))};
  }
  function openCase(id) {
    const item=state.cases.find(c=>c.id===id);if(!item)throw new Error('This resource case was not found.');activeCase=id;const remaining=unresolved(item),remainingKeys=new Set(remaining.map(r=>r.key));
    show(`Availability case · ${item.resource}`,`${item.id} · Saved ${new Date(item.createdAt).toLocaleString()}`,`${steps(2)}<div class="note ${remaining.length?'':'good'}"><b>${remaining.length?`${remaining.length} dated allocation${remaining.length===1?'':'s'} still need action.`:'All affected allocations are resolved.'}</b> This status updates from the saved Event Operations allocations when the case is reopened.</div><div class="v53r-case-options"><span><b>Period</b>${h(item.from.replace('T',' '))} → ${item.scope==='forever'?'Forever':h(item.to.replace('T',' '))}</span><span><b>Slots</b>${item.removeSlots?'Removed':'Retained'}</span><span><b>New bookings</b>${item.blockNew?'Blocked':'Allowed'}</span><span><b>Resource</b>${item.inactive?'Inactive from start date':'Active'}</span></div><div class="meta v53r-reason">${h(item.reason)}</div><div class="v53r-impact-list">${item.rows.map(r=>`<article class="v53r-impact ${remainingKeys.has(r.key)?'unresolved':'full'}"><div class="v53r-impact-top"><div><b>${r.role==='destination'?'Destination · ':''}${h(r.name)}</b><div class="meta">${h(r.iso)} · ${h(r.time)} · ${h(r.venue)}</div><div class="meta">${r.replacements.length?r.replacements.map(x=>h(x.name)+(r.private?'':` · ${x.qty} places`)).join(', '):'No replacement at time of closure'}</div></div><span class="badge ${remainingKeys.has(r.key)?'b-warn':'b-good'}">${remainingKeys.has(r.key)?'Needs action':'Resolved'}</span></div>${button('Open in Event Operations','event',`data-key="${h(r.key)}" data-private="${r.private?'1':'0'}"`)}</article>`).join('')||'<div class="v53r-empty">Existing resource slots were retained or no allocations were affected.</div>'}</div>`,button('All resource cases','cases')+'<span class="sp"></span>'+button('Close','close'));
    return {ok:true,case:clone(item),outstanding:remaining.map(r=>r.key)};
  }
  function report(error) { const el=document.getElementById('v53r-error');if(el){el.className='v53r-error';el.textContent=error.message;} }
  function close() { window.closeDrawer?.(); }
  function openEvent(key,isPrivate) { close();const saved=state.cases.flatMap(c=>c.rows).find(r=>r.key===key),current=saved?currentOccurrence(saved):null;const iso=current?dateOf(current):String(key).split('@')[1]?.slice(0,10);return window.OptimoV53Guide?.navigate(isPrivate?'private':'session',{id:current?keyOf(current):key,date:iso}); }
  function snapshot() { return {version:1,draft:draft?clone(draft):null,activeCase,cases:state.cases.map(item=>({...clone(item),outstanding:unresolved(item).map(r=>r.key)})),resourceStates:clone(state.resourceStates)}; }
  function setDraft(patch) { if(!draft)throw new Error('Open a resource availability workflow first.');Object.assign(draft,patch);if(draft.scope!=='forever')draft.inactive=false;return clone(draft); }
  const reassignContext=()=>typeof v50Reassign!=='undefined'?v50Reassign:null;
  const moveContext=()=>typeof v44MoveCtx!=='undefined'?v44MoveCtx:null;
  function nativeError(error) { let el=document.getElementById('v53r-error');if(!el){document.getElementById('drawerBody')?.insertAdjacentHTML('beforeend','<div id="v53r-error" role="alert"></div>');}report(error); }
  function saveWorkCase(resource,kind,impacts,options={}) {
    const id=(kind==='transfer'?'RT-':'RR-')+Date.now().toString(36).toUpperCase();
    const dates=impacts.map(r=>r.iso).sort(),item={id,kind,createdAt:new Date().toISOString(),resource,scope:options.scope||'period',from:options.from||(dates[0]||today())+'T00:00',to:options.to||(dates.at(-1)||today())+'T23:59',reason:options.reason|| (kind==='transfer'?'Temporary resource venue transfer':'Selected work re-assigned'),removeSlots:true,blockNew:false,inactive:false,rows:impacts,...options};
    state.cases.unshift(item);save();engine().persist?.();engine().refresh?.();
    window.OptimoAudit?.record?.({area:'resources',action:kind==='transfer'?'Move resource to another venue':'Re-assign selected resource work',entity:resource,before:impacts.map(r=>r.before),after:clone(item),scope:{from:item.from,to:item.to},outcome:`${impacts.length} dated allocations updated`});
    return item;
  }
  function applyReassignment() {
    try {
      const context=reassignContext();if(!context?.selected?.size)throw new Error('Select dated work to re-assign.');
      const source=resourcesOnly().find(r=>r.name===context.name),reservations=[],impacts=[],moves=[];
      for(const index of [...context.selected].sort((a,b)=>a-b)) {
        const work=context.work[index],row=rows().find(r=>keyOf(r)===work.occurrenceKey);
        if(!row || !work.date)throw new Error('An undated diary item needs a dated allocation before it can be applied. Leave it unselected and choose dated work.');
        if(!has(row,source.name))throw new Error(`${row.name} no longer uses ${source.name}. Reopen the dated work list.`);
        const coverage=window.v50ReassignCoverage?.(index),direct=context.direct[index]||[],chosen=[...direct,...(coverage?.earlier||[])];
        const unique=[...new Map(chosen.map(x=>[x.name,x])).values()],need=removedNeed(row,source.name);let left=need;const replacements=[];
        for(const pick of unique) {
          if(!left)break;const candidate=resourcesOnly().find(r=>r.name===pick.name);
          if(!candidate || !eligible(candidate,source,row))throw new Error(`${pick.name} is not eligible for ${row.name}.`);
          const crossed=candidate.venue!==row.venue;
          const check=availability(crossed?{...candidate,venue:row.venue}:candidate,row,reservations);
          const qty=row.private?1:Math.min(left,Number(pick.qty)||0);
          if(qty<=0 || check.available<(row.private?1:qty))throw new Error(`${pick.name} cannot take ${row.name} on ${dateOf(row)}: ${check.reason}.`);
          replacements.push({name:pick.name,qty,capacity:check.capacity||capacity(candidate,row),type:source.human?'Resource':'Equipment'});left-=qty;
          reservations.push({name:pick.name,qty,private:!!row.private,key:keyOf(row),iso:dateOf(row),time:row.time});
          if(crossed) { const [start,end]=range(row.time);const travel=[Math.max(0,start-30),Math.min(1439,end+30)],conflict=rows().find(r=>dateOf(r)===dateOf(row)&&has(r,pick.name)&&keyOf(r)!==keyOf(row)&&!r.preliminary&&overlap(travel,range(r.time)));if(conflict)throw new Error(`${pick.name} needs source cover or travel review for ${conflict.name}. Complete Move to another venue before applying this replacement.`);moves.push({name:pick.name,from:dateOf(row)+'T'+clock(start),to:dateOf(row)+'T'+clock(end),venue:row.venue}); }
        }
        const covered=need-left;
        impacts.push({key:keyOf(row),originalKey:row.originalKey||keyOf(row),allocationId:row.allocationId,sourceId:row.sourceId,iso:dateOf(row),time:row.time,name:row.name,venue:row.venue,private:!!row.private,need,covered,replacements,before:clone(row),outcome:covered>=need?'full':covered?'partial':'unresolved'});
      }
      for(const impact of impacts){const patch=patchFor(impact,source.name);engine().applyOccurrence(impact.key,patch,{audit:false,refresh:false});impact.after={...impact.before,...patch};}
      for(const move of moves){const rs=state.resourceStates[move.name]||{ranges:[]};rs.moves||=[];rs.moves.push(move);state.resourceStates[move.name]=rs;}
      const item=saveWorkCase(source.name,'reassign',impacts);openCase(item.id);return {ok:true,caseId:item.id};
    }catch(error){nativeError(error);return {ok:false,error:error.message};}
  }
  const clock=minutes=>String(Math.floor(minutes/60)).padStart(2,'0')+':'+String(minutes%60).padStart(2,'0');
  function transferDraft() {
    const m=moveContext();if(!m)throw new Error('Choose a movable resource.');const resource=resourcesOnly().find(r=>r.name===m.name);
    if(!resource||resource.movable===false)throw new Error('This resource is fixed at its venue.');
    m.date||=today();m.privateChoices||={};
    return {name:m.name,day:m.date,scope:'period',from:m.date+'T'+m.leave,to:m.date+'T23:59',removeSlots:true,blockNew:false,inactive:false,privateChoices:m.privateChoices};
  }
  function transferPlan() { return plan(transferDraft()); }
  function transferDestinations() {
    const m=moveContext();if(!m)return [];const source=resourcesOnly().find(r=>r.name===m.name),date=m.date||today(),leave=Number(m.leave?.slice(0,2))*60+Number(m.leave?.slice(3,5)),ready=leave+Number(m.travel??30),released=new Set(transferPlan().rows.map(r=>r.key));
    return rows().filter(r=>!r.private&&dateOf(r)===date&&r.venue===m.to&&Number(range(r.time)?.[0])>=ready&&(!source.business||!r.business||source.business===r.business)&&eligible({...source,name:'__transfer__'},source,r)).map(row=>{const check=availability({...source,venue:m.to},row,[],released),need=Math.max(0,Number(row.att??row.attendees??0)-Number(row.assigned||0));return {row,check,need,qty:Math.min(check.available,need||capacity(source,row))};}).filter(x=>x.check.available>0);
  }
  function applyResourceMove() {
    try {
      const m=moveContext(),d=transferDraft();validate(d);const source=resourcesOnly().find(r=>r.name===m.name),p=transferPlan();if(p.errors.length)throw new Error(p.errors.join('\n'));
      if(!m.to||m.to===source.venue)throw new Error('Choose a different destination venue.');
      if(!m.dest?.size)throw new Error('Choose at least one available dated destination timeslot.');
      const choices=transferDestinations(),targets=[],reservations=[];
      for(const key of m.dest){const match=choices.find(x=>keyOf(x.row)===key);if(!match)throw new Error('A destination timeslot is no longer eligible or cannot be reached after travel. Review the destination list.');const check=availability({...source,venue:m.to},match.row,reservations,new Set(p.rows.map(r=>r.key)));if(check.available<match.qty)throw new Error('Selected destination timeslots overlap or exceed the resource capacity.');targets.push(match);reservations.push({name:m.name,key,iso:m.date,time:match.row.time,qty:match.qty,private:false});}
      for(const impact of p.rows){const patch=patchFor(impact,m.name);engine().applyOccurrence(impact.key,patch,{audit:false,refresh:false});impact.after={...impact.before,...patch};}
      const destinationImpacts=[];
      for(const {row,qty,need} of targets){const supply=clone(row.linkedSupply||[]),old=supply.find(s=>s.name===m.name);if(old)old.used=Number(old.used||0)+qty;else supply.push({type:source.human?'Resource':'Equipment',name:m.name,used:qty,capacity:capacity(source,row)});const attendees=Number(row.att??row.attendees??0),assigned=Math.min(attendees,Number(row.assigned||0)+qty),patch={resources:[...new Set([...(row.resources||[]),m.name])],linkedSupply:supply,assigned,attention:assigned<attendees,status:row.preliminary?'preliminary':assigned<attendees?'attention':attendees?'covered':'nobookings',detail:`${m.name} transferred from ${source.venue}; ${qty} places added`};engine().applyOccurrence(keyOf(row),patch,{audit:false,refresh:false});destinationImpacts.push({key:keyOf(row),originalKey:row.originalKey||keyOf(row),sourceId:row.sourceId,iso:dateOf(row),time:row.time,name:row.name,venue:row.venue,private:false,role:'destination',need,covered:qty,replacements:[{name:m.name,qty,capacity:capacity(source,row)}],before:clone(row),after:{...row,...patch},outcome:assigned>=attendees?'full':'partial'});}
      const rs=state.resourceStates[m.name]||{ranges:[]};rs.moves||=[];rs.moves.push({from:d.from,to:d.to,venue:m.to,travel:Number(m.travel??30),destinations:targets.map(x=>keyOf(x.row))});state.resourceStates[m.name]=rs;
      const item=saveWorkCase(m.name,'transfer',[...p.rows,...destinationImpacts],{from:d.from,to:d.to,reason:`Temporary transfer from ${source.venue} to ${m.to}; ${Number(m.travel??30)} minutes travel`,destinations:targets.map(x=>keyOf(x.row))});openCase(item.id);return {ok:true,caseId:item.id};
    }catch(error){nativeError(error);return {ok:false,error:error.message};}
  }
  function decorateTransfer(step) {
    const m=moveContext();if(!m)return;
    if(step===1){const body=document.getElementById('drawerBody');if(body&&!body.querySelector('[data-v53r-move-date]'))body.querySelector('.section .sb')?.insertAdjacentHTML('beforeend',`<div class="two mt"><label class="fld">Operating date<input type="date" data-v53r-move-date value="${h(m.date||today())}"></label><label class="fld">Travel time (minutes)<input type="number" min="0" max="240" data-v53r-move-travel value="${Number(m.travel??30)}"></label></div>`);}
    if(step===2||step===4){const p=transferPlan(),source=resourcesOnly().find(r=>r.name===m.name),privateRows=p.rows.filter(r=>r.private);if(privateRows.length)document.getElementById('drawerBody')?.insertAdjacentHTML('beforeend',`<div class="section mt"><div class="sh"><h3>Private source bookings · whole-resource replacements</h3></div><div class="sb">${privateRows.map(r=>`<label class="fld mt">${h(r.iso)} · ${h(r.time)} · ${h(r.name)}<select data-v53r-move-private="${h(r.key)}"><option value="">Leave unallocated for Event Operations</option>${candidates(source,r.before).map(c=>`<option value="${h(c.name)}" ${m.privateChoices?.[r.key]?.name===c.name?'selected':''} ${c.available?'':'disabled'}>${h(c.name)} · ${c.available?'Available':h(c.reason)}</option>`).join('')}</select></label>`).join('')}</div></div>`);}
  }
  document.addEventListener('click',event=>{const b=event.target.closest('[data-v53r-action]');if(!b)return;event.preventDefault();try{switch(b.dataset.v53rAction){case'close':close();break;case'review':review();break;case'apply':apply();break;case'apply-reassign':applyReassignment();break;case'back':openUnavailable(draft.name);break;case'cases':cases(b.dataset.name);break;case'case':openCase(b.dataset.id);break;case'event':openEvent(b.dataset.key,b.dataset.private==='1');break;}}catch(error){report(error);}});
  document.addEventListener('change',event=>{const el=event.target;try{const m=moveContext();if(el.hasAttribute('data-v53r-move-date')&&m){m.date=el.value;m.dest.clear();return;}if(el.hasAttribute('data-v53r-move-travel')&&m){m.travel=Math.max(0,Number(el.value));m.dest.clear();return;}if(el.dataset.v53rMovePrivate&&m){m.privateChoices||={};m.privateChoices[el.dataset.v53rMovePrivate]={name:el.value};window.v48RenderMove?.(m._resourceStep||2);return;}if(!draft)return;if(el.dataset.v53rField){const name=el.dataset.v53rField;draft[name]=el.type==='checkbox'?el.checked:el.value;if(name==='scope' && draft.scope!=='forever')draft.inactive=false;if(['scope','day','from','to','removeSlots'].includes(name))openUnavailable(draft.name);}else if(el.dataset.v53rPrivate){const key=el.dataset.v53rPrivate;draft.privateChoices[key]={...(draft.privateChoices[key]||{}),name:el.value};review();}else if(el.dataset.v53rRepeat){const key=el.dataset.v53rRepeat;draft.privateChoices[key]={...(draft.privateChoices[key]||{}),allDates:el.checked};review();}}catch(error){report(error);}});
  const api={openUnavailable,review,apply,cases,openCase,snapshot,setDraft,applyReassignment,applyMove:applyResourceMove,transferPlan,transferDestinations,candidates:(name,key)=>{const source=resourcesOnly().find(r=>r.name===name),row=rows().find(r=>keyOf(r)===key);return source&&row?candidates(source,row):[];},candidateAvailability:availability,isBlocked,isAvailable,resourceState,openEvent,venueFor:(name,row)=>venueFor(resourcesOnly().find(r=>r.name===name)||{name},row)};
  window.OptimoV53ResourceOperations=Object.freeze(api);
  function install() {
    if(!engine()?.registerResourceAdapter)return false;
    const native=window.openUnavailable;
    window.openUnavailable=function(name){if(resourcesOnly().some(r=>r.name===name))return openUnavailable(name);return native?.apply(this,arguments);};
    engine().registerResourceAdapter({catalog:[{id:'resourceUnavailable',title:'Mark a resource unavailable',group:'Resources',pick:'resource',description:'Persistent today, period or forever options; dated public reallocation and whole-private replacements.'},{id:'resourceCases',title:'Resource availability cases',group:'Resources',pick:null,description:'Saved resource changes, unresolved dated allocations and Event Operations links.'},{id:'resourceCase',title:'Resource availability case details',group:'Resources',pick:null,description:'Review the saved impact and live resolution status of one resource change.'}],navigate:(id,args={})=>{if(id==='resourceUnavailable')return openUnavailable(args.name||args.resourceName||args.id,args);if(id==='resourceCases')return cases(args.name||args.resourceName);if(id==='resourceCase')return openCase(args.caseId||args.id);return {ok:false,error:'Unknown resource operation.'};},snapshot,isBlocked,isAvailable,resourceState});
    const nativeRender=window.renderResource;if(nativeRender)window.renderResource=function(){const result=nativeRender.apply(this,arguments);decorate();return result;};
    const nativeCandidates=window.v50ReassignCandidateSet;if(nativeCandidates)window.v50ReassignCandidateSet=function(resource,work){const row=rows().find(r=>keyOf(r)===work.occurrenceKey);if(!row)return nativeCandidates.apply(this,arguments);return resourcesOnly().filter(r=>eligible(r,resource,row)).map(r=>{const crossed=venueFor(r,row)!==row.venue,check=availability(crossed?{...r,venue:row.venue}:r,row);return {name:r.name,venue:venueFor(r,row),cap:check.available,kind:crossed?'move':'add',skill:r.skills,available:check.available};}).filter(c=>c.available>0);};
    const nativeReassign=window.v50RenderReassign;if(nativeReassign)window.v50RenderReassign=function(step){const c=reassignContext();if(step===1&&c){const old=c.work.map((work,i)=>({work,picked:c.selected.has(i),direct:c.direct[i]||[]})).filter(x=>!x.work.date||rows().some(r=>keyOf(r)===x.work.occurrenceKey&&has(r,c.name)));c.work=old.map(x=>x.work);c.selected=new Set(old.flatMap((x,i)=>x.picked?[i]:[]));c.direct=Object.fromEntries(old.map((x,i)=>[i,x.direct]));c.index=[...c.selected][0]||0;}const result=nativeReassign.apply(this,arguments);if(step===3){const button=[...document.querySelectorAll('#drawerFoot button')].find(b=>b.textContent.trim()==='Apply re-assignment');if(button){button.removeAttribute('onclick');button.dataset.v53rAction='apply-reassign';}}return result;};
    const nativeMoveRender=window.v48RenderMove;
    if(nativeMoveRender){
      window.v48MoveImpact=function(){return transferPlan().rows.map(r=>({time:r.iso+' · '+r.time,title:r.name,need:r.need,covered:r.covered,cover:r.replacements.map(x=>x.name+(r.private?'':` · ${x.qty}`)).join(', ')||'No eligible replacement selected',status:r.outcome==='full'||r.outcome==='released'?'auto':r.outcome==='partial'?'partial':'issue'}));};
      window.v44MoveImpact=window.v48MoveImpact;
      window.v48DestWork=function(){return transferDestinations().map(x=>[keyOf(x.row),x.row.time,x.row.name,x.need?`${x.need} places need coverage · ${x.row.iso}`:`Optional additional capacity · ${x.row.iso}`]);};
      window.v48RenderMove=function(step){const m=moveContext();if(m)m._resourceStep=step;const result=nativeMoveRender.apply(this,arguments);decorateTransfer(step);return result;};
      window.v44RenderMove=window.v48RenderMove;window.v48ApplyMove=applyResourceMove;window.v47ApplyMove=applyResourceMove;
    }
    decorate();return true;
  }
  function decorate() {
    const header=document.querySelector('#screen-resource .pghead .rt');if(header&&!header.querySelector('[data-v53r-action="cases"]'))header.insertAdjacentHTML('beforeend',button('Availability cases','cases'));
    const detail=document.querySelector('#screen-resource .resdetail');if(!detail)return;detail.querySelector('.v53r-current-state')?.remove();
    const name=detail.querySelector('.resperson h3')?.textContent,rs=state.resourceStates[name];if(!rs)return;
    const now=today()+'T12:00',inactive=rs.inactiveFrom&&rs.inactiveFrom<=now,blocked=isBlocked(name,today());
    detail.querySelector('.rb')?.insertAdjacentHTML('afterbegin',`<div class="v53r-current-state"><span class="badge ${inactive||blocked?'b-warn':'b-grey'}">${inactive?'Inactive':blocked?'New bookings blocked':'Availability changes recorded'}</span>${button('View saved cases','cases',`data-name="${h(name)}"`)}</div>`);
  }
  if(!install()) { let attempts=0;const timer=setInterval(()=>{if(install()||++attempts>60)clearInterval(timer);},100); }
})();
