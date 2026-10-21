/* Same-origin local prototype bridge: no network or external audit destination. */
(function(root){
  if(root.OptimoAudit)return;
  const source=root.E&&root.ST?'r7':'v53',area=()=>source==='r7'?'Facilities':document.querySelector('.screen.on')?.id?.includes('resource')?'Resources':'Events';
  const clone=value=>{try{return JSON.parse(JSON.stringify(value))}catch{return null}};
  const safe=fn=>{try{return fn()}catch{return null}};
  function capture(){
    if(source==='r7')return clone({bookings:root.ST?.bookings,parts:root.ST?.parts,resources:root.ST?.resources,sessions:root.ST?.sessions,closures:root.ST?.closures,flags:root.ST?.flags,holds:root.ST?.holds,history:root.ST?.history?.map(row=>({id:row.id,at:row.at,undoneAt:row.undoneAt,scope:row.scope})),extension:safe(()=>{const state=root.OptimoR7Extensions?.snapshot?.();return state?{publicOperations:state.publicOperations,internalTasks:state.internalTasks}:null})});
    return clone({sessions:safe(()=>sessions),privates:safe(()=>privates),resources:safe(()=>resources),operations:root.OptimoV53Operations?.auditSnapshot?.(),resourceCases:root.OptimoV53ResourceOperations?.auditSnapshot?.()});
  }
  let baseline=capture(),lastAction=null,lastExplicit=0,started=false;
  root.addEventListener('load',()=>{baseline=capture();started=true},{once:true});
  function record(entry){
    lastExplicit=Date.now();const result=safe(()=>root.parent.OptimoAudit.record({...entry,source:entry.source||source,area:entry.area||area()}));baseline=capture();return result;
  }
  root.OptimoAudit={record,entries:()=>safe(()=>root.parent.OptimoAudit.entries())||[]};
  root.OptimoPermissions=safe(()=>root.parent.OptimoPermissions)||{keepPrice:true,overrideSkill:true,capacityOverride:true,can(name){return !!this[name]}};
  function check(action=null,allowSimulation=false){
    if(!started)return;
    const after=capture(),changed=JSON.stringify(after)!==JSON.stringify(baseline);
    if(changed){const before=baseline;baseline=after;record({area:area(),action:action?.label||'Updated operational data',entity:action?.entity||'',scope:action?.scope||{},before,after,outcome:'applied'});}
    else if(allowSimulation&&(!action||lastExplicit<action.at))record({area:area(),action:action.label,entity:action.entity,outcome:'simulated',notes:'The original prototype displayed a result without changing stored allocation data.'});
  }
  document.addEventListener('click',event=>{
    const button=event.target.closest('button,[data-act]');if(!button)return;
    const handler=button.getAttribute('onclick')||button.getAttribute('data-act')||'';
    const label=(button.textContent||'').trim().replace(/\s+/g,' ');
    const commit=/^apply\b|^finish\b|^confirm.*apply|^create \d+ sessions$|^send\b|^import\b/i.test(label)&&!/review|choose|possible|selected|search|clear context|confirm setting/i.test(label);
    lastAction={label,at:Date.now(),entity:document.querySelector('#drawerTitle')?.textContent||root.UI?.cid||'',scope:{handler}};
    setTimeout(()=>check(lastAction,commit&&source==='v53'),180);
  },true);
  setInterval(()=>check(lastAction&&Date.now()-lastAction.at<2500?lastAction:null),900);
})(window);
