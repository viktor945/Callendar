import { ArrowRight, CalendarDays, Heart, Plus, Sparkles } from 'lucide-react';
import { dateFromKey, dateKey, dateLabel, intimacyIdeas, type DateEvent, type PairProfile } from '../../model';

export function IntimacyDashboard({ events, today, profile, onCreate, onDetail, onSettings, compact = false }: { events: DateEvent[]; today: string; profile: PairProfile; onCreate: (draft: Partial<DateEvent>) => void; onDetail: (event: DateEvent) => void; onSettings: () => void; compact?: boolean }) {
  const from = dateFromKey(today); from.setDate(from.getDate() - 27);
  const facts = events.filter(event => event.kind === 'intimacy' && event.status === 'completed' && event.date >= dateKey(from) && event.date <= today);
  const planned = events.filter(event => event.kind === 'intimacy' && event.status === 'planned' && event.date >= today).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const tags = new Set(facts.flatMap(event => event.tags));
  const weeks = Array.from({ length: 4 }, (_, index) => {
    const start = new Date(from); start.setDate(from.getDate() + index * 7);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start: dateKey(start), end: dateKey(end), count: facts.filter(event => event.date >= dateKey(start) && event.date <= dateKey(end)).length };
  });
  return <div className={`intimacy-dashboard ${compact ? 'compact' : ''}`}>
    <section className="intimacy-overview"><div className="card-label"><Heart size={15} />НАША БЛИЗОСТЬ<span>♡</span></div><h2>{compact ? 'Больше внимания нам' : 'Наш ритм, наши желания'}</h2><p className="muted">Последние 28 дней · {dateLabel(dateKey(from))} — {dateLabel(today)}</p>
      <div className="intimacy-stats"><div><strong data-testid="intimacy-facts">{facts.length}</strong><span>состоявшихся встреч</span></div><div><strong>{planned.length}</strong><span>будущих планов</span></div><div><strong>{tags.size}</strong><span>вариантов близости</span></div></div>
      {!compact && <div className="rhythm-chart" aria-label="Состоявшиеся встречи за четыре недели">{weeks.map((week, index) => <div key={week.start} title={`${dateLabel(week.start)} — ${dateLabel(week.end)}: ${week.count}`}><span className="rhythm-value">{week.count}</span><div className="rhythm-bar-track"><span style={{ height: `${Math.max(5, week.count / Math.max(1, ...weeks.map(item => item.count)) * 100)}%` }} /></div><span>{index + 1}-я неделя</span></div>)}</div>}
      <button className="frequency-setting" onClick={onSettings}>{profile.weeklyGoal === null ? 'Без цели по частоте · настроить' : `Наше пожелание: ${profile.weeklyGoal} в неделю · изменить`}<ArrowRight size={14} /></button>
      <div className="intimacy-actions"><button className="button primary" onClick={() => onCreate({ kind: 'intimacy', status: 'completed', title: '', time: '' })}><Plus size={16} />Добавить факт</button><button className="button secondary" onClick={() => onCreate({ kind: 'intimacy' })}>Запланировать</button></div>
    </section>
    {!compact && <>
      <section className="intimacy-plans"><div className="section-heading"><h3>Время только для нас</h3><span className="muted">Планы</span></div>{planned.length ? planned.map(event => <button className="agenda-event" key={event.id} onClick={() => onDetail(event)}><span className="agenda-icon intimacy"><CalendarDays size={20} /></span><span className="agenda-title"><strong>{event.title}</strong><span>{dateLabel(event.date)} · {event.time}</span></span><ArrowRight size={16} /></button>) : <p className="empty-intimacy">Выберите вечер, который хочется провести вместе.</p>}</section>
      <section className="intimacy-ideas"><div className="section-heading"><h3>Разнообразие начинается с идеи</h3><Sparkles size={19} /></div><p className="muted">Выберите настроение и обсудите детали с партнёром.</p><div className="ideas-grid">{intimacyIdeas.map(idea => <article className="idea-card intimacy" key={idea.title}><div className="idea-art"><span>{idea.emoji}</span><span className="idea-art-star">✦</span></div><span className="idea-tag">{idea.tag}</span><h2>{idea.title}</h2><p>{idea.description}</p><button className="button secondary" onClick={() => onCreate({ kind: 'intimacy', title: idea.title, note: idea.description, tags: [idea.tag], time: '21:00' })}>В наш календарь<Plus size={16} /></button></article>)}</div></section>
    </>}
  </div>;
}
