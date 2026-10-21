import './booking-model.js';
const model=globalThis.OptimoBookingModel;
const list=value=>Array.isArray(value)?value:[];
const n=value=>Math.max(0,Number(value)||0);
const date=value=>/^\d{4}-\d{2}-\d{2}$/.test(value||'')?value:null;
const unique=rows=>[...new Map(rows.map(row=>[row.id,row])).values()];
export function buildWorkQueue(v={},r={},ready={v53:false,r7:false},scope={}) {
  const matches=record=>!record.date||(!scope.from||(record.endDate||record.date)>=scope.from)&&(!scope.to||record.date<=scope.to);
  const issues=[],drafts=[],followUps=[];
  if(ready.v53){
    list(v.sessions).filter(s=>!s.preliminary&&(n(s.attendees)>n(s.assigned)||['attention','notassigned'].includes(s.status))).forEach(s=>issues.push({id:'v53-public-'+s.id,source:'v53',area:'Events',title:s.name,detail:n(s.attendees)>n(s.assigned)?`${n(s.attendees)-n(s.assigned)} guest places still need resource cover`:s.detail||'Review this event’s space and resource requirements',date:date(s.date),time:s.time,venue:s.venue,family:'public',action:n(s.attendees)>n(s.assigned)?'assign':'session',args:{id:s.id},actionLabel:n(s.attendees)>n(s.assigned)?'Arrange cover':'Review event',status:n(s.attendees)>n(s.assigned)?'Needs cover':'Needs a decision'}));
    list(v.privates).filter(p=>p.attention).forEach(p=>issues.push({id:'v53-private-'+p.id,source:'v53',area:'Events',title:p.name,detail:p.attentionReason||'Review the booking’s space and resource requirements',date:date(p.date),time:p.time,venue:p.venue,family:'private',action:'private',args:{id:p.id},actionLabel:'Resolve booking',status:'Needs a decision'}));

    const baseOccurrences=new Set([...list(v.sessions).map(item=>`${item.id}@${item.date||''}`),...list(v.privates).map(item=>`${item.id}@${item.date||''}`)]);
    list(v.attentionOccurrences).forEach(item=>{
      const sourceId=item.sourceId||String(item.key||item.id||'').split('@')[0],key=item.key||item.id||`${sourceId}@${item.date||item.iso}`;
      const at=date(item.iso)||date(item.date);
      if(baseOccurrences.has(`${sourceId}@${at}`)||item.preliminary)return;
      const privateWork=item.private||item.kind==='private'||item.canonical?.family==='private',gap=Math.max(0,n(item.attendees??item.att)-n(item.assigned));
      issues.push({id:'v53-occurrence-'+key,source:'v53',area:'Events',title:item.name||item.title,detail:item.detail||item.reason||(gap?`${gap} guest places still need resource cover`:'Review this scheduled occurrence'),date:at,time:item.time,venue:item.venue,family:privateWork?'private':'public',action:privateWork?'private':gap?'bulkAssign':'session',args:privateWork?{id:sourceId,date:at}:gap?{ids:[key]}:{id:key,date:at},actionLabel:privateWork?'Resolve booking':gap?'Arrange cover':'Review event',status:gap?'Needs cover':'Needs a decision'});
    });

  }
  if(ready.r7){
    list(r.followUp?.eventAttention?.items).forEach(s=>issues.push({id:'r7-issue-'+s.key,source:'r7',area:'Events',title:s.title,detail:s.reason,date:date(s.date),time:s.start,venue:s.venueName||s.venue,family:s.kind==='private'?'private':'public',action:'attention',args:{key:s.key,kind:s.kind,booking:s.booking},actionLabel:'Resolve booking',status:'Needs a decision'}));
    const facility=r.pending?.facilities||{},ops=r.pending?.operations||{};
    list(facility.cases).forEach(c=>{const undecided=Math.max(0,n(c.progress?.total)-n(c.progress?.done));drafts.push({id:'facility-case-'+c.id,source:'r7',area:'Facilities',title:c.title,detail:`${n(c.progress?.done)} of ${n(c.progress?.total)} affected bookings decided${c.blocked?' · validation issues to resolve':''}`,date:date(c.date),endDate:date(c.endDate),family:c.mode==='clear'?'internal':'block',action:undecided||c.blocked?'closureCase':'closureReview',args:{cid:c.id},actionLabel:undecided||c.blocked?'Continue decisions':'Review & apply',status:undecided?`${undecided} to decide`:c.blocked?'Blocked':'Ready for review',blocked:!!c.blocked});});
    if(n(facility.draftMoves))drafts.push({id:'facility-board',source:'r7',area:'Facilities',title:'Facility schedule changes',detail:`${n(facility.draftMoves)} proposed moves · changes take effect after Apply`,date:null,family:'private',action:'boardReview',args:{},actionLabel:'Review changes',status:(facility.boardCheck?.ok===false||Object.keys(facility.boardCheck?.fail||{}).length>0)?'Blocked':'Ready for review',blocked:(facility.boardCheck?.ok===false||Object.keys(facility.boardCheck?.fail||{}).length>0)});
    if(n(ops.draft?.n)||n(ops.toDecide))drafts.push({id:'operations-plan',source:'r7',area:'Events & resources',title:'Event and resource changes',detail:ops.draft?.text||`${n(ops.draft?.n)} proposed changes · ${n(ops.toDecide)} decisions remaining`,date:null,family:'internal',action:'opReview',args:{},actionLabel:'Review changes',status:ops.blocked?'Blocked':n(ops.toDecide)?`${n(ops.toDecide)} to decide`:'Ready for review',blocked:!!ops.blocked,children:list(r.workItems).filter(item=>String(item.id).startsWith('job:')&&item.route).map(item=>({id:'r7-'+item.id,source:'r7',title:item.title||'Resource change',action:item.route.action,args:item.route.args,actionLabel:'Continue task'}))});
    list(r.followUp?.facilities?.flags).filter(f=>!f.status||f.status==='open').forEach((f,i)=>followUps.push({id:'facility-followup-'+(f.id||i),source:'r7',area:'Facilities',title:f.bookingName||f.name||f.bookingId||'Booking follow-up',detail:f.text||f.reason||f.short||'Finish the outstanding booking action',date:date(f.date),family:f.family||((f.kind==='public'||f.kind==='session'||f.tone==='session')?'public':(f.kind==='private'||['season','casual','hire'].includes(f.tone))?'private':'internal'),action:'followUp',args:{kind:'facility',id:f.id,bookingId:f.bookingId,cid:f.closureId},actionLabel:'Finish action',status:f.short||'Follow-up'}));
    list(r.followUp?.operations?.rows).forEach((f,i)=>followUps.push({id:'operations-followup-'+(f.id||f.flagId||i),source:'r7',area:'Events & resources',title:f.title||f.booking||f.bookingId||f.name||'Booking follow-up',detail:f.text||f.reason||f.short||'Finish the outstanding booking action',date:date(f.date),family:f.family||(f.kind==='private'?'private':'public'),action:'followUp',args:{kind:'operations',id:f.id||f.flagId,bookingId:f.bookingId||f.booking,key:f.key},actionLabel:'Finish action',status:f.short||'Follow-up'}));
  }
  const sort=rows=>unique(rows).filter(matches).sort((a,b)=>(a.date||'9999').localeCompare(b.date||'9999')||(a.time||'').localeCompare(b.time||'')||a.title.localeCompare(b.title));
  const provisional=ready.v53?list(v.sessions).filter(s=>matches(s)&&(s.canonical||model.publicEvent(s)).confirmation==='provisional').length:0;
  const result={issues:sort(issues),drafts:sort(drafts),followUps:sort(followUps),provisional,loaded:n(ready.v53)+n(ready.r7),complete:!!(ready.v53&&ready.r7)};
  result.blocked=result.drafts.filter(d=>d.blocked).length;
  result.clear=result.complete&&!result.issues.length&&!result.drafts.length&&!result.followUps.length;
  return result;
}
