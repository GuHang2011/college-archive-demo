export type Status = 'PENDING' | 'APPROVED' | 'REJECTED';
export type Archive = { id: string; name: string; category: string; status: Status; remark: string; createdAt: number; size: number; blob: Blob; sample: boolean; taskId?: number; rejectReason?: string };
export const categories = ['教学建设', '科研成果', '学生工作', '社会服务'];
export const statusText: Record<Status, string> = { PENDING: '待审核', APPROVED: '已通过', REJECTED: '需修改' };
export const statusType: Record<Status, 'warning' | 'success' | 'danger'> = { PENDING: 'warning', APPROVED: 'success', REJECTED: 'danger' };
export const MAX_FILE = 20 * 1024 * 1024;
export const MAX_TOTAL = 50 * 1024 * 1024;
export const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.zip';
const DB = 'college-archive-public-demo-v1';
const STORE = 'files';
let db: IDBDatabase;

export async function openDatabase() {
  db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => { request.result.createObjectStore(STORE, { keyPath: 'id' }); request.result.createObjectStore('meta'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('请关闭其他演示标签页后刷新。'));
  });
}
export function allFiles(): Promise<Archive[]> {
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    request.onsuccess = () => resolve(request.result.sort((a: Archive, b: Archive) => b.createdAt - a.createdAt));
    request.onerror = () => reject(request.error);
  });
}
// Resolve only after commit, so quota errors never appear as successful uploads.
function write(action: (store: IDBObjectStore) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, 'readwrite');
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error || new Error('浏览器本地空间不足，请删除部分试传文件后重试。'));
    action(transaction.objectStore(STORE));
  });
}
export const saveFiles = (files: Archive[]) => write(store => files.forEach(file => store.put(file)));
export const deleteFile = (id: string) => write(store => store.delete(id));
export const wasSeeded = (): Promise<boolean> => new Promise((resolve, reject) => {
  const request = db.transaction('meta').objectStore('meta').get('seeded');
  request.onsuccess = () => resolve(Boolean(request.result)); request.onerror = () => reject(request.error);
});
export const replaceFiles = (files: Archive[]): Promise<void> => new Promise((resolve, reject) => {
  const transaction = db.transaction([STORE, 'meta'], 'readwrite');
  transaction.oncomplete = () => resolve(); transaction.onabort = transaction.onerror = () => reject(transaction.error);
  const store = transaction.objectStore(STORE); store.clear(); files.forEach(file => store.put(file));
  transaction.objectStore('meta').put(true, 'seeded');
});

async function sampleImage(title: string, category: string): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1000; canvas.height = 1300;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#faf9f4'; ctx.fillRect(0, 0, 1000, 1300);
  ctx.fillStyle = '#173e38'; ctx.fillRect(0, 0, 1000, 18);
  ctx.font = '24px "Microsoft YaHei", sans-serif'; ctx.fillText('学院资料归档 / 演示文档', 85, 115);
  ctx.fillStyle = '#1f3531'; ctx.font = 'bold 42px "Microsoft YaHei", sans-serif'; ctx.fillText(title, 85, 240);
  ctx.font = '24px "Microsoft YaHei", sans-serif'; ctx.fillStyle = '#70817c'; ctx.fillText(category + ' · 合成示例材料', 85, 298);
  ctx.fillStyle = '#dce7e0'; ctx.fillRect(85, 350, 830, 2);
  const lines = ['01  建设目标', '完善课程资料归档，形成可查阅的成果记录。', '', '02  实施过程', '围绕教学设计、实践活动与持续改进整理材料。', '', '03  阶段成果', '通过资料归档与协同审核，记录建设进展。', '', '本文件为在线演示生成，不代表任何真实业务记录。'];
  ctx.font = '25px "Microsoft YaHei", sans-serif';
  lines.forEach((line, index) => { ctx.fillStyle = /^0/.test(line) ? '#177b66' : '#52645e'; ctx.fillText(line, 85, 430 + index * 58); });
  ctx.fillStyle = '#177b66'; ctx.fillRect(85, 1130, 830, 4);
  ctx.fillText('LOCAL DEMO  /  仅用于功能体验', 85, 1195);
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('示例图片生成失败')), 'image/png'));
}
export async function seedFiles(): Promise<Archive[]> {
  const records = [
    ['课程建设阶段总结', '教学建设', 'APPROVED'], ['创新实践活动记录', '学生工作', 'PENDING'],
    ['科研项目成果概览', '科研成果', 'APPROVED'], ['校企共建交流纪要', '社会服务', 'PENDING'],
    ['实践教学材料整理', '教学建设', 'REJECTED'],
  ];
  return Promise.all(records.map(async ([title, category, status], index) => {
    const blob = await sampleImage(title, category);
    return { id: `sample-${index}`, name: title + '.png', category, status: status as Status, remark: '系统预置的合成示例，可预览、下载和体验审核。', createdAt: Date.now() - (index + 1) * 86400000, size: blob.size, blob, sample: true, rejectReason: status === 'REJECTED' ? '请补充活动日期和材料说明。' : undefined };
  }));
}
export function fileError(file: File) {
  if (!ACCEPT.split(',').includes('.' + file.name.split('.').pop()?.toLowerCase())) return '此格式暂不支持，请选择 Office、PDF、图片或 ZIP 文件。';
  if (file.size > MAX_FILE) return '演示版单文件最大 20 MB。';
  if (!file.size) return '不能添加空文件。';
  return '';
}
export const fileSize = (size: number) => size < 1024 * 1024 ? `${Math.round(size / 1024)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB`;
export const dateLabel = (time: number) => new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(time);
