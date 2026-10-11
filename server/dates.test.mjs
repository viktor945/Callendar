import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from './index.mjs';
import { validateScenario, resolveAnswers } from '../src/features/dates/scenario.ts';

const node = (id, type, next, options = []) => ({ id, type, title: id, body: '', button: 'Дальше', required: true, next, options });
function scenario(fixed = false) {
  return { title: 'Ночь в Алматы', theme: 'city-night', start: 'intro', nodes: [
    node('intro', 'intro', 'place'),
    node('place', 'single', null, [{ id: 'mountain', label: 'Шымбулак', next: 'activity' }, { id: 'home', label: 'Дома', next: 'home-activity' }]),
    node('activity', 'single', null, [{ id: 'walk', label: 'Маршрут', next: 'level' }]),
    node('level', 'single', null, [{ id: 'easy', label: 'Лёгкий', next: 'equipment' }]),
    node('equipment', 'multiple', 'when', [{ id: 'tea', label: 'Термос' }, { id: 'blanket', label: 'Плед' }]),
    node('home-activity', 'multiple', 'when', [{ id: 'film', label: 'Кино' }]),
    { ...node('when', 'datetime', 'wishes'), dateMode: fixed ? 'fixed' : 'choose', fixedDate: '2026-10-20', fixedTime: '19:30' },
    { ...node('wishes', 'text', 'accept'), required: false }, node('accept', 'accept', null),
  ] };
}
const answer = { intro: true, place: 'mountain', activity: 'walk', level: 'easy', equipment: ['tea'], when: { date: '2026-10-20', time: '19:30' }, wishes: 'Горячий чай', accept: true };

test('scenario engine supports deep branches and drops obsolete partial answers', () => {
  const s = scenario(); validateScenario(s);
  assert.deepEqual(resolveAnswers(s, answer).path, ['intro', 'place', 'activity', 'level', 'equipment', 'when', 'wishes', 'accept']);
  const changed = { ...answer, place: 'home' };
  assert.deepEqual(resolveAnswers(s, changed, false).answers, { intro: true, place: 'home' });
  assert.throws(() => resolveAnswers(s, changed), /страницы/);
  assert.throws(() => resolveAnswers(s, { ...answer, place: 'nonexistent' }), /вариант/);
  assert.throws(() => resolveAnswers(s, { ...answer, invented: true }), /неизвестную/);
  assert.throws(() => resolveAnswers(s, { ...answer, equipment: ['tea', 'tea'] }), /занятия/);
  assert.throws(() => resolveAnswers(scenario(true), { ...answer, when: { date: '2026-10-21', time: '19:30' } }), /автором/);
});

test('publication rejects cycles, missing edges, duplicate IDs and incomplete date paths; drafts survive', () => {
  for (const change of [s => s.nodes[2].options[0].next = 'place', s => s.nodes[2].options[0].next = 'deleted', s => s.nodes.push({ ...s.nodes[0] }), s => s.nodes[4].next = 'accept', s => s.nodes.push(node('unreachable', 'info', 'accept')), s => s.nodes[0].id = '__proto__']) {
    const s = scenario(); change(s); assert.throws(() => validateScenario(s));
  }
  const draft = scenario(); draft.nodes[2].options[0].next = 'deleted'; validateScenario(draft, false);
  const multi = scenario(); multi.nodes[4].options[0].next = 'when'; assert.throws(() => validateScenario(multi), /общий/);
});

async function setup(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vdvoem-dates-'));
  const databasePath = join(dir, 'db.sqlite');
  let app = await createApp({ databasePath, serveFrontend: false });
  let base;
  async function listen() { await new Promise(r => app.server.listen(0, '127.0.0.1', r)); base = `http://127.0.0.1:${app.server.address().port}/api`; }
  await listen(); t.after(async () => { await app.close(); rmSync(dir, { recursive: true, force: true }); });
  const client = () => { let cookie = ''; return async (path, method = 'GET', body) => {
    const r = await fetch(base + path, { method, headers: { cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    if (r.headers.get('set-cookie')) cookie = r.headers.get('set-cookie').split(';')[0];
    return { status: r.status, data: await r.json() };
  }; };
  const a = client(), b = client(), outsider = client(), anonymous = client();
  const created = await a('/pairs', 'POST', { name: 'A' });
  const authorId = created.data.memberId;
  await b('/join', 'POST', { name: 'B', invite: created.data.invite });
  await outsider('/pairs', 'POST', { name: 'C' });
  async function draft(s = scenario()) { return (await a('/dates/invitations', 'POST', { scenario: s, authorId: 'spoofed' })).data; }
  async function publish(item) { return (await a(`/dates/invitations/${item.id}/publish`, 'POST', { version: item.version })).data; }
  return { a, b, outsider, anonymous, authorId, draft, publish, async restart() { await app.close(); app = await createApp({ databasePath, serveFrontend: false }); await listen(); } };
}

test('invitations use pair membership, keep drafts private and let both partners be authors', async t => {
  const f = await setup(t);
  let item = await f.draft();
  assert.equal(item.authorId, f.authorId);
  assert.deepEqual((await f.b('/dates/invitations')).data, []);
  assert.equal((await f.b(`/dates/invitations/${item.id}`)).status, 404);
  assert.equal((await f.anonymous('/dates/invitations')).status, 401);
  assert.equal((await f.outsider(`/dates/invitations/${item.id}`)).status, 404);
  item = await f.publish(item);
  assert.equal((await f.b('/dates/invitations')).data.length, 1);
  assert.equal((await f.b(`/dates/invitations/${item.id}`, 'PATCH', { scenario: scenario(), version: item.version })).status, 403);
  assert.equal((await f.a(`/dates/invitations/${item.id}/respond`, 'POST', { versionId: item.publishedId, answers: answer })).status, 403);
  assert.equal((await f.outsider(`/dates/invitations/${item.id}/respond`, 'POST', { versionId: item.publishedId, answers: answer })).status, 404);
  const reverse = await f.b('/dates/invitations', 'POST', { scenario: scenario() });
  const published = await f.b(`/dates/invitations/${reverse.data.id}/publish`, 'POST', { version: reverse.data.version });
  assert.equal(published.status, 200);
  assert.equal((await f.a(`/dates/invitations/${reverse.data.id}/respond`, 'POST', { versionId: published.data.publishedId, answers: answer })).status, 201);
});

test('saved progress pins immutable versions; replies create one date atomically and survive restart', async t => {
  const f = await setup(t);
  let item = await f.publish(await f.draft());
  const versionId = item.publishedId;
  assert.equal((await f.b(`/dates/invitations/${item.id}/progress`, 'PUT', { versionId, answers: { intro: true, place: 'mountain' } })).status, 200);
  const changed = scenario(); changed.title = 'Новая версия'; changed.nodes[2].options[0].label = 'Другое занятие';
  const updated = await f.a(`/dates/invitations/${item.id}`, 'PATCH', { scenario: changed, version: item.version });
  assert.equal(updated.status, 200);
  assert.equal((await f.a(`/dates/invitations/${item.id}`, 'PATCH', { scenario: changed, version: item.version })).status, 409);
  item = await f.publish(updated.data);
  const current = (await f.b(`/dates/invitations/${item.id}`)).data;
  assert.equal(current.run.versionId, versionId);
  assert.equal(current.run.scenario.title, 'Ночь в Алматы');
  assert.equal(current.publishedScenario.title, 'Новая версия');
  const result = await f.b(`/dates/invitations/${item.id}/respond`, 'POST', { versionId, answers: answer });
  assert.equal(result.status, 201);
  assert.equal(result.data.event.kind, 'date');
  assert.equal(result.data.event.title, 'Ночь в Алматы');
  assert.equal(result.data.event.status, 'planned');
  const repeat = await f.b(`/dates/invitations/${item.id}/respond`, 'POST', { versionId, answers: answer });
  assert.equal(repeat.status, 200);
  assert.equal(repeat.data.event.id, result.data.event.id);
  assert.equal((await f.b(`/dates/invitations/${item.id}/respond`, 'POST', { versionId, answers: { ...answer, wishes: 'Другой ответ' } })).status, 409);
  assert.equal((await f.a('/session')).data.events.length, 1);
  await f.restart();
  const fromAuthor = (await f.a(`/dates/invitations/${item.id}`)).data;
  assert.deepEqual(fromAuthor.response.answers, answer);
  assert.equal(fromAuthor.response.scenario.title, 'Ночь в Алматы');
  assert.equal(fromAuthor.response.eventId, result.data.event.id);
  await f.a(`/events/${result.data.event.id}`, 'DELETE', { version: 1 });
  assert.equal((await f.a(`/dates/invitations/${item.id}`)).data.response.eventId, null);
  assert.equal((await f.b(`/dates/invitations/${item.id}/respond`, 'POST', { versionId, answers: answer })).data.event, null);
});

test('fixed-date responses and forged paths are checked by the server', async t => {
  const f = await setup(t), item = await f.publish(await f.draft(scenario(true)));
  for (const forged of [{ ...answer, when: { date: '2026-10-21', time: '19:30' } }, { ...answer, when: { date: '2026-02-30', time: '19:30' } }, { ...answer, 'home-activity': ['film'] }]) {
    assert.equal((await f.b(`/dates/invitations/${item.id}/respond`, 'POST', { versionId: item.publishedId, answers: forged, path: ['accept'] })).status, 400);
  }
  assert.equal((await f.a('/session')).data.events.length, 0);
  assert.equal((await f.b(`/dates/invitations/${item.id}/respond`, 'POST', { versionId: 'unknown', answers: answer })).status, 409);
});
