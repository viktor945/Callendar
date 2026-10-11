export type Category = 'date' | 'home' | 'adventure';
export type EventKind = 'date' | 'intimacy';
export type DateEvent = {
  id: string; version: number; kind: EventKind; tags: string[]; linkedDateId: string | null;
  title: string; date: string; time: string; location: string; category: Category;
  note: string; status: 'planned' | 'completed';
  continuation: { title: string; time: string; wishes: string } | null;
};
export type PairProfile = { relationshipMode: 'dating' | 'couple'; partnerLabel: string; weeklyGoal: number | null; version: number };
export type Session = { memberId: string; members: { id: string; name: string }[]; events: DateEvent[]; profile: PairProfile };
export type PersonalNote = { note: string; rating: number | null };
export const defaultProfile: PairProfile = { relationshipMode: 'dating', partnerLabel: '', weeklyGoal: null, version: 1 };
export const intimacyTags = ['Нежность и массаж', 'Привычный формат', 'Оральная близость', 'Игрушки', 'Ролевая игра', 'Новый сценарий'];
export const intimacyIdeas = [
  { title: 'Вечер прикосновений', description: 'Тёплый свет, массаж и время прислушаться друг к другу.', emoji: '🕯️', tag: 'Нежность и массаж' },
  { title: 'Расскажем о желаниях', description: 'Выберите по одной идее и обсудите, что хочется попробовать вместе.', emoji: '💌', tag: 'Новый сценарий' },
  { title: 'Наш привычный ритуал', description: 'Вернуться к тому, что нравится вам обоим. Без спешки и лишних планов.', emoji: '🌙', tag: 'Привычный формат' },
  { title: 'Немного игры', description: 'Вместе придумайте образ или историю для вечера. Детали выбираете вы.', emoji: '🎭', tag: 'Ролевая игра' },
  { title: 'Попробовать новое', description: 'Обсудите новую игрушку или аксессуар и выберите подходящий момент.', emoji: '✨', tag: 'Игрушки' },
  { title: 'Внимание друг к другу', description: 'Обсудите, какие прикосновения и формы близости приятны каждому.', emoji: '🌸', tag: 'Оральная близость' },
];
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);
export const dateLabel = (key: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) => dateFromKey(key).toLocaleDateString('ru-RU', options);
