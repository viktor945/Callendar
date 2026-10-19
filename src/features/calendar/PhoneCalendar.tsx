import { useState } from 'react';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Flame, Heart, Plus } from 'lucide-react';
import { dateFromKey, dateKey, dateLabel, type DateEvent, type EventKind } from '../../model';

export function PhoneCalendar({ events, month, selected, today, filter, onFilter, onMonth, onSelect, onDetail, onCreate }: { events: DateEvent[]; month: Date; selected: string; today: string; filter: EventKind | 'all'; onFilter: (filter: EventKind | 'all') => void; onMonth: (amount: number) => void; onSelect: (day: string) => void; onDetail: (event: DateEvent) => void; onCreate: () => void }) {
  const [expanded, setExpanded] = useState(false), [dayOnly, setDayOnly] = useState(false), [showAll, setShowAll] = useState(false);
  const monthEvents = events.filter(event => event.date.startsWith(dateKey(month).slice(0, 7)));
  const filtered = monthEvents.filter(event => filter === 'all' || event.kind === filter);
  const list = filtered.filter(event => !dayOnly || event.date === selected).sort((a, b) => {
    const rank = (event: DateEvent) => event.date === selected ? 0 : event.date >= today ? 1 : 2;
    return rank(a) - rank(b) || (a.date < today && b.date < today ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)) || a.time.localeCompare(b.time);
  });
  const start = expanded ? new Date(month) : dateFromKey(selected);
  start.setDate(expanded ? 1 - (start.getDay() + 6) % 7 : start.getDate() - (start.getDay() + 6) % 7);
  const count = expanded ? Math.ceil(((month.getDay() + 6) % 7 + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 : 7;
  const days = Array.from({ length: count }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); return day; });
  return <section className="phone-calendar">
    <div className="phone-calendar-top"><div className="month-controls"><button className="icon-button" aria-label="Предыдущий месяц" onClick={() => { onMonth(-1); setDayOnly(false); }}><ChevronLeft size={20} /></button><h2>{month.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '')}</h2><button className="icon-button" aria-label="Следующий месяц" onClick={() => { onMonth(1); setDayOnly(false); }}><ChevronRight size={20} /></button></div><button className="phone-month-toggle" aria-pressed={expanded} onClick={() => setExpanded(!expanded)}><CalendarDays size={18} />{expanded ? 'Неделя' : 'Месяц'}</button></div>
    <div className="phone-week" aria-label={expanded ? 'Месяц' : 'Неделя'}>{days.map(day => {
      const key = dateKey(day), daily = filtered.filter(event => event.date === key);
      return <button key={key} aria-label={dateLabel(key, { weekday: 'long', day: 'numeric', month: 'long' })} aria-pressed={selected === key} className={`phone-day ${key === selected ? 'chosen' : ''} ${day.getMonth() !== month.getMonth() ? 'outside' : ''} ${key === today ? 'today' : ''}`} onClick={() => { onSelect(key); setDayOnly(true); setShowAll(false); }}><span>{day.toLocaleDateString('ru-RU', { weekday: 'short' })}</span><strong>{day.getDate()}</strong><i>{daily.some(event => event.kind === 'date') && <b className="date-dot" />}{daily.some(event => event.kind === 'intimacy') && <b className="intimacy-dot" />}</i></button>;
    })}</div>
    <div className="phone-calendar-tools"><div className="calendar-filters" role="group" aria-label="Фильтр календаря">{([{ key: 'all', label: 'Все встречи' }, { key: 'date', label: 'Свидания' }, { key: 'intimacy', label: 'Секс' }] as const).map(item => <button key={item.key} aria-label={item.label} aria-pressed={filter === item.key} className={filter === item.key ? 'active' : ''} onClick={() => { onFilter(item.key); setShowAll(false); }}><span className={`category-dot ${item.key}`} />{item.key === 'all' ? 'Все' : item.label}<span className="filter-count">{monthEvents.filter(event => item.key === 'all' || event.kind === item.key).length}</span></button>)}</div><button className="today-button" onClick={() => { onSelect(today); setDayOnly(true); }}>Сегодня</button></div>
    <div className="phone-list-heading"><h3>{dayOnly ? dateLabel(selected, { day: 'numeric', month: 'long' }) : 'Ваши встречи'}</h3>{dayOnly && <button className="text-button" onClick={() => setDayOnly(false)}>Весь месяц</button>}</div>
    <div className={`phone-event-list ${showAll ? '' : 'collapsed'}`}>{list.map(event => <button key={event.id} aria-label={`${event.kind === 'intimacy' ? 'Секс' : 'Свидание'} · ${event.status === 'planned' ? 'Запланировано' : 'Состоялось'} · ${event.title}`} className={`calendar-event phone-event kind-${event.kind} ${event.status}`} onClick={() => onDetail(event)}><span className="phone-event-symbol">{event.kind === 'date' ? <Heart size={23} /> : <Flame size={23} />}</span><span className="phone-event-copy"><span className="event-kind-label">{event.kind === 'date' ? 'Свидание' : 'Секс'}<span>{event.status === 'completed' ? <Check size={15} /> : <Clock3 size={15} />}{event.status === 'completed' ? 'Состоялось' : 'План'}</span></span><strong className="event-title">{event.title}</strong><span className="phone-event-date">{dateLabel(event.date)}{event.time && ` · ${event.time}`}</span></span><ChevronRight size={18} /></button>)}</div>
    {!list.length && <div className="phone-empty"><CalendarDays size={28} /><p>Здесь пока свободно</p><button className="button secondary" onClick={onCreate}><Plus size={18} />Добавить встречу</button></div>}
    {list.length > 4 && <button className="phone-show-all" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Свернуть список' : `Все встречи месяца · ${list.length}`}</button>}
  </section>;
}
