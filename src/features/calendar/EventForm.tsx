import { useState, type FormEvent } from 'react';
import { Heart, Home, Mountain, Sparkles, Plus, X } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { type DateEvent } from '../../model';
import { SexCatalog } from '../intimacy/SexCatalog';
import { catalogTags } from '../intimacy/catalog';

type Draft = Omit<DateEvent, 'id' | 'version'>;
export function EventForm({ initial, defaultDate, onSave, onClose, demo, events }: { initial?: Partial<DateEvent>; defaultDate: string; onSave: (event: Draft) => Promise<void>; onClose: () => void; demo: boolean; events: DateEvent[] }) {
  const [form, setForm] = useState<Draft>({ title: initial?.title ?? '', date: initial?.date || defaultDate, time: initial?.time ?? (initial?.status === 'completed' ? '' : '19:00'), location: initial?.location || '', category: initial?.category || 'date', note: initial?.note || '', status: initial?.status || 'planned', kind: initial?.kind || 'date', tags: initial?.tags || [], positions: initial?.positions || [], linkedDateId: initial?.linkedDateId || null, continuation: initial?.continuation || null });
  const [intimate, setIntimate] = useState(!!initial?.continuation);
  const [continuation, setContinuation] = useState(initial?.continuation || { title: 'Время для секса', time: '', wishes: '' });
  const [customTag, setCustomTag] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const intimacy = form.kind === 'intimacy';
  const field = <K extends keyof Draft>(key: K, value: Draft[K]) => setForm(previous => ({ ...previous, [key]: value }));
  const toggleTag = (tag: string) => { if (!form.tags.includes(tag) && form.tags.length >= 24) { setError('Можно выбрать до 24 вариантов. Уберите один, чтобы добавить другой.'); return false; } setError(''); field('tags', form.tags.includes(tag) ? form.tags.filter(old => old !== tag) : [...form.tags, tag]); return true; };
  const togglePosition = (value: string) => { const positions = form.positions || []; if (!positions.includes(value) && positions.length >= 20) { setError('Можно добавить до 20 поз.'); return false; } field('positions', positions.includes(value) ? positions.filter(old => old !== value) : [...positions, value]); setError(''); return true; };
  const ownVariants = [...new Set(events.flatMap(event => event.tags))].filter(tag => !catalogTags.includes(tag));
  const ownPositions = [...new Set(events.flatMap(event => event.positions || []))];
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const tags = intimacy ? [...new Set([...form.tags, ...(customTag.trim() ? [customTag.trim()] : [])])] : [];
      const positions = intimacy ? [...new Set([...(form.positions || []), ...(position.trim() ? [position.trim()] : [])])] : [];
      if (tags.length > 24) throw new Error('Выберите до 24 вариантов.');
      if (positions.length > 20) throw new Error('Можно добавить до 20 поз.');
      await onSave({ ...form, tags, positions, linkedDateId: intimacy ? form.linkedDateId : null, continuation: !intimacy && intimate ? continuation : null });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <Modal title={initial?.id ? 'Изменить встречу' : intimacy ? 'Время для секса' : 'Запланируем время вдвоём'} onClose={onClose} wide><form onSubmit={submit}>
    <p className="form-intro">{demo ? 'Вы в демо. Эти изменения не сохранятся после перезагрузки.' : 'Общая запись появится у вас обоих.'}</p>
    <div className="event-kind-picker" role="group" aria-label="Тип встречи"><button type="button" aria-pressed={!intimacy} className={!intimacy ? 'chosen' : ''} onClick={() => field('kind', 'date')}><Heart size={17} />Свидание</button><button type="button" aria-pressed={intimacy} className={intimacy ? 'chosen' : ''} onClick={() => field('kind', 'intimacy')}><Sparkles size={17} />Секс</button></div>
    <label>Название<input required maxLength={100} placeholder={intimacy ? 'Например, вечер только для нас' : 'Например, ужин без повода'} value={form.title} onChange={e => field('title', e.target.value)} autoFocus /></label>
    <label>Статус<select value={form.status} onChange={e => field('status', e.target.value as Draft['status'])}><option value="planned">Запланировано</option><option value="completed">Встреча состоялась</option></select></label>
    <div className="form-row"><label>Дата<input required type="date" value={form.date} onChange={e => field('date', e.target.value)} /></label><label>Время {intimacy && form.status === 'completed' && <span className="optional">необязательно</span>}<input required={!intimacy || form.status === 'planned'} type="time" value={form.time} onChange={e => field('time', e.target.value)} /></label></div>
    {!intimacy && <div className="field-group"><span className="field-label">Формат</span><div className="category-picker">{([{ key: 'date', title: 'Свидание', icon: Heart }, { key: 'home', title: 'Дома вдвоём', icon: Home }, { key: 'adventure', title: 'Приключение', icon: Mountain }] as const).map(item => <button type="button" key={item.key} className={form.category === item.key ? `chosen ${item.key}` : ''} onClick={() => field('category', item.key)}><item.icon size={16} />{item.title}</button>)}</div></div>}
    {intimacy && <>
      <div className="field-group"><span className="field-label">Настроения и варианты <span className="optional">видно обоим · до 24</span></span><SexCatalog compact selected={form.tags} onToggle={toggleTag} />
        {form.tags.length > 0 && <div className="selected-options" aria-label="Выбранные варианты">{form.tags.map(tag => <button type="button" key={tag} onClick={() => toggleTag(tag)}>{tag}<X size={13} /></button>)}</div>}
      </div>
      {ownVariants.length > 0 && <div className="field-group"><span className="field-label">Ваши собственные варианты</span><div className="tag-picker">{ownVariants.map(tag => <button type="button" key={tag} aria-pressed={form.tags.includes(tag)} className={form.tags.includes(tag) ? 'chosen' : ''} onClick={() => toggleTag(tag)}>{tag}</button>)}</div></div>}
      <div className="field-group"><label htmlFor="custom-variant">Свой вариант <span className="optional">необязательно</span></label><div className="custom-option-input"><input id="custom-variant" aria-label="Свой вариант" maxLength={40} placeholder="Название вашей идеи" value={customTag} onChange={e => setCustomTag(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (customTag.trim() && (form.tags.includes(customTag.trim()) || toggleTag(customTag.trim()))) setCustomTag(''); } }} /><button type="button" aria-label="Добавить свой вариант" disabled={!customTag.trim()} onClick={() => { if (form.tags.includes(customTag.trim()) || toggleTag(customTag.trim())) setCustomTag(''); }}><Plus size={18} /></button></div></div>
      <details className="positions-options"><summary>Позы <span>необязательно · свои названия</span></summary><p className="microcopy">Можно оставить пустым. Названия в плане видны обоим; сохранённые варианты можно выбрать в следующей встрече.</p><div className="field-group"><label htmlFor="custom-position">Название позы</label><div className="custom-option-input"><input id="custom-position" maxLength={80} placeholder="Своё название или условное обозначение" value={position} onChange={e => setPosition(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); if (position.trim() && (form.positions?.includes(position.trim()) || togglePosition(position.trim()))) setPosition(''); } }} /><button type="button" aria-label="Добавить позу" disabled={!position.trim()} onClick={() => { if (form.positions?.includes(position.trim()) || togglePosition(position.trim())) setPosition(''); }}><Plus size={18} /></button></div></div>
        <div className="tag-picker">{ownPositions.filter(value => !form.positions?.includes(value)).map(value => <button type="button" key={value} onClick={() => togglePosition(value)}>{value}<Plus size={13} /></button>)}</div>
        <div className="selected-options" aria-label="Выбранные позы">{form.positions?.map(value => <button type="button" key={value} onClick={() => togglePosition(value)}>{value}<X size={13} /></button>)}</div>
      </details>
      <label>Связать со свиданием <span className="optional">необязательно</span><select value={form.linkedDateId || ''} onChange={e => field('linkedDateId', e.target.value || null)}><option value="">Самостоятельная встреча</option>{events.filter(event => event.kind === 'date' && event.id !== initial?.id).map(event => <option key={event.id} value={event.id}>{event.date} · {event.title}</option>)}</select></label>
    </>}
    <label>Место <span className="optional">необязательно</span><input maxLength={200} placeholder={intimacy ? 'Например, дома' : 'Где встретимся?'} value={form.location} onChange={e => field('location', e.target.value)} /></label>
    <label>Общая заметка <span className="optional">видно обоим</span><textarea maxLength={2000} rows={2} placeholder="Что хочется сделать вместе?" value={form.note} onChange={e => field('note', e.target.value)} /></label>
    {!intimacy && <div className={`intimacy-option ${intimate ? 'enabled' : ''}`}><label className="toggle-label"><span><Heart size={18} /><span>А после свидания…<small>Необязательный план интимного продолжения</small></span></span><input type="checkbox" checked={intimate} onChange={e => setIntimate(e.target.checked)} /><span className="switch" aria-hidden="true" /></label>
      {intimate && <div className="continuation-fields"><div className="form-row"><label>Как назовём?<input required maxLength={100} value={continuation.title} onChange={e => setContinuation({ ...continuation, title: e.target.value })} /></label><label>Время<input type="time" value={continuation.time} onChange={e => setContinuation({ ...continuation, time: e.target.value })} /></label></div><label>Общие пожелания <span className="optional">видно обоим</span><textarea maxLength={2000} rows={2} value={continuation.wishes} onChange={e => setContinuation({ ...continuation, wishes: e.target.value })} /></label><p className="microcopy">Продолжение пока описано в плане свидания. В карточке можно отдельно запланировать секс.</p></div>}
    </div>}
    {intimacy && <p className="microcopy">{form.status === 'completed' ? 'Запись сразу видна обоим. Личные ощущения можно сохранить отдельно.' : 'Обсудите пожелания вместе. План можно изменить в любой момент.'}</p>}
    {error && <p className="error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Отмена</button><button className="button primary" disabled={busy}>{busy ? 'Сохраняем…' : initial?.id ? 'Сохранить изменения' : intimacy ? form.status === 'completed' ? 'Добавить факт секса' : 'Добавить план секса' : 'Добавить свидание'}<Heart size={16} /></button></div>
  </form></Modal>;
}
