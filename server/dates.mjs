import { randomUUID } from 'node:crypto';
import { validateScenario, resolveAnswers, answerText } from '../src/features/dates/scenario.ts';

export function dateModule({ db, broadcast, fail, notifyPartner = () => {} }) {
  db.exec(`CREATE TABLE IF NOT EXISTS date_invitations (
    id TEXT PRIMARY KEY, pair_id TEXT NOT NULL REFERENCES pairs(id), author_id TEXT NOT NULL REFERENCES members(id),
    status TEXT NOT NULL DEFAULT 'draft', draft TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, published_id TEXT, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS date_scenario_versions (id TEXT PRIMARY KEY, invitation_id TEXT NOT NULL REFERENCES date_invitations(id) ON DELETE CASCADE, snapshot TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS date_runs (invitation_id TEXT NOT NULL REFERENCES date_invitations(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), version_id TEXT NOT NULL REFERENCES date_scenario_versions(id), answers TEXT NOT NULL, PRIMARY KEY(invitation_id, member_id));
    CREATE TABLE IF NOT EXISTS date_responses (invitation_id TEXT PRIMARY KEY REFERENCES date_invitations(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES members(id), version_id TEXT NOT NULL REFERENCES date_scenario_versions(id), data TEXT NOT NULL, event_id TEXT REFERENCES events(id) ON DELETE SET NULL);`);
  const snapshot = id => id ? JSON.parse(db.prepare('SELECT snapshot FROM date_scenario_versions WHERE id = ?').get(id).snapshot) : null;
  function representation(row, member) {
    const author = row.author_id === member.id;
    const response = db.prepare('SELECT * FROM date_responses WHERE invitation_id = ?').get(row.id);
    const run = db.prepare('SELECT * FROM date_runs WHERE invitation_id = ? AND member_id = ?').get(row.id, member.id);
    return {
      id: row.id, authorId: row.author_id, status: row.status, version: row.version,
      scenario: author ? JSON.parse(row.draft) : snapshot(row.published_id), publishedId: row.published_id, publishedScenario: snapshot(row.published_id),
      response: response ? { ...JSON.parse(response.data), versionId: response.version_id, eventId: response.event_id, scenario: snapshot(response.version_id) } : null,
      run: run ? { versionId: run.version_id, answers: JSON.parse(run.answers), scenario: snapshot(run.version_id) } : null,
    };
  }
  function rowFor(member, id) {
    const row = db.prepare('SELECT * FROM date_invitations WHERE id = ? AND pair_id = ?').get(id, member.pair_id);
    if (!row || (row.status === 'draft' && row.author_id !== member.id)) fail(404, 'Приглашение не найдено.');
    return row;
  }
  function scenarioInput(input, publish = false) {
    try { validateScenario(input, publish); } catch (error) { fail(400, error.message); }
    return input;
  }
  function responseInput(scenario, answers, complete) {
    try { return resolveAnswers(scenario, answers, complete); } catch (error) { fail(400, error.message); }
  }
  function checkedVersion(row, member, versionId) {
    const run = db.prepare('SELECT version_id FROM date_runs WHERE invitation_id = ? AND member_id = ?').get(row.id, member.id);
    if (typeof versionId !== 'string' || versionId !== (run?.version_id || row.published_id)) fail(409, 'Версия приглашения изменилась. Откройте его снова.');
    return snapshot(versionId);
  }
  const transaction = action => { db.exec('BEGIN'); try { const result = action(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; } };
  return function handle({ member, pathname, method, body, reply }) {
    if (!pathname.startsWith('/api/dates/')) return false;
    if (pathname === '/api/dates/inbox' && method === 'GET') {
      reply(200, db.prepare("SELECT id FROM date_invitations WHERE pair_id = ? AND author_id != ? AND status = 'published'").all(member.pair_id, member.id)); return true;
    }
    if (pathname === '/api/dates/invitations') {
      if (method === 'GET') {
        const rows = db.prepare("SELECT * FROM date_invitations WHERE pair_id = ? AND (author_id = ? OR status != 'draft') ORDER BY created_at DESC, rowid DESC").all(member.pair_id, member.id);
        reply(200, rows.map(row => representation(row, member))); return true;
      }
      if (method === 'POST') {
        const scenario = scenarioInput(body.scenario);
        const id = randomUUID();
        db.prepare('INSERT INTO date_invitations (id, pair_id, author_id, draft, created_at) VALUES (?, ?, ?, ?, ?)').run(id, member.pair_id, member.id, JSON.stringify(scenario), Date.now());
        reply(201, representation(rowFor(member, id), member)); return true;
      }
    }
    const route = /^\/api\/dates\/invitations\/([a-f0-9-]{36})(?:\/(publish|progress|respond))?$/.exec(pathname);
    if (!route) return false;
    const row = rowFor(member, route[1]);
    if (!route[2] && method === 'GET') { reply(200, representation(row, member)); return true; }
    if (!route[2] && method === 'PATCH') {
      if (row.author_id !== member.id) fail(403, 'Сценарий редактирует автор приглашения.');
      if (row.status === 'answered') fail(409, 'Ответ уже сохранён. Создайте новое приглашение на основе этого.');
      const scenario = scenarioInput(body.scenario);
      if (!Number.isInteger(body.version) || row.version !== body.version) fail(409, 'Черновик изменился. Откройте его снова.');
      db.prepare('UPDATE date_invitations SET draft = ?, version = version + 1 WHERE id = ?').run(JSON.stringify(scenario), row.id);
      reply(200, representation(rowFor(member, row.id), member)); return true;
    }
    if (route[2] === 'publish' && method === 'POST') {
      if (row.author_id !== member.id) fail(403, 'Опубликовать приглашение может только автор.');
      if (row.status === 'answered') fail(409, 'На это приглашение уже есть ответ.');
      if (!Number.isInteger(body.version) || row.version !== body.version) fail(409, 'Черновик изменился. Откройте его снова.');
      if (db.prepare('SELECT count(*) AS n FROM members WHERE pair_id = ?').get(member.pair_id).n !== 2) fail(409, 'Сначала подключите партнёра к календарю. Черновик можно сохранить сейчас.');
      const scenario = scenarioInput(JSON.parse(row.draft), true);
      transaction(() => {
        const id = randomUUID();
        db.prepare('INSERT INTO date_scenario_versions VALUES (?, ?, ?)').run(id, row.id, JSON.stringify(scenario));
        db.prepare("UPDATE date_invitations SET published_id = ?, status = 'published', version = version + 1 WHERE id = ?").run(id, row.id);
      });
      broadcast(member.pair_id);
      notifyPartner(member, { body: 'Для вас новое приглашение на свидание.', url: `/?dateInvite=${row.id}`, tag: `invitation-${row.id}` });
      reply(200, representation(rowFor(member, row.id), member)); return true;
    }
    if (['progress', 'respond'].includes(route[2]) && ['PUT', 'POST'].includes(method)) {
      if (row.author_id === member.id) fail(403, 'Ответ отправляет второй участник пары. Для автора есть предпросмотр.');
      if (row.status === 'draft') fail(404, 'Приглашение ещё не опубликовано.');
      const existing = db.prepare('SELECT * FROM date_responses WHERE invitation_id = ?').get(row.id);
      const scenario = existing ? snapshot(existing.version_id) : checkedVersion(row, member, body.versionId);
      if (existing && body.versionId !== existing.version_id) fail(409, 'Ответ относится к другой версии приглашения.');
      if (route[2] === 'progress') {
        if (existing) fail(409, 'Ответ уже отправлен.');
        const result = responseInput(scenario, body.answers, false);
        db.prepare('INSERT INTO date_runs VALUES (?, ?, ?, ?) ON CONFLICT(invitation_id, member_id) DO UPDATE SET answers = excluded.answers').run(row.id, member.id, body.versionId, JSON.stringify(result.answers));
        reply(200, { answers: result.answers }); return true;
      }
      const response = responseInput(scenario, body.answers, true);
      if (existing) {
        if (JSON.stringify(response) !== existing.data) fail(409, 'Приглашение уже принято с другим ответом.');
        const event = existing.event_id ? db.prepare('SELECT * FROM events WHERE id = ?').get(existing.event_id) : null;
        reply(200, { invitation: representation(row, member), event: event ? { ...JSON.parse(event.data), id: event.id, version: event.version } : null }); return true;
      }
      const id = randomUUID();
      const selectedPlace = scenario.nodes.find(node => node.purpose === 'place' && response.path.includes(node.id));
      const note = response.path.map(nodeId => scenario.nodes.find(node => node.id === nodeId)).filter(node => ['single', 'multiple', 'text'].includes(node.type)).map(node => `${node.title}: ${answerText(node, response.answers[node.id])}`).join('\n').slice(0, 2000);
      const event = { kind: 'date', title: scenario.title, date: response.date, time: response.time, category: ['adrenaline', 'nature'].includes(scenario.theme) ? 'adventure' : ['cozy-home', 'retro'].includes(scenario.theme) ? 'home' : 'date', location: selectedPlace ? answerText(selectedPlace, response.answers[selectedPlace.id]).slice(0, 200) : '', note, status: 'planned', continuation: null, tags: [], linkedDateId: null };
      transaction(() => {
        db.prepare('INSERT INTO events (id, pair_id, data) VALUES (?, ?, ?)').run(id, member.pair_id, JSON.stringify(event));
        db.prepare('INSERT INTO date_responses VALUES (?, ?, ?, ?, ?)').run(row.id, member.id, body.versionId, JSON.stringify(response), id);
        db.prepare("UPDATE date_invitations SET status = 'answered', version = version + 1 WHERE id = ?").run(row.id);
      });
      broadcast(member.pair_id);
      notifyPartner(member, { body: 'Партнёр принял приглашение. Встреча появилась в общем календаре.', url: '/', tag: `invitation-${row.id}` });
      reply(201, { invitation: representation(rowFor(member, row.id), member), event: { ...event, id, version: 1 } }); return true;
    }
    return false;
  };
}
