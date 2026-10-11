import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/index.mjs';
process.env.NODE_ENV = 'production';
const directory = mkdtempSync(join(tmpdir(), 'vdvoem-browser-'));
const app = await createApp({ databasePath: join(directory, 'calendar.sqlite') });
app.server.listen(3100, '127.0.0.1');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); process.exit(0); });
