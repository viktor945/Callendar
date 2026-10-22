import { useEffect, useState } from 'react';
import { Bell, Check, Download, Share, Smartphone } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { CalendarConnection } from '../calendar/CalendarConnection';
import type { DateEvent } from '../../model';
import { api } from '../../lib/api';
import { applicationKey, installApp, isIOS, isStandalone, registerWorker } from '../../lib/pwa';

export function DeviceSettings({ demo, events, onClose }: { demo: boolean; events: DateEvent[]; onClose: () => void }) {
  const [config, setConfig] = useState<{ enabled: boolean; publicKey: string | null } | null>(demo ? { enabled: false, publicKey: null } : null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const ios = isIOS(), standalone = isStandalone();
  const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && window.isSecureContext;
  useEffect(() => {
    if (demo) return;
    let active = true;
    api<{ enabled: boolean; publicKey: string | null }>('/push/config').then(async value => {
      if (!active) return; setConfig(value);
      if (supported && value.enabled) {
        const worker = await registerWorker(); const existing = await worker.pushManager.getSubscription();
        if (existing) await api('/push/subscriptions', 'POST', existing.toJSON());
        if (active) setSubscription(existing);
      }
    }).catch(err => { if (active) setError(err.message); });
    return () => { active = false; };
  }, [demo, supported]);
  async function enable() {
    setBusy(true); setError(''); setNotice('');
    try {
      // Request permission directly inside the click gesture (required by iOS).
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') throw new Error(permission === 'denied' ? 'Доступ закрыт в настройках устройства. Разрешите уведомления для «Вдвоём» и попробуйте снова.' : 'Уведомления пока не разрешены. Их можно включить позже.');
      const worker = await registerWorker();
      const existing = await worker.pushManager.getSubscription();
      const value = existing || await worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: applicationKey(config!.publicKey!) });
      try { await api('/push/subscriptions', 'POST', value.toJSON()); }
      catch (err) { if (!existing) await value.unsubscribe(); throw err; }
      setSubscription(value); setNotice('Уведомления включены на этом устройстве.');
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function disable() {
    if (!subscription) return;
    setBusy(true); setError(''); setNotice('');
    try { await api('/push/subscriptions', 'DELETE', { endpoint: subscription.endpoint }); await subscription.unsubscribe(); setSubscription(null); setNotice('Уведомления отключены на этом устройстве.'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  async function testPush() {
    setBusy(true); setError(''); setNotice('');
    try { await api('/push/test', 'POST', {}); setNotice('Тест отправлен. Проверьте уведомление на телефоне.'); }
    catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <Modal title="На телефоне и компьютере" onClose={onClose} wide><div className="device-settings">
    <CalendarConnection demo={demo} events={events} />
    <section className="device-card"><span className="device-icon"><Smartphone size={25} /></span><h3>{standalone ? 'Уже на экране «Домой»' : 'Вдвоём — рядом, как приложение'}</h3><p>Открывайте календарь с домашнего экрана, в отдельном окне без панели браузера.</p>
      {standalone ? <p className="device-success"><Check size={16} /> Сайт открыт как приложение</p> : ios ? <ol><li>Откройте опубликованный сайт в Safari.</li><li>Нажмите <Share size={14} /> «Поделиться» → «На экран Домой».</li><li>Откройте «Вдвоём» с новой иконки и подключите вашу пару внутри приложения.</li></ol> : <><button className="button secondary" onClick={async () => { if (!await installApp()) setNotice('В меню браузера выберите «Установить приложение» или «Добавить на главный экран».'); }}><Download size={16} />Установить приложение</button><p className="microcopy">На iPhone: Safari → «Поделиться» → «На экран Домой».</p></>}
    </section>
    <section className="device-card"><span className="device-icon"><Bell size={25} /></span><h3>Приглашения и общие планы</h3><p>Новое приглашение, принятие свидания, создание, изменение или отмена запланированной встречи — уведомление получит второй партнёр.</p><p className="device-privacy">На экране блокировки — только нейтральное сообщение «Вдвоём». Названия, тип встречи, варианты, позы и личные заметки в пуш не попадают.</p>
      {demo ? <div className="device-status">В демо можно посмотреть настройки. Настоящие пуши требуют серверной версии сайта по HTTPS и подключённой пары.</div> : !config ? <p className="muted">Проверяем возможность подключения…</p> : !config.enabled ? <div className="device-status">Пуши будут доступны после публикации серверной версии по HTTPS.</div> : ios && !standalone ? <div className="device-status">На iPhone сначала добавьте сайт на экран «Домой», затем включите уведомления внутри приложения. Требуется iOS 16.4 или новее.</div> : !supported ? <div className="device-status">Этот браузер пока не поддерживает пуши. Используйте актуальный браузер; на iPhone — приложение с экрана «Домой».</div> : <div className="device-actions">{subscription ? <><p className="device-success"><Check size={16} />Подключены на этом устройстве</p><button className="button primary" disabled={busy} onClick={testPush}>Отправить тест</button><button className="text-button" disabled={busy} onClick={disable}>Отключить на этом устройстве</button></> : <button className="button primary" disabled={busy} onClick={enable}><Bell size={16} />{busy ? 'Подключаем…' : 'Включить уведомления'}</button>}</div>}
      <p className="microcopy">Уведомления включаются каждым партнёром на своём устройстве. Напоминания по времени пока не отправляются.</p>
    </section>
    {error && <p className="error" role="alert">{error}</p>}{notice && <p className="device-success" role="status">{notice}</p>}
  </div></Modal>;
}
