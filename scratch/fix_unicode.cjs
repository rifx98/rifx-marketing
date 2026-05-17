const fs = require('fs');
const f = 'app/panel/panel-client.tsx';
let c = fs.readFileSync(f, 'utf8');

// Only fix in the dashboard section (lines ~1463-1643)
// Replace literal \u escape sequences with actual characters
c = c.replace(/\\u00a1/g, '¡');
c = c.replace(/\\u00e1/g, 'á');
c = c.replace(/\\u00e9/g, 'é');
c = c.replace(/\\u00ed/g, 'í');
c = c.replace(/\\u00f3/g, 'ó');
c = c.replace(/\\u00fa/g, 'ú');
c = c.replace(/\\u00f1/g, 'ñ');
c = c.replace(/\\u00b7/g, '·');

fs.writeFileSync(f, c);
console.log('Fixed! Checking sample...');
const check = fs.readFileSync(f, 'utf8');
const line = check.split('\n').find(l => l.includes('Academia Chatea'));
console.log('Sample line:', line?.trim().substring(0, 100));
