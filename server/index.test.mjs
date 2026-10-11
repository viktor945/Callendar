import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './index.mjs';

test('shared calendar: pairing, sync, privacy, validation, persistence', async t => {
  const directory = mkdtempSync(join(tmpdir(), 'vdvoem-test-'));
  const databasePath = join(directory, 'test.sqlite');
  let app = await createApp({ databasePath, serveFrontend: false });
  let base;
  async function start() {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    base = `http://127.0.0.1:${app.server.address().port}`;
  }
  await start();
  t.after(async () => { await app.close(); rmSync(directory, { recursive: true, force: true }); });
  function client() {
    let cookie = '';
    return {
      get cookie() { return cookie; },
      async request(path, method = 'GET', body, extraHeaders = {}) {
        const response = await fetch(`${base}/api${path}`, { method, headers: { ...(cookie ? { cookie } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...extraHeaders }, body: body === undefined ? undefined : JSON.stringify(body) });
        if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
        return { status: response.status, data: await response.json(), headers: response.headers };
      },
    };
  }
  const alice = client(), mark = client(), outsider = client();
  let invite, event;
  const draft = { title: 'Ужин', date: '2026-10-19', time: '19:00', location: 'Дома', category: 'date', note: 'Общее пожелание', status: 'planned', continuation: { title: 'Время для нас', time: '21:00', wishes: 'Музыка' } };
  await t.test('anonymous users cannot read or write shared events', async () => {
    assert.equal((await outsider.request('/session')).data, null);
    assert.equal((await outsider.request('/events', 'POST', draft)).status, 401);
    assert.equal((await outsider.request('/stream')).status, 401);
  });
  await t.test('creator gets an empty calendar and HttpOnly session', async () => {
    const result = await alice.request('/pairs', 'POST', { name: 'Алиса' });
    assert.equal(result.status, 201);
    assert.deepEqual(result.data.events, []);
    assert.equal(result.data.members.length, 1);
    assert.match(result.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
    invite = result.data.invite;
    assert.ok(invite.length >= 32);
  });
  await t.test('invitation rotation invalidates older invitation', async () => {
    const rotated = await alice.request('/invite', 'POST', {});
    assert.equal(rotated.status, 200);
    assert.equal((await mark.request('/join', 'POST', { name: 'Марк', invite })).status, 404);
    invite = rotated.data.invite;
  });
  await t.test('second partner joins; invitation is single use and pair limited to two', async () => {
    const result = await mark.request('/join', 'POST', { name: 'Марк', invite });
    assert.equal(result.status, 200);
    assert.equal(result.data.members.length, 2);
    assert.equal((await outsider.request('/join', 'POST', { name: 'Третий', invite })).status, 404);
    assert.equal((await alice.request('/invite', 'POST', {})).status, 409);
    assert.equal((await alice.request('/pairs', 'POST', { name: 'Ещё' })).status, 409);
  });
  await t.test('shared updates reach partner through SSE and persisted state', async () => {
    const abort = new AbortController();
    const timeout = setTimeout(() => abort.abort(), 4000);
    try {
      const stream = await fetch(`${base}/api/stream`, { headers: { cookie: mark.cookie }, signal: abort.signal });
      assert.equal(stream.status, 200);
      const reader = stream.body.getReader();
      const ready = new TextDecoder().decode((await reader.read()).value);
      assert.match(ready, /event: ready/);
      const created = await alice.request('/events', 'POST', draft);
      assert.equal(created.status, 201);
      event = created.data;
      const change = new TextDecoder().decode((await reader.read()).value);
      assert.match(change, /event: change/);
      assert.ok(!change.includes(draft.note));
      const state = (await mark.request('/session')).data;
      assert.deepEqual(state.events[0], event);
    } finally { clearTimeout(timeout); abort.abort(); }
  });
  await t.test('personal notes stay with their author and are absent from shared payloads', async () => {
    assert.equal((await alice.request(`/events/${event.id}/private`, 'PUT', { note: 'Моя личная заметка' })).status, 200);
    assert.equal((await mark.request(`/events/${event.id}/private`)).data.note, '');
    await mark.request(`/events/${event.id}/private`, 'PUT', { note: 'Личное Марка' });
    assert.equal((await alice.request(`/events/${event.id}/private`)).data.note, 'Моя личная заметка');
    assert.equal((await mark.request(`/events/${event.id}/private`)).data.note, 'Личное Марка');
    assert.ok(!JSON.stringify((await mark.request('/session')).data).includes('личная'));
  });
  await t.test('another pair cannot access or modify this pair’s records', async () => {
    assert.equal((await outsider.request('/pairs', 'POST', { name: 'Другой человек' })).status, 201);
    assert.deepEqual((await outsider.request('/session')).data.events, []);
    for (const [path, method, body] of [[`/events/${event.id}`, 'PATCH', event], [`/events/${event.id}`, 'DELETE', { version: 1 }], [`/events/${event.id}/private`, 'GET', undefined], [`/events/${event.id}/private`, 'PUT', { note: 'Попытка' }]]) {
      assert.equal((await outsider.request(path, method, body)).status, 404);
    }
  });
  await t.test('concurrent edits and stale deletes do not overwrite partner’s changes', async () => {
    const updated = await mark.request(`/events/${event.id}`, 'PATCH', { ...event, title: 'Ужин и прогулка' });
    assert.equal(updated.status, 200);
    assert.equal(updated.data.version, 2);
    assert.equal((await alice.request(`/events/${event.id}`, 'PATCH', { ...event, title: 'Старое изменение' })).status, 409);
    assert.equal((await alice.request(`/events/${event.id}`, 'DELETE', { version: event.version })).status, 409);
    event = updated.data;
  });
  await t.test('invalid dates, times, text, and cross-origin mutations rejected', async () => {
    for (const invalid of [{ date: '2026-02-30' }, { time: '25:99' }, { category: 'invalid' }, { title: ' ' }, { continuation: { title: 'test', time: '25:00', wishes: '' } }]) {
      assert.equal((await alice.request('/events', 'POST', { ...draft, ...invalid })).status, 400);
    }
    assert.equal((await alice.request('/events', 'POST', draft, { Origin: 'https://unrelated.example' })).status, 403);
    assert.equal((await alice.request(`/events/${event.id}/private`, 'PUT', { note: 'a'.repeat(4001) })).status, 400);
  });
  await t.test('sessions, events and separate notes survive server restart', async () => {
    await app.close();
    app = await createApp({ databasePath, serveFrontend: false });
    await start();
    assert.equal((await alice.request('/session')).data.events[0].title, 'Ужин и прогулка');
    assert.equal((await alice.request(`/events/${event.id}/private`)).data.note, 'Моя личная заметка');
    assert.equal((await mark.request(`/events/${event.id}/private`)).data.note, 'Личное Марка');
  });
  await t.test('completed events enter history and deletion removes associated notes', async () => {
    const completed = await alice.request(`/events/${event.id}`, 'PATCH', { ...event, status: 'completed' });
    assert.equal(completed.status, 200);
    assert.equal((await mark.request('/session')).data.events[0].status, 'completed');
    assert.equal((await mark.request(`/events/${event.id}`, 'DELETE', { version: completed.data.version })).status, 200);
    assert.deepEqual((await alice.request('/session')).data.events, []);
    assert.equal(app.db.prepare('SELECT count(*) AS count FROM private_notes').get().count, 0);
  });
});
