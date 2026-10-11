// Shared by the browser and Node 24. Never execute user-provided conditions/code.
export type NodeType = 'intro' | 'confirm' | 'reveal' | 'single' | 'multiple' | 'datetime' | 'text' | 'info' | 'accept';
export type ScenarioOption = { id: string; label: string; next?: string };
export type ScenarioNode = { id: string; type: NodeType; title: string; body: string; next: string | null; options: ScenarioOption[]; required: boolean; button: string; dateMode?: 'choose' | 'fixed'; fixedDate?: string; fixedTime?: string; purpose?: 'place' };
export type Scenario = { title: string; theme: string; start: string; nodes: ScenarioNode[] };
export type Answer = string | string[] | boolean | { date: string; time: string };
export type Answers = Record<string, Answer>;
export type ScenarioResponse = { answers: Answers; path: string[]; date: string; time: string };
export const themeKeys = ['adrenaline', 'pink-dream', 'city-night', 'cozy-home', 'gourmet', 'nature', 'retro', 'quest', 'art', 'luxury'];
export const nodeTypes: Record<NodeType, string> = { intro: 'Вступление', confirm: 'Подтверждение', reveal: 'Раскрытие сюрприза', single: 'Один вариант', multiple: 'Несколько вариантов', datetime: 'Дата и время', text: 'Свободный ответ', info: 'Информация', accept: 'Принятие' };
function invalid(message: string): never { throw new Error(message); }
const safeId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value) && !Object.hasOwn(Object.prototype, value);
const string = (value: unknown, max: number, required = false): value is string => typeof value === 'string' && value.length <= max && (!required || !!value.trim());
export const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);

export function validateScenario(input: unknown, publish = true): asserts input is Scenario {
  const s = input as Scenario;
  if (!s || !string(s.title, 100, true) || !themeKeys.includes(s.theme) || !Array.isArray(s.nodes) || !s.nodes.length || s.nodes.length > 100 || !string(s.start, 80, true)) invalid('Проверьте название, атмосферу и страницы сценария.');
  const ids = new Set<string>();
  for (const n of s.nodes) {
    if (!n || !safeId(n.id) || ids.has(n.id) || !Object.hasOwn(nodeTypes, n.type) || !string(n.title, 160, publish) || !string(n.body, 3000) || !string(n.button, 80) || typeof n.required !== 'boolean' || !(n.next === null || string(n.next, 80, true)) || !Array.isArray(n.options) || n.options.length > 20) invalid('Некорректная страница или повторяющийся ID.');
    ids.add(n.id);
    const options = new Set<string>();
    for (const option of n.options) {
      if (!option || !safeId(option.id) || options.has(option.id) || !string(option.label, 120, publish) || !(option.next === undefined || string(option.next, 80, true))) invalid('Проверьте варианты страницы.');
      options.add(option.id);
    }
    if (publish && ['single', 'multiple'].includes(n.type) && !n.options.length) invalid('Добавьте варианты выбора.');
    if (!['single', 'multiple'].includes(n.type) && n.options.length) invalid('Варианты допустимы на страницах выбора.');
    if (n.type === 'multiple' && n.options.some(option => option.next)) invalid('Множественный выбор использует один общий следующий шаг.');
    if (n.type === 'datetime' && (!['choose', 'fixed'].includes(n.dateMode || '') || (publish && n.dateMode === 'fixed' && (!validDate(n.fixedDate || '') || !validTime(n.fixedTime || ''))))) invalid('Проверьте режим, дату и время встречи.');
  }
  if (!publish) return;
  if (!ids.has(s.start)) invalid('Начальная страница не найдена.');
  const reached = new Set<string>(), visiting = new Set<string>(), visited = new Set<string>();
  const map = new Map(s.nodes.map(n => [n.id, n]));
  function walk(id: string, dateCount: number) {
    const n = map.get(id);
    if (!n) invalid('Переход ведёт на удалённую страницу.');
    if (visiting.has(id)) invalid('В сценарии есть цикл.');
    const count = dateCount + (n.type === 'datetime' ? 1 : 0);
    if (count > 1) invalid('На каждом пути должна быть одна страница даты.');
    reached.add(id);
    if (n.type === 'accept') { if (n.next !== null || count !== 1) invalid('Принятие завершает путь после выбора даты.'); return; }
    const state = `${id}:${count}`;
    if (visited.has(state)) return;
    visiting.add(id);
    const nexts = n.type === 'single' ? n.options.map(option => option.next || n.next) : [n.next];
    for (const next of nexts) { if (!next) invalid('У страницы не задан следующий шаг.'); walk(next, count); }
    visiting.delete(id); visited.add(state);
  }
  walk(s.start, 0);
  if (reached.size !== s.nodes.length) invalid('Есть страницы, к которым нет перехода. Свяжите их со сценарием.');
}

export function resolveAnswers(s: Scenario, input: Answers, complete = true): ScenarioResponse {
  validateScenario(s);
  if (!input || typeof input !== 'object' || Array.isArray(input)) invalid('Проверьте ответы.');
  if (Object.keys(input).some(id => !s.nodes.some(n => n.id === id))) invalid('Ответ содержит неизвестную страницу.');
  const answers: Answers = {}, path: string[] = [];
  let id: string | null = s.start, date = '', time = '';
  while (id) {
    const n: ScenarioNode = s.nodes.find(node => node.id === id)!;
    path.push(id);
    const value: Answer | undefined = input[id];
    if (value === undefined) { if (complete) invalid('Пройдите все страницы приглашения.'); break; }
    let next: string | null = n.next;
    if (n.type === 'single') {
      const option: ScenarioOption | undefined = n.options.find(option => option.id === value);
      if (!option) invalid('Выбранный вариант не найден.');
      answers[id] = option.id; next = option.next || n.next;
    } else if (n.type === 'multiple') {
      if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !n.options.some(option => option.id === item)) || new Set(value).size !== value.length || (n.required && !value.length)) invalid('Проверьте выбранные занятия.');
      answers[id] = n.options.filter(option => value.includes(option.id)).map(option => option.id);
    } else if (n.type === 'datetime') {
      if (!value || typeof value !== 'object' || Array.isArray(value) || !('date' in value) || !validDate(value.date) || !validTime(value.time)) invalid('Укажите дату и время.');
      if (n.dateMode === 'fixed' && (value.date !== n.fixedDate || value.time !== n.fixedTime)) invalid('Дата приглашения задана автором.');
      date = value.date; time = value.time; answers[id] = { date, time };
    } else if (n.type === 'text') {
      if (!string(value, 2000, n.required)) invalid('Проверьте текст ответа.');
      answers[id] = value.trim();
    } else {
      if (value !== true) invalid('Подтвердите шаг приглашения.');
      answers[id] = true;
    }
    if (n.type === 'accept') { id = null; break; }
    id = next;
  }
  if (complete && Object.keys(input).some(key => !(key in answers))) invalid('В ответе есть недоступные страницы.');
  return { answers, path, date, time };
}

export function answerText(n: ScenarioNode, answer: Answer | undefined): string {
  if (answer === undefined) return '';
  if (n.type === 'single') return n.options.find(option => option.id === answer)?.label || '';
  if (Array.isArray(answer)) return n.options.filter(option => answer.includes(option.id)).map(option => option.label).join(', ');
  if (typeof answer === 'object') return `${answer.date} · ${answer.time}`;
  return typeof answer === 'boolean' ? answer ? 'Да' : 'Нет' : answer;
}
