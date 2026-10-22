import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from './index.mjs';
import { calendarFile } from '../src/features/calendar/ical.ts';

test('iCalendar keeps stable IDs, folds Unicode, escapes text and excludes private details and completed events', () => {
  const event = { id: 'one', version: 3, kind: 'date', title: 'Ужин, вместе;\n' + 'Наш вечер '.repeat(20), date: '2026-10-22', time: '19:30', status: 'planned', note: 'secret-note' };
  const result = calendarFile([event, { ...event, id: 'sex', kind: 'intimacy', time: '', title: 'secret-title', sexType: 'oral', tags: ['secret-tag'] }, { ...event, id: 'past', status: 'completed' }]);
  assert.match(result, /UID:one@vdvoem\r\nSEQUENCE:3/);
  assert.match(result, /DTSTART:20261022T193000/);
  assert.match(result, /SUMMARY:Ужин\\, вместе\\;\\n/);
  assert.match(result, /SUMMARY:Время для двоих/);
  assert.match(result, /DTSTART;VALUE=DATE:20261022\r\nDTEND;VALUE=DATE:20261023/);
  assert.match(result, /TRIGGER:-PT1H/); assert.match(result, /TRIGGER:PT9H/);
  assert.doesNotMatch(result, /secret-|UID:past/);
  for (const line of result.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75);
});

test('subscription is private, revocable, isolated and reflects edits and deletions', async t => {
  const before = process.env.PUBLIC_ORIGIN; process.env.PUBLIC_ORIGIN = 'https://calendar.example';
  const app = await createApp({ databasePath: ':memory:', serveFrontend: false });
  if (before === undefined) delete process.env.PUBLIC_ORIGIN; else process.env.PUBLIC_ORIGIN = before;
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  t.after(() => app.close());
  const base = `http://127.0.0.1:${app.server.address().port}`;
  function client() { let cookie = ''; return async (path, method = 'GET', body) => {
    const response = await fetch(base + '/api' + path, { method, headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (response.headers.get('set-cookie')) cookie = response.headers.get('set-cookie').split(';')[0];
    return { status: response.status, data: await response.json() };
  }; }
  const a = client(), b = client(), other = client(), anonymous = client();
  assert.equal((await anonymous('/calendar/subscription', 'POST', {})).status, 401);
  const pair = await a('/pairs', 'POST', { name: 'А' });
  await b('/join', 'POST', { name: 'Б', invite: pair.data.invite });
  await other('/pairs', 'POST', { name: 'Другие' });
  const event = { kind: 'date', title: 'Наш ужин', date: '2026-10-22', time: '19:00', category: 'date', status: 'planned' };
  const created = await b('/events', 'POST', event);
  const eventId = created.data.id;
  await other('/events', 'POST', { ...event, title: 'Чужой ужин' });
  const subscription = await a('/calendar/subscription', 'POST', {});
  const path = new URL(subscription.data.url).pathname;
  assert.equal(subscription.status, 201);
  assert.equal((await a('/calendar/subscription')).data.active, true);
  const response = await fetch(base + path);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const content = await response.text();
  assert.match(content, /Наш ужин/); assert.doesNotMatch(content, /Чужой/);
  await b(`/events/${eventId}`, 'PATCH', { ...event, title: 'Новый ужин', version: 1 });
  assert.match(await (await fetch(base + path)).text(), /Новый ужин/);
  await b(`/events/${eventId}`, 'DELETE', { version: 2 });
  assert.doesNotMatch(await (await fetch(base + path)).text(), /BEGIN:VEVENT/);
  await b('/calendar/subscription', 'POST', {});
  await a('/calendar/subscription', 'POST', {});
  assert.equal((await fetch(base + path)).status, 404);
  assert.equal((await b('/calendar/subscription')).data.active, true);
  await a('/calendar/subscription', 'DELETE', {});
  assert.equal((await a('/calendar/subscription')).data.active, false);
});
