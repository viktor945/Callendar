import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Send } from 'lucide-react';
import { ThemeShell } from './ThemeShell';
import { resolveAnswers, answerText, type Answers, type Answer, type Scenario, type ScenarioResponse } from './scenario';
import { dateKey } from '../../model';

export function ScenarioPlayer({ scenario, initialAnswers = {}, preview = false, onClose, onProgress, onSubmit }: { scenario: Scenario; initialAnswers?: Answers; preview?: boolean; onClose: () => void; onProgress?: (answers: Answers) => Promise<void>; onSubmit: (response: ScenarioResponse) => Promise<void> }) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);
  const [draft, setDraft] = useState<{ id: string; value: Answer } | null>(null);
  const initial = resolveAnswers(scenario, initialAnswers, false);
  const [position, setPosition] = useState(Math.max(0, initial.path.length - 1));
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [done, setDone] = useState(false);
  const path = resolveAnswers(scenario, answers, false).path;
  const currentId = path[Math.min(position, path.length - 1)];
  const node = scenario.nodes.find(n => n.id === currentId)!;
  const current = answers[node.id];
  const value: Answer = draft?.id === node.id ? draft.value : current ?? (node.type === 'multiple' ? [] : node.type === 'datetime' ? { date: node.dateMode === 'fixed' ? node.fixedDate || '' : dateKey(new Date()), time: node.dateMode === 'fixed' ? node.fixedTime || '19:30' : '19:30' } : node.type === 'text' ? '' : true);
  function change(value: Answer) {
    // Revisiting a choice discards all subsequent answers before following its new branch.
    setDraft({ id: node.id, value }); setError('');
  }
  async function next() {
    setBusy(true); setError('');
    try {
      const kept = Object.fromEntries(path.slice(0, position).map(id => [id, answers[id]]));
      const updated = { ...kept, [node.id]: value };
      const result = resolveAnswers(scenario, updated, node.type === 'accept');
      if (node.type === 'accept') { await onSubmit(result); setDone(true); }
      else { await onProgress?.(result.answers); setAnswers(result.answers); setDraft(null); setPosition(position + 1); }
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <section className="scenario-player"><div className="dates-toolbar"><button className="text-button" onClick={onClose}><ArrowLeft size={16} />{preview ? 'Вернуться в редактор' : 'К приглашениям'}</button><span className="muted">{preview ? 'Предпросмотр · ответ не отправляется' : 'Ваше приглашение'}</span></div>
    <ThemeShell theme={scenario.theme}>
      {done ? <div className="recipient-stage recipient-done"><Check size={38} /><span className="stage-eyebrow">{preview ? 'Предпросмотр завершён' : 'Свидание принято'}</span><h2>{scenario.title}</h2><p>{preview ? 'Так партнёр увидит ваше приглашение.' : 'Ответ сохранён. Свидание добавлено в общий календарь.'}</p><button className="stage-action" onClick={onClose}>Вернуться к приглашениям<ArrowRight size={17} /></button></div> : <div className={`recipient-stage node-${node.type}`}>
        <span className="stage-eyebrow">{node.type === 'intro' ? 'Тебе приглашение' : node.type === 'accept' ? 'Последний штрих' : `Шаг ${position + 1}`}</span><h2>{node.title}</h2>{node.body && <p className="stage-body">{node.body}</p>}
        {['single', 'multiple'].includes(node.type) && <div className={`stage-options ${node.type === 'multiple' ? 'multiple' : ''}`}>{node.options.map((option, index) => { const selected = node.type === 'single' ? value === option.id : Array.isArray(value) && value.includes(option.id); return <button key={option.id} aria-pressed={selected} className={selected ? 'selected' : ''} onClick={() => change(node.type === 'single' ? option.id : Array.isArray(value) ? value.includes(option.id) ? value.filter(id => id !== option.id) : [...value, option.id] : [option.id])}><span className="option-number">{String(index + 1).padStart(2, '0')}</span><span>{option.label}</span>{selected && <Check size={17} />}</button>; })}</div>}
        {node.type === 'datetime' && typeof value === 'object' && !Array.isArray(value) && <div className="stage-date"><label>Дата<input type="date" disabled={node.dateMode === 'fixed'} value={value.date} onChange={e => change({ ...value, date: e.target.value })} /></label><label>Время<input type="time" disabled={node.dateMode === 'fixed'} value={value.time} onChange={e => change({ ...value, time: e.target.value })} /></label>{node.dateMode === 'fixed' && <span>Дата и время уже выбраны автором.</span>}</div>}
        {node.type === 'text' && <label className="stage-text-label">Ваш ответ{!node.required && ' · необязательно'}<textarea rows={3} maxLength={2000} value={typeof value === 'string' ? value : ''} onChange={e => change(e.target.value)} /></label>}
        {node.type === 'accept' && <div className="stage-summary">{path.slice(0, position).map(id => { const n = scenario.nodes.find(n => n.id === id)!; return ['single', 'multiple', 'datetime', 'text'].includes(n.type) && answers[id] !== '' ? <div key={id}><span>{n.title}</span><strong>{answerText(n, answers[id])}</strong></div> : null; })}</div>}
        {error && <p className="stage-error" role="alert">{error}</p>}
        <div className="stage-actions">{position > 0 && <button className="stage-back" disabled={busy} onClick={() => { setPosition(position - 1); setDraft(null); setError(''); }}><ArrowLeft size={16} />Назад</button>}<button className="stage-action" disabled={busy || (node.type === 'single' && typeof value !== 'string') || (node.type === 'multiple' && node.required && Array.isArray(value) && !value.length)} onClick={next}>{busy ? 'Сохраняем…' : node.button || (node.type === 'accept' ? 'Принять приглашение' : 'Продолжить')}{node.type === 'accept' ? <Send size={16} /> : <ArrowRight size={16} />}</button></div>
      </div>}
    </ThemeShell>
  </section>;
}
