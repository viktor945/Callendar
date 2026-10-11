import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.mjs';

test('HTTPS hosting origin enables Secure cookies and accepts only its own origin', async () => {
  const previousRender = process.env.RENDER_EXTERNAL_URL;
  const previousOrigin = process.env.PUBLIC_ORIGIN;
  process.env.RENDER_EXTERNAL_URL = 'https://vdvoem-example.onrender.com';
  delete process.env.PUBLIC_ORIGIN;
  const app = await createApp({ databasePath: ':memory:', serveFrontend: false });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  try {
    const response = await fetch(`${base}/api/pairs`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://vdvoem-example.onrender.com' }, body: JSON.stringify({ name: 'Проверка HTTPS' }) });
    assert.equal(response.status, 201);
    assert.match(response.headers.get('set-cookie'), /; Secure/);
    const rejected = await fetch(`${base}/api/pairs`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://other.example' }, body: JSON.stringify({ name: 'Проверка' }) });
    assert.equal(rejected.status, 403);
  } finally {
    await app.close();
    if (previousRender === undefined) delete process.env.RENDER_EXTERNAL_URL; else process.env.RENDER_EXTERNAL_URL = previousRender;
    if (previousOrigin === undefined) delete process.env.PUBLIC_ORIGIN; else process.env.PUBLIC_ORIGIN = previousOrigin;
  }
});
