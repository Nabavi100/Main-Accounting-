import { build as buildWeb } from 'vite';
import { build as bundle } from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const staging = path.join(root, 'out', 'desktop-app');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

await buildWeb({ root });
await fs.rm(staging, { recursive: true, force: true });
await fs.mkdir(path.join(staging, 'desktop', 'assets'), { recursive: true });
await fs.cp(path.join(root, 'dist'), path.join(staging, 'dist'), { recursive: true });
await bundle({
  entryPoints: [path.join(root, 'server.ts')],
  outfile: path.join(staging, 'desktop', 'server.cjs'),
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  external: ['vite'], minifySyntax: true,
  define: { 'process.env.NODE_ENV': '"production"' },
  logLevel: 'info',
});
for (const filename of ['main.cjs', 'runtime.cjs', 'GUIDE-fa.txt', 'BUG-REPORT-fa.txt']) {
  await fs.copyFile(path.join(root, 'desktop', filename), path.join(staging, 'desktop', filename));
}
for (const filename of ['icon.png', 'icon.ico']) {
  await fs.copyFile(path.join(root, 'desktop', 'assets', filename), path.join(staging, 'desktop', 'assets', filename));
}
const firebase = JSON.parse(await fs.readFile(path.join(root, 'firebase-applet-config.json'), 'utf8'));
await fs.writeFile(path.join(staging, 'desktop', 'firebase-public.json'), JSON.stringify({ authDomain: firebase.authDomain }));
await fs.writeFile(path.join(staging, 'package.json'), JSON.stringify({
  name: 'nabavi-accounting-desktop', version: pkg.version,
  description: 'Nabavi Accounting — Windows desktop review edition',
  author: 'شرکت تجارتی برادران نبوی', license: 'UNLICENSED',
  main: 'desktop/main.cjs', private: true,
}, null, 2) + '\n');
console.log(`Desktop prepared: ${staging}\nOnly the compiled app, bundled local service and public assets are staged; no .env, server_data, test data or source credentials.`);
