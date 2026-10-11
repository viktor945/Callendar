import { Check, CalendarDays } from 'lucide-react';
import { answerText } from './scenario';
import type { Invitation } from './types';

export function ResponseSummary({ invitation, onCalendar }: { invitation: Invitation; onCalendar: (id: string) => void }) {
  const response = invitation.response!;
  return <div className="response-summary"><h3><Check size={18} />Ответ партнёра сохранён</h3><p>Весь выбранный путь:</p><dl>{response.path.map(id => { const node = response.scenario.nodes.find(n => n.id === id)!; return <div key={id}><dt>{node.title}</dt><dd>{answerText(node, response.answers[id]) || 'Без пожеланий'}</dd></div>; })}</dl>{response.eventId ? <button className="button secondary" onClick={() => onCalendar(response.eventId!)}><CalendarDays size={16} />Открыть свидание в календаре</button> : <p className="muted">Свидание удалено из календаря; ответ сохранён.</p>}</div>;
}
