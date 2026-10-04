import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { build } from 'vite';
import { launchBrowser, stubWordRandom } from './browser.js';
import { pagesBase } from '../scripts/pages-base.js';
import { STORAGE_KEY } from '../src/leaderboard.js';

const originalRepository = process.env.GITHUB_REPOSITORY;
const originalBase = process.env.PAGES_BASE_PATH;
const browser = await launchBrowser();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
try {
  for (const repository of ['pages-test/repository-check', 'pages-test/pages-test.github.io', 'swirita/nawras-wordle']) {
    process.env.GITHUB_REPOSITORY = repository;
    delete process.env.PAGES_BASE_PATH;
    const base = pagesBase();
    const directory = resolve('.checks', base === '/' ? 'pages-root' : 'pages-repository');
    await build({ build: { outDir: directory, emptyOutDir: true } });
    const html = await readFile(resolve(directory, 'index.html'), 'utf8');
    assert.ok(html.includes(`${base}assets/nawras-small.png`));
    assert.ok(!html.includes('%BASE_URL%'));
    // Strict static file serving: no Vite SPA fallback to mask refresh failures.
    const server = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        if (!pathname.startsWith(base)) throw Error('Outside base');
        const relative = pathname.slice(base.length) || 'index.html';
        const file = resolve(directory, relative);
        if (!file.startsWith(directory + sep) || !(await stat(file)).isFile()) throw Error('Missing file');
        response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream' });
        response.end(await readFile(file));
      } catch { response.writeHead(404); response.end('Not found'); }
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    const context = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } });
    try {
      const page = await context.newPage();
      const failures = [];
      page.on('pageerror', (error) => failures.push(error.message));
      page.on('response', (response) => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`); });
      await page.addInitScript(stubWordRandom, 0);
      const url = `http://127.0.0.1:${server.address().port}${base}`;
      assert.equal((await page.goto(url)).status(), 200);
      assert.equal(await page.title(), 'Nawras Wordle');
      assert.equal(await page.locator('link[rel="icon"]').getAttribute('href'), `${base}assets/nawras-small.png`);
      assert.ok(await page.locator('#landing .brand').evaluate((image) => image.complete && image.naturalWidth === 2172));
      assert.equal((await page.request.get(`${url}assets/nawras-small.png`)).status(), 200);
      await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
      assert.ok(await page.getByText('No results yet', { exact: true }).isVisible());
      assert.equal(page.url(), url);
      assert.equal((await page.reload()).status(), 200);
      await page.getByLabel('Enter your name', { exact: true }).fill('Pages player');
      await page.getByLabel('Enter your name', { exact: true }).press('Enter');
      assert.ok(await page.locator('#game').isVisible());
      assert.ok(await page.locator('#game .brand').evaluate((image) => image.complete && image.naturalWidth > 0));
      assert.equal(await page.locator('#category-hint').innerText(), 'Hint: Data Structures');
      // The bundled dictionary must accept a non-answer English word offline.
      await context.setOffline(true);
      for (const word of ['house', 'stack']) {
        await page.keyboard.type(word);
        await page.keyboard.press('Enter');
        await page.waitForSelector('#board[aria-busy="false"], #result:not([hidden])');
      }
      await page.waitForSelector('#result:not([hidden])');
      assert.equal(await page.locator('#result-title').innerText(), 'Solved!');
      assert.equal(await page.locator('#result-guesses').innerText(), '2');
      assert.equal(await page.locator('#result-answer').innerText(), 'STACK');
      const attempts = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), STORAGE_KEY);
      assert.equal(attempts.length, 1);
      assert.equal(attempts[0].word, 'STACK');
      assert.equal(attempts[0].solved, true);
      assert.equal(await page.locator('#result-leaderboard .current-attempt').getAttribute('data-result-id'), attempts[0].id);
      await context.setOffline(false);
      await page.getByRole('button', { name: 'Next Player', exact: true }).click();
      assert.equal(await page.getByLabel('Enter your name', { exact: true }).inputValue(), '');
      assert.equal((await page.reload()).status(), 200);
      await page.getByRole('button', { name: 'Leaderboard', exact: true }).click();
      assert.equal(await page.locator('#full-leaderboard tbody tr').count(), 1);
      assert.equal(await page.locator('#full-leaderboard tbody tr').getAttribute('data-result-id'), attempts[0].id);
      await page.getByRole('button', { name: '← Back', exact: true }).click();
      assert.ok(await page.locator('#landing').isVisible());
      assert.equal(page.url(), url);
      assert.deepEqual(failures, []);
      console.log(`PASS ${base}: strict static hosting, branding/favicon, offline dictionary, navigation/refresh, complete game, unique saved result and same-origin persistence.`);
    } finally {
      await context.close();
      await new Promise((done) => server.close(done));
    }
  }
} finally {
  await browser.close();
  if (originalRepository === undefined) delete process.env.GITHUB_REPOSITORY;
  else process.env.GITHUB_REPOSITORY = originalRepository;
  if (originalBase === undefined) delete process.env.PAGES_BASE_PATH;
  else process.env.PAGES_BASE_PATH = originalBase;
}
