import { useState } from 'react';
import { ArrowLeft, Eye, Plus, Save, Send, Trash2 } from 'lucide-react';
import { nodeTypes, validateScenario, type Scenario, type ScenarioNode, type NodeType } from './scenario';
import { newNode } from './presets';
import { ScenarioPlayer } from './ScenarioPlayer';
import { ThemeShell } from './ThemeShell';
import type { Invitation } from './types';

export function ScenarioEditor({ initial, invitation, onClose, onSave }: { initial: Scenario; invitation?: Invitation; onClose: () => void; onSave: (scenario: Scenario, invitation: Invitation | undefined, publish: boolean) => Promise<Invitation> }) {
  const [scenario, setScenario] = useState<Scenario>(structuredClone(initial));
  const [selectedId, setSelectedId] = useState(initial.start);
  const [current, setCurrent] = useState(invitation);
  const [preview, setPreview] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState('');
  const node = scenario.nodes.find(n => n.id === selectedId) || scenario.nodes[0];
  function change(next: Scenario) { setScenario(next); setSaved(''); setError(''); }
  function update(patch: Partial<ScenarioNode>) { change({ ...scenario, nodes: scenario.nodes.map(n => n.id === node.id ? { ...n, ...patch } : n) }); }
  function append(optionId?: string) {
    if (scenario.nodes.length >= 100) { setError('В сценарии может быть до 100 страниц.'); return; }
    const added = newNode();
    let nodes: ScenarioNode[];
    if (optionId) {
      const option = node.options.find(option => option.id === optionId)!; added.next = option.next || node.next;
      nodes = scenario.nodes.map(n => n.id === node.id ? { ...n, options: n.options.map(o => o.id === optionId ? { ...o, next: added.id } : o) } : n);
    } else if (node.type === 'accept') {
      added.next = node.id;
      nodes = scenario.nodes.map(n => ({ ...n, next: n.next === node.id ? added.id : n.next, options: n.options.map(o => o.next === node.id ? { ...o, next: added.id } : o) }));
    } else { added.next = node.next; nodes = scenario.nodes.map(n => n.id === node.id ? { ...n, next: added.id } : n); }
    const index = nodes.findIndex(n => n.id === node.id);
    nodes.splice(node.type === 'accept' && !optionId ? index : index + 1, 0, added);
    change({ ...scenario, start: scenario.start === node.id && node.type === 'accept' ? added.id : scenario.start, nodes }); setSelectedId(added.id);
  }
  function remove() {
    if (node.type === 'accept' && scenario.nodes.filter(n => n.type === 'accept').length < 2) { setError('Сценарию нужен финальный экран принятия.'); return; }
    if (node.type === 'single' && new Set(node.options.map(o => o.next || node.next)).size > 1) { setError('У этой страницы несколько веток. Сначала задайте общий следующий шаг для её вариантов.'); return; }
    const replacement = node.type === 'single' ? node.options[0]?.next || node.next : node.next;
    const nodes = scenario.nodes.filter(n => n.id !== node.id).map(n => ({ ...n, next: n.next === node.id ? replacement : n.next, options: n.options.map(o => o.next === node.id ? { ...o, next: replacement || undefined } : o) }));
    if (!nodes.length) return;
    change({ ...scenario, start: scenario.start === node.id ? replacement || nodes[0].id : scenario.start, nodes }); setSelectedId(nodes[0].id);
  }
  async function save(publish: boolean) {
    setBusy(true); setError('');
    try { validateScenario(scenario, publish); const result = await onSave(scenario, current, publish); setCurrent(result); if (result.publicationError) throw new Error(`Черновик сохранён. ${result.publicationError}`); setSaved(publish ? 'Приглашение отправлено партнёру' : 'Черновик сохранён'); if (publish) onClose(); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  function showPreview() { try { validateScenario(scenario); setPreview(true); } catch (err) { setError((err as Error).message); } }
  if (preview) return <ScenarioPlayer key="preview" scenario={scenario} preview onClose={() => setPreview(false)} onSubmit={async () => {}} />;
  const targets = scenario.nodes.filter(n => n.id !== node.id);
  return <section className="scenario-editor"><div className="dates-toolbar"><button className="text-button" onClick={onClose}><ArrowLeft size={16} />К атмосферам</button><div className="editor-toolbar-actions"><button className="button secondary" onClick={showPreview}><Eye size={16} />Предпросмотр</button><button className="button secondary" disabled={busy} onClick={() => save(false)}><Save size={16} />Сохранить черновик</button><button className="button primary" disabled={busy} onClick={() => save(true)}><Send size={16} />Отправить приглашение</button></div></div>
    {error && <p className="error" role="alert">{error}</p>}{saved && <p className="dates-saved" role="status">{saved}</p>}
    <div className="editor-layout"><aside className="scenario-pages"><label>Название свидания<input maxLength={100} value={scenario.title} onChange={e => change({ ...scenario, title: e.target.value })} /></label><h3>Страницы сценария <span>{scenario.nodes.length}</span></h3><p>Переходы определяют путь партнёра.</p><div className="scenario-page-list">{scenario.nodes.map((n, i) => <button key={n.id} className={node.id === n.id ? 'selected' : ''} onClick={() => setSelectedId(n.id)}><span>{String(i + 1).padStart(2, '0')}</span><div><strong>{n.title || 'Без названия'}</strong><small>{nodeTypes[n.type]}{scenario.start === n.id ? ' · начало' : ''}</small></div></button>)}</div></aside>
      <div className="page-editor"><div className="page-editor-head"><h3>Настройте страницу</h3><button className="icon-button" aria-label="Удалить страницу" onClick={remove}><Trash2 size={17} /></button></div>
        <label>Тип страницы<select value={node.type} onChange={e => { const type = e.target.value as NodeType; update({ type, options: ['single', 'multiple'].includes(type) ? node.options.length ? node.options.map(o => ({ ...o, next: type === 'multiple' ? undefined : o.next })) : [{ id: crypto.randomUUID(), label: 'Первый вариант' }] : [], ...(type === 'datetime' ? { dateMode: 'choose', fixedDate: '', fixedTime: '19:30' } : {}), next: type === 'accept' ? null : node.next }); }}>{Object.entries(nodeTypes).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
        <label>Заголовок страницы<input maxLength={160} value={node.title} onChange={e => update({ title: e.target.value })} /></label><label>Текст страницы<textarea rows={3} maxLength={3000} value={node.body} onChange={e => update({ body: e.target.value })} /></label><label>Текст кнопки<input maxLength={80} value={node.button} onChange={e => update({ button: e.target.value })} /></label>
        {['single', 'multiple'].includes(node.type) && <div className="options-editor"><h4>Варианты{node.type === 'single' ? ' и ветки' : ' · можно выбрать несколько'}</h4>{node.options.map((option, index) => <div className="option-editor" key={option.id}><label>Вариант {index + 1}<input maxLength={120} value={option.label} onChange={e => update({ options: node.options.map(o => o.id === option.id ? { ...o, label: e.target.value } : o) })} /></label>{node.type === 'single' && <><label>Следующая страница для варианта {index + 1}<select value={option.next || ''} onChange={e => update({ options: node.options.map(o => o.id === option.id ? { ...o, next: e.target.value || undefined } : o) })}><option value="">Общий следующий шаг</option>{targets.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}</select></label><button className="text-button" onClick={() => append(option.id)}><Plus size={14} />Добавить этап этой ветки</button></>}<button className="icon-button" aria-label={`Удалить вариант ${index + 1}`} onClick={() => update({ options: node.options.filter(o => o.id !== option.id) })}><Trash2 size={15} /></button></div>)}<button className="text-button" disabled={node.options.length >= 20} onClick={() => update({ options: [...node.options, { id: crypto.randomUUID(), label: 'Новый вариант' }] })}><Plus size={15} />Добавить вариант</button></div>}
        {node.type === 'datetime' && <><label>Кто выбирает дату?<select value={node.dateMode || 'choose'} onChange={e => update({ dateMode: e.target.value as 'choose' | 'fixed' })}><option value="choose">Партнёр</option><option value="fixed">Я укажу заранее</option></select></label>{node.dateMode === 'fixed' && <div className="form-row"><label>Дата<input type="date" value={node.fixedDate || ''} onChange={e => update({ fixedDate: e.target.value })} /></label><label>Время<input type="time" value={node.fixedTime || ''} onChange={e => update({ fixedTime: e.target.value })} /></label></div>}</>}
        {['text', 'multiple'].includes(node.type) && <label className="editor-checkbox"><input type="checkbox" checked={node.required} onChange={e => update({ required: e.target.checked })} />Обязательный ответ</label>}
        {node.type !== 'accept' && <label>Общий следующий шаг<select value={node.next || ''} onChange={e => update({ next: e.target.value || null })}><option value="">Не задан</option>{targets.map(n => <option key={n.id} value={n.id}>{n.title}</option>)}</select></label>}
        {node.type !== 'single' && <button className="button secondary" onClick={() => append()}><Plus size={16} />{node.type === 'accept' ? 'Добавить страницу перед финалом' : 'Добавить страницу после этой'}</button>}
        <button className="text-button start-page" onClick={() => change({ ...scenario, start: node.id })}>Начинать приглашение с этой страницы</button>
      </div>
      <div className="editor-mini-preview"><ThemeShell small theme={scenario.theme}><span className="stage-eyebrow">Оформление страницы</span><h2>{node.title}</h2><p>{node.body}</p>{node.options.map(o => <span className="mini-preview-option" key={o.id}>{o.label}</span>)}</ThemeShell><p className="microcopy">Эта атмосфера сохраняется на всём пути, включая добавленные страницы.</p></div>
    </div>
  </section>;
}
