import {build} from 'esbuild';
import {readFile,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
await build({entryPoints:[path.join(root,'src/main.tsx')],outfile:path.join(root,'extension/popup.js'),bundle:true,
  minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},target:'chrome120',legalComments:'none'});
const result=spawnSync(process.execPath,[path.join(root,'node_modules/@tailwindcss/cli/dist/index.mjs'),
  '-i','src/popup.css','-o','extension/popup.css','--minify'],{cwd:root,encoding:'utf8'});
if(result.status!==0) throw new Error(result.stderr||result.stdout);
// 拡張機能は外部フォントを読み込まない。コピーしたキットの原本はそのまま保つ。
const css=await readFile(path.join(root,'extension/popup.css'),'utf8');
await writeFile(path.join(root,'extension/popup.css'),css.replace(/@import\s*(?:url\([^)]*\)|["']https?:[^"']+["'])\s*;/g,''));
console.log('Built popup.js and popup.css (local assets only)');
