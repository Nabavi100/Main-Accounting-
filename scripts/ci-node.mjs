// Keep failed Windows diagnostics accessible through GitHub's checks API as well
// as the regular logs. All callers run source-controlled build/test commands.
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
let tail = '';
const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
  stream.setEncoding('utf8');
  stream.on('data', text => { destination.write(text); tail = (tail + text).slice(-20000); });
}
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => {
  if (code !== 0 && process.env.GITHUB_ACTIONS) {
    const message = tail.replace(/\u001b\[[0-9;]*m/g, '').replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::error title=Windows build/test diagnostic::${message}`);
  }
  process.exitCode = code || (code === 0 ? 0 : 1);
});
