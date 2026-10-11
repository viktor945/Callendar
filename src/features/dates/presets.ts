import { inviteTemplates } from './templates';
import type { Scenario, ScenarioNode, NodeType } from './scenario';

export function newNode(type: NodeType = 'info'): ScenarioNode {
  return { id: crypto.randomUUID(), type, title: 'Новая страница', body: '', button: 'Продолжить', next: null, options: [], required: true, ...(type === 'datetime' ? { dateMode: 'choose' as const, fixedDate: '', fixedTime: '19:30' } : {}) };
}
export function createPreset(theme: string, ready = false): Scenario {
  const t = inviteTemplates.find(template => template.key === theme)!;
  const node = (id: string, type: NodeType, title: string, next: string | null, body = ''): ScenarioNode => ({ id, type, title, body, next, button: 'Продолжить', options: [], required: true });
  const intro = node('intro', 'intro', t.title, ready ? 'datetime' : 'confirm', t.subtitle);
  intro.button = 'Да, я в деле';
  const confirm = node('confirm', 'confirm', t.confirmTitle, 'place');
  const place = node('place', 'single', t.choiceTitle, null);
  place.purpose = 'place';
  place.options = t.places.map((p, i) => ({ id: `place-${i}`, label: p.name, next: `activities-${i}` }));
  const activities = t.places.map((p, i) => ({ ...node(`activities-${i}`, 'multiple', `${p.name}: что будем делать?`, 'datetime', 'Можно выбрать несколько вариантов.'), options: p.activities.map((label, j) => ({ id: `activity-${i}-${j}`, label })) }));
  const datetime = { ...node('datetime', 'datetime', 'Когда встречаемся?', 'wishes'), dateMode: 'choose' as const, fixedDate: '', fixedTime: '19:30' };
  const wishes = node('wishes', 'text', 'Маленькая подсказка', 'accept', 'Пожелания — необязательно.'); wishes.required = false;
  const accept = node('accept', 'accept', 'Наше свидание', null, t.finalText); accept.button = 'Принять приглашение';
  if (ready) { intro.body = `${t.subtitle}\n${t.places[0].name} · ${t.places[0].activities.join(', ')}`; }
  return { title: t.name, theme, start: 'intro', nodes: ready ? [intro, datetime, wishes, accept] : [intro, confirm, place, ...activities, datetime, wishes, accept] };
}
