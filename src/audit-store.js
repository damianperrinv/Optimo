const copy=value=>value===undefined?null:JSON.parse(JSON.stringify(value));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function diffValues(before,after,path='') {
  if(same(before,after))return [];
  if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after))return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>diffValues(before[key],after[key],path?`${path}.${key}`:key));
  if(Array.isArray(before)&&Array.isArray(after)){
    const identity=row=>row&&typeof row==='object'?(row.id??row.key??row.name):null;
    if([...before,...after].every(row=>identity(row)!==null)){
      const b=new Map(before.map(row=>[String(identity(row)),row])),a=new Map(after.map(row=>[String(identity(row)),row]));
      if(b.size===before.length&&a.size===after.length)return [...new Set([...b.keys(),...a.keys()])].flatMap(key=>diffValues(b.get(key),a.get(key),`${path}[${key}]`));
    }
  }
  return [{path:path||'value',before:copy(before),after:copy(after)}];
}
export function createAuditStore({storage=globalThis.localStorage,key='optimo-audit-v3',onChange=()=>{}}={}) {
  let entries=[];
  try{entries=JSON.parse(storage?.getItem(key)||'[]');if(!Array.isArray(entries))entries=[];}catch{}
  let persistenceError=null;
  const store={
    record(input={}){
      const changes=copy(input.changes||diffValues(input.before,input.after));
      const knownOutcomes=new Set(['applied','draft','simulated','configuration','rejected','reverted']);
      const rawOutcome=input.outcome||'applied',outcome=knownOutcomes.has(rawOutcome)?rawOutcome:'applied';
      const area=String(input.area||'Operations').replace(/^./,letter=>letter.toUpperCase());
      const entry={id:globalThis.crypto?.randomUUID?.()||`audit-${Date.now()}-${Math.random().toString(36).slice(2)}`,at:new Date().toISOString(),actor:input.actor||'Prototype operator',source:input.source||'workspace',area,action:input.action||'Updated work',entity:input.entity||'',scope:copy(input.scope||{}),outcome,changes,notes:input.notes||(outcome!==rawOutcome?String(rawOutcome):'')};
      entries.push(entry);
      try{storage?.setItem(key,JSON.stringify(entries));persistenceError=null;}catch{persistenceError='Browser storage is full. The complete log is retained in this tab; export it before closing.';}
      onChange(entry);return copy(entry);
    },
    entries(){return copy(entries)},
    get persistenceError(){return persistenceError},
    export(){return JSON.stringify({version:1,exportedAt:new Date().toISOString(),entries},null,2)},
  };return Object.freeze(store);
}
