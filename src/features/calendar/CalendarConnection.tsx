import { useEffect, useState } from 'react';
import { CalendarDays, Download } from 'lucide-react';
import type { DateEvent } from '../../model';
import { api } from '../../lib/api';
import { calendarFile } from './ical';

export function CalendarConnection({ demo, events }: { demo: boolean; events: DateEvent[] }) {
  const [config, setConfig] = useState<{ enabled: boolean; active: boolean } | null>(demo ? { enabled: false, active: false } : null);
  const [url, setUrl] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const planned = events.filter(event => event.status === 'planned');
  useEffect(() => {
    if (demo) return;
    let active = true;
    api<{ enabled: boolean; active: boolean }>('/calendar/subscription').then(value => { if (active) setConfig(value); }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [demo]);
  async function subscribe() {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await api<{ url: string }>('/calendar/subscription', 'POST', {});
      setUrl(result.url); setConfig({ enabled: true, active: true });
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function revoke() {
    setBusy(true); setError('');
    try { await api('/calendar/subscription', 'DELETE', {}); setUrl(''); setConfig(value => value && ({ ...value, active: false })); setNotice('Подписка отключена. Уже загруженные записи удалите вместе с подписным календарём на телефоне.'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  function download() {
    const link = document.createElement('a'), blob = URL.createObjectURL(new Blob([calendarFile(planned)], { type: 'text/calendar;charset=utf-8' }));
    link.href = blob; link.download = 'vdvoem.ics'; document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(blob), 60000);
    setNotice('Откройте скачанный файл в календаре и подтвердите добавление. Это разовая копия: изменения и отмены автоматически не переносятся.');
  }
  return <section className="device-card calendar-connection"><span className="device-icon"><CalendarDays size={25} /></span><h3>Календарь телефона</h3><p>Запланированные встречи — в Apple Calendar или другом календаре с поддержкой подписок. У каждого партнёра своё подключение.</p>
    <p className="device-privacy">18+ переносится как «Время для двоих». Заметки, тип секса, варианты и позы не передаются. Названия свиданий будут видны в календаре телефона.</p>
    <p>Напоминание: за час до встречи. Без указанного времени — в 09:00 в день встречи. Время используется в часовом поясе календаря телефона.</p>
    {demo ? <p className="device-status">Сейчас открыт деморежим. Можно скачать пример календаря. Автоматическая подписка требует серверной версии по HTTPS и вашей пары.</p> : config?.enabled ? <div className="device-actions">
      {!url && <button className="button primary" disabled={busy} onClick={subscribe}>{config.active ? 'Создать новую ссылку подписки' : 'Подключить календарь телефона'}</button>}
      {config.active && !url && <p className="microcopy">Новая ссылка отключит старую подписку. После этого подключите календарь заново.</p>}
      {url && <><a className="button primary" href={url.replace(/^https:/, 'webcal:')}>Открыть подписку на iPhone</a><label className="calendar-subscription-label">Ссылка подписки<input readOnly value={url} onFocus={event => event.target.select()} /></label><button className="button secondary" onClick={async () => { try { await navigator.clipboard.writeText(url); setNotice('Ссылка скопирована.'); } catch { setNotice('Выделите ссылку в поле и скопируйте её вручную.'); } }}>Скопировать ссылку</button></>}
      {config.active && <button className="text-button" disabled={busy} onClick={revoke}>Отключить подписку</button>}
      <p className="microcopy">На iPhone подтвердите подписку и разрешите напоминания. Если включено «Удалять напоминания», отключите этот пункт. На Android добавьте ссылку через веб-версию Google Календаря → «Другие календари» → «Добавить по URL», затем включите отображение и уведомления на телефоне. Поддержка напоминаний зависит от календаря.</p>
      <p className="microcopy">Подписка переносит изменения и отмены из «Вдвоём» с задержкой обновления календаря телефона. Редактируйте встречи здесь: обратной синхронизации нет. Ссылка даёт доступ к планам — не передавайте её другим.</p>
    </div> : <p className="device-status">{config ? 'Подписка появится в серверной версии по HTTPS. Пока доступен файл календаря.' : 'Проверяем подключение календаря…'}</p>}
    <button className="button secondary" disabled={!planned.length} onClick={download}><Download size={16} />Скачать календарь .ics ({planned.length})</button><p className="microcopy">Файл — разовый перенос. Повторный импорт может создать дубликаты. Проверьте разрешение уведомлений для календаря в настройках телефона.</p>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
  </section>;
}
