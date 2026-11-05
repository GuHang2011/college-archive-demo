// Browser -> real gateway -> explicit provider fixture. No paid model calls.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const output = path.resolve(__dirname, '../test-results/assistant');
(async () => {
  const { createServer } = await import('../server/index.mjs');
  const { configFromEnv } = await import('../server/assistant.mjs');
  let mode = 'success'; const upstream = [];
  const server = createServer({ ...configFromEnv({}), key: 'fixture-provider-only', token: 'fixture-access-code', model: 'fixture-model', timeoutMs: 2000 }, async (_url, options) => {
    upstream.push(JSON.parse(options.body));
    if (mode === 'slow') return new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
    if (mode === 'fail') return new Response('private-provider-diagnostic', { status: 429 });
    const content = mode === 'html' ? '<img src=x onerror="alert(1)"> 这是安全显示的测试文本。' : '【模型接口测试回复】本次材料围绕课程建设整理，请核实活动日期、附件清单后归档。';
    return new Response(JSON.stringify({ choices: [{ message: { content }, finish_reason: 'stop' }] }), { headers: { 'Content-Type': 'application/json' } });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`; let browser, page;
  const checks = [], errors = [], requests = [];
  const check = async (name, action) => { await action(); checks.push(name); console.log('PASS ' + name); };
  try {
    fs.mkdirSync(output, { recursive: true });
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.TEST_BROWSER_EXECUTABLE } : process.platform === 'win32' ? { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } : {}) });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, permissions: ['clipboard-read', 'clipboard-write'] });
    page = await context.newPage(); page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message)); page.on('request', r => requests.push(r.url()));
    const go = name => page.getByRole('navigation', { name: '演示功能导航' }).getByRole('button', { name, exact: true }).click();
    const question = () => page.getByRole('textbox', { name: '向助手提问', exact: true });
    const send = async text => { await question().fill(text); await page.getByRole('button', { name: '发送给 AI', exact: true }).click(); };
    const settle = () => page.getByRole('button', { name: '发送给 AI', exact: true }).waitFor();
    const connect = async (token = 'fixture-access-code') => {
      await page.getByRole('button', { name: '连接 AI', exact: true }).click();
      await page.getByRole('textbox', { name: '助手服务地址', exact: true }).fill(base);
      await page.getByRole('textbox', { name: '服务访问码', exact: true }).fill(token);
      await page.getByRole('button', { name: '检查并连接', exact: true }).click();
    };
    await page.goto(base + '/college-archive-demo/#assistant');
    await check('assistant hash route and offline mode are clear; blank prompt is disabled and makes no requests', async () => {
      await page.getByText('离线指引 · 未连接大模型', { exact: true }).waitFor();
      await page.getByText('当前浏览器 · 5 份资料', { exact: true }).waitFor();
      await page.locator('.el-loading-mask').waitFor({ state: 'hidden' });
      assert.equal(await page.getByRole('button', { name: '获取本地指引' }).isDisabled(), true);
      assert.equal(requests.filter(x => x.includes('/api/')).length, 0);
      await page.screenshot({ path: path.join(output, 'desktop-assistant.png'), fullPage: true });
    });
    await check('local guidance analyzes only opted-in metadata, and draft remains an unsubmitted editable remark', async () => {
      await page.getByRole('button', { name: /整理归档清单/ }).click(); await page.getByRole('button', { name: '获取本地指引' }).click();
      assert.match(await page.locator('.assistant-message.assistant').last().innerText(), /勾选/);
      await page.locator('.assistant-context-control .el-checkbox').click();
      assert.equal(await page.getByRole('checkbox', { name: '附带归档清单（最多 20 条）' }).isChecked(), true);
      await page.getByRole('button', { name: /整理归档清单/ }).click(); await page.getByRole('button', { name: '获取本地指引' }).click();
      assert.match(await page.locator('.assistant-message.assistant').last().innerText(), /共 5 份资料/);
      await page.getByRole('button', { name: /起草材料说明/ }).click(); await page.getByRole('button', { name: '获取本地指引' }).click();
      await page.locator('.assistant-message.assistant').last().getByRole('button', { name: '复制内容' }).click(); assert.match(await page.evaluate(() => navigator.clipboard.readText()), /归档说明模板/);
      await page.locator('.assistant-message.assistant').last().getByRole('button', { name: /用于归档备注/ }).click();
      const dialog = page.getByRole('dialog', { name: '上传归档资料', exact: true });
      assert.match(await dialog.getByPlaceholder('选填，例如：本学期教学成果').inputValue(), /归档说明模板/);
      assert.equal(await dialog.locator('.queue-item').count(), 0); await dialog.getByRole('button', { name: '取消', exact: true }).click();
      assert.equal(upstream.length, 0);
    });
    await check('invalid access code is shown; connection test never invokes a model or persists credentials', async () => {
      await connect('wrong'); await page.getByText('服务访问码无效，请检查后重新连接。', { exact: true }).waitFor();
      await page.getByRole('textbox', { name: '服务访问码', exact: true }).fill('fixture-access-code');
      await page.getByRole('button', { name: '检查并连接', exact: true }).click();
      await page.getByRole('dialog', { name: '连接 AI 服务', exact: true }).waitFor({ state: 'hidden' });
      assert.equal(upstream.length, 0);
      const stored = await page.evaluate(() => JSON.stringify([Object.entries(localStorage), Object.entries(sessionStorage)]));
      assert.ok(!stored.includes('fixture-access-code')); assert.ok(!stored.includes('fixture-provider-only'));
    });
    await check('real gateway receives opted-in metadata and multi-turn history; replies cannot execute HTML', async () => {
      await send('请起草归档说明'); await settle(); assert.match(await page.locator('.assistant-message.assistant').last().innerText(), /模型接口测试回复/);
      assert.ok(upstream[0].messages.some(m => m.content.includes('课程建设阶段总结.png')));
      assert.ok(!JSON.stringify(upstream).includes('blob')); assert.ok(!JSON.stringify(upstream).includes('fixture-access-code'));
      await page.locator('.assistant-context-control .el-checkbox').click();
      assert.equal(await page.getByRole('checkbox', { name: '附带归档清单（最多 20 条）' }).isChecked(), false);
      mode = 'html'; await send('再简短一些'); await settle();
      assert.equal(upstream[1].messages.length, 4); assert.equal(upstream[1].messages[2].role, 'assistant');
      assert.ok(!JSON.stringify(upstream[1]).includes('课程建设阶段总结.png'));
      assert.equal(await page.locator('.message-content img').count(), 0); assert.match(await page.locator('.assistant-message.assistant').last().innerText(), /<img/);
    });
    await check('failure retains question; retry does not duplicate messages; cancel and navigation abort generation', async () => {
      mode = 'fail'; await send('检查材料是否齐全'); await settle(); await page.getByRole('button', { name: '重试上次请求' }).waitFor();
      assert.match(await page.locator('.assistant-error').innerText(), /额度不足/);
      const before = await page.locator('.assistant-message.user').count(); mode = 'success';
      await page.getByRole('button', { name: '重试上次请求' }).click(); await settle(); assert.equal(await page.locator('.assistant-message.user').count(), before);
      mode = 'slow'; await send('等待取消'); await page.getByRole('button', { name: '停止生成' }).click(); await settle(); await page.getByText('已停止生成，未收到回复。', { exact: true }).waitFor();
      await send('切换页面取消'); await go('资料归档'); await go('AI 助手'); await settle();
      assert.match(await page.locator('.assistant-error').innerText(), /已停止/);
      mode = 'success'; await send('恢复正常提问'); await settle(); assert.match(await page.locator('.assistant-message.assistant').last().innerText(), /模型接口测试回复/);
    });
    await check('mobile theme layout, clear and refresh remove conversation and connection', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('button', { name: '切换界面主题' }).click(); await page.getByRole('button', { name: '学院蓝' }).click(); await question().click();
      await page.getByRole('button', { name: '清空对话', exact: true }).click();
      await page.getByRole('dialog', { name: '清空对话' }).getByRole('button', { name: '清空', exact: true }).click();
      assert.equal(await page.locator('.assistant-message').count(), 0);
      await page.reload(); await page.getByText('离线指引 · 未连接大模型', { exact: true }).waitFor();
      await page.waitForFunction(() => document.querySelectorAll('.el-message').length === 0);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, 'mobile-assistant.png'), fullPage: true });
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, checks, upstreamCalls: upstream.length, realPaidModelCalls: 0, errors }, null, 2));
  } catch (error) { console.error(error); process.exitCode = 1; if (page) { fs.writeFileSync(path.join(output, 'failure.html'), await page.content()); await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }); } }
  finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})();
