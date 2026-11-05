const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
(async () => {
  const { createCollaboration } = await import('../server/collaboration.mjs');
  const { createServer } = await import('../server/index.mjs');
  const { configFromEnv } = await import('../server/assistant.mjs');
  const root = path.resolve(__dirname, '../test-results/collaboration'); fs.mkdirSync(root, { recursive: true });
  const directory = fs.mkdtempSync(path.join(root, 'browser-db-')), service = createCollaboration(directory);
  const password = 'browser-fixture-password', ids = [];
  for (const [username, name, role] of [['admin', '学院管理员', 'admin'], ['teacher1', '林老师', 'member'], ['teacher2', '周老师', 'member']]) ids.push(await service.addUser({ username, name, role, password }));
  service.setupRoom('学院工作群', ids[0], ids);
  const server = createServer(configFromEnv({}), fetch, service);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`; let browser;
  const checks = [], errors = [], pages = [];
  const check = async (name, action) => { await action(); checks.push(name); console.log('PASS ' + name); };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.TEST_BROWSER_EXECUTABLE } : process.platform === 'win32' ? { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } : {}) });
    const open = async username => {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, acceptDownloads: true });
      const page = await context.newPage(); pages.push(page); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/#chat'); await page.getByLabel('通讯账号', { exact: true }).fill(username); await page.getByLabel('通讯密码', { exact: true }).fill(password);
      await page.getByRole('button', { name: '登录并连接', exact: true }).click(); await page.getByRole('heading', { name: '学院工作群', exact: true }).waitFor();
      return page;
    };
    const go = (page, name) => page.getByRole('navigation', { name: '演示功能导航' }).getByRole('button', { name: new RegExp('^' + name) }).click();
    const send = async (page, content) => { await page.getByRole('textbox', { name: '聊天消息内容', exact: true }).fill(content); await page.getByRole('button', { name: '发送消息', exact: true }).click(); await page.waitForFunction(() => document.querySelector('#chat-input')?.value === ''); };
    const teacher = await open('teacher1'), receiver = await open('teacher2'), admin = await open('admin');
    await check('three isolated browsers exchange real persisted messages and binary attachments without API mocks', async () => {
      await send(teacher, '各位老师好，请在这里交流归档资料。');
      await receiver.locator('.chat-bubble').getByText('各位老师好，请在这里交流归档资料。', { exact: true }).waitFor();
      await admin.locator('.chat-bubble').getByText('各位老师好，请在这里交流归档资料。', { exact: true }).waitFor();
      const file = Buffer.from('多人通讯附件内容\n' + 'archive '.repeat(1000));
      await teacher.getByLabel('添加聊天附件', { exact: true }).setInputFiles({ name: '课程归档说明.txt', mimeType: 'text/plain', buffer: file });
      await send(teacher, '请查收课程归档说明附件。');
      const attachment = receiver.locator('.chat-attachment').filter({ hasText: '课程归档说明.txt' }); await attachment.waitFor();
      const download = receiver.waitForEvent('download'); await attachment.getByRole('button', { name: '下载', exact: true }).click();
      const stream = await (await download).createReadStream(), chunks = []; for await (const chunk of stream) chunks.push(chunk); assert.ok(Buffer.concat(chunks).equals(file));
    });
    await check('group pins synchronize live; ordinary members cannot pin and unread counts clear on reading', async () => {
      assert.equal(await teacher.getByRole('button', { name: '置顶消息', exact: true }).count(), 0);
      await admin.locator('.chat-message').filter({ hasText: '各位老师好，请在这里交流归档资料。' }).getByRole('button', { name: '置顶消息', exact: true }).click();
      await receiver.locator('.pinned-messages').getByText('各位老师好，请在这里交流归档资料。', { exact: false }).waitFor();
      await go(receiver, '工作台'); await send(teacher, '这是一条未读提醒消息。');
      await receiver.waitForFunction(() => [...document.querySelectorAll('nav button')].find(button => button.textContent.includes('内部通讯'))?.querySelector('.nav-count')?.textContent === '1');
      await go(receiver, '内部通讯'); await receiver.locator('.chat-bubble').getByText('这是一条未读提醒消息。', { exact: true }).waitFor();
      await receiver.waitForFunction(() => ![...document.querySelectorAll('nav button')].find(button => button.textContent.includes('内部通讯'))?.querySelector('.nav-count'));
    });
    await check('private conversation is visible only to its two participants and ordinary members can create groups', async () => {
      await teacher.getByRole('button', { name: '联系人', exact: true }).click(); await teacher.locator('.conversation-item').filter({ hasText: '周老师' }).click();
      await teacher.getByRole('heading', { name: '周老师', exact: true }).waitFor(); await send(teacher, '这是一条仅两人可见的私聊。');
      await receiver.locator('.conversation-item').filter({ hasText: '林老师' }).click(); await receiver.locator('.chat-bubble').getByText('这是一条仅两人可见的私聊。', { exact: true }).waitFor();
      assert.equal(await admin.locator('.conversation-item').count(), 1);
      await teacher.getByRole('button', { name: '新建群聊', exact: true }).click(); const group = teacher.getByRole('dialog', { name: '新建工作群' });
      await group.getByRole('textbox', { name: '群名称', exact: true }).fill('课程建设工作组'); await group.getByRole('checkbox', { name: '周老师' }).check(); await group.getByRole('button', { name: '创建群聊', exact: true }).click();
      await teacher.getByRole('heading', { name: '课程建设工作组', exact: true }).waitFor(); await send(teacher, '工作组已建立，欢迎交流。');
      await receiver.locator('.conversation-item').filter({ hasText: '课程建设工作组' }).click(); await receiver.locator('.chat-bubble').getByText('工作组已建立，欢迎交流。', { exact: true }).waitFor();
    });
    await check('administrator broadcasts, pins and read marks synchronize; demo role switch grants no broadcast permission', async () => {
      await go(admin, '广播通知'); await admin.getByRole('button', { name: '发布广播', exact: true }).click(); const dialog = admin.getByRole('dialog', { name: '发布广播', exact: true });
      await dialog.getByRole('textbox', { name: '广播标题', exact: true }).fill('关于本周教学资料归档的提醒'); await dialog.getByRole('textbox', { name: '广播内容', exact: true }).fill('请各位老师核对课程材料、附件日期与分类。资料可通过内部通讯交流，确认后再归档。'); await dialog.getByRole('button', { name: '确认发布', exact: true }).click();
      await admin.getByRole('button', { name: '置顶广播', exact: true }).click();
      await go(receiver, '广播通知'); await receiver.getByRole('heading', { name: '关于本周教学资料归档的提醒', exact: true }).waitFor(); await receiver.locator('.broadcast-pin').waitFor();
      assert.equal(await receiver.getByRole('button', { name: '发布广播', exact: true }).count(), 0);
      await receiver.locator('.role-select').click(); await receiver.locator('.el-select-dropdown__item').getByText('管理员体验', { exact: true }).click();
      assert.equal(await receiver.getByRole('button', { name: '发布广播', exact: true }).count(), 0);
      await receiver.getByRole('button', { name: '标记已读', exact: true }).click(); await receiver.locator('.broadcast-card footer').getByText('已读', { exact: true }).waitFor();
      await receiver.getByRole('heading', { name: '广播通知', exact: true }).click();
      await receiver.screenshot({ path: path.join(root, 'desktop-broadcast.png'), fullPage: true });
    });
    await check('reading settings persist and mobile chat remains usable with larger type', async () => {
      await teacher.getByRole('button', { name: '字体与阅读设置' }).click(); await teacher.getByRole('button', { name: '舒适', exact: true }).click(); await teacher.getByRole('button', { name: '阅读宋体', exact: true }).click();
      await teacher.reload(); await teacher.getByRole('button', { name: '登录并连接' }).waitFor(); assert.equal(await teacher.evaluate(() => document.documentElement.style.getPropertyValue('--reader-scale')), '1.12');
      await teacher.getByRole('button', { name: '字体与阅读设置' }).click(); await teacher.getByRole('button', { name: '清晰黑体', exact: true }).click(); await teacher.getByRole('heading', { name: '内部通讯', exact: true }).click();
      await teacher.getByLabel('通讯账号', { exact: true }).fill('teacher1'); await teacher.getByLabel('通讯密码', { exact: true }).fill(password); await teacher.getByRole('button', { name: '登录并连接' }).click();
      await teacher.getByRole('heading', { name: '课程建设工作组', exact: true }).waitFor();
      await teacher.setViewportSize({ width: 390, height: 844 }); await teacher.waitForFunction(() => document.querySelectorAll('.el-message').length === 0);
      assert.ok(await teacher.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await teacher.screenshot({ path: path.join(root, 'mobile-chat.png'), fullPage: true });
      await admin.setViewportSize({ width: 1440, height: 1100 }); await go(admin, '内部通讯'); await admin.waitForFunction(() => document.querySelectorAll('.el-message').length === 0); await admin.screenshot({ path: path.join(root, 'desktop-chat.png'), fullPage: true });
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(root, 'browser-report.json'), JSON.stringify({ passed: true, checks, realServer: true, independentBrowserSessions: 3, mockedApis: false, errors }, null, 2));
  } catch (error) { console.error(error); process.exitCode = 1; for (let index = 0; index < pages.length; index++) { await pages[index].screenshot({ path: path.join(root, `failure-${index}.png`), fullPage: true }).catch(() => {}); fs.writeFileSync(path.join(root, `failure-${index}.html`), await pages[index].content().catch(() => '')); } }
  finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); service.close(); assert.ok(directory.startsWith(root + path.sep)); fs.rmSync(directory, { recursive: true, force: true }); }
})();
