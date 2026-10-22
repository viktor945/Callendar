import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const directory = mkdtempSync(join(tmpdir(), 'calendar-worker-browser-'));
const child = spawn(process.execPath, ['node_modules/wrangler/bin/wrangler.js', 'dev', '--local', '--ip', '127.0.0.1', '--port', '8788', '--persist-to', join(directory, 'data')], { stdio: 'inherit', env: { ...process.env, XDG_CONFIG_HOME: join(directory, 'config'), WRANGLER_SEND_METRICS: 'false' } });
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', code => { rmSync(directory, { recursive: true, force: true }); process.exit(code ?? 0); });
