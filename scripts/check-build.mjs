// dist/ — редактируемые исходники и готовые ресурсы, не удалять при сборке.
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const required = [
  'dist/index.html', 'dist/gusha/index.html', 'dist/gusha/hello-frames.bin',
  'dist/assets/cormorant-garamond.woff2', 'dist/assets/OFL.txt',
  'dist/assets/sky-data.js', 'dist/assets/sensors.js',
  'dist/gusha/assets/coffee-reference.jpg', 'dist/gusha/assets/share-outline.svg',
  'dist/gusha/assets/lens-love.png', 'dist/gusha/assets/lens-career.png',
  'dist/gusha/assets/lens-self.png'
];
for (const path of required) if (!existsSync(path)) throw new Error('Missing resource: ' + path);
let checked = 0;
function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, e.name);
    if (e.isDirectory()) walk(path);
    else if (/\.(?:js|mjs)$/.test(path)) { execFileSync(process.execPath, ['--check', path]); checked++; }
  }
}
walk('dist'); walk('scripts');
console.log('Static build ready: resources present, ' + checked + ' JavaScript files checked.');
