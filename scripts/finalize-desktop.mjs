import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));
const filename = `Nabavi-Accounting-${pkg.version}-Setup-x64.exe`;
const source = path.join(root, 'out', 'desktop-build', filename);
const output = path.join(root, 'desktop-release');
const bytes = await fs.readFile(source);
if (bytes.subarray(0, 2).toString() !== 'MZ') throw new Error('Not a Windows executable.');
await fs.mkdir(output, { recursive: true });
await fs.copyFile(source, path.join(output, filename));
const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
await fs.writeFile(path.join(output, `${filename}.sha256`), `${sha256}  ${filename}\n`);
for (const file of ['GUIDE-fa.txt', 'BUG-REPORT-fa.txt']) {
  await fs.copyFile(path.join(root, 'desktop', file), path.join(output, file));
}
console.log(`Installer: ${path.join(output, filename)}\nSize: ${(bytes.length / 1024 / 1024).toFixed(1)} MiB\nSHA-256: ${sha256}\nUnsigned review build: do not describe it as a commercially signed production release.`);
