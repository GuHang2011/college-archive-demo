// Check the redesigned routes at small, medium and large widths with real local data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
(async () => {
  const { createServer } = await import('../server/index.mjs');
  const { configFromEnv } = await import('../server/assistant.mjs');
  const server = createServer(configFromEnv({}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const output = path.resolve(__dirname, '../test-results/interface'); fs.mkdirSync(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.TEST_BROWSER_EXECUTABLE } : process.platform === 'win32' ? { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], checks = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(base); await page.getByRole('heading', { name: '最近归档', exact: true }).waitFor();
    await page.locator('.el-loading-mask').waitFor({ state: 'hidden' });
    const type = await page.evaluate(() => Object.fromEntries(['body', '.home-actions .el-button', '.recent-file-name strong', '.recent-file-name small'].map(selector => [selector, parseFloat(getComputedStyle(document.querySelector(selector)).fontSize)])));
    assert.equal(type.body, 16); assert.equal(type['.home-actions .el-button'], 15);
    assert.equal(type['.recent-file-name strong'], 16); assert.equal(type['.recent-file-name small'], 13);
    const colors = await page.locator('.recent-file-icon').evaluateAll(elements => elements.map(el => getComputedStyle(el).backgroundColor));
    assert.equal(new Set(colors).size, 4);
    await page.getByRole('group', { name: '首页资料筛选' }).getByRole('button', { name: /^待审核/ }).click();
    assert.equal(await page.locator('.recent-file').count(), 2);
    await page.getByRole('button', { name: '全部资料', exact: true }).click();
    assert.equal(await page.locator('.recent-file').count(), 5);
    checks.push('Default body and file names are 16px; metadata is 13px; categories have distinct colors');
    await page.locator('.role-select').click(); await page.locator('.el-select-dropdown__item').getByText('管理员体验', { exact: true }).click();
    const routes = [['工作台', 'overview'], ['资料归档', 'archives'], ['限时任务', 'tasks'], ['资料审核', 'audit'], ['AI 助手', 'assistant'], ['内部通讯', 'chat'], ['广播通知', 'broadcasts']];
    const checkWidth = async label => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `Page overflow: ${label}`);
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      for (const [label, route] of routes) {
        await page.getByRole('navigation').getByRole('button', { name: new RegExp('^' + label) }).click();
        await page.waitForFunction(({ route, label }) => location.hash === '#' + route && document.querySelector('nav button[aria-current="page"]')?.textContent.trim().startsWith(label), { route, label });
        await page.locator('main h1:visible').waitFor(); await checkWidth(`${width}/${route}`);
        if (route === 'assistant') {
          for (const title of ['整理归档清单', '起草材料说明', '检查审核要点', '如何拍照归档']) {
            assert.ok(await page.locator('.assistant-presets button > span').getByText(title, { exact: false }).isVisible(), `${width}px: shortcut label ${title} must remain visible`);
          }
        }
        await page.waitForFunction(() => [...document.querySelectorAll('main img')].filter(img => img.checkVisibility()).every(img => img.complete && img.naturalWidth > 0));
        if ([1440, 390].includes(width)) await page.screenshot({ path: path.join(output, `${width}-${route}.png`), fullPage: true, animations: 'disabled' });
      }
      checks.push(`${width}px: all seven routes fit the viewport`);
    }
    await page.getByRole('button', { name: '字体与阅读设置' }).click();
    await page.getByRole('button', { name: '大字', exact: true }).click();
    await page.getByRole('button', { name: '字体与阅读设置' }).click();
    await page.locator('.reading-settings').waitFor({ state: 'hidden' });
    for (const [label, route] of routes) {
      await page.getByRole('navigation').getByRole('button', { name: new RegExp('^' + label) }).click();
      await page.waitForFunction(route => location.hash === '#' + route, route);
      await checkWidth(`320px/large-type/${route}`);
    }
    checks.push('320px: all routes remain usable with large text; reading popover closes');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: '字体与阅读设置' }).click(); await page.getByRole('button', { name: '标准', exact: true }).click(); await page.getByRole('button', { name: '字体与阅读设置' }).click();
    await page.locator('.reading-settings').waitFor({ state: 'hidden' });
    await page.getByRole('navigation').getByRole('button', { name: '资料归档', exact: true }).click();
    await page.getByRole('button', { name: '上传资料', exact: true }).click();
    await page.getByRole('dialog', { name: '上传归档资料' }).waitFor();
    await page.screenshot({ path: path.join(output, '1440-upload.png'), fullPage: true, animations: 'disabled' });
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).click();
    await page.getByRole('navigation').getByRole('button', { name: '工作台', exact: true }).click();
    for (const name of ['极简白', '青竹绿', '学院蓝', '暖砂金', '海棠红']) {
      await page.getByRole('button', { name: '切换界面主题' }).click(); await page.getByRole('button', { name }).click();
      await page.getByRole('button', { name: '切换界面主题' }).click(); await checkWidth(name);
      assert.equal(await page.locator('.home-heading').evaluate(el => getComputedStyle(el).backgroundImage), 'none');
    }
    checks.push('All five color choices work with the neutral layout');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
    console.log(checks.map(check => 'PASS ' + check).join('\n'));
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
