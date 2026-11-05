import { computed, ref } from 'vue';
import { normalizeGateway } from './assistant';

export type Person = { id: string; username: string; name: string; role: 'admin' | 'member' };
export type Attachment = { id: string; name: string; size: number };
export type ChatMessage = { id: number; room: string; user: string; author: string; content: string; created_at: number; pinned: number; files: Attachment[] };
export type Room = { id: string; name: string; kind: 'private' | 'group'; owner: string; members: string[]; unread: number; canPin: boolean; last: { content: string; created_at: number } | null };
export type Broadcast = { id: number; title: string; content: string; author: string; created_at: number; pinned: number; isRead: number };
type Snapshot = { user: Person; contacts: Person[]; rooms: Room[]; broadcasts: Broadcast[]; revision: number };
export const collabState = ref<Snapshot>();
export const collabStatus = ref<'disconnected' | 'connected' | 'reconnecting'>('disconnected');
export const collabError = ref('');
export const collabVersion = ref(0);
export const unreadChat = computed(() => collabState.value?.rooms.reduce((sum, room) => sum + room.unread, 0) || 0);
export const unreadBroadcast = computed(() => collabState.value?.broadcasts.filter(item => !item.isRead).length || 0);
let base = '', token = '', generation = 0, polling: AbortController | undefined;
export const defaultCollabBase = () => import.meta.env.VITE_COLLAB_GATEWAY || (['localhost', '127.0.0.1'].includes(location.hostname) ? location.origin : '');
export const currentCollabBase = () => base;

export async function collabApi(route: string, body?: unknown, signal?: AbortSignal): Promise<any> {
  const own = new AbortController(), timeout = setTimeout(() => own.abort(), route.startsWith('/sync') ? 35000 : 20000);
  const abort = () => own.abort(); signal?.addEventListener('abort', abort, { once: true });
  try {
    const response = await fetch(base + '/api/collab' + route, { method: body === undefined ? 'GET' : 'POST', credentials: 'omit', redirect: 'error', signal: own.signal,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let result; try { result = await response.json(); } catch { throw new Error('此地址不是通讯服务，请检查服务地址。'); }
    if (!response.ok) { const error = new Error(result.error || '通讯请求失败。') as Error & { status: number }; error.status = response.status; throw error; }
    return result;
  } catch (error: any) { if (error instanceof TypeError) throw new Error('无法连接通讯服务，请检查地址、网络及跨域设置。'); if (own.signal.aborted) throw new Error('请求超时或已取消，请重试。'); throw error; }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export async function refreshCollaboration() {
  const current = generation, snapshot = await collabApi('/state') as Snapshot;
  if (current === generation && token) { collabState.value = snapshot; collabVersion.value++; }
}
export async function loginCollaboration(address: string, username: string, password: string) {
  base = normalizeGateway(address); const result = await collabApi('/login', { username, password });
  if (!result.token || !result.user) throw new Error('通讯服务返回了无效登录结果。');
  token = result.token; generation++; collabError.value = '';
  try { await refreshCollaboration(); collabStatus.value = 'connected'; void poll(generation); }
  catch (error) { token = ''; collabState.value = undefined; throw error; }
}
async function poll(current: number) {
  let delay = 1000;
  while (token && current === generation) {
    const controller = new AbortController(); polling = controller;
    try {
      await collabApi(`/sync?after=${collabState.value?.revision || 0}`, undefined, controller.signal);
      if (current !== generation) return;
      await refreshCollaboration(); collabStatus.value = 'connected'; collabError.value = ''; delay = 1000;
    } catch (error: any) {
      if (current !== generation) return;
      if (error.status === 401) { token = ''; collabState.value = undefined; collabStatus.value = 'disconnected'; collabError.value = error.message; return; }
      collabStatus.value = 'reconnecting'; collabError.value = '连接中断，正在自动重连。已发送消息保存在服务端。';
      await new Promise(resolve => setTimeout(resolve, delay)); delay = Math.min(15000, delay * 2);
    }
  }
}
export async function logoutCollaboration() {
  try { if (token) await collabApi('/logout', {}); } finally { generation++; polling?.abort(); token = ''; collabState.value = undefined; collabStatus.value = 'disconnected'; collabError.value = ''; }
}
export function uploadAttachment(room: string, file: File, onProgress: (percent: number) => void): Promise<Attachment> {
  const url = `${base}/api/collab/files?room=${encodeURIComponent(room)}&name=${encodeURIComponent(file.name)}`;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest(); xhr.open('POST', url); xhr.setRequestHeader('Authorization', `Bearer ${token}`); xhr.setRequestHeader('Content-Type', 'application/octet-stream'); xhr.timeout = 125000;
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => { try { const data = JSON.parse(xhr.responseText); if (xhr.status >= 200 && xhr.status < 300) resolve(data); else reject(new Error(data.error || '附件上传失败。')); } catch { reject(new Error('附件上传响应异常。')); } };
    xhr.onerror = xhr.ontimeout = () => reject(new Error('附件上传失败或超时，请重试。')); xhr.send(file);
  });
}
export async function downloadAttachment(file: Attachment) {
  const response = await fetch(`${base}/api/collab/files/${encodeURIComponent(file.id)}`, { credentials: 'omit', redirect: 'error', headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error('附件不可访问，请重新登录或检查会话权限。');
  const blob = await response.blob(), url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = file.name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
}
