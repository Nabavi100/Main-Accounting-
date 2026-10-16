// Keep failed Windows diagnostics accessible through GitHub's checks API as well
// as the regular logs. All callers run source-controlled build/test commands.
import { spawn } from 'node:child_process';
const args = process.argv.slice(2);
let tail = '';
let errors = '';
const uncolor = text => text.replace(/\u001b\[[0-9;]*m/g, '');
const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
for (const [stream, destination] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
  stream.setEncoding('utf8');
  stream.on('data', text => {
    destination.write(text); tail = (tail + text).slice(-20000);
    for (const line of uncolor(text).split(/\r?\n/)) {
      if (/error|failed|cannot|ENOENT|EINVAL|ERR_|exitCode|stackTrace/i.test(line)) errors = (errors + line.slice(0, 900) + '\n').slice(-1600);
    }
  });
}
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => {
  if (code !== 0 && process.env.GITHUB_ACTIONS) {
    // Check annotations are truncated at 4096 characters: retain the actual
    // error lines and END of the output, not the middle of long dependency logs.
    const diagnostic = `${errors}\n--- final output ---\n${uncolor(tail).slice(-1900)}`;
    const message = diagnostic.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
    console.log(`::error title=Windows build/test diagnostic::${message}`);
  }
  process.exitCode = code || (code === 0 ? 0 : 1);
});
