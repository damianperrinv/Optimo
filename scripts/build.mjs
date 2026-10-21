import { build, transform } from "esbuild";
import { readFile, writeFile, mkdir } from "node:fs/promises";
const root = new URL("../", import.meta.url);
const { outputFiles } = await build({
  entryPoints: [new URL("src/app.js", root).pathname],
  bundle: true,
  minify: true,
  format: "iife",
  write: false,
  target: "es2022",
});
const css = (await transform(await readFile(new URL("src/styles.css", root), "utf8"), {loader: "css", minify: true})).code;
let html = await readFile(new URL("index.html", root), "utf8");
html = html
  .replace(
    /<link\b[^>]*href="\/src\/styles\.css"[^>]*>/,
    () => `<style>${css}</style>`,
  )
  .replace(
    '<script type="module" src="/src/app.js"></script>',
    () =>
      `<script>${outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`,
  );
await mkdir(new URL("dist/", root), { recursive: true });
await writeFile(new URL("dist/optimo-hybrid.html", root), html);
console.log(
  "Built dist/optimo-hybrid.html — self-contained, works offline, no server required.",
);
