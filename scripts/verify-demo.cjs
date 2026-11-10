// Exercises the built static site, without mocking application data or APIs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('@playwright/test');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'test-results');
const basePath = '/college-archive-demo/';
const types = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const server = http.createServer((req, res) => {
    const requested = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, 'dist', requested.slice(basePath.length) || 'index.html');
    if (!requested.startsWith(basePath) || !file.startsWith(path.join(root, 'dist') + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.DEMO_BASE_URL || `http://127.0.0.1:${server.address().port}${basePath}`;
  let browser, page;
  const checks = [], errors = [], requests = [];
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.TEST_BROWSER_EXECUTABLE } : process.platform === 'win32' ? { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } : {}), args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.addInitScript(() => {
      window.__tracks = [];
      const get = navigator.mediaDevices?.getUserMedia.bind(navigator.mediaDevices);
      if (get) navigator.mediaDevices.getUserMedia = async constraints => { const stream = await get(constraints); window.__tracks.push(...stream.getTracks()); return stream; };
    });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => requests.push(r.url()));
    page.on('response', r => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    const check = async (name, fn) => { await fn(); checks.push(name); console.log(`PASS ${name}`); };
    const go = async name => { await page.getByRole('navigation', { name: '演示功能导航' }).getByRole('button', { name, exact: true }).click(); };
    const rows = () => page.locator('.archive-table .el-table__body tbody tr');
    const upload = () => page.getByRole('dialog', { name: '上传归档资料', exact: true });
    const openUpload = async () => { await page.getByRole('button', { name: '上传资料', exact: true }).click(); await upload().waitFor(); };
    const awaitRows = count => page.waitForFunction(count => document.querySelectorAll('.archive-table .el-table__body tbody tr').length === count, count);
    await page.goto(base);
    await check('Standalone site works under a GitHub Pages project subpath with five generated samples', async () => {
      await page.getByRole('heading', { name: '最近归档', exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelector('.home-summary dd')?.textContent?.includes('5'));
      await page.getByRole('button', { name: '上传资料', exact: true }).waitFor();
      await page.waitForFunction(() => !document.querySelector('.home-actions button')?.disabled);
      await page.locator('.el-loading-mask').waitFor({ state: 'hidden' });
      await page.screenshot({ path: path.join(output, 'desktop-overview.png'), fullPage: true });
      await page.getByRole('button', { name: '预览 课程建设阶段总结.png', exact: true }).click();
      await page.getByAltText('归档资料预览').waitFor();
      await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
      await page.getByRole('button', { name: '提交资料：创新实践与学生成长记录', exact: true }).click();
      const homeTask = page.getByRole('dialog', { name: '提交任务：创新实践与学生成长记录', exact: true });
      await homeTask.waitFor(); await homeTask.getByRole('button', { name: '取消', exact: true }).click();
      await go('资料归档'); await awaitRows(5);
    });
    await check('Sample image preview and download produce a real image', async () => {
      const row = rows().first(); await row.getByRole('button', { name: '预览', exact: true }).click();
      await page.getByAltText('归档资料预览').waitFor();
      await page.waitForFunction(() => document.querySelector('.document-preview')?.naturalWidth === 1000);
      const download = page.waitForEvent('download');
      await page.getByRole('dialog').getByRole('button', { name: '下载文件' }).click();
      assert.ok((await download).suggestedFilename().endsWith('.png'));
      await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
    });
    await check('Theme selection persists across reloads', async () => {
      await page.getByRole('button', { name: '切换界面主题' }).click();
      await page.getByRole('button', { name: '学院蓝' }).click();
      const selectedAccent = await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent'));
      await page.reload(); await awaitRows(5);
      assert.equal(await page.evaluate(() => localStorage.getItem('college-demo-theme')), 'blue');
      assert.equal(await page.evaluate(() => document.documentElement.style.getPropertyValue('--accent')), selectedAccent);
    });
    await check('File upload persists in IndexedDB after refresh and can be searched', async () => {
      await openUpload();
      await upload().getByRole('button', { name: '确认归档' }).click();
      await page.getByText('请先选择文件或拍照。', { exact: true }).waitFor();
      const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDXsAAAAASUVORK5CYII=', 'base64');
      await upload().locator('input[type=file]').setInputFiles({ name: 'browser-upload.png', mimeType: 'image/png', buffer: png });
      await upload().getByRole('button', { name: '确认归档' }).click(); await upload().waitFor({ state: 'hidden' });
      await awaitRows(6); await page.reload(); await awaitRows(6);
      await page.getByRole('textbox', { name: '搜索文件名或备注' }).fill('browser-upload'); await awaitRows(1);
      await page.getByRole('textbox', { name: '搜索文件名或备注' }).fill(''); await awaitRows(6);
    });
    await check('Camera capture creates a JPEG and releases its stream after confirmation', async () => {
      await openUpload(); await upload().getByRole('button', { name: '摄像头拍照' }).click();
      const camera = page.getByRole('dialog', { name: '拍照上传', exact: true });
      await page.waitForFunction(() => [...document.querySelectorAll('.camera-actions button')].some(b => b.textContent.trim() === '拍照' && !b.disabled));
      await camera.getByRole('button', { name: '拍照', exact: true }).click();
      await camera.getByAltText('本次拍摄的照片').waitFor();
      await page.waitForFunction(() => window.__tracks.length > 0 && window.__tracks.every(t => t.readyState === 'ended'));
      await page.screenshot({ path: path.join(output, 'camera-preview.png'), fullPage: true });
      await camera.getByRole('button', { name: '使用照片' }).click();
      assert.match(await upload().locator('.queue').innerText(), /拍照资料-.*\.jpg/);
      await upload().getByRole('button', { name: '确认归档' }).click(); await upload().waitFor({ state: 'hidden' }); await awaitRows(7);
      const downloaded = page.waitForEvent('download');
      await rows().first().getByRole('button', { name: '下载', exact: true }).click();
      const stream = await (await downloaded).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk);
      assert.ok(Buffer.concat(chunks).subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff])));
    });
    await check('Role switching enables approval and rejection with a required reason', async () => {
      await page.locator('.role-select').click(); await page.locator('.el-select-dropdown__item').getByText('管理员体验', { exact: true }).click();
      await page.getByRole('navigation').getByRole('button', { name: /资料审核/ }).click(); await awaitRows(4);
      await rows().first().getByRole('button', { name: '通过', exact: true }).click(); await awaitRows(3);
      await rows().first().getByRole('button', { name: '驳回', exact: true }).click();
      const box = page.getByRole('dialog', { name: '驳回资料', exact: true });
      await box.getByRole('button', { name: '确认驳回' }).click(); await page.getByText('请填写 1–200 字的驳回原因', { exact: true }).waitFor();
      await box.getByRole('textbox').fill('请补充活动说明'); await box.getByRole('button', { name: '确认驳回' }).click(); await awaitRows(2);
      await go('资料归档'); await awaitRows(7); await page.locator('.archive-table').getByText('请补充活动说明', { exact: true }).waitFor();
    });
    await check('Mobile tasks support submissions and the expired task is disabled', async () => {
      await page.setViewportSize({ width: 390, height: 844 }); await go('限时任务');
      assert.equal(await page.getByRole('button', { name: '提交已截止' }).isDisabled(), true);
      await page.getByRole('button', { name: '提交资料', exact: true }).first().click();
      const taskDialog = page.getByRole('dialog', { name: /^提交任务：/ });
      await taskDialog.locator('input[type=file]').setInputFiles({ name: 'task-notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF') });
      await taskDialog.getByRole('button', { name: '提交任务资料' }).click(); await taskDialog.waitFor({ state: 'hidden' });
      await page.getByText('已提交 1 份', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.el-message').length === 0);
      await page.screenshot({ path: path.join(output, 'mobile-tasks.png'), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await go('工作台');
      await page.waitForFunction(() => document.querySelector('nav button[aria-current="page"]')?.textContent.trim() === '工作台');
      await page.screenshot({ path: path.join(output, 'mobile-overview.png'), fullPage: true });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    });
    await check('Reset removes local uploads and restores sample data without clearing theme', async () => {
      await page.getByRole('button', { name: '重置演示数据', exact: true }).click();
      await page.getByRole('button', { name: '确认重置', exact: true }).click(); await page.getByText('演示数据已重置。', { exact: true }).waitFor();
      await go('资料归档'); await awaitRows(5); await page.reload(); await awaitRows(5);
      assert.equal(await page.evaluate(() => localStorage.getItem('college-demo-theme')), 'blue');
    });
    await check('Application makes no API calls or third-party network requests', async () => {
      assert.deepEqual(requests.filter(url => /^https?:/.test(url) && !url.startsWith(new URL(base).origin + '/')), []);
      assert.deepEqual(requests.filter(url => /\/api\//.test(url)), []);
      assert.deepEqual(errors, []);
    });
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, base, browser: browser.version(), checks, errors, requests: requests.length }, null, 2));
  } catch (error) {
    console.error(error); console.error('Browser errors:', errors);
    if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    process.exitCode = 1;
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)); }
})();

