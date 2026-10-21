import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../',import.meta.url);
const sources={
  v53:{path:'references/v53.html',hash:'d7c186066af9ed2bea2d865a67a347169c4f4d235f75f1e65270e8fc6cef4bc9',scripts:35},
  r7:{path:'references/r7.html',hash:'fef5843abad8414df8e59a374ad8c32e1c6cf788a3a8a7627843748e9af1c532',scripts:17}
};
const scripts=html=>[...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]);
for(const [name,s]of Object.entries(sources))test(`${name} full source is preserved byte for byte`,()=>{const bytes=readFileSync(new URL(s.path,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),s.hash);assert.equal(scripts(bytes.toString()).length,s.scripts)});
test('r7 preserves all original facility and operations engine scenario setups',()=>{
  const html=readFileSync(new URL(sources.r7.path,root),'utf8'),parts=scripts(html);
  const context=vm.createContext({window:{},console,Date,JSON,Math,Set,Map});
  for(const source of parts.slice(0,3))vm.runInContext(source,context,{timeout:10000});
  const {E,O,__SEED__:facilitySeed,__SEED_OPS__:opsSeed}=context.window;
  assert.equal(Object.keys(E).length,132);assert.equal(Object.keys(O).length,189);
  for(let n=1;n<=14;n++){const result=E.demoFrame(facilitySeed,n);assert.ok(result,`Facility scenario ${n} must set up`);assert.ok(result.st,`Facility scenario ${n} needs real engine state`)}
  for(let n=15;n<=47;n++){const result=O.demoFrame(opsSeed,n);assert.ok(result?.os,`Operations scenario ${n} needs real state`);assert.equal(result.error,'',`Operations scenario ${n}: ${result.error}`);assert.ok(result.ui?.view)}
});
