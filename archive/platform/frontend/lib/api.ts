let csrfToken = '';
export function setCsrf(value: string) { csrfToken = value; }
export async function api<T = any>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/v1${path}`, { ...options, credentials: 'include', headers: { 'Content-Type': 'application/json', ...(csrfToken ? { 'X-CSRF-Token': csrfToken } : {}), ...options.headers } });
  const body = await response.json().catch(() => ({ message: `Server returned ${response.status}.` }));
  if (!response.ok) throw new Error(body.message ?? body.error?.message ?? body.error ?? 'The request could not be completed.');
  return body;
}
export type Draft = { id: string; name: string; source: string; updatedAt: string; versions: Array<{ source: string; savedAt: string }> };
const key = 'ducklab.drafts.v1';
export function readDrafts(): Draft[] { try { const parsed = JSON.parse(localStorage.getItem(key) ?? '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
export function saveDraft(draft: Pick<Draft,'id'|'name'|'source'>): Draft {
  const drafts = readDrafts(); const existing = drafts.find(d => d.id === draft.id); const savedAt = new Date().toISOString();
  const saved: Draft = { ...draft, updatedAt: savedAt, versions: [...(existing?.versions ?? []), { source: draft.source, savedAt }].slice(-50) };
  localStorage.setItem(key, JSON.stringify([saved, ...drafts.filter(d => d.id !== draft.id)])); return saved;
}
export function download(name: string, content: Blob | string) { const url = typeof content === 'string' ? content : URL.createObjectURL(content); const link = document.createElement('a'); link.href = url; link.download = name; link.click(); if (typeof content !== 'string') setTimeout(() => URL.revokeObjectURL(url), 1000); }
