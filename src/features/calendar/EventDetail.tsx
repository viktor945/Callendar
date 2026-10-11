import { useEffect, useState } from 'react';
import { CalendarDays, Check, Clock3, Heart, LockKeyhole, MapPin, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { api } from '../../lib/api';
import { dateLabel, type DateEvent, type PersonalNote } from '../../model';

export function EventDetail({ event, demo, onClose, onEdit, onDelete, onComplete, onContinuation, demoNotes, events }: { event: DateEvent; demo: boolean; onClose: () => void; onEdit: () => void; onDelete: () => Promise<void>; onComplete: () => Promise<void>; onContinuation: () => void; demoNotes: { current: Record<string, PersonalNote> }; events: DateEvent[] }) {
  const [note, setNote] = useState('');
  const [rating, setRating] = useState<number | null>(null);
  const [loading, setLoading] = useState(!demo);
  const [noteReady, setNoteReady] = useState(demo);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const intimacy = event.kind === 'intimacy';
  const linked = events.find(old => old.id === event.linkedDateId);
  const children = events.filter(old => old.linkedDateId === event.id);
  useEffect(() => {
    let active = true;
    const apply = (data: PersonalNote) => { if (active) { setNote(data.note); setRating(data.rating); setNoteReady(true); } };
    if (demo) apply(demoNotes.current[event.id] || { note: '', rating: null });
    else api<PersonalNote>(`/events/${event.id}/private`).then(apply).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [event.id, demo, demoNotes]);
  async function perform(action: () => Promise<void>) { setBusy(true); setError(''); try { await action(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <Modal title={event.title} onClose={onClose} wide>
    <div className="detail-tags"><span className={`pill ${intimacy ? 'intimacy' : event.category}`}>{intimacy ? 'Интимная жизнь' : { date: 'Свидание', home: 'Дома вдвоём', adventure: 'Приключение' }[event.category]}</span><span className="pill neutral">{event.status === 'completed' ? 'Встреча состоялась' : 'Запланировано'}</span></div>
    <div className="detail-meta"><span><CalendarDays size={18} />{dateLabel(event.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>{event.time && <span><Clock3 size={18} />{event.time}</span>}{event.location && <span><MapPin size={18} />{event.location}</span>}</div>
    {event.tags.length > 0 && <div className="detail-tag-list">{event.tags.map(tag => <span className="pill intimacy" key={tag}>{tag}</span>)}</div>}
    {event.note && <p className="detail-note">{event.note}</p>}
    {linked && <p className="linked-date"><Heart size={15} />Продолжение свидания «{linked.title}»</p>}
    {children.length > 0 && <div className="linked-date"><Heart size={15} /><span>Отдельные встречи близости: {children.map(child => child.title).join(', ')}. Их статус меняется отдельно.</span></div>}
    {event.continuation && <div className="continuation-detail"><span className="eyebrow"><Heart size={14} /> А после свидания</span><h3>{event.continuation.title}</h3>{event.continuation.time && <p className="muted">{event.continuation.time} · время для близости</p>}{event.continuation.wishes && <p>{event.continuation.wishes}</p>}<span className="microcopy">Общие пожелания · видно обоим</span></div>}
    {!intimacy && <button className="button secondary continuation-create" onClick={onContinuation}>Запланировать близость отдельно<Heart size={16} /></button>}
    <div className="private-note"><div className="private-heading"><LockKeyhole size={18} /><h3>Только для меня</h3><span>Личное</span></div><p className="muted">Мои ощущения, желания и воспоминания. Партнёр не видит эту заметку{intimacy ? ' и личную оценку' : ''}.</p>
      {intimacy && event.status === 'completed' && <label>Как мне было?<select aria-label="Личная оценка" disabled={loading || busy || !noteReady} value={rating ?? ''} onChange={e => { setRating(e.target.value ? Number(e.target.value) : null); setSaved(false); }}><option value="">Без оценки</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5{value === 5 ? ' — замечательно' : ''}</option>)}</select></label>}
      <textarea aria-label="Личная заметка" rows={3} maxLength={4000} value={note} disabled={loading || busy || !noteReady} placeholder={loading ? 'Загружаем личную заметку…' : 'Что я хочу запомнить?'} onChange={e => { setNote(e.target.value); setSaved(false); }} />
      <button className="text-button" disabled={loading || busy || !noteReady} onClick={() => perform(async () => { const data = { note, ...(intimacy && event.status === 'completed' ? { rating } : {}) }; if (demo) demoNotes.current[event.id] = { note, rating }; else await api(`/events/${event.id}/private`, 'PUT', data); setSaved(true); })}>{saved ? <><Check size={15} /> Сохранено{demo ? ' в демо' : ''}</> : 'Сохранить личную заметку'}</button>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
    {confirmDelete ? <div className="delete-confirm"><p>Удалить встречу и её личные заметки у обоих партнёров?{children.length > 0 && ' Связанные встречи близости сохранятся как самостоятельные записи.'}</p><button className="button danger" disabled={busy} onClick={() => perform(onDelete)}>Удалить</button><button className="button secondary" onClick={() => setConfirmDelete(false)}>Оставить</button></div> : <div className="modal-actions detail-actions"><button className="icon-button delete-button" aria-label="Удалить встречу" onClick={() => setConfirmDelete(true)}><Trash2 size={18} /></button><button className="button secondary" disabled={busy} onClick={onEdit}>Изменить</button>{event.status === 'planned' && <button className="button primary" disabled={busy} onClick={() => perform(onComplete)}><Check size={16} />Встреча состоялась</button>}</div>}
  </Modal>;
}
