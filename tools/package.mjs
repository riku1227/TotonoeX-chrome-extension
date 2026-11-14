import { mkdir, copyFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'dist', 'x-direct-url-copy');
const manifest = JSON.parse(await readFile(path.join(root,'extension','manifest.json'),'utf8'));
const pkg = JSON.parse(await readFile(path.join(root,'package.json'),'utf8'));
if (manifest.version !== pkg.version) throw new Error('Version mismatch');
await mkdir(output, {recursive:true});
for (const [source, target] of [
  ['extension/manifest.json','manifest.json'],
  ['extension/dom-signals.js','dom-signals.js'],
  ['extension/content.js','content.js'],
  ['extension/premium.js','premium.js'],
  ['extension/post-tools.js','post-tools.js'],
  ['extension/popup.html','popup.html'],
  ['extension/popup.js','popup.js'],
  ['extension/popup.css','popup.css'],
  ['extension/_locales/en/messages.json','_locales/en/messages.json'],
  ['extension/_locales/ja/messages.json','_locales/ja/messages.json'],
  ['extension/icons/icon-16.png','icons/icon-16.png'],
  ['extension/icons/icon-32.png','icons/icon-32.png'],
  ['extension/icons/icon-48.png','icons/icon-48.png'],
  ['extension/icons/icon-128.png','icons/icon-128.png'],
  ['README.md','README.md'],
  ['README.en.md','README.en.md'],
]) {
  const from=path.join(root,source), to=path.join(output,target);
  await mkdir(path.dirname(to), {recursive:true});
  await copyFile(from,to);
  const digest = buffer => createHash('sha256').update(buffer).digest('hex');
  if (digest(await readFile(from)) !== digest(await readFile(to))) throw new Error(`Copy mismatch: ${target}`);
}
console.log(`Packaged ${manifest.name} ${manifest.version}: ${output}`);
