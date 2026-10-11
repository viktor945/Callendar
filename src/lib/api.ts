export const staticPreview = import.meta.env.VITE_STATIC_PREVIEW === 'true';
export async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (staticPreview) throw new Error('В предпросмотре нет общего сервера. Изменения доступны только в этой вкладке.');
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Не удалось сохранить изменения.');
  return data;
}
