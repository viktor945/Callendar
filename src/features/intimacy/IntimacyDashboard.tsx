import { useState } from 'react';
import { ArrowRight, CalendarDays, Flame, Plus, Shuffle, Sparkles, X } from 'lucide-react';
import { dateFromKey, dateKey, dateLabel, type DateEvent, type PairProfile } from '../../model';
import { SexCatalog } from './SexCatalog';
import { sexCatalog, sexPresets } from './catalog';

export function IntimacyDashboard({ events, today, profile, onCreate, onDetail, onSettings, compact = false }: { events: DateEvent[]; today: string; profile: PairProfile; onCreate: (draft: Partial<DateEvent>) => void; onDetail: (event: DateEvent) => void; onSettings: () => void; compact?: boolean }) {
  const [selection, setSelection] = useState<string[]>([]);
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
    <section className="intimacy-overview"><div className="card-label"><Flame size={15} />СЕКС · НАШ КАЛЕНДАРЬ<span>✦</span></div><h2>{compact ? 'Больше внимания нам' : 'Наш ритм, наши желания'}</h2><p className="muted">Последние 28 дней · {dateLabel(dateKey(from))} — {dateLabel(today)}</p>
      <div className="intimacy-stats"><div><strong data-testid="intimacy-facts">{facts.length}</strong><span>состоявшихся встреч</span></div><div><strong>{planned.length}</strong><span>будущих планов</span></div><div><strong>{tags.size}</strong><span>выбранных вариантов</span></div></div>
      {!compact && <details className="rhythm-details"><summary>Статистика за 28 дней</summary><div className="rhythm-chart" aria-label="Состоявшиеся встречи за четыре недели">{weeks.map((week, index) => <div key={week.start} title={`${dateLabel(week.start)} — ${dateLabel(week.end)}: ${week.count}`}><span className="rhythm-value">{week.count}</span><div className="rhythm-bar-track"><span style={{ height: `${Math.max(5, week.count / Math.max(1, ...weeks.map(item => item.count)) * 100)}%` }} /></div><span>{index + 1}-я неделя</span></div>)}</div><button className="frequency-setting" onClick={onSettings}>{profile.weeklyGoal === null ? 'Без цели по частоте · настроить' : `Наше пожелание: ${profile.weeklyGoal} в неделю · изменить`}<ArrowRight size={14} /></button></details>}

      <div className="intimacy-actions"><button className="button primary" onClick={() => onCreate({ kind: 'intimacy', status: 'completed', title: '', time: '' })}><Plus size={16} />Добавить факт</button><button className="button secondary" onClick={() => onCreate({ kind: 'intimacy' })}>Запланировать</button></div>
    </section>
    {!compact && <>
      <section className="intimacy-ideas"><div className="sex-catalog-intro"><span className="eyebrow"><Sparkles size={15} />КОЛЛЕКЦИЯ ДЛЯ ДВОИХ</span><h2>Больше «давай попробуем».</h2><p>8 сфер, 24 подкатегории и 96 вариантов. Соберите свой вечер из того, что подходит вам обоим.</p></div>
        <button className="button secondary catalog-shuffle" onClick={() => {
          const pool = [...sexCatalog]; const result: string[] = [];
          for (let index = 0; index < 3; index++) { const [category] = pool.splice(Math.floor(Math.random() * pool.length), 1); const options = category.groups.flatMap(group => group.options); result.push(options[Math.floor(Math.random() * options.length)]); }
          setSelection(result);
        }}><Shuffle size={16} />Собрать случайное настроение</button>
        <SexCatalog selected={selection} onToggle={tag => setSelection(previous => previous.includes(tag) ? previous.filter(old => old !== tag) : previous.length < 24 ? [...previous, tag] : previous)} />
        {selection.length > 0 && <div className="catalog-selection selection-dock"><strong>Ваш набор · {selection.length}/24</strong><div className="selected-options">{selection.map(tag => <button key={tag} onClick={() => setSelection(previous => previous.filter(old => old !== tag))}>{tag}<X size={13} /></button>)}</div><button className="button primary" onClick={() => onCreate({ kind: 'intimacy', title: 'Наш вечер', tags: selection, time: '21:00' })}>Запланировать с этим набором<ArrowRight size={16} /></button></div>}
        <details className="sex-ready-presets"><summary>Готовые наборы · 8</summary><div className="sex-presets">{sexPresets.map(idea => <article className={`sex-preset tone-${idea.color}`} key={idea.title}><span className="preset-emoji">{idea.emoji}</span><h3>{idea.title}</h3><p>{idea.description}</p><div className="preset-tags">{idea.tags.map(tag => <span key={tag}>{tag}</span>)}</div><button className="button secondary" onClick={() => onCreate({ kind: 'intimacy', title: idea.title, note: idea.description, tags: idea.tags, time: '21:00' })}>В наш календарь<Plus size={16} /></button></article>)}</div></details>
      </section>
      <section className="intimacy-plans"><div className="section-heading"><h3>Время только для нас</h3><span className="muted">Планы</span></div>{planned.length ? planned.map(event => <button className="agenda-event" key={event.id} onClick={() => onDetail(event)}><span className="agenda-icon intimacy"><CalendarDays size={20} /></span><span className="agenda-title"><strong>{event.title}</strong><span>{dateLabel(event.date)}{event.time ? ` · ${event.time}` : ''}</span></span><ArrowRight size={16} /></button>) : <p className="empty-intimacy">Выберите вечер, который хочется провести вместе.</p>}</section>

    </>}
  </div>;
}
