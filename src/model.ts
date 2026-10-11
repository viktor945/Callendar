export type Category = 'date' | 'home' | 'adventure';
export type EventKind = 'date' | 'intimacy';
export type DateEvent = {
  id: string; version: number; kind: EventKind; tags: string[]; positions?: string[]; linkedDateId: string | null;
  title: string; date: string; time: string; location: string; category: Category;
  note: string; status: 'planned' | 'completed';
  continuation: { title: string; time: string; wishes: string } | null;
};
export type PairProfile = { relationshipMode: 'dating' | 'couple'; partnerLabel: string; weeklyGoal: number | null; version: number };
export type Session = { memberId: string; members: { id: string; name: string }[]; events: DateEvent[]; profile: PairProfile };
export type PersonalNote = { note: string; rating: number | null };
export const defaultProfile: PairProfile = { relationshipMode: 'dating', partnerLabel: '', weeklyGoal: null, version: 1 };
export const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
export const dateFromKey = (key: string) => new Date(`${key}T12:00:00`);
export const dateLabel = (key: string, options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long' }) => dateFromKey(key).toLocaleDateString('ru-RU', options);
