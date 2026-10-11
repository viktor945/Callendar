import { useState, type FormEvent } from 'react';
import { Modal } from '../../components/Modal';
import { RelationshipPicker } from '../../components/RelationshipPicker';
import type { PairProfile } from '../../model';

export function PairSettings({ profile, demo, onClose, onSave }: { profile: PairProfile; demo: boolean; onClose: () => void; onSave: (profile: PairProfile) => Promise<void> }) {
  const [form, setForm] = useState(profile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(''); try { await onSave(form); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  return <Modal title="Наш формат отношений" onClose={onClose} wide><form onSubmit={submit}>
    <p className="form-intro">Выберите, чему хочется уделить больше внимания. Свидания и интимный календарь доступны в обоих форматах.</p>
    <RelationshipPicker value={form.relationshipMode} onChange={relationshipMode => setForm({ ...form, relationshipMode })} />
    <label>Как называем отношения? <span className="optional">необязательно</span><input maxLength={40} placeholder="Например, девушка, жена или своё название" value={form.partnerLabel} onChange={e => setForm({ ...form, partnerLabel: e.target.value })} /></label>
    <label>Желаемая частота близости<select value={form.weeklyGoal ?? ''} onChange={e => setForm({ ...form, weeklyGoal: e.target.value ? Number(e.target.value) : null })}><option value="">Без цели — просто наблюдать историю</option>{Array.from({ length: 14 }, (_, i) => i + 1).map(value => <option value={value} key={value}>{value} в неделю</option>)}</select></label>
    <p className="microcopy">Это ваше общее пожелание, которое можно изменить. {demo ? 'В демо выбор действует в этой вкладке.' : 'Настройки увидят оба партнёра.'} История встреч сохранится.</p>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="modal-actions"><button className="button secondary" type="button" onClick={onClose}>Отмена</button><button className="button primary" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить формат'}</button></div>
  </form></Modal>;
}
