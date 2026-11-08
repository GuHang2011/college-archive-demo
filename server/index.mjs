import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { authorize, complete, configFromEnv, HttpError, validatePayload } from './assistant.mjs';
import { createCollaboration } from './collaboration.mjs';

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
export function createServer(config = configFromEnv(), fetchImpl = fetch, collaboration) {
  let active = 0, windowStart = Date.now(), calls = 0;
  return http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff'); res.setHeader('Referrer-Policy', 'no-referrer');
    const json = (code, body) => { if (!res.destroyed) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(body)); } };
    const url = new URL(req.url, 'http://localhost');
    if (!url.pathname.startsWith('/api/')) {
      if (!['GET', 'HEAD'].includes(req.method)) return json(405, { error: 'Method not allowed' });
      let requested; try { requested = decodeURIComponent(url.pathname); } catch { return json(400, { error: 'Invalid path' }); }
      if (requested.startsWith('/college-archive-demo/')) requested = requested.slice('/college-archive-demo'.length);
      const file = path.resolve(dist, '.' + (requested.endsWith('/') ? requested + 'index.html' : requested));
      if (!file.startsWith(dist + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return json(404, { error: 'Not found' });
      res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream'); res.setHeader('Cache-Control', 'no-cache');
      if (req.method === 'HEAD') return res.end();
      const stream = fs.createReadStream(file); stream.on('error', () => res.destroy()); stream.pipe(res); return;
    }
    const origin = req.headers.origin;
    // Local origins use the actual listening port, never an untrusted Host header.
    const port = req.socket.localPort;
    const origins = [...config.origins, `http://127.0.0.1:${port}`, `http://localhost:${port}`];
    if (origin && !origins.includes(origin)) return json(403, { error: '此网站不在服务允许的来源中。' });
    if (origin) { res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); }
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Max-Age': '600' }); res.end(); return;
    }
    if (url.pathname.startsWith('/api/collab/')) {
      if (!collaboration) return json(503, { error: '通讯服务尚未启用，请联系管理员。' });
      return collaboration.handle(req, res, url, json);
    }
    if (!config.key || !config.token) return json(503, { error: '助手服务尚未配置。请在服务端设置 AI_API_KEY、AI_MODEL 和 AI_ACCESS_TOKEN 后重启。' });
    if (!authorize(req.headers.authorization, config.token)) return json(401, { error: '服务访问码无效，请检查后重新连接。' });
    if (url.pathname === '/api/assistant/status' && req.method === 'GET') return json(200, { ready: true, model: config.model });
    if (url.pathname !== '/api/assistant/chat') return json(404, { error: 'Not found' });
    if (req.method !== 'POST') return json(405, { error: 'Method not allowed' });
    if (!req.headers['content-type']?.startsWith('application/json')) return json(415, { error: '请使用 JSON 请求。' });
    if (active >= config.concurrency) return json(429, { error: '助手正在处理其他请求，请稍后重试。' });
    if (Date.now() - windowStart >= 3600000) { windowStart = Date.now(); calls = 0; }
    if (calls >= config.hourlyLimit) return json(429, { error: '本小时演示调用次数已用完，请稍后再试。' });
    active++;
    const controller = new AbortController(); let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, config.timeoutMs);
    const cancel = () => { if (!res.writableEnded) controller.abort(); }; res.on('close', cancel);
    try {
      const chunks = []; let size = 0;
      // Bound the read as well as the upstream request; slow/incomplete bodies cannot hold a slot indefinitely.
      const abortRead = () => { if (!req.complete) req.destroy(); }; controller.signal.addEventListener('abort', abortRead, { once: true });
      try { for await (const chunk of req) { size += chunk.length; if (size > 128 * 1024) throw new HttpError(413, '请求过大，请减少对话或附带资料。'); chunks.push(chunk); } }
      finally { controller.signal.removeEventListener('abort', abortRead); }
      let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new HttpError(400, '请求内容不是有效 JSON。'); }
      const payload = validatePayload(body); calls++;
      const result = await complete(config, payload, controller.signal, fetchImpl);
      json(200, result);
    } catch (error) {
      json(timedOut ? 504 : error instanceof HttpError ? error.status : 502, { error: timedOut ? '模型响应超时，请稍后重试。' : error instanceof HttpError ? error.message : controller.signal.aborted ? '请求已取消。' : '无法连接模型服务，请检查网络和服务端配置。' });
    } finally { clearTimeout(timer); active--; res.off('close', cancel); }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 4175), host = process.env.HOST || '127.0.0.1';
  const config = configFromEnv();
  const collaboration = createCollaboration(path.resolve(process.env.COLLAB_DATA_DIR || path.join(dist, '../.local')));
  createServer(config, fetch, collaboration).listen(port, host, () => { console.log(`Archive demo: http://${host}:${port}`); console.log(`AI: ${config.key && config.token ? 'configured' : 'not configured; local guidance available'}`); console.log(`Collaboration: ${collaboration.userCount()} accounts; run npm run setup:collaboration to initialize.`); });
}
