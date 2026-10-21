import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build,transform} from 'esbuild';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const guidance={};
for(const source of ['v53','r7']){
 const stems=source==='v53'?['v53-guidance','v53-extensions','v53-resource-extensions']:['r7-guidance','r7-extensions'];
 const optional=async path=>{try{return await read(path)}catch(error){if(error.code==='ENOENT')return '';throw error}};
 guidance[source]={css:(await Promise.all(stems.map(stem=>optional('src/'+stem+'.css')))).join('\n'),js:await read('src/booking-model.js')+'\n'+await read('src/audit-bridge.js')+'\n'+(await Promise.all(stems.map(stem=>optional('src/'+stem+'.js')))).join('\n')};
}
const sources={v53:await read('references/v53.html'),r7:await read('references/r7.html')};
const css=(await transform(await read('src/full-workspace.css'),{loader:'css',minify:true})).code;
const js=(await build({entryPoints:[new URL('src/full-workspace.js',root).pathname],bundle:true,minify:true,write:false,format:'iife',target:'es2022'})).outputFiles[0].text;
const json=value=>JSON.stringify(value).replace(/</g,'\\u003c');
function html(includeSources){return template.replace(/<link\b[^>]*href="\/src\/full-workspace\.css"[^>]*>/,()=>`<style>${css}</style>`).replace(/<script id="guidance-data"><\/script>/,()=>`<script>window.OPTIMO_GUIDANCE=${json(guidance)};${includeSources?'window.OPTIMO_SOURCES='+json(sources)+';':''}</script>`).replace(/<script type="module" src="\/src\/full-workspace\.js"><\/script>/,()=>`<script>${js.replace(/<\/script/gi,'<\\/script')}</script>`)}
const template=await read('workspace.html');
await mkdir(new URL('dist/',root),{recursive:true});
await writeFile(new URL('dist/optimo-full-hybrid.html',root),html(true));
await writeFile(new URL('dist/optimo-workspace-loader.html',root),html(false));
await writeFile(new URL('dist/optimo-review-viewer.html',root),await read('review-viewer.html'));
console.log('Built full hybrid with intact source workflows and local-file loader.');
