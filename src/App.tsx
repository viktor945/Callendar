import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Bell, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, Copy, Flame, Heart, History, Home, Lightbulb, Link2, LockKeyhole, MapPin, Mountain, Plus, Sparkles, Users, Wifi, WifiOff, X } from 'lucide-react';
import { api, staticPreview } from './lib/api';
import { Modal } from './components/Modal';
import { RelationshipPicker } from './components/RelationshipPicker';
import { EventForm } from './features/calendar/EventForm';
import { EventDetail } from './features/calendar/EventDetail';
import { PairSettings } from './features/pair/PairSettings';
import { DeviceSettings } from './features/pair/DeviceSettings';
import { DatesHub } from './features/dates/DatesHub';
import type { Invitation } from './features/dates/types';
import { IntimacyDashboard } from './features/intimacy/IntimacyDashboard';
import { dateKey, dateFromKey, dateLabel, defaultProfile, type Category, type DateEvent, type Session, type PairProfile, type PersonalNote, type EventKind } from './model';


type Page = 'calendar' | 'intimacy' | 'ideas' | 'history';
const categories = { date: { label: 'Свидание', icon: Heart }, home: { label: 'Дома вдвоём', icon: Home }, adventure: { label: 'Приключение', icon: Mountain } };
const today = dateFromKey(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
const monthLabel = (date: Date) => date.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(' г.', '');
function demoEvents(): DateEvent[] {
  const offset = (days: number) => { const date = new Date(today); date.setDate(date.getDate() + days); return dateKey(date); };
  const dates = [
    { id: 'demo-1', title: 'Ужин в любимом месте', date: offset(2), time: '19:00', location: 'Наш любимый ресторан', category: 'date', note: 'Закажем тот самый десерт и поболтаем обо всём.', continuation: { title: 'Вечер только для нас', time: '21:30', wishes: 'Тёплый свет, музыка и никаких спешных планов.' }, status: 'planned', version: 1 },
    { id: 'demo-2', title: 'Кино, плед и мы', date: offset(5), time: '20:00', location: 'Дома', category: 'home', note: 'Фильм выбираем по очереди. В этот раз — ты!', continuation: null, status: 'planned', version: 1 },
    { id: 'demo-3', title: 'За город на весь день', date: offset(7), time: '11:00', location: 'Придумаем вместе', category: 'adventure', note: 'Возьмём термос и отправимся навстречу осени.', continuation: null, status: 'planned', version: 1 },
    { id: 'demo-4', title: 'Медленное утро', date: offset(13), time: '10:00', location: 'Дома', category: 'home', note: '', continuation: null, status: 'planned', version: 1 },
    { id: 'demo-5', title: 'Та самая прогулка', date: offset(-4), time: '18:00', location: 'Парк у набережной', category: 'adventure', note: 'Листья под ногами, горячий кофе и два часа разговоров.', continuation: null, status: 'completed', version: 1 },
  ];
  return [...dates.map(event => ({ ...event, kind: 'date' as const, status: event.status as DateEvent['status'], category: event.category as Category, tags: [], linkedDateId: null })), ...[-1, -5, -11, 3].map((days, i) => ({ id: `demo-intimacy-${i}`, version: 1, kind: 'intimacy' as const, title: ['Вечер для двоих', 'Наше медленное утро', 'Ближе друг к другу', 'Время только для нас'][i], date: offset(days), time: i === 3 ? '21:00' : '', location: 'Дома', category: 'home' as const, note: i === 3 ? 'Освободим вечер и выберем настроение вместе.' : '', status: (i === 3 ? 'planned' : 'completed') as DateEvent['status'], continuation: null, tags: [['Нежность и массаж', 'Привычный формат', 'Объятия', 'Свечи'][i]], linkedDateId: null }))];
}
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [demoDates, setDemoDates] = useState(demoEvents);
  const [demoInvitations, setDemoInvitations] = useState<Invitation[]>([]);
  const [page, setPage] = useState<Page>(new URLSearchParams(location.search).has('dateInvite') ? 'ideas' : 'calendar');
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(dateKey(today));
  const [filter, setFilter] = useState<EventKind | 'all'>('date');
  const [demoProfile, setDemoProfile] = useState<PairProfile>(defaultProfile);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [incomingInvitations, setIncomingInvitations] = useState(0);
  const [receivedFocus, setReceivedFocus] = useState(0);
  const knownInvitations = useRef<Set<string> | null>(null);
  const [newPairMode, setNewPairMode] = useState<PairProfile['relationshipMode']>('dating');
  const [newPairLabel, setNewPairLabel] = useState('');
  const [form, setForm] = useState<Partial<DateEvent> | null>(null);
  const [detail, setDetail] = useState<DateEvent | null>(null);
  const [pairModal, setPairModal] = useState(false);
  const [pairMode, setPairMode] = useState<'create' | 'join'>(location.hash.startsWith('#invite=') ? 'join' : 'create');
  const [inviteInput, setInviteInput] = useState(location.hash.startsWith('#invite=') ? location.hash.slice(8) : '');
  const [inviteLink, setInviteLink] = useState('');
  const [name, setName] = useState('');
  const [pairError, setPairError] = useState('');
  const [pairBusy, setPairBusy] = useState(false);
  const [connection, setConnection] = useState<'connecting' | 'live' | 'offline'>('connecting');
  const [toast, setToast] = useState('');
  const notes = useRef<Record<string, PersonalNote>>({});
  const demo = !session;
  const events = session?.events || demoDates;
  const profile = session?.profile || demoProfile;
  const coupleMode = profile.relationshipMode === 'couple';
  const defaultKind: EventKind = coupleMode || page === 'intimacy' ? 'intimacy' : 'date';
  const activeDetail = detail ? events.find(event => event.id === detail.id) : undefined;
  const partner = session?.members.find(member => member.id !== session.memberId);
  const me = session?.members.find(member => member.id === session.memberId);
  async function refresh() { const data = await api<Session | null>('/session'); setSession(data); if (data) setFilter(data.profile.relationshipMode === 'couple' ? 'intimacy' : 'date'); }
  async function load() { if (staticPreview) { setLoaded(true); return; } setLoadError(''); try { await refresh(); } catch (err) { setLoadError((err as Error).message || 'Не удалось подключиться к серверу.'); } finally { setLoaded(true); } }
  useEffect(() => { void load(); if (!staticPreview && location.hash.startsWith('#invite=')) setPairModal(true); }, []);
  useEffect(() => {
    if (!session?.memberId) return;
    const source = new EventSource('/api/stream');
    let active = true;
    const sync = () => { api<Session | null>('/session').then(data => { if (active) { setSession(data); setConnection('live'); } }).catch(() => { if (active) setConnection('offline'); }); };
    source.addEventListener('ready', sync);
    source.addEventListener('change', sync);
    source.onerror = () => setConnection('offline');
    const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; source.close(); document.removeEventListener('visibilitychange', onVisible); };
  }, [session?.memberId]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 4500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => {
    if (!session) { setIncomingInvitations(0); knownInvitations.current = null; return; }
    let active = true;
    api<{ id: string }[]>('/dates/inbox').then(items => {
      if (!active) return;
      const ids = new Set(items.map(item => item.id));
      if (knownInvitations.current && [...ids].some(id => !knownInvitations.current!.has(id))) setToast('Вам пришло приглашение на свидание. Откройте входящие.');
      knownInvitations.current = ids; setIncomingInvitations(ids.size);
    }).catch(() => { /* The next sync retries; the calendar stays available. */ });
    return () => { active = false; };
  }, [session]);
  useEffect(() => { if (session) setFilter(session.profile.relationshipMode === 'couple' ? 'intimacy' : 'date'); }, [session?.profile.relationshipMode]);
  const planned = events.filter(event => event.status === 'planned').sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const upcoming = planned.find(event => event.kind === 'date' && `${event.date}T${event.time}` >= `${dateKey(today)}T00:00`);
  const monthEvents = events.filter(event => event.date.startsWith(dateKey(month).slice(0, 7)) && (filter === 'all' || event.kind === filter));
  const selectedEvents = events.filter(event => event.date === selected && (filter === 'all' || event.kind === filter)).sort((a, b) => a.time.localeCompare(b.time));
  const completed = events.filter(event => event.status === 'completed' && (filter === 'all' || event.kind === filter)).sort((a, b) => b.date.localeCompare(a.date));
  const start = new Date(month); start.setDate(1 - (month.getDay() + 6) % 7);
  const cells = Array.from({ length: Math.ceil(((month.getDay() + 6) % 7 + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7) * 7 }, (_, i) => { const date = new Date(start); date.setDate(start.getDate() + i); return date; });
  function shiftMonth(amount: number) { const next = new Date(month.getFullYear(), month.getMonth() + amount, 1); setMonth(next); setSelected(dateKey(next)); }
  async function saveEvent(data: Omit<DateEvent, 'id' | 'version'>) {
    if (demo) {
      const event = { ...data, id: form?.id || `demo-${Date.now()}`, version: (form?.version || 0) + 1 };
      setDemoDates(previous => form?.id ? previous.map(old => old.id === event.id ? event : old) : [...previous, event]);
    } else {
      const saved = await api<DateEvent>(form?.id ? `/events/${form.id}` : '/events', form?.id ? 'PATCH' : 'POST', { ...data, version: form?.version });
      setSession(current => current && { ...current, events: [...current.events.filter(event => event.id !== saved.id), saved] });
    }
    setSelected(data.date); setMonth(new Date(dateFromKey(data.date).getFullYear(), dateFromKey(data.date).getMonth(), 1)); setForm(null); setFilter(data.kind); setPage('calendar'); setToast(demo ? 'Добавлено в демо. Изменения доступны в этой вкладке.' : 'Встреча сохранена в вашем общем календаре');
  }
  async function deleteEvent(event: DateEvent) {
    if (demo) { setDemoDates(previous => previous.filter(old => old.id !== event.id).map(old => old.linkedDateId === event.id ? { ...old, linkedDateId: null, version: old.version + 1 } : old)); delete notes.current[event.id]; setDemoInvitations(previous => previous.map(item => item.response?.eventId === event.id ? { ...item, response: { ...item.response, eventId: null } } : item)); }
    else { await api(`/events/${event.id}`, 'DELETE', { version: event.version }); await refresh(); }
    setDetail(null); setToast('Встреча удалена');
  }
  async function completeEvent(event: DateEvent) {
    if (demo) setDemoDates(previous => previous.map(old => old.id === event.id ? { ...old, status: 'completed', version: old.version + 1 } : old));
    else { const saved = await api<DateEvent>(`/events/${event.id}`, 'PATCH', { ...event, status: 'completed' }); setSession(current => current && { ...current, events: current.events.map(old => old.id === event.id ? saved : old) }); }
    setDetail(null); setToast('Этот момент теперь в вашей истории ♡');
  }
  async function invitePartner() {
    setPairError(''); setInviteLink(''); setPairModal(true);
    if (!session) return;
    if (partner) return;
    setPairBusy(true);
    try { const data = await api<{ invite: string }>('/invite', 'POST', {}); setInviteLink(`${location.origin}/#invite=${data.invite}`); } catch (err) { setPairError((err as Error).message); } finally { setPairBusy(false); }
  }
  async function connectPair(event: FormEvent) {
    event.preventDefault(); setPairBusy(true); setPairError('');
    try {
      const invite = inviteInput.includes('#invite=') ? inviteInput.split('#invite=')[1].trim() : inviteInput.trim();
      const data = await api<Session & { invite?: string }>(pairMode === 'create' ? '/pairs' : '/join', 'POST', { name, invite, relationshipMode: newPairMode, partnerLabel: newPairLabel });
      setSession(data); setDemoInvitations([]); setFilter(data.profile.relationshipMode === 'couple' ? 'intimacy' : 'date'); notes.current = {}; setDetail(null); setForm(null);
      history.replaceState(null, '', location.pathname + location.search);
      if (data.invite) setInviteLink(`${location.origin}/#invite=${data.invite}`);
      else { setPairModal(false); setToast('Вы подключены! Теперь это ваш общий календарь.'); }
    } catch (err) { setPairError((err as Error).message); } finally { setPairBusy(false); }
  }
  async function saveProfile(value: PairProfile) {
    if (demo) setDemoProfile({ ...value, version: profile.version + 1 });
    else { const saved = await api<PairProfile>('/pair/profile', 'PATCH', value); setSession(current => current && { ...current, profile: saved }); }
    setFilter(value.relationshipMode === 'couple' ? 'intimacy' : 'date'); setSettingsOpen(false); setToast('Формат обновлён. История встреч сохранена.');
  }
  function createContinuation(event: DateEvent) { setDetail(null); setForm({ kind: 'intimacy', date: event.date, time: event.continuation?.time || '21:00', title: event.continuation?.title || 'Вечер только для нас', note: event.continuation?.wishes || '', linkedDateId: event.id }); }
  async function copyInvite() { try { await navigator.clipboard.writeText(inviteLink); setToast('Ссылка скопирована. Отправьте её партнёру.'); } catch { setPairError('Выделите и скопируйте ссылку вручную.'); } }
  if (!loaded || loadError) return <div className="loading-screen"><div className="brand"><span className="brand-symbol"><Heart fill="currentColor" /></span>вдвоём<span className="brand-dot">.</span></div>{loadError ? <><p className="error">Не удалось подключиться к серверу.</p><button className="button primary" onClick={load}>Попробовать снова</button></> : <p>Готовим пространство для вас двоих…</p>}</div>;

  return <div className="app-shell">
    <aside className="sidebar"><a href="#" className="brand" onClick={e => { e.preventDefault(); setPage('calendar'); }}><span className="brand-symbol"><Heart size={22} fill="currentColor" /></span>вдвоём<span className="brand-dot">.</span></a><div className="space-label">ВАШЕ ОБЩЕЕ ПРОСТРАНСТВО</div>
      <nav aria-label="Основная навигация">{([{ id: 'calendar', title: 'Наш календарь', icon: CalendarDays }, { id: 'intimacy', title: 'Секс', icon: Flame }, { id: 'ideas', title: 'Идеи для свиданий', icon: Lightbulb }, { id: 'history', title: 'Наша история', icon: History }] as const).map(item => <button key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}><item.icon size={19} />{item.title}{page === item.id && <span className="nav-dot" />}</button>)}</nav>
      <div className="sidebar-note"><div className="note-doodle">✳︎</div><p>Самое важное —<br />время друг для друга.</p><span>Остальное подождёт.</span></div>
      <div className="sidebar-bottom"><LockKeyhole size={15} /><span>Пространство только для двоих</span></div>
    </aside>
    <div className="main-wrapper"><header className="topbar"><div className="breadcrumb">Наше пространство<span>/</span><strong>{page === 'calendar' ? 'Календарь' : page === 'intimacy' ? 'Секс' : page === 'ideas' ? 'Идеи' : 'История'}</strong></div><div className="topbar-right"><button className="icon-button device-settings-button" aria-label="Приложение и уведомления" title="Приложение и уведомления" onClick={() => setDeviceSettingsOpen(true)}><Bell size={18} /></button><span className={`connection ${demo ? 'demo' : connection}`} title={demo ? 'Примеры встреч. Создайте пару для сохранения и синхронизации.' : connection === 'live' ? 'Подключение к серверу активно' : 'Переподключаемся к серверу'}>{demo ? <span className="status-dot" /> : connection === 'offline' ? <WifiOff size={13} /> : <Wifi size={13} />}{demo ? 'Демо-режим' : connection === 'live' ? 'Синхронизировано' : connection === 'offline' ? 'Нет связи' : 'Подключаемся'}</span><div className="avatars" aria-label={demo ? 'Пример пары' : session.members.map(member => member.name).join(' и ')}><span className="avatar avatar-one">{demo ? 'А' : me?.name[0]?.toUpperCase()}</span><span className="avatar avatar-two">{demo ? 'М' : partner?.name[0]?.toUpperCase() || '+'}</span></div><button className="pair-button" onClick={invitePartner}>{staticPreview ? 'О демо' : demo ? 'Создать пару' : partner ? 'Наша пара' : 'Пригласить'}<ChevronRight size={15} /></button></div></header>
      <main><div className="page-heading"><div><div className="eyebrow"><span className="tiny-line" /> {page === 'calendar' ? 'БОЛЬШЕ ВРЕМЕНИ ВМЕСТЕ' : page === 'intimacy' ? 'БЛИЖЕ ДРУГ К ДРУГУ' : page === 'ideas' ? 'ЧТО-ТО НОВОЕ ДЛЯ ВАС' : 'МОМЕНТЫ, КОТОРЫЕ ОСТАЮТСЯ'}</div><h1>{page === 'calendar' ? 'Время для нас' : page === 'intimacy' ? 'Секс и наши желания' : page === 'ideas' ? 'Свидания с характером' : 'Наша история'}<span className="heading-spark">✳︎</span></h1><p>{page === 'calendar' ? (coupleMode ? 'Наш ритм, наши желания. И время для приятных свиданий.' : 'Планируйте свидания. Будьте ближе. Создавайте вашу историю.') : page === 'intimacy' ? 'Планы, состоявшиеся встречи и идеи, которые хочется обсудить.' : page === 'ideas' ? 'Выберите атмосферу. Создайте сценарий. Пригласите друг друга.' : 'Здесь живут ваши свидания, секс и личные воспоминания.'}</p></div>{page !== 'ideas' && <button className="button primary new-event" onClick={() => setForm({ kind: defaultKind })}><Plus size={18} />{defaultKind === 'intimacy' ? 'Запланировать секс' : 'Запланировать свидание'}</button>}</div>
      {incomingInvitations > 0 && <button className="incoming-banner" onClick={() => { setReceivedFocus(previous => previous + 1); setPage('ideas'); }}><Bell size={18} /><span>Входящие приглашения · {incomingInvitations}</span><ArrowRight size={17} /></button>}
      {demo && <div className="demo-banner"><span><Sparkles size={16} />{staticPreview ? 'Интерактивный просмотр: попробуйте планы, идеи и историю. Изменения только в этой вкладке.' : 'Познакомьтесь с вашим будущим календарём — сейчас здесь примеры.'}</span><button onClick={invitePartner}>{staticPreview ? 'Что можно попробовать' : 'Начать нашу историю'}<ArrowRight size={15} /></button></div>}
      <section className={`relationship-banner ${coupleMode ? 'couple' : ''}`}><div><span className="relationship-symbol">{coupleMode ? '♡' : '✦'}</span><div><strong>{coupleMode ? 'Мы пара / в браке' : 'Встречаемся'}{profile.partnerLabel ? ` · ${profile.partnerLabel}` : ''}</strong><p>{coupleMode ? 'В центре — секс, наши желания и ритм. Свидания добавляют приятные моменты.' : 'В центре — свидания. Секс можно планировать отдельно.'}</p></div></div><button className="text-button" onClick={() => setSettingsOpen(true)}>Изменить формат<ChevronRight size={15} /></button></section>
      {page === 'intimacy' && <IntimacyDashboard events={events} today={dateKey(today)} profile={profile} onCreate={setForm} onDetail={setDetail} onSettings={() => setSettingsOpen(true)} />}
      {page === 'calendar' && <div className="dashboard-grid"><section className="calendar-section"><div className="calendar-card"><div className="calendar-toolbar"><div className="month-controls"><h2>{monthLabel(month)}</h2><button className="icon-button" onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц"><ChevronLeft size={18} /></button><button className="icon-button" onClick={() => shiftMonth(1)} aria-label="Следующий месяц"><ChevronRight size={18} /></button></div><button className="today-button" onClick={() => { setMonth(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(dateKey(today)); }}>Сегодня</button></div><div className="calendar-filters" role="group" aria-label="Фильтр календаря">{([{ key: 'all', label: 'Все встречи' }, { key: 'date', label: 'Свидания' }, { key: 'intimacy', label: 'Секс' }] as const).map(item => <button key={item.key} className={filter === item.key ? 'selected' : ''} aria-pressed={filter === item.key} onClick={() => setFilter(item.key)}><span className={`category-dot ${item.key}`} />{item.label}<span className="filter-count">{events.filter(event => event.date.startsWith(dateKey(month).slice(0, 7)) && (item.key === 'all' || event.kind === item.key)).length}</span></button>)}</div>
        <div className="weekday-row">{['ПН', 'ВТ', 'СР', 'ЧТ', 'ПТ', 'СБ', 'ВС'].map(day => <span key={day}>{day}</span>)}</div><div className="calendar-grid">{cells.map(date => { const key = dateKey(date); const daily = monthEvents.filter(event => event.date === key); return <div key={key} className={`calendar-cell ${date.getMonth() !== month.getMonth() ? 'outside-month' : ''} ${key === selected ? 'selected-day' : ''}`}><button className={`day-number ${key === dateKey(today) ? 'is-today' : ''}`} aria-label={dateLabel(key, { weekday: 'long', day: 'numeric', month: 'long' })} aria-pressed={key === selected} onClick={() => setSelected(key)}>{date.getDate()}</button><div className="cell-events">{daily.slice(0, 2).map(event => <button key={event.id} aria-label={`${event.kind === 'intimacy' ? 'Секс' : 'Свидание'} · ${event.status === 'planned' ? 'Запланировано' : 'Состоялось'} · ${event.title}`} className={`calendar-event kind-${event.kind} ${event.kind === 'intimacy' ? 'intimacy' : event.category} ${event.status === 'completed' ? 'completed' : ''}`} onClick={() => setDetail(event)} title={`${event.time} ${event.title}`}><span className="event-kind-label">{event.kind === 'intimacy' ? <Flame size={11} /> : <Heart size={11} />}{event.kind === 'intimacy' ? 'Секс' : 'Свидание'}{event.status === 'completed' ? <Check size={10} /> : <Clock3 size={10} />}</span><span className="event-time">{event.time || (event.status === 'completed' ? 'Было' : '')}{event.continuation && <Heart size={10} />}</span><span className="event-title">{event.title}</span></button>)}{daily.length > 2 && <button className="more-events" onClick={() => setSelected(key)}>ещё {daily.length - 2}</button>}</div></div>; })}</div><div className="calendar-legend"><span><Heart size={12} /><i className="legend-swatch dates" />Свидания</span><span><Flame size={12} /><i className="legend-swatch intimacy" />Секс</span><span><Clock3 size={12} />План</span><span><Check size={12} />Состоялось</span></div></div>
        <div className="day-agenda"><div className="section-heading"><h3>{selected === dateKey(today) ? 'Сегодня' : dateLabel(selected, { day: 'numeric', month: 'long', weekday: 'short' })}<span>{selectedEvents.length ? `${selectedEvents.length} ${selectedEvents.length === 1 ? 'встреча' : 'встречи'}` : 'Свободный день'}</span></h3><button className="text-button" onClick={() => setForm({ date: selected, kind: defaultKind })}><Plus size={15} />Добавить</button></div>{selectedEvents.length ? selectedEvents.map(event => <button key={event.id} className="agenda-event" onClick={() => setDetail(event)}><span className={`agenda-icon kind-${event.kind} ${event.kind === 'intimacy' ? 'intimacy' : event.category}`}>{(() => { const Icon = event.kind === 'intimacy' ? Flame : categories[event.category].icon; return <Icon size={20} />; })()}</span><span className="agenda-title"><strong>{event.title}</strong><span>{event.kind === 'intimacy' ? `Секс · ${event.status === 'completed' ? 'состоялся' : 'план'}` : `Свидание · ${event.location || categories[event.category].label}`}{event.continuation ? ' · с продолжением' : ''}</span></span><span className="agenda-time">{event.time}</span><ChevronRight size={16} /></button>) : <div className="empty-day"><span>☁</span><p>Немного свободного времени для чего-то хорошего.<button onClick={() => setForm({ date: selected, kind: defaultKind })}>{defaultKind === 'intimacy' ? 'Запланируем время для секса?' : 'Может, запланируем свидание?'}</button></p></div>}</div></section>
        <aside className="right-column">{coupleMode && <IntimacyDashboard compact events={events} today={dateKey(today)} profile={profile} onCreate={setForm} onDetail={setDetail} onSettings={() => setSettingsOpen(true)} />}<section className="next-date-card"><div className="card-label"><span className="category-dot date" />БЛИЖАЙШЕЕ СВИДАНИЕ<span>♡</span></div>{upcoming ? <><div className="date-illustration" aria-hidden="true"><div className="art-orbit" /><span className="art-spark one">✦</span><span className="art-spark two">✳︎</span><div className="wine-glass left"><span /><i /></div><div className="wine-glass right"><span /><i /></div><span className="art-heart">♡</span></div><span className="upcoming-date">{dateLabel(upcoming.date, { weekday: 'short', day: 'numeric', month: 'long' })}</span><h3>{upcoming.title}</h3><div className="upcoming-meta"><span><Clock3 size={14} />{upcoming.time}</span>{upcoming.location && <span><MapPin size={14} />{upcoming.location}</span>}</div>{upcoming.continuation && <div className="continuation-tag"><Heart size={13} />И немного времени только для нас</div>}<button className="button card-button" onClick={() => setDetail(upcoming)}>Посмотреть план<ArrowRight size={16} /></button></> : <div className="no-upcoming"><Heart size={42} strokeWidth={1} /><h3>Самое время для свидания</h3><p>Найдите маленький повод побыть вместе.</p><button className="button card-button" onClick={() => setForm({ kind: 'date' })}>Создать первый план<Plus size={16} /></button></div>}</section>
        <section className="idea-teaser"><div className="card-label"><Lightbulb size={15} />СВИДАНИЕ ПО ВАШЕМУ СЦЕНАРИЮ<Sparkles size={16} /></div><div className="idea-emoji">💌<span>✧</span></div><h3>Сначала атмосфера</h3><p>10 настроений, ваши места и занятия. Приглашение, которое хочется принять.</p><button className="text-button" onClick={() => setPage('ideas')}>Выбрать атмосферу<ArrowRight size={15} /></button></section>
        <div className="little-reminder"><span>✳︎</span><p>Не обязательно придумывать<br />что-то особенное.<br /><strong>Вы уже есть друг у друга.</strong></p></div></aside></div>}
      {page === 'ideas' && <DatesHub receivedFocus={receivedFocus} session={session} demoInvitations={demoInvitations} setDemoInvitations={setDemoInvitations} onEvent={event => { if (demo) setDemoDates(previous => [...previous.filter(old => old.id !== event.id), event]); else setSession(current => current && { ...current, events: [...current.events.filter(old => old.id !== event.id), event] }); }} onCalendar={id => { const event = events.find(event => event.id === id); if (event) { setMonth(new Date(dateFromKey(event.date).getFullYear(), dateFromKey(event.date).getMonth(), 1)); setSelected(event.date); setFilter('date'); setDetail(event); setPage('calendar'); } }} />}
      {page === 'history' && <><div className="ideas-filter" role="group" aria-label="Фильтр истории">{([{ key: 'all', label: 'Все моменты' }, { key: 'date', label: 'Свидания' }, { key: 'intimacy', label: 'Секс' }] as const).map(item => <button key={item.key} className={filter === item.key ? 'selected' : ''} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div><div className="history-summary"><Heart size={25} /><div><strong>{completed.length} {completed.length === 1 ? 'сохранённый момент' : 'сохранённых моментов'}</strong><span>У каждой встречи есть своя история. Личные заметки — внутри.</span></div></div>{completed.length ? <div className="history-list">{completed.map(event => <button className="history-event" key={event.id} onClick={() => setDetail(event)}><span className={`history-symbol ${event.kind === 'intimacy' ? 'intimacy' : event.category}`}>{event.kind === 'intimacy' ? '♡' : event.category === 'date' ? '♡' : event.category === 'home' ? '☕' : '✳︎'}</span><span className="history-text"><span>{dateLabel(event.date)}</span><h3>{event.title}</h3><p>{event.note || event.location || 'Маленький момент вашей общей истории'}</p></span><span className="history-open">Вспомнить<ArrowRight size={17} /></span></button>)}</div> : <div className="empty-history"><Heart size={48} strokeWidth={1} /><h2>Ваша история только начинается</h2><p>После свидания нажмите «Встреча состоялась»,<br />и этот момент останется здесь.</p><button className="button primary" onClick={() => { setPage('calendar'); setForm({ kind: defaultKind }); }}>Запланировать свидание<Plus size={16} /></button></div>}</>}
      <footer className="main-footer"><button className="text-button" onClick={() => setDeviceSettingsOpen(true)}><Bell size={14} />На телефон и уведомления</button><span>вдвоём <Heart size={12} /></span></footer></main>
    </div>
    {form && <EventForm initial={form} defaultDate={selected} onClose={() => setForm(null)} onSave={saveEvent} demo={demo} events={events} />}
    {activeDetail && !form && <EventDetail key={activeDetail.id} event={activeDetail} demo={demo} demoNotes={notes} onClose={() => setDetail(null)} onEdit={() => { setForm(activeDetail); setDetail(null); }} onDelete={() => deleteEvent(activeDetail)} onComplete={() => completeEvent(activeDetail)} events={events} onContinuation={() => createContinuation(activeDetail)} />}
    {settingsOpen && <PairSettings profile={profile} demo={demo} onClose={() => setSettingsOpen(false)} onSave={saveProfile} />}
    {deviceSettingsOpen && <DeviceSettings demo={demo} onClose={() => setDeviceSettingsOpen(false)} />}
    {pairModal && <Modal title={staticPreview ? 'Предпросмотр «Вдвоём»' : session ? partner ? 'Ваше пространство для двоих' : 'Пригласите любимого человека' : 'Начнём вашу историю'} onClose={() => setPairModal(false)}><div className="pair-modal-art"><span className="pair-art-heart">♡</span><span>✦</span><Users size={40} strokeWidth={1.3} /><span>✧</span></div>{staticPreview ? <><p className="pair-intro">Посмотрите, как может выглядеть ваше пространство для двоих.</p><div className="pair-info"><Sparkles size={18} /><p>В этой вкладке можно выбирать формат отношений, добавлять свидания и отдельные записи секса, смотреть регулярность, пробовать идеи, личные заметки и оценки. После перезагрузки вернутся примеры. Подключение партнёра и синхронизация доступны в серверной версии.</p></div><button className="button primary full-width" onClick={() => setPairModal(false)}>Попробовать календарь<ArrowRight size={17} /></button></> : session ? partner ? <><p className="pair-intro"><strong>{me?.name} и {partner.name}</strong><br />Один календарь. Ваши встречи и общие планы.</p><div className="pair-info"><Wifi size={18} /><p>Планы синхронизируются между вашими браузерами. Личные заметки доступны только их автору.</p></div><button className="button primary full-width" onClick={() => setPairModal(false)}>Вернуться к нашим планам</button></> : <><p className="pair-intro">Отправьте эту ссылку партнёру.<br />После подключения у вас будет один календарь.</p>{inviteLink ? <><label>Ваша ссылка-приглашение<div className="invite-input"><input value={inviteLink} readOnly onFocus={e => e.target.select()} aria-label="Ссылка-приглашение" /><button className="icon-button" aria-label="Скопировать приглашение" onClick={copyInvite}><Copy size={18} /></button></div></label><button className="button primary full-width" onClick={copyInvite}><Link2 size={17} />Скопировать ссылку</button><p className="microcopy invite-warning">Ссылка действует 7 дней и только для одного партнёра. Отправляйте её лично: она даёт доступ к общим планам. Вход сохраняется в этом браузере.</p></> : <p className="muted">{pairBusy ? 'Создаём приглашение…' : 'Не удалось получить ссылку.'}</p>}</> : <form onSubmit={connectPair}><p className="pair-intro">Один календарь для двух людей.<br />И чуть больше времени друг для друга.</p><div className="pair-tabs"><button type="button" className={pairMode === 'create' ? 'active' : ''} onClick={() => setPairMode('create')}>Создать нашу пару</button><button type="button" className={pairMode === 'join' ? 'active' : ''} onClick={() => setPairMode('join')}>У меня приглашение</button></div><label>Как вас зовут?<input required maxLength={40} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} /></label>{pairMode === 'create' && <><p className="field-label">Кого приглашаем в календарь?</p><RelationshipPicker value={newPairMode} onChange={setNewPairMode} /><label>Название отношений <span className="optional">необязательно</span><input maxLength={40} placeholder="Например, девушка или жена" value={newPairLabel} onChange={e => setNewPairLabel(e.target.value)} /></label><p className="microcopy">После подключения общие записи будут видны партнёру. Личные заметки и оценки останутся только у автора.</p></>}{pairMode === 'join' && <label>Приглашение от партнёра<input required maxLength={300} placeholder="Вставьте ссылку-приглашение" value={inviteInput} onChange={e => setInviteInput(e.target.value)} /></label>}<p className="microcopy">{pairMode === 'create' ? 'Начнём с чистого календаря. Примеры из демо переноситься не будут.' : 'Планы партнёра появятся после подключения.'}</p><button className="button primary full-width" disabled={pairBusy}>{pairBusy ? 'Подключаем…' : pairMode === 'create' ? 'Создать общий календарь' : 'Присоединиться'}<ArrowRight size={17} /></button></form>}{pairError && <p className="error" role="alert">{pairError}</p>}</Modal>}
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button aria-label="Закрыть уведомление" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}
