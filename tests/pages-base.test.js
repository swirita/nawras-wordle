import test from 'node:test';
import assert from 'node:assert/strict';
import { pagesBase } from '../scripts/pages-base.js';

test('local and account sites use root; repository sites derive their path', () => {
  assert.equal(pagesBase({}), '/');
  assert.equal(pagesBase({ GITHUB_REPOSITORY: 'Nawras/nawras.github.io' }), '/');
  assert.equal(pagesBase({ GITHUB_REPOSITORY: 'Nawras/New-Wordle' }), '/New-Wordle/');
});
test('Pages metadata supports repository paths and root/custom domains', () => {
  const repository = { GITHUB_REPOSITORY: 'Nawras/New-Wordle' };
  assert.equal(pagesBase({ ...repository, PAGES_BASE_PATH: '/New-Wordle' }), '/New-Wordle/');
  assert.equal(pagesBase({ ...repository, PAGES_BASE_PATH: '' }), '/');
  assert.equal(pagesBase({ ...repository, PAGES_BASE_PATH: '/' }), '/');
});
