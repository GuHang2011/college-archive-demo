const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');

(async () => {
  const { createServer } = await import('../server/index.mjs');
  const { configFromEnv } = await import('../server/assistant.mjs');
  const server = createServer(configFromEnv({}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = process.env.PHOTO_BASE_URL || `http://127.0.0.1:${server.address().port}/college-archive-demo/`;
  const output = path.resolve(__dirname, '../test-results/photography');
  fs.mkdirSync(output, { recursive: true });
  let browser;
  try {
    browser = await chromium.launch({ headless: true, ...(process.env.TEST_BROWSER_EXECUTABLE ? { executablePath: process.env.TEST_BROWSER_EXECUTABLE } : process.platform === 'win32' ? { executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [], external = [], responses = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) external.push(request.url()); });
    page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); if (response.url().includes('/photos/')) responses.push({ url: response.url(), type: response.headers()['content-type'] }); });
    await page.goto(base, { waitUntil: 'networkidle' });
    await page.locator('.el-loading-mask').waitFor({ state: 'hidden' });
    const gallery = page.locator('.home-opening .photo-gallery');
    assert.equal(await gallery.locator('.photo-tile').count(), 3);
    await page.waitForFunction(() => [...document.querySelectorAll('.home-opening img, .recent-file-icon img')].every(img => img.complete && img.naturalWidth > 0));
    assert.equal(await page.locator('.recent-file-icon img').count(), 5);
    const sizes = [];
    for (const width of [1440, 1024, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      if (width === 1440 || width === 390) await page.screenshot({ path: path.join(output, `${width}-overview.png`), fullPage: true });
      sizes.push(width);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    const titles = ['书页与文献', '阅读与整理', '桌面与记录'];
    const authors = ['Patrick Tomasso', 'Alejandro Escamilla', 'Galymzhan Abdugalimov'];
    await gallery.getByRole('button', { name: '查看摄影素材：书页与文献' }).click();
    for (let i = 0; i < titles.length; i++) {
      const dialog = page.getByRole('dialog', { name: /^摄影素材/ });
      await dialog.getByRole('group', { name: '选择摄影素材' }).getByRole('button', { name: titles[i] }).click();
      await page.waitForFunction(() => document.querySelector('.photo-preview-image')?.naturalWidth === 1200);
      assert.ok((await dialog.locator('.photo-preview-caption').innerText()).includes(authors[i]));
      assert.match(await dialog.getByRole('link', { name: /原始作品/ }).getAttribute('href'), /^https:\/\/unsplash.com\/photos\//);
      assert.equal(await dialog.getByRole('link', { name: /使用许可/ }).getAttribute('href'), 'https://unsplash.com/license');
    }
    await page.screenshot({ path: path.join(output, 'photo-source-preview.png'), fullPage: true });
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: /^摄影素材/ }).waitFor({ state: 'hidden' });
    await page.getByRole('navigation').getByRole('button', { name: '内部通讯', exact: true }).click();
    await page.locator('.collab-login .photo-tile').click();
    await page.getByRole('dialog', { name: '摄影素材 · 桌面与记录' }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: /^摄影素材/ }).waitFor({ state: 'hidden' });
    await page.screenshot({ path: path.join(output, '1440-chat.png'), fullPage: true });
    await page.getByRole('navigation').getByRole('button', { name: '资料归档', exact: true }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('.file-symbol img')].length === 5 && [...document.querySelectorAll('.file-symbol img')].every(img => img.complete && img.naturalWidth > 0));
    await page.getByRole('button', { name: '上传资料', exact: true }).click();
    const upload = page.getByRole('dialog', { name: '上传归档资料', exact: true });
    await upload.locator('input[type=file]').setInputFiles(path.resolve(__dirname, '../public/photos/reading.jpg'));
    await upload.getByRole('button', { name: '确认归档', exact: true }).click();
    await upload.waitFor({ state: 'hidden' });
    await page.reload();
    await page.waitForFunction(() => document.querySelectorAll('.file-symbol img').length === 6);
    const row = page.locator('.archive-table .el-table__body tbody tr').filter({ hasText: 'reading.jpg' });
    await row.getByRole('button', { name: '预览', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.document-preview')?.naturalWidth === 1200);
    await page.getByRole('dialog').getByRole('button', { name: '关闭', exact: true }).click();
    await page.getByRole('dialog').waitFor({ state: 'hidden' });
    await page.setViewportSize({ width: 320, height: 900 });
    await page.getByRole('navigation').getByRole('button', { name: '工作台', exact: true }).click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    assert.deepEqual(errors, []); assert.deepEqual(external, []);
    assert.ok(responses.some(item => /image\/jpeg/.test(item.type)));
    assert.ok(responses.some(item => /image\/webp/.test(item.type)));
    const report = { passed: true, base, galleryPhotos: 3, authors, widths: sizes, uploadedPhotoSurvivesReload: true, errors, externalRequests: external };
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    console.log('PASS real photographs load under project subpath; source credits, switching, mobile layout, persisted upload thumbnails and image MIME types; no third-party requests.');
  } finally { await browser?.close(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
