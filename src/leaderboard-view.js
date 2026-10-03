import { rankResults, resultTime } from './leaderboard.js';

export function renderLeaderboard(host, results, currentId = null) {
  host.replaceChildren();
  const ranked = rankResults(results);
  if (!ranked.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No results yet';
    host.append(empty);
    return ranked;
  }
  const table = document.createElement('table');
  table.className = 'leaderboard-table';
  const caption = document.createElement('caption');
  caption.className = 'sr-only';
  caption.textContent = 'All attempts, ranked by guesses and completion time';
  table.append(caption);
  const head = table.createTHead().insertRow();
  for (const title of ['Rank', 'Player', 'Guesses', 'Time']) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = title;
    head.append(cell);
  }
  const body = table.createTBody();
  for (const result of ranked) {
    const row = body.insertRow();
    row.dataset.resultId = result.id;
    row.classList.toggle('top-five', result.topFive);
    row.classList.toggle('current-attempt', result.id === currentId);
    if (result.id === currentId) row.setAttribute('aria-current', 'true');
    for (const value of [result.rank ?? 'Not solved', result.playerName, result.guessesUsed, resultTime(result.elapsedMs)]) {
      row.insertCell().textContent = String(value);
    }
  }
  host.append(table);
  return ranked;
}

export function scrollToAttempt(host, id) {
  const row = [...host.querySelectorAll('[data-result-id]')].find((element) => element.dataset.resultId === id);
  if (!row) return;
  // scrollIntoView can move the page and hide the summary. Move only this list.
  const containerBounds = host.getBoundingClientRect();
  const rowBounds = row.getBoundingClientRect();
  const headerHeight = host.querySelector('thead').getBoundingClientRect().height;
  const top = host.scrollTop + rowBounds.top - containerBounds.top
    - headerHeight - Math.max(0, (host.clientHeight - headerHeight - rowBounds.height) / 2);
  host.scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
}
