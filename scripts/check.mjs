import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
for (const file of ['dist/app.js', 'dist/model.js', 'dist/data.js']) execFileSync(process.execPath, ['--check', file]);
for (const file of ['dist/index.html', 'dist/styles.css', 'dist/assets/map-data.json', 'dist/assets/favicon.svg']) if (!existsSync(file)) throw new Error(`Missing ${file}`);
const data = JSON.parse(readFileSync('dist/assets/map-data.json', 'utf8'));
if (data.length !== 47 || new Set(data.map(p => p.id)).size !== 47) throw new Error('Map must contain all 47 prefectures');
console.log('Static application checks passed (47 prefectures, all assets, JavaScript syntax).');
