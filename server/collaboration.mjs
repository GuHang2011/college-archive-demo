import { DatabaseSync } from 'node:sqlite';
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';
import { HttpError } from './assistant.mjs';

const derive = promisify(scrypt), MAX_FILE = 20 * 1024 * 1024, MAX_STORAGE = 500 * 1024 * 1024;
const extensions = new Set(['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.zip', '.jpg', '.jpeg', '.png']);
const fail = (code, message) => { throw new HttpError(code, message); };
const cleanText = (value, max, required = true) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, `请填写有效内容（最多 ${max} 字）。`);
  return value.trim();
};
export async function readJson(req, limit = 32 * 1024) {
  if (!req.headers['content-type']?.startsWith('application/json')) fail(415, '请使用 JSON 请求。');
  const chunks = []; let size = 0;
  const timer = setTimeout(() => req.destroy(), 15000);
  try { for await (const chunk of req) { size += chunk.length; if (size > limit) fail(413, '请求内容过长。'); chunks.push(chunk); } }
  finally { clearTimeout(timer); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { fail(400, '请求格式错误。'); }
}

export function createCollaboration(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const fileDirectory = path.join(directory, 'files'); fs.mkdirSync(fileDirectory, { recursive: true });
  const db = new DatabaseSync(path.join(directory, 'collaboration.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL, salt TEXT NOT NULL, password TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS rooms(id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, owner TEXT NOT NULL, created_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS members(room TEXT NOT NULL REFERENCES rooms(id), user TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(room,user));
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL REFERENCES rooms(id), user TEXT NOT NULL REFERENCES users(id), content TEXT NOT NULL, client_id TEXT NOT NULL, created_at INTEGER NOT NULL, pinned INTEGER NOT NULL DEFAULT 0, UNIQUE(user,client_id));
    CREATE INDEX IF NOT EXISTS messages_room ON messages(room,id);
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY, room TEXT NOT NULL REFERENCES rooms(id), user TEXT NOT NULL REFERENCES users(id), name TEXT NOT NULL, size INTEGER NOT NULL, created_at INTEGER NOT NULL, message INTEGER REFERENCES messages(id));
    CREATE TABLE IF NOT EXISTS read_marks(room TEXT NOT NULL, user TEXT NOT NULL, last_id INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(room,user));
    CREATE TABLE IF NOT EXISTS broadcasts(id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL, user TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, pinned INTEGER NOT NULL DEFAULT 0, client_id TEXT NOT NULL, UNIQUE(user,client_id));
    CREATE TABLE IF NOT EXISTS broadcast_reads(broadcast INTEGER NOT NULL REFERENCES broadcasts(id), user TEXT NOT NULL REFERENCES users(id), PRIMARY KEY(broadcast,user));`);
  const get = (sql, ...params) => db.prepare(sql).get(...params);
  const all = (sql, ...params) => db.prepare(sql).all(...params);
  const run = (sql, ...params) => db.prepare(sql).run(...params);
  const transaction = fn => { db.exec('BEGIN IMMEDIATE'); try { const result = fn(); db.exec('COMMIT'); return result; } catch (e) { db.exec('ROLLBACK'); throw e; } };
  const sessions = new Map(), attempts = new Map(), events = new EventEmitter(); events.setMaxListeners(200);
  let revision = 1, activeUploads = 0, activeLogins = 0;
  const changed = () => { revision++; events.emit('change'); };
  const userInfo = user => ({ id: user.id, username: user.username, name: user.name, role: user.role });
  const checkSession = req => {
    const token = req.headers.authorization?.replace(/^Bearer /, ''); const session = sessions.get(token);
    if (!session || session.expires < Date.now()) { sessions.delete(token); fail(401, '登录已失效，请重新登录内部通讯。'); }
    const user = get('SELECT * FROM users WHERE id=?', session.user); if (!user) fail(401, '账号不可用。');
    return { user, token, session };
  };
  const memberRoom = (user, id) => { const room = get('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE r.id=? AND m.user=?', id, user.id); if (!room) fail(403, '无权访问此会话。'); return room; };
  const mayPin = (user, room) => room.kind === 'private' || room.owner === user.id || user.role === 'admin';
  const messageInfo = message => ({ ...message, files: all('SELECT id,name,size FROM files WHERE message=?', message.id) });
  // Remove unfinished transfers left by interrupted clients, never sent attachments.
  for (const file of all('SELECT id FROM files WHERE message IS NULL AND created_at<?', Date.now() - 86400000)) { fs.rmSync(path.join(fileDirectory, file.id), { force: true }); run('DELETE FROM files WHERE id=?', file.id); }
  for (const name of fs.readdirSync(fileDirectory)) if (name.endsWith('.part')) fs.rmSync(path.join(fileDirectory, name), { force: true });

  async function addUser({ username, name, role, password }) {
    if (!/^[a-zA-Z0-9._-]{3,40}$/.test(username) || !['admin', 'member'].includes(role) || typeof password !== 'string' || password.length < 12 || password.length > 128) throw new Error('Account requires a valid username, role and password of 12–128 characters.');
    cleanText(name, 60); if (get('SELECT id FROM users WHERE username=?', username)) throw new Error('Account already exists.');
    const salt = randomBytes(16).toString('hex'), hash = await derive(password, salt, 64), id = randomUUID();
    run('INSERT INTO users VALUES(?,?,?,?,?,?)', id, username, name, role, salt, hash.toString('hex'));
    return id;
  }
  function setupRoom(name, owner, users, kind = 'group') {
    const id = randomUUID(); transaction(() => { run('INSERT INTO rooms VALUES(?,?,?,?,?)', id, name, kind, owner, Date.now()); for (const user of new Set(users)) run('INSERT INTO members VALUES(?,?)', id, user); }); changed(); return id;
  }

  async function handle(req, res, url, json) {
    try {
      const route = url.pathname.slice('/api/collab'.length);
      if (route === '/login' && req.method === 'POST') {
        const ip = req.socket.remoteAddress, now = Date.now();
        for (const [key, attempt] of attempts) if (attempt.until < now) attempts.delete(key);
        const attempt = attempts.get(ip) || { count: 0, until: now + 60000 }; attempts.set(ip, attempt);
        if (++attempt.count > 15 || activeLogins >= 4) fail(429, '登录尝试较多，请稍后再试。');
        activeLogins++;
        try {
          const body = await readJson(req, 2048), username = cleanText(body.username, 40), password = cleanText(body.password, 128);
          const user = get('SELECT * FROM users WHERE username=?', username);
          const hash = await derive(password, user?.salt || 'dummy-salt-for-timing', 64);
          if (!user || !timingSafeEqual(hash, Buffer.from(user.password, 'hex'))) fail(401, '账号或密码错误。');
          for (const [key, value] of sessions) if (value.expires < now) sessions.delete(key);
          const own = [...sessions].filter(([, value]) => value.user === user.id);
          if (own.length >= 5) sessions.delete(own[0][0]);
          const token = randomBytes(32).toString('hex'); sessions.set(token, { user: user.id, expires: now + 8 * 3600000, messageWindow: now, messageCount: 0 });
          return json(200, { token, user: userInfo(user) });
        } finally { activeLogins--; }
      }
      const { user, token, session } = checkSession(req);
      if (route === '/logout' && req.method === 'POST') { sessions.delete(token); changed(); return json(200, { ok: true }); }
      if (route === '/sync' && req.method === 'GET') {
        if (Number(url.searchParams.get('after')) !== revision) return json(200, { revision });
        if (events.listenerCount('change') >= 100) fail(429, '实时连接较多，请稍后重试。');
        const finish = () => { cleanup(); if (!res.destroyed) json(200, { revision }); };
        const timer = setTimeout(finish, 25000);
        const cleanup = () => { clearTimeout(timer); events.off('change', finish); res.off('close', cleanup); };
        events.once('change', finish); res.once('close', cleanup); return;
      }
      if (route === '/state' && req.method === 'GET') {
        const contacts = all('SELECT id,username,name,role FROM users ORDER BY name');
        const rooms = all('SELECT r.* FROM rooms r JOIN members m ON m.room=r.id WHERE m.user=? ORDER BY r.created_at DESC', user.id).map(room => {
          const members = all('SELECT user FROM members WHERE room=?', room.id).map(m => m.user);
          const last = get('SELECT id,content,user,created_at FROM messages WHERE room=? ORDER BY id DESC LIMIT 1', room.id);
          const unread = get('SELECT COUNT(*) AS count FROM messages WHERE room=? AND user<>? AND id>COALESCE((SELECT last_id FROM read_marks WHERE room=? AND user=?),0)', room.id, user.id, room.id, user.id).count;
          return { ...room, members, last: last || null, unread, canPin: mayPin(user, room) };
        });
        const broadcasts = all('SELECT b.*,u.name AS author,EXISTS(SELECT 1 FROM broadcast_reads WHERE broadcast=b.id AND user=?) AS isRead FROM broadcasts b JOIN users u ON b.user=u.id ORDER BY pinned DESC,id DESC LIMIT 100', user.id);
        return json(200, { user: userInfo(user), contacts, rooms, broadcasts, revision });
      }
      let match = route.match(/^\/rooms\/([a-f0-9-]+)\/messages$/);
      if (match && req.method === 'GET') {
        memberRoom(user, match[1]); const before = Number(url.searchParams.get('before') || Number.MAX_SAFE_INTEGER);
        if (!Number.isSafeInteger(before) || before <= 0) fail(400, '分页参数无效。');
        const items = all('SELECT m.*,u.name AS author FROM messages m JOIN users u ON m.user=u.id WHERE room=? AND m.id<? ORDER BY m.id DESC LIMIT 100', match[1], before).reverse().map(messageInfo);
        const pins = all('SELECT m.*,u.name AS author FROM messages m JOIN users u ON m.user=u.id WHERE room=? AND pinned=1 ORDER BY m.id DESC', match[1]).map(messageInfo);
        return json(200, { items, pins, hasMore: items.length === 100 });
      }
      match = route.match(/^\/files\/([a-f0-9-]+)$/);
      if (match && req.method === 'GET') {
        const file = get('SELECT * FROM files WHERE id=?', match[1]); if (!file) fail(404, '文件不存在。'); memberRoom(user, file.room);
        if (!file.message && file.user !== user.id) fail(403, '附件尚未发送。');
        const disk = path.join(fileDirectory, file.id); if (!fs.existsSync(disk)) fail(404, '附件已不在服务器，请联系管理员。');
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="attachment"; filename*=UTF-8''${encodeURIComponent(file.name).replace(/'/g, '%27')}`, 'Content-Length': file.size, 'Cache-Control': 'no-store' });
        const stream = fs.createReadStream(disk); stream.on('error', () => res.destroy()); res.on('close', () => stream.destroy()); stream.pipe(res); return;
      }
      if (req.method !== 'POST') fail(405, '不支持此操作。');
      if (route === '/files') {
        const room = memberRoom(user, url.searchParams.get('room')), name = cleanText(url.searchParams.get('name'), 255);
        if (/[\\/\x00-\x1f]/.test(name) || !extensions.has(path.extname(name).toLowerCase())) fail(400, '请选择 Office、PDF、图片、文本或 ZIP 文件。');
        if (activeUploads >= 2) fail(429, '上传繁忙，请稍后重试。');
        const length = Number(req.headers['content-length']); if (!Number.isSafeInteger(length) || length <= 0 || length > MAX_FILE) fail(413, '单个附件需为 1 字节至 20 MB。');
        if (get('SELECT COUNT(*) AS count FROM files WHERE user=? AND message IS NULL', user.id).count >= 10) fail(429, '未发送附件较多，请先发送或取消队列中的附件。');
        if (get('SELECT COALESCE(SUM(size),0) AS size FROM files').size + length > MAX_STORAGE) fail(507, '服务端附件空间已达 500 MB，请联系管理员。');
        activeUploads++; const id = randomUUID(), temp = path.join(fileDirectory, id + '.part'), target = path.join(fileDirectory, id); let bytes = 0;
        const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
        try {
          await pipeline(req, new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; callback(bytes > MAX_FILE ? new Error('File too large') : null, chunk); } }), fs.createWriteStream(temp, { flags: 'wx' }), { signal: controller.signal });
          if (!sessions.has(token)) fail(401, '登录已失效，请重新上传。');
          if (bytes !== length) fail(400, '上传不完整，请重新选择文件。');
          if (get('SELECT COALESCE(SUM(size),0) AS size FROM files').size + bytes > MAX_STORAGE) fail(507, '服务端空间不足。');
          fs.renameSync(temp, target);
          try { run('INSERT INTO files VALUES(?,?,?,?,?,?,NULL)', id, room.id, user.id, name, bytes, Date.now()); } catch (error) { fs.rmSync(target, { force: true }); throw error; }
          return json(201, { id, name, size: bytes });
        } finally { clearTimeout(timer); activeUploads--; fs.rmSync(temp, { force: true }); }
      }
      const body = await readJson(req);
      if (!sessions.has(token) || session.expires < Date.now()) fail(401, '登录已失效，请重新登录。');
      if (route === '/files/discard') {
        const file = get('SELECT * FROM files WHERE id=?', String(body.id));
        if (!file || file.user !== user.id || file.message) fail(403, '不能取消这个附件。');
        fs.rmSync(path.join(fileDirectory, file.id), { force: true }); run('DELETE FROM files WHERE id=?', file.id); return json(200, { ok: true });
      }
      if (route === '/rooms') {
        if (!Array.isArray(body.members) || body.members.length > 50 || !['private', 'group'].includes(body.kind)) fail(400, '请选择有效联系人。');
        const ids = [...new Set([user.id, ...body.members])]; if (ids.length < 2 || (body.kind === 'private' && ids.length !== 2) || !ids.every(id => typeof id === 'string' && get('SELECT id FROM users WHERE id=?', id))) fail(400, '会话成员无效。');
        if (body.kind === 'private') {
          const existing = get("SELECT r.id FROM rooms r JOIN members a ON a.room=r.id JOIN members b ON b.room=r.id WHERE r.kind='private' AND a.user=? AND b.user=?", ids[0], ids[1]);
          if (existing) return json(200, existing);
        }
        if (get('SELECT COUNT(*) AS count FROM rooms WHERE owner=?', user.id).count >= 100) fail(429, '创建的会话数量已达上限。');
        return json(201, { id: setupRoom(body.kind === 'private' ? '私聊' : cleanText(body.name, 60), user.id, ids, body.kind) });
      }
      if (route === '/messages') {
        const room = memberRoom(user, String(body.room)), content = cleanText(body.content, 4000, false), clientId = cleanText(body.clientId, 80);
        const ids = body.files || []; if (!Array.isArray(ids) || ids.length > 5 || ids.some(id => typeof id !== 'string') || new Set(ids).size !== ids.length || (!content && !ids.length)) fail(400, '请输入消息或选择最多 5 个附件。');
        const existing = get('SELECT * FROM messages WHERE user=? AND client_id=?', user.id, clientId);
        if (existing) {
          const files = all('SELECT id FROM files WHERE message=? ORDER BY id', existing.id).map(f => f.id);
          if (existing.room !== room.id || existing.content !== content || JSON.stringify([...ids].sort()) !== JSON.stringify(files)) fail(409, '重试内容已变化，请重新发送。');
          return json(200, messageInfo(existing));
        }
        if (Date.now() - session.messageWindow > 60000) { session.messageWindow = Date.now(); session.messageCount = 0; }
        if (session.messageCount >= 60) fail(429, '本分钟消息较多，请稍后重试。');
        const id = transaction(() => {
          for (const id of ids) { const file = get('SELECT * FROM files WHERE id=?', id); if (!file || file.user !== user.id || file.room !== room.id || file.message) fail(403, '附件无权使用或已经发送。'); }
          const result = run('INSERT INTO messages(room,user,content,client_id,created_at) VALUES(?,?,?,?,?)', room.id, user.id, content, clientId, Date.now());
          for (const id of ids) run('UPDATE files SET message=? WHERE id=?', result.lastInsertRowid, id);
          return Number(result.lastInsertRowid);
        });
        session.messageCount++; changed(); return json(201, messageInfo(get('SELECT * FROM messages WHERE id=?', id)));
      }
      if (route === '/messages/pin') {
        const message = get('SELECT * FROM messages WHERE id=?', Number(body.id)); if (!message) fail(404, '消息不存在。');
        const room = memberRoom(user, message.room); if (!mayPin(user, room)) fail(403, '仅群主或管理员可以置顶群消息。');
        if (typeof body.pinned !== 'boolean') fail(400, '置顶状态无效。');
        if (body.pinned && !message.pinned && get('SELECT COUNT(*) AS count FROM messages WHERE room=? AND pinned=1', room.id).count >= 5) fail(400, '每个会话最多置顶 5 条消息。');
        run('UPDATE messages SET pinned=? WHERE id=?', Number(body.pinned), message.id); changed(); return json(200, { ok: true });
      }
      if (route === '/read') {
        memberRoom(user, String(body.room)); const message = get('SELECT id FROM messages WHERE id=? AND room=?', Number(body.lastId), body.room);
        const previous = get('SELECT last_id FROM read_marks WHERE room=? AND user=?', body.room, user.id)?.last_id || 0;
        if (message && previous < message.id) { run('INSERT INTO read_marks VALUES(?,?,?) ON CONFLICT(room,user) DO UPDATE SET last_id=MAX(last_id,excluded.last_id)', body.room, user.id, message.id); changed(); }
        return json(200, { ok: true });
      }
      if (route === '/broadcasts') {
        if (user.role !== 'admin') fail(403, '只有通讯管理员可以发布广播。');
        const title = cleanText(body.title, 100), content = cleanText(body.content, 6000), clientId = cleanText(body.clientId, 80);
        const existing = get('SELECT * FROM broadcasts WHERE user=? AND client_id=?', user.id, clientId);
        if (existing) { if (existing.title !== title || existing.content !== content) fail(409, '重试内容已变化。'); return json(200, existing); }
        const result = run('INSERT INTO broadcasts(title,content,user,created_at,client_id) VALUES(?,?,?,?,?)', title, content, user.id, Date.now(), clientId);
        changed(); return json(201, { id: Number(result.lastInsertRowid) });
      }
      if (route === '/broadcasts/pin') {
        if (user.role !== 'admin') fail(403, '只有通讯管理员可以置顶广播。');
        const notice = get('SELECT id,pinned FROM broadcasts WHERE id=?', Number(body.id)); if (!notice || typeof body.pinned !== 'boolean') fail(400, '广播参数无效。');
        if (body.pinned && !notice.pinned && get('SELECT COUNT(*) AS count FROM broadcasts WHERE pinned=1').count >= 5) fail(400, '最多置顶 5 条广播。');
        run('UPDATE broadcasts SET pinned=? WHERE id=?', Number(body.pinned), notice.id); changed(); return json(200, { ok: true });
      }
      if (route === '/broadcasts/read') {
        const notice = get('SELECT id FROM broadcasts WHERE id=?', Number(body.id)); if (!notice) fail(404, '广播不存在。');
        const result = run('INSERT OR IGNORE INTO broadcast_reads VALUES(?,?)', notice.id, user.id); if (result.changes) changed(); return json(200, { ok: true });
      }
      fail(404, '接口不存在。');
    } catch (error) { json(error instanceof HttpError ? error.status : 500, { error: error instanceof HttpError ? error.message : '通讯服务暂时无法完成操作，请重试。' }); }
  }
  return { handle, addUser, setupRoom, userCount: () => get('SELECT COUNT(*) AS count FROM users').count, close() { events.removeAllListeners(); db.close(); } };
}
