import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuditStore,diffValues} from '../src/audit-store.js';
const memory=()=>{const rows=new Map();return {getItem:key=>rows.get(key)||null,setItem:(key,value)=>rows.set(key,value)}};
test('audit identifies changes by allocation id when array order changes',()=>{
 const before={parts:[{id:'a',date:'2026-08-24',space:'A'},{id:'b',date:'2026-08-25',space:'B'}]},after={parts:[{id:'b',date:'2026-08-25',space:'B'},{id:'a',date:'2026-08-26',space:'C'}]};
 assert.deepEqual(diffValues(before,after),[{path:'parts[a].date',before:'2026-08-24',after:'2026-08-26'},{path:'parts[a].space',before:'A',after:'C'}]);
});
test('unchanged operating state produces no invented field changes',()=>assert.deepEqual(diffValues({booking:{id:'b',places:8}},{booking:{id:'b',places:8}}),[]));
test('audit persists actor, scope, before/after and applied outcome across store instances',()=>{
 const storage=memory(),store=createAuditStore({storage});const entry=store.record({area:'Facilities',action:'Move booking',entity:'BK-1',actor:'Alex',scope:{mode:'series',dates:['2026-10-17','2026-10-24']},before:{space:'A'},after:{space:'B'}});
 assert.equal(entry.outcome,'applied');assert.equal(entry.actor,'Alex');assert.deepEqual(createAuditStore({storage}).entries(),[entry]);assert.deepEqual(entry.changes,[{path:'space',before:'A',after:'B'}]);
});
test('simulated source results remain explicitly distinct from applied allocation changes',()=>{
 const store=createAuditStore({storage:memory()});const entry=store.record({action:'Notify attendees',outcome:'simulated',notes:'No delivery service'});assert.equal(entry.outcome,'simulated');assert.deepEqual(entry.changes,[]);assert.equal(entry.notes,'No delivery service');
});
test('audit callers cannot change recorded scope or exported history through references',()=>{
 const store=createAuditStore({storage:memory()}),scope={dates:['2026-10-17']};const entry=store.record({scope,before:{places:6},after:{places:8}});scope.dates.push('2026-10-24');entry.changes[0].after=999;store.entries()[0].scope.dates=[];
 const exported=JSON.parse(store.export());assert.deepEqual(exported.entries[0].scope.dates,['2026-10-17']);assert.equal(exported.entries[0].changes[0].after,8);
 const changes=[{path:'space',before:'A',after:'B'}];store.record({changes});changes[0].after='tampered';assert.equal(store.entries()[1].changes[0].after,'B');
});
test('a full browser store retains the complete in-memory log and reports that export is needed',()=>{
 const store=createAuditStore({storage:{getItem:()=>null,setItem:()=>{throw Error('Quota exceeded')}}});store.record({action:'Move A',before:'A',after:'B'});store.record({action:'Move B',before:'B',after:'C'});assert.equal(store.entries().length,2);assert.match(store.persistenceError,/export/i);assert.equal(JSON.parse(store.export()).entries.length,2);
});
test('module audit entries use consistent area and outcome filters without losing result details',()=>{
 const store=createAuditStore({storage:memory()});const entry=store.record({area:'resources',outcome:'4 allocations processed; 1 needs review',before:null,after:{case:'RU-1'}});assert.equal(entry.area,'Resources');assert.equal(entry.outcome,'applied');assert.match(entry.notes,/1 needs review/);
});
