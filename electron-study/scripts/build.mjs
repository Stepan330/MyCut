import { build } from 'esbuild';
import { mkdir } from 'node:fs/promises';
import { copyAsset } from './copy-asset.mjs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
await mkdir(new URL('../dist/', import.meta.url), { recursive: true });
await build({ absWorkingDir: root, entryPoints: ['src/app.jsx'], bundle: true, outfile: 'dist/app.js', format: 'iife', minify: false, sourcemap: true, define: { 'process.env.NODE_ENV': '"production"' } });
for (const file of ['index.html', 'style.css', 'outliner.css', 'workspace.css']) await copyAsset(new URL(`../src/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
for (const file of ['Roboto-Regular.ttf', 'ROBOTO_License.txt', 'NOTICE.md']) await copyAsset(new URL(`../../next/app/assets/fonts/${file}`, import.meta.url), new URL(`../dist/${file}`, import.meta.url));
