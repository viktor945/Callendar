import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, Bell, CalendarDays, Check, ChevronRight, Copy, Flame, Heart, History, Lightbulb, Link2, Plus, Settings2, Sparkles, Users, Wifi, WifiOff, X } from 'lucide-react';
import { api, staticPreview } from './lib/api';
import { Modal } from './components/Modal';
import { RelationshipPicker } from './components/RelationshipPicker';
import { EventForm } from './features/calendar/EventForm';
import { PhoneCalendar } from './features/calendar/PhoneCalendar';
import { EventDetail } from './features/calendar/EventDetail';
import { PairSettings } from './features/pair/PairSettings';
import { DeviceSettings } from './features/pair/DeviceSettings';
import { DatesHub } from './features/dates/DatesHub';
import type { Invitation } from './features/dates/types';
import { IntimacyDashboard } from './features/intimacy/IntimacyDashboard';
import { dateKey, dateFromKey, dateLabel, defaultProfile, type Category, type DateEvent, type Session, type PairProfile, type PersonalNote, type EventKind } from './model';


type Page = 'calendar' | 'intimacy' | 'ideas' | 'history';
const today = dateFromKey(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
function demoEvents(): DateEvent[] {
  const offset = (days: number) => { const date = new Date(today); date.setDate(date.getDate() + days); return dateKey(date); };
  const dates = [
    { id: 'demo-1', title: 'Ужин в любимом месте', date: offset(2), time: '19:00', location: 'Наш любимый ресторан', category: 'date', note: 'Закажем тот самый десерт и поболтаем обо всём.', continuation: { title: 'Вечер только для нас', time: '21:30', wishes: 'Тёплый свет, музыка и никаких спешных планов.' }, status: 'planned', version: 1 },
    { id: 'demo-2', title: 'Кино, плед и мы', date: offset(5), time: '20:00', location: 'Дома', category: 'home', note: 'Фильм выбираем по очереди. В этот раз — ты!', continuation: null, status: 'planned', version: 1 },
    { id: 'demo-3', title: 'За город на весь день', date: offset(7), time: '11:00', location: 'Придумаем вместе', category: 'adventure', note: 'Возьмём термос и отправимся навстречу осени.', continuation: null, status: 'planned', version: 1 },
    { id: 'demo-4', title: 'Медленное утро', date: offset(13), time: '10:00', location: 'Дома', category: 'home', note: '', continuation: null, status: 'planned', version: 1 },
    { id: 'demo-5', title: 'Та самая прогулка', date: offset(-4), time: '18:00', location: 'Парк у набережной', category: 'adventure', note: 'Листья под ногами, горячий кофе и два часа разговоров.', continuation: null, status: 'completed', version: 1 },
  ];
  return [...dates.map(event => ({ ...event, kind: 'date' as const, status: event.status as DateEvent['status'], category: event.category as Category, tags: [], linkedDateId: null })), ...[-1, -5, -11, 2].map((days, i) => ({ id: `demo-intimacy-${i}`, version: 1, kind: 'intimacy' as const, title: ['Вечер для двоих', 'Наше медленное утро', 'Ближе друг к другу', 'Время только для нас'][i], date: offset(days), time: i === 3 ? '21:00' : '', location: 'Дома', category: 'home' as const, note: i === 3 ? 'Освободим вечер и выберем настроение вместе.' : '', status: (i === 3 ? 'planned' : 'completed') as DateEvent['status'], continuation: null, tags: [['Нежность и массаж', 'Привычный формат', 'Объятия', 'Свечи'][i]], linkedDateId: null }))];
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
  const [quickAdd, setQuickAdd] = useState(false);
  const [focusedFlow, setFocusedFlow] = useState(false);
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
  useEffect(() => { window.scrollTo({ top: 0 }); }, [page]);
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
  const completed = events.filter(event => event.status === 'completed' && (filter === 'all' || event.kind === filter)).sort((a, b) => b.date.localeCompare(a.date));
  const factsFrom = new Date(today); factsFrom.setDate(factsFrom.getDate() - 27);
  const factsCount = events.filter(event => event.kind === 'intimacy' && event.status === 'completed' && event.date >= dateKey(factsFrom) && event.date <= dateKey(today)).length;
  function chooseDay(day: string) { setSelected(day); const date = dateFromKey(day); setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }
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

  return <div className={`app-shell phone-app page-${page} ${focusedFlow ? 'flow-focused' : ''}`}>
    <nav className="bottom-nav" aria-label="Основная навигация">{([{ id: 'calendar', label: 'Календарь', title: 'Наш календарь', icon: CalendarDays }, { id: 'intimacy', label: '18+', title: '18+', icon: Flame }, { id: 'add', label: 'Добавить', title: 'Добавить запись', icon: Plus }, { id: 'ideas', label: 'Свидания', title: 'Идеи для свиданий', icon: Lightbulb }, { id: 'history', label: 'История', title: 'Наша история', icon: History }] as const).map(item => <button key={item.id} aria-label={item.title} aria-current={page === item.id ? 'page' : undefined} className={`phone-nav-item ${item.id === 'add' ? 'phone-add' : ''} ${page === item.id ? 'active' : ''}`} onClick={() => { if (item.id === 'add') setQuickAdd(true); else { setPage(item.id); window.scrollTo({ top: 0 }); } }}><item.icon size={23} /><span>{item.label}</span>{item.id === 'ideas' && incomingInvitations > 0 && <i>{incomingInvitations}</i>}</button>)}</nav>
    <div className="main-wrapper"><header className="topbar"><button className="phone-brand" aria-label="На главный экран" onClick={() => { setPage('calendar'); window.scrollTo({ top: 0 }); }}><Heart size={23} fill="currentColor" />вдвоём<span>·</span></button><div className="topbar-right"><button className="icon-button" aria-label="Изменить формат" title="Настройки пары" onClick={() => setSettingsOpen(true)}><Settings2 size={21} /></button><button className="icon-button device-settings-button" aria-label="Приложение и уведомления" title="Приложение и уведомления" onClick={() => setDeviceSettingsOpen(true)}><Bell size={18} /></button><span className={`connection ${demo ? 'demo' : connection}`} title={demo ? 'Примеры встреч. Создайте пару для сохранения и синхронизации.' : connection === 'live' ? 'Подключение к серверу активно' : 'Переподключаемся к серверу'}>{demo ? <span className="status-dot" /> : connection === 'offline' ? <WifiOff size={13} /> : <Wifi size={13} />}{demo ? 'Демо-режим' : connection === 'live' ? 'Синхронизировано' : connection === 'offline' ? 'Нет связи' : 'Подключаемся'}</span><div className="avatars" aria-label={demo ? 'Пример пары' : session.members.map(member => member.name).join(' и ')}><span className="avatar avatar-one">{demo ? 'А' : me?.name[0]?.toUpperCase()}</span><span className="avatar avatar-two">{demo ? 'М' : partner?.name[0]?.toUpperCase() || '+'}</span></div><button className="pair-button" onClick={invitePartner}>{staticPreview ? 'О демо' : demo ? 'Создать пару' : partner ? 'Наша пара' : 'Пригласить'}<ChevronRight size={15} /></button></div></header>
      <main><div className="page-heading"><div><div className="eyebrow"><span className="tiny-line" /> {page === 'calendar' ? 'БОЛЬШЕ ВРЕМЕНИ ВМЕСТЕ' : page === 'intimacy' ? 'БЛИЖЕ ДРУГ К ДРУГУ' : page === 'ideas' ? 'ЧТО-ТО НОВОЕ ДЛЯ ВАС' : 'МОМЕНТЫ, КОТОРЫЕ ОСТАЮТСЯ'}</div><h1>{page === 'calendar' ? 'Время для нас' : page === 'intimacy' ? 'Секс и наши желания' : page === 'ideas' ? 'Свидания с характером' : 'Наша история'}<span className="heading-spark">✳︎</span></h1><p>{page === 'calendar' ? (coupleMode ? 'Наш ритм, наши желания. И время для приятных свиданий.' : 'Свидания и время друг для друга.') : page === 'intimacy' ? 'Планы, состоявшиеся встречи и идеи, которые хочется обсудить.' : page === 'ideas' ? 'Выберите атмосферу. Создайте сценарий. Пригласите друг друга.' : 'Здесь живут ваши свидания, секс и личные воспоминания.'}</p></div>{page !== 'ideas' && page !== 'calendar' && <button className="button primary new-event" onClick={() => setForm({ kind: defaultKind })}><Plus size={18} />{defaultKind === 'intimacy' ? 'Запланировать секс' : 'Запланировать свидание'}</button>}</div>
      {incomingInvitations > 0 && <button className="incoming-banner" onClick={() => { setReceivedFocus(previous => previous + 1); setPage('ideas'); }}><Bell size={18} /><span>Входящие приглашения · {incomingInvitations}</span><ArrowRight size={17} /></button>}
      {demo && <div className="demo-banner"><span><Sparkles size={16} />{staticPreview ? 'Демо · изменения только в этой вкладке.' : 'Демо · примеры встреч для вашей пары.'}</span><button onClick={invitePartner}>{staticPreview ? 'Что можно попробовать' : 'Начать нашу историю'}<ArrowRight size={15} /></button></div>}
      <section className={`relationship-banner ${coupleMode ? 'couple' : ''}`}><div><span className="relationship-symbol">{coupleMode ? '♡' : '✦'}</span><div><strong>{coupleMode ? 'Мы пара / в браке' : 'Встречаемся'}{profile.partnerLabel ? ` · ${profile.partnerLabel}` : ''}</strong><p>{coupleMode ? 'В центре — секс, наши желания и ритм. Свидания добавляют приятные моменты.' : 'В центре — свидания. Секс можно планировать отдельно.'}</p></div></div><button className="text-button" aria-label="Открыть настройки отношений" onClick={() => setSettingsOpen(true)}>Формат<ChevronRight size={15} /></button></section>
      {page === 'intimacy' && <IntimacyDashboard events={events} today={dateKey(today)} profile={profile} onCreate={setForm} onDetail={setDetail} onSettings={() => setSettingsOpen(true)} />}
      {page === 'calendar' && <>
        <div className="home-quick-actions" aria-label="Быстрые действия"><button aria-label="Запланировать свидание" className="quick-date" onClick={() => setForm({ kind: 'date', date: selected })}><Heart size={22} /><span>Свидание</span></button><button aria-label="Запланировать секс" className="quick-intimacy" onClick={() => setForm({ kind: 'intimacy', date: selected })}><Flame size={22} /><span>План 18+</span></button><button className="quick-fact" onClick={() => setForm({ kind: 'intimacy', status: 'completed', date: dateKey(today), time: '' })}><Check size={22} /><span>Добавить факт</span></button></div>
        {coupleMode && <div className="phone-rhythm"><span><strong data-testid="intimacy-facts">{factsCount}</strong> встреч за 28 дней</span><button className="frequency-setting" onClick={() => setSettingsOpen(true)}>{profile.weeklyGoal ? `${profile.weeklyGoal} в неделю` : 'Наш ритм'}<ChevronRight size={16} /></button></div>}
        <PhoneCalendar events={events} month={month} selected={selected} today={dateKey(today)} filter={filter} onFilter={setFilter} onMonth={shiftMonth} onSelect={chooseDay} onDetail={setDetail} onCreate={() => setQuickAdd(true)} />
      </>}
      {page === 'ideas' && <DatesHub onFocusChange={setFocusedFlow} receivedFocus={receivedFocus} session={session} demoInvitations={demoInvitations} setDemoInvitations={setDemoInvitations} onEvent={event => { if (demo) setDemoDates(previous => [...previous.filter(old => old.id !== event.id), event]); else setSession(current => current && { ...current, events: [...current.events.filter(old => old.id !== event.id), event] }); }} onCalendar={id => { const event = events.find(event => event.id === id); if (event) { setMonth(new Date(dateFromKey(event.date).getFullYear(), dateFromKey(event.date).getMonth(), 1)); setSelected(event.date); setFilter('date'); setDetail(event); setPage('calendar'); } }} />}
      {page === 'history' && <><div className="ideas-filter" role="group" aria-label="Фильтр истории">{([{ key: 'all', label: 'Все моменты' }, { key: 'date', label: 'Свидания' }, { key: 'intimacy', label: 'Секс' }] as const).map(item => <button key={item.key} className={filter === item.key ? 'selected' : ''} onClick={() => setFilter(item.key)}>{item.label}</button>)}</div><div className="history-summary"><Heart size={25} /><div><strong>{completed.length} {completed.length === 1 ? 'сохранённый момент' : 'сохранённых моментов'}</strong><span>У каждой встречи есть своя история. Личные заметки — внутри.</span></div></div>{completed.length ? <div className="history-list">{completed.map(event => <button className="history-event" key={event.id} onClick={() => setDetail(event)}><span className={`history-symbol ${event.kind === 'intimacy' ? 'intimacy' : event.category}`}>{event.kind === 'intimacy' ? '♡' : event.category === 'date' ? '♡' : event.category === 'home' ? '☕' : '✳︎'}</span><span className="history-text"><span>{dateLabel(event.date)}</span><h3>{event.title}</h3><p>{event.note || event.location || 'Маленький момент вашей общей истории'}</p></span><span className="history-open">Вспомнить<ArrowRight size={17} /></span></button>)}</div> : <div className="empty-history"><Heart size={48} strokeWidth={1} /><h2>Ваша история только начинается</h2><p>После свидания нажмите «Встреча состоялась»,<br />и этот момент останется здесь.</p><button className="button primary" onClick={() => { setPage('calendar'); setForm({ kind: defaultKind }); }}>Запланировать свидание<Plus size={16} /></button></div>}</>}
      <footer className="main-footer"><button className="text-button" onClick={() => setDeviceSettingsOpen(true)}><Bell size={14} />На телефон и уведомления</button><span>вдвоём <Heart size={12} /></span></footer></main>
    </div>
    {form && <EventForm initial={form} defaultDate={selected} onClose={() => setForm(null)} onSave={saveEvent} demo={demo} events={events} />}
    {activeDetail && !form && <EventDetail key={activeDetail.id} event={activeDetail} demo={demo} demoNotes={notes} onClose={() => setDetail(null)} onEdit={() => { setForm(activeDetail); setDetail(null); }} onDelete={() => deleteEvent(activeDetail)} onComplete={() => completeEvent(activeDetail)} events={events} onContinuation={() => createContinuation(activeDetail)} />}
    {settingsOpen && <PairSettings profile={profile} demo={demo} onClose={() => setSettingsOpen(false)} onSave={saveProfile} />}
    {quickAdd && <Modal title="Что добавим?" onClose={() => setQuickAdd(false)}><div className="quick-add-menu"><button onClick={() => { setQuickAdd(false); setForm({ kind: 'date', date: selected }); }}><Heart size={25} /><span><strong>Свидание</strong><small>Добавить общий план</small></span><ChevronRight size={20} /></button><button onClick={() => { setQuickAdd(false); setForm({ kind: 'intimacy', date: selected }); }}><Flame size={25} /><span><strong>Запланировать секс</strong><small>Дата и тип, остальные детали по желанию</small></span><ChevronRight size={20} /></button><button onClick={() => { setQuickAdd(false); setForm({ kind: 'intimacy', status: 'completed', date: dateKey(today), time: '' }); }}><Check size={25} /><span><strong>Добавить факт</strong><small>Отметить состоявшуюся встречу</small></span><ChevronRight size={20} /></button><button onClick={() => { setQuickAdd(false); setPage('ideas'); window.scrollTo({ top: 0 }); }}><Lightbulb size={25} /><span><strong>Создать приглашение</strong><small>Выбрать атмосферу и сценарий</small></span><ChevronRight size={20} /></button></div></Modal>}
    {deviceSettingsOpen && <DeviceSettings events={events} demo={demo} onClose={() => setDeviceSettingsOpen(false)} />}
    {pairModal && <Modal title={staticPreview ? 'Предпросмотр «Вдвоём»' : session ? partner ? 'Ваше пространство для двоих' : 'Пригласите любимого человека' : 'Начнём вашу историю'} onClose={() => setPairModal(false)}><div className="pair-modal-art"><span className="pair-art-heart">♡</span><span>✦</span><Users size={40} strokeWidth={1.3} /><span>✧</span></div>{staticPreview ? <><p className="pair-intro">Посмотрите, как может выглядеть ваше пространство для двоих.</p><div className="pair-info"><Sparkles size={18} /><p>В этой вкладке можно выбирать формат отношений, добавлять свидания и отдельные записи секса, смотреть регулярность, пробовать идеи, личные заметки и оценки. После перезагрузки вернутся примеры. Подключение партнёра и синхронизация доступны в серверной версии.</p></div><button className="button primary full-width" onClick={() => setPairModal(false)}>Попробовать календарь<ArrowRight size={17} /></button></> : session ? partner ? <><p className="pair-intro"><strong>{me?.name} и {partner.name}</strong><br />Один календарь. Ваши встречи и общие планы.</p><div className="pair-info"><Wifi size={18} /><p>Планы синхронизируются между вашими браузерами. Личные заметки доступны только их автору.</p></div><button className="button primary full-width" onClick={() => setPairModal(false)}>Вернуться к нашим планам</button></> : <><p className="pair-intro">Отправьте эту ссылку партнёру.<br />После подключения у вас будет один календарь.</p>{inviteLink ? <><label>Ваша ссылка-приглашение<div className="invite-input"><input value={inviteLink} readOnly onFocus={e => e.target.select()} aria-label="Ссылка-приглашение" /><button className="icon-button" aria-label="Скопировать приглашение" onClick={copyInvite}><Copy size={18} /></button></div></label><button className="button primary full-width" onClick={copyInvite}><Link2 size={17} />Скопировать ссылку</button><p className="microcopy invite-warning">Ссылка действует 7 дней и только для одного партнёра. Отправляйте её лично: она даёт доступ к общим планам. Вход сохраняется в этом браузере.</p></> : <p className="muted">{pairBusy ? 'Создаём приглашение…' : 'Не удалось получить ссылку.'}</p>}</> : <form onSubmit={connectPair}><p className="pair-intro">Один календарь для двух людей.<br />И чуть больше времени друг для друга.</p><div className="pair-tabs"><button type="button" className={pairMode === 'create' ? 'active' : ''} onClick={() => setPairMode('create')}>Создать нашу пару</button><button type="button" className={pairMode === 'join' ? 'active' : ''} onClick={() => setPairMode('join')}>У меня приглашение</button></div><label>Как вас зовут?<input required maxLength={40} placeholder="Ваше имя" value={name} onChange={e => setName(e.target.value)} /></label>{pairMode === 'create' && <><p className="field-label">Кого приглашаем в календарь?</p><RelationshipPicker value={newPairMode} onChange={setNewPairMode} /><label>Название отношений <span className="optional">необязательно</span><input maxLength={40} placeholder="Например, девушка или жена" value={newPairLabel} onChange={e => setNewPairLabel(e.target.value)} /></label><p className="microcopy">После подключения общие записи будут видны партнёру. Личные заметки и оценки останутся только у автора.</p></>}{pairMode === 'join' && <label>Приглашение от партнёра<input required maxLength={300} placeholder="Вставьте ссылку-приглашение" value={inviteInput} onChange={e => setInviteInput(e.target.value)} /></label>}<p className="microcopy">{pairMode === 'create' ? 'Начнём с чистого календаря. Примеры из демо переноситься не будут.' : 'Планы партнёра появятся после подключения.'}</p><button className="button primary full-width" disabled={pairBusy}>{pairBusy ? 'Подключаем…' : pairMode === 'create' ? 'Создать общий календарь' : 'Присоединиться'}<ArrowRight size={17} /></button></form>}{pairError && <p className="error" role="alert">{pairError}</p>}</Modal>}
    {toast && <div className="toast" role="status"><Check size={18} /><span>{toast}</span><button aria-label="Закрыть уведомление" onClick={() => setToast('')}><X size={16} /></button></div>}
  </div>;
}
