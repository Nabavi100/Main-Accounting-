import { build, Platform, Arch } from 'electron-builder';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../desktop/electron-builder.cjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// The fully bundled app has ZERO production node_modules. Make it the project
// root too, so electron-builder never falls back to collecting the web repo's
// build-time React/Firebase/Vite dependency tree into the installed program.
await build({
  projectDir: path.join(root, 'out', 'desktop-app'),
  config,
  targets: Platform.WINDOWS.createTarget(process.argv.includes('--dir') ? 'dir' : 'nsis', Arch.x64),
  publish: 'never',
});
