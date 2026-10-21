import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {build,transform} from 'esbuild';
const root=new URL('../',import.meta.url),read=path=>readFile(new URL(path,root),'utf8');
const guidance={};
for(const source of ['v53','r7']){const stem=source==='v53'?'v53-guidance':'r7-guidance';guidance[source]={css:await read('src/'+stem+'.css'),js:await read('src/booking-model.js')+'\n'+await read('src/'+stem+'.js')}}
const sources={v53:await read('references/v53-v56.html'),r7:await read('references/r7.html')};
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
