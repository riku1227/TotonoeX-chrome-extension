import {readFile} from 'node:fs/promises';
import {homedir} from 'node:os';
import path from 'node:path';
// スキル原本は変更せず、Windowsの区切り文字だけを揃える。
// 原本のkit除外判定が / のみを扱うため、そのままだとキット未使用と誤判定する。
const skillRoot=process.env.SPACE_UI_DESIGN_DIR||path.join(homedir(),'.agents','skills','space-ui-design');
const source=await readFile(path.join(skillRoot,'scripts','design-lint.mjs'),'utf8');
const portable=source.replace('const files = walk(root);', 'const files = walk(root).map(p => p.replaceAll(String.fromCharCode(92), "/"));');
process.argv=[process.execPath,'design-lint.mjs','src'];
await import('data:text/javascript;base64,'+Buffer.from(portable).toString('base64'));
