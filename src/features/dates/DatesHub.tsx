import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { ArrowRight, Copy, Eye, Pencil, Plus, Search, Send } from 'lucide-react';
import { api } from '../../lib/api';
import { inviteTemplates } from './templates';
import { ThemeShell } from './ThemeShell';
import { createPreset } from './presets';
import { ScenarioEditor } from './ScenarioEditor';
import { ScenarioPlayer } from './ScenarioPlayer';
import { ResponseSummary } from './ResponseSummary';
import { answerText, type Answers, type Scenario, type ScenarioResponse } from './scenario';
import type { Invitation } from './types';
import type { DateEvent, Session } from '../../model';

export function DatesHub({ session, onEvent, onCalendar, demoInvitations, setDemoInvitations, receivedFocus = 0, onFocusChange }: { session: Session | null; onEvent: (event: DateEvent) => void; onCalendar: (id: string) => void; demoInvitations: Invitation[]; setDemoInvitations: Dispatch<SetStateAction<Invitation[]>>; receivedFocus?: number; onFocusChange?: (focused: boolean) => void }) {
  const demo = !session;
  const [tab, setTab] = useState<'themes' | 'created' | 'received'>('themes');
  const [serverItems, setServerItems] = useState<Invitation[]>([]);
  const items = demo ? demoInvitations : serverItems;
  const setItems = demo ? setDemoInvitations : setServerItems;
  const [demoMember, setDemoMember] = useState('demo-a');
  const memberId = session?.memberId || demoMember;
  const [editor, setEditor] = useState<{ scenario: Scenario; invitation?: Invitation } | null>(null);
  const [player, setPlayer] = useState<{ invitation: Invitation; preview: boolean } | null>(null);
  const [ready, setReady] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => { onFocusChange?.(!!editor || !!player); if (editor || player) requestAnimationFrame(() => window.scrollTo({ top: 0 })); return () => onFocusChange?.(false); }, [!!editor, !!player, onFocusChange]);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [loading, setLoading] = useState(!demo);
  useEffect(() => { if (receivedFocus) { setTab('received'); setEditor(null); setPlayer(null); } }, [receivedFocus]);
  useEffect(() => {
    if (demo) return;
    let active = true;
    api<Invitation[]>('/dates/invitations').then(data => { if (active) { setItems(data); setError(''); } }).catch(err => { if (active) setError(err.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [session, demo]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get('dateInvite');
    if (!id || !items.length) return;
    const found = items.find(item => item.id === id && item.authorId !== memberId && item.status === 'published');
    if (found) { setPlayer({ invitation: found, preview: false }); setTab('received'); history.replaceState(null, '', location.pathname + location.hash); }
  }, [items, memberId]);
  function update(invitation: Invitation) { setItems(previous => [invitation, ...previous.filter(item => item.id !== invitation.id)]); }
  async function save(scenario: Scenario, invitation: Invitation | undefined, publish: boolean): Promise<Invitation> {
    let saved: Invitation;
    if (demo) {
      saved = { id: invitation?.id || crypto.randomUUID(), authorId: memberId, status: invitation?.status || 'draft', version: (invitation?.version || 0) + 1, scenario: structuredClone(scenario), publishedId: invitation?.publishedId || null, publishedScenario: invitation?.publishedScenario || null, response: null, run: invitation?.run || null };
      if (publish) { saved.status = 'published'; saved.publishedId = crypto.randomUUID(); saved.publishedScenario = structuredClone(scenario); }
    } else {
      saved = await api<Invitation>(invitation ? `/dates/invitations/${invitation.id}` : '/dates/invitations', invitation ? 'PATCH' : 'POST', { scenario, version: invitation?.version });
      update(saved); // A publication failure still leaves the saved draft recoverable.
      if (publish) {
        try { saved = await api<Invitation>(`/dates/invitations/${saved.id}/publish`, 'POST', { version: saved.version }); }
        catch (err) { return { ...saved, publicationError: (err as Error).message }; }
      }
    }
    update(saved); if (publish) { setTab('created'); setNotice(demo ? 'Приглашение готово. Переключитесь на роль партнёра и пройдите его.' : 'Приглашение появилось у партнёра в этом разделе.'); }
    return saved;
  }
  async function progress(item: Invitation, answers: Answers) {
    const versionId = item.run?.versionId || item.publishedId!;
    if (demo) {
      const run = { versionId, scenario: item.run?.scenario || item.publishedScenario!, answers };
      setItems(previous => previous.map(old => old.id === item.id ? { ...old, run } : old));
    } else await api(`/dates/invitations/${item.id}/progress`, 'PUT', { versionId, answers });
  }
  async function respond(item: Invitation, response: ScenarioResponse) {
    if (demo) {
      const scenario = item.run?.scenario || item.publishedScenario!;
      const place = scenario.nodes.find(node => node.purpose === 'place' && response.path.includes(node.id));
      const event: DateEvent = { id: crypto.randomUUID(), version: 1, kind: 'date', title: scenario.title, date: response.date, time: response.time, category: ['adrenaline', 'nature'].includes(scenario.theme) ? 'adventure' : ['cozy-home', 'retro'].includes(scenario.theme) ? 'home' : 'date', location: place ? answerText(place, response.answers[place.id]) : '', note: response.path.map(id => scenario.nodes.find(n => n.id === id)!).filter(n => ['single', 'multiple', 'text'].includes(n.type)).map(n => `${n.title}: ${answerText(n, response.answers[n.id])}`).join('\n').slice(0, 2000), status: 'planned', tags: [], continuation: null, linkedDateId: null };
      update({ ...item, status: 'answered', version: item.version + 1, response: { ...response, scenario, versionId: item.run?.versionId || item.publishedId!, eventId: event.id } }); onEvent(event);
    } else {
      const result = await api<{ invitation: Invitation; event: DateEvent | null }>(`/dates/invitations/${item.id}/respond`, 'POST', { versionId: item.run?.versionId || item.publishedId, answers: response.answers });
      update(result.invitation); if (result.event) onEvent(result.event);
    }
  }
  async function copy(item: Invitation) {
    try { await navigator.clipboard.writeText(`${location.origin}/?dateInvite=${item.id}`); setNotice('Ссылка скопирована. Приглашение открывается только участникам вашей пары.'); }
    catch { setNotice(`Ссылка: ${location.origin}/?dateInvite=${item.id}`); }
  }
  if (editor) return <div className="date-module"><ScenarioEditor key={editor.invitation?.id || editor.scenario.theme} initial={editor.scenario} invitation={editor.invitation} onClose={() => setEditor(null)} onSave={save} /></div>;
  if (player) {
    const scenario = player.preview ? player.invitation.publishedScenario || player.invitation.scenario : player.invitation.run?.scenario || player.invitation.publishedScenario!;
    return <div className="date-module"><ScenarioPlayer key={`${player.invitation.id}-${player.preview}`} scenario={scenario} initialAnswers={player.preview ? {} : player.invitation.run?.answers || {}} preview={player.preview} onClose={() => setPlayer(null)} onProgress={player.preview ? undefined : answers => progress(player.invitation, answers)} onSubmit={player.preview ? async () => {} : response => respond(player.invitation, response)} /></div>;
  }
  const created = items.filter(item => item.authorId === memberId), received = items.filter(item => item.authorId !== memberId && item.status !== 'draft');
  return <section className="date-module"><div className="dates-intro"><div><span className="eyebrow">СНАЧАЛА АТМОСФЕРА</span><h2>Какой будет наша история?</h2><p>Ваши 10 атмосфер, места и занятия. Настройте приглашение так, как хочется именно вам.</p></div><span className="dates-intro-mark">✧</span></div>
    {demo && <div className="dates-demo-role"><span>Попробуйте обе стороны приглашения:</span><button aria-pressed={demoMember === 'demo-a'} className={demoMember === 'demo-a' ? 'selected' : ''} onClick={() => { setDemoMember('demo-a'); setTab('created'); }}>Я — первый партнёр</button><button aria-pressed={demoMember === 'demo-b'} className={demoMember === 'demo-b' ? 'selected' : ''} onClick={() => { setDemoMember('demo-b'); setTab('received'); }}>Я — второй партнёр</button></div>}
    <div className="dates-tabs" role="tablist" aria-label="Свидания"><button role="tab" aria-selected={tab === 'themes'} onClick={() => setTab('themes')}>Атмосферы <span>10</span></button><button role="tab" aria-selected={tab === 'created'} onClick={() => setTab('created')}>Созданные <span>{created.length}</span></button><button role="tab" aria-selected={tab === 'received'} onClick={() => setTab('received')}>Входящие <span>{received.length}</span></button></div>
    {error && <p role="alert" className="error">{error}</p>}{notice && <p className="dates-notice" role="status">{notice}</p>}
    {tab === 'themes' ? <><div className="scenario-mode"><p>Можно предложить выбор или пригласить на готовое свидание.</p><button aria-pressed={!ready} className={!ready ? 'selected' : ''} onClick={() => setReady(false)}>Партнёр выбирает детали</button><button aria-pressed={ready} className={ready ? 'selected' : ''} onClick={() => setReady(true)}>Готовый план / сюрприз</button></div><div className="catalog-search atmosphere-search"><Search size={18} /><input aria-label="Найти атмосферу свидания" placeholder="Найти атмосферу: дома, природа…" value={search} onChange={event => setSearch(event.target.value)} /></div><div className="atmospheres-grid">{inviteTemplates.filter(template => `${template.name} ${template.tagline} ${template.description}`.toLocaleLowerCase('ru').includes(search.trim().toLocaleLowerCase('ru'))).map(template => <article className="atmosphere-card" key={template.key}><ThemeShell theme={template.key} small><span className="atmosphere-emoji">{template.emoji}</span><span className="stage-eyebrow">{template.tagline}</span><h3>{template.name}</h3><p>{template.description}</p><button className="stage-action" onClick={() => setEditor({ scenario: createPreset(template.key, ready) })}>Настроить свидание<ArrowRight size={16} /></button></ThemeShell></article>)}</div><p className="dates-footnote">Места из шаблонов — идеи для Алматы. Перед встречей уточните доступность и детали.</p></> : loading ? <p className="dates-empty">Загружаем приглашения…</p> : <div className="invitations-list">{(tab === 'created' ? created : received).length ? (tab === 'created' ? created : received).map(item => <article className="invitation-card" key={item.id}><div className="invitation-card-head"><span>{inviteTemplates.find(t => t.key === item.scenario.theme)?.emoji}</span><div><h3>{item.scenario.title}</h3><p>{inviteTemplates.find(t => t.key === item.scenario.theme)?.name}</p></div><span className={`invite-status ${item.status}`}>{item.status === 'draft' ? 'Черновик' : item.status === 'answered' ? 'Принято' : 'Ждёт ответа'}</span></div>{item.response ? <ResponseSummary invitation={item} onCalendar={onCalendar} /> : <div className="invitation-actions">{item.authorId === memberId ? <><button className="button secondary" onClick={() => setEditor({ scenario: item.scenario, invitation: item })}><Pencil size={15} />Редактировать</button><button className="button secondary" onClick={() => setPlayer({ invitation: item, preview: true })}><Eye size={15} />Посмотреть</button>{!demo && item.status === 'published' && <button className="button secondary" onClick={() => copy(item)}><Copy size={15} />Ссылка</button>}</> : <button className="button primary" onClick={() => setPlayer({ invitation: item, preview: false })}><Send size={15} />{item.run ? 'Продолжить приглашение' : 'Открыть приглашение'}</button>}</div>}</article>) : <div className="dates-empty"><span>💌</span><h3>{tab === 'created' ? 'История начинается с приглашения' : 'Здесь появятся приглашения партнёра'}</h3><p>{tab === 'created' ? 'Выберите атмосферу и придумайте ваше свидание.' : demo ? 'Создайте приглашение от первого партнёра, затем переключитесь сюда.' : 'Создавать свидания и приглашать друг друга можете вы оба.'}</p><button className="button secondary" onClick={() => setTab('themes')}><Plus size={16} />Выбрать атмосферу</button></div>}</div>}
  </section>;
}
