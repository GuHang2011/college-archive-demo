const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
(async () => {
  const { createServer } = await import('../server/index.mjs');
  const { configFromEnv } = await import('../server/assistant.mjs');
  const server = createServer(configFromEnv({}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/college-archive-demo/`;
  const output = path.resolve(__dirname, '../test-results/workspace'); fs.mkdirSync(output, { recursive: true });
  let browser, page;
  const errors = [], checks = [];
  const check = async (name, action) => { await action(); checks.push(name); console.log('PASS ' + name); };
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.TEST_BROWSER_EXECUTABLE } : process.platform === 'win32' ? { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } : {}) });
    page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base); await page.locator('.el-loading-mask').waitFor({ state: 'hidden' });
    const go = name => page.getByRole('navigation').getByRole('button', { name: new RegExp('^' + name) }).click();
    const rows = page.locator('.archive-table .el-table__body tbody tr');
    await check('keyboard quick find opens a matched file detail without losing the current route', async () => {
      await page.keyboard.press('Control+k');
      const search = page.getByRole('dialog', { name: '快速查找' }); await search.waitFor();
      await search.getByRole('textbox').fill('实践教学');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      const detail = page.getByRole('dialog', { name: '资料详情' }); await detail.waitFor();
      await expect(detail.getByRole('heading', { name: '实践教学材料整理.png' })).toBeVisible();
      await expect(detail.getByText('请补充活动日期和材料说明。')).toBeVisible();
      assert.equal(new URL(page.url()).hash, '');
      const download = page.waitForEvent('download'); await detail.getByRole('button', { name: '下载文件', exact: true }).click();
      assert.equal((await download).suggestedFilename(), '实践教学材料整理.png');
      await search.waitFor({ state: 'hidden' });
      await page.screenshot({ path: path.join(output, 'desktop-file-details.png'), fullPage: true, animations: 'disabled' });
      await page.keyboard.press('Escape'); await detail.waitFor({ state: 'hidden' });
      await page.keyboard.press('Control+k'); await search.getByRole('textbox').fill('限时任务');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => location.hash === '#tasks');
    });
    await check('task views filter active and closed work and keep expired submissions disabled', async () => {
      const views = page.getByRole('group', { name: '任务状态视图' });
      await views.getByRole('button', { name: /^进行中/ }).click(); await expect(page.locator('.task-card')).toHaveCount(2);
      await expect(page.locator('.task-card').first()).toContainText('创新实践与学生成长记录');
      await views.getByRole('button', { name: /^已截止/ }).click(); await expect(page.locator('.task-card')).toHaveCount(1);
      await expect(page.getByRole('button', { name: '提交已截止', exact: true })).toBeDisabled();
      await views.getByRole('button', { name: /^全部任务/ }).click(); await expect(page.locator('.task-card')).toHaveCount(3);
    });
    await go('资料归档');
    await check('archive status, category, search and sort compose correctly with clearable empty results', async () => {
      const views = page.getByRole('group', { name: '资料状态视图' });
      await views.getByRole('button', { name: /^待审核/ }).click(); await expect(rows).toHaveCount(2);
      await page.getByLabel('按分类筛选', { exact: true }).click(); await page.locator('.el-select-dropdown__item').getByText('学生工作', { exact: true }).click(); await expect(rows).toHaveCount(1);
      await page.getByRole('textbox', { name: '搜索文件名或备注', exact: true }).fill('does-not-exist'); await expect(rows).toHaveCount(0);
      await page.locator('.archive-empty').getByRole('button', { name: '清除筛选', exact: true }).click(); await expect(rows).toHaveCount(5);
      await page.getByLabel('资料排序', { exact: true }).click(); await page.locator('.el-select-dropdown__item').getByText('最早归档', { exact: true }).click(); await expect(rows.first()).toContainText('实践教学材料整理.png');
      await page.getByRole('button', { name: '紧凑行距', exact: true }).click(); await expect(page.locator('.archive-table')).toHaveClass(/is-compact/);
      assert.equal(await rows.first().locator('.file-title strong').evaluate(el => parseFloat(getComputedStyle(el).fontSize)), 16);
    });
    await check('real uploads paginate and filters return to page one', async () => {
      await page.getByRole('button', { name: '上传资料', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: '上传归档资料', exact: true });
      const uploads = Array.from({ length: 9 }, (_, i) => ({ name: `workspace-${String(i).padStart(2, '0')}.pdf`, mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nfixture ' + i + '\n%%EOF') }));
      await dialog.locator('input[type=file]').setInputFiles(uploads); await dialog.getByRole('button', { name: '确认归档', exact: true }).click(); await dialog.waitFor({ state: 'hidden' });
      await expect(rows).toHaveCount(12);
      await page.locator('.el-pagination .btn-next').click(); await expect(rows).toHaveCount(2);
      await page.getByRole('textbox', { name: '搜索文件名或备注', exact: true }).fill('workspace-00'); await expect(rows).toHaveCount(1); await expect(rows.first()).toContainText('workspace-00.pdf');
      await page.locator('.active-filters').getByRole('button', { name: '清除筛选', exact: true }).click(); await expect(rows).toHaveCount(12);
    });
    await check('mobile archive offers details, preview and downloads directly at 390px and large type at 320px', async () => {
      await page.setViewportSize({ width: 390, height: 844 });
      const first = page.locator('.archive-mobile-record').first();
      await expect(first).toBeVisible(); await expect(page.locator('.archive-table')).toBeHidden();
      await first.locator('.mobile-file-title').click();
      const detail = page.getByRole('dialog', { name: '资料详情' }); await detail.waitFor();
      await detail.getByRole('button', { name: '预览文件', exact: true }).click(); await page.getByAltText('归档资料预览').waitFor();
      await page.keyboard.press('Escape'); await page.getByAltText('归档资料预览').waitFor({ state: 'hidden' });
      await expect(detail).toBeVisible(); await page.keyboard.press('Escape'); await detail.waitFor({ state: 'hidden' });
      const download = page.waitForEvent('download'); await first.getByRole('button', { name: '下载', exact: true }).click(); assert.equal((await download).suggestedFilename(), '实践教学材料整理.png');
      await page.getByRole('textbox', { name: '搜索文件名或备注', exact: true }).fill('实践教学');
      await page.screenshot({ path: path.join(output, 'mobile-archive.png'), fullPage: true });
      await page.setViewportSize({ width: 320, height: 900 });
      await page.getByRole('button', { name: '字体与阅读设置' }).click(); await page.getByRole('button', { name: '大字', exact: true }).click(); await page.getByRole('button', { name: '字体与阅读设置' }).click();
      await page.locator('.reading-settings').waitFor({ state: 'hidden' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await first.locator('.mobile-file-title').click(); await detail.waitFor(); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(output, '320-file-details.png'), fullPage: true });
    });
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ passed: true, checks, errors }, null, 2));
  } catch (error) { await page?.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {}); throw error; }
  finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
