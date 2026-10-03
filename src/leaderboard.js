import { formatTime } from './round.js';

export const STORAGE_KEY = 'nawras-wordle.results.v1';
export const roundedSeconds = (elapsedMs) => Math.round(elapsedMs / 1000);
export const resultTime = (elapsedMs) => formatTime(roundedSeconds(elapsedMs) * 1000);

function validResult(value) {
  return value && typeof value === 'object'
    && typeof value.id === 'string' && value.id.length > 0 && value.id.length <= 128
    && typeof value.playerName === 'string' && value.playerName.trim().length > 0 && value.playerName.length <= 24
    && typeof value.word === 'string' && /^[A-Z]{5}$/.test(value.word)
    && typeof value.solved === 'boolean'
    && (value.hintsUsed === undefined || (Number.isInteger(value.hintsUsed) && value.hintsUsed >= 0 && value.hintsUsed <= 3))
    && (value.isRetry === undefined || typeof value.isRetry === 'boolean')
    && Number.isInteger(value.guessesUsed) && value.guessesUsed >= 1 && value.guessesUsed <= 6
    && (value.solved || value.guessesUsed === 6)
    && Number.isFinite(value.elapsedMs) && value.elapsedMs >= 0 && value.elapsedMs <= Number.MAX_SAFE_INTEGER
    && typeof value.completedAt === 'string' && Number.isFinite(Date.parse(value.completedAt));
}

function cleanResults(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.filter((value) => {
    if (!validResult(value) || seen.has(value.id)) return false;
    seen.add(value.id);
    return true;
  }).map(({ id, playerName, word, solved, guessesUsed, elapsedMs, completedAt, hintsUsed = 0, isRetry = false }) =>
    ({ id, playerName, word, solved, guessesUsed, elapsedMs, completedAt, hintsUsed, isRetry }));
}

export const attemptLabel = (result) => result.isRetry ? 'Practice' : result.hintsUsed > 0 ? 'Assisted' : '';
export const competitive = (result) => result.solved && !attemptLabel(result);
export const rankLabel = (result) => attemptLabel(result)
  ? `${attemptLabel(result)}${result.solved ? '' : ' · Not solved'}`
  : result.rank ? `Rank ${result.rank}` : 'Not solved';

export function loadResults(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    return cleanResults(raw ? JSON.parse(raw) : []);
  } catch {
    return [];
  }
}

// An ID is allocated once per round. Saving or displaying it again is idempotent.
// Merge in-memory entries so a temporary storage failure doesn't discard them.
export function saveResult(result, fallback = [], storage) {
  const memory = cleanResults([...fallback, result]);
  try {
    const target = storage ?? globalThis.localStorage;
    const saved = loadResults(target);
    const results = cleanResults([...saved, ...memory]);
    if (results.some(({ id }) => id === result.id) && !saved.some(({ id }) => id === result.id)) {
      target.setItem(STORAGE_KEY, JSON.stringify(results));
    }
    return { results, saved: saved.some(({ id }) => id === result.id) || results.some(({ id }) => id === result.id) };
  } catch {
    return { results: memory, saved: false };
  }
}

export function rankResults(results) {
  const successes = results.filter(competitive).sort((a, b) =>
    a.guessesUsed - b.guessesUsed
    || roundedSeconds(a.elapsedMs) - roundedSeconds(b.elapsedMs)
    || Date.parse(a.completedAt) - Date.parse(b.completedAt));
  let rank = 0;
  const ranked = successes.map((result, index) => {
    const previous = successes[index - 1];
    if (!previous || previous.guessesUsed !== result.guessesUsed
      || roundedSeconds(previous.elapsedMs) !== roundedSeconds(result.elapsedMs)) rank = index + 1;
    return { ...result, rank, topFive: rank <= 5 };
  });
  const unsuccessful = results.filter((result) => !competitive(result))
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt))
    .map((result) => ({ ...result, rank: null, topFive: false }));
  return [...ranked, ...unsuccessful];
}
