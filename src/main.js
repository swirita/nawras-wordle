import './style.css';
import { RULES, selectWord } from './words.js';
import { isValidWord } from './dictionary.js';
import { evaluateGuess, updateKeyFeedback, elapsedMs, formatTime, eligibleHintPositions, revealHint } from './round.js';
import { gameState } from './state.js';
import { STORAGE_KEY, loadResults, saveResult, resultTime, attemptLabel, rankLabel } from './leaderboard.js';
import { renderLeaderboard, scrollToAttempt } from './leaderboard-view.js';
import { startParticles } from './particles.js';

const $ = (selector) => document.querySelector(selector);
const screens = [...document.querySelectorAll('.screen')];
const nameInput = $('#player-name');
const board = $('#board');
const keyboard = $('#keyboard');
const fullscreenButton = $('#fullscreen-button');
let fullscreenPending = false;
async function toggleFullscreen() {
  if (fullscreenPending) return;
  fullscreenPending = true;
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    fullscreenButton.textContent = 'Fullscreen unavailable';
  } finally {
    fullscreenPending = false;
  }
}
fullscreenButton.hidden = !document.fullscreenEnabled;
fullscreenButton.addEventListener('click', () => { void toggleFullscreen(); });
document.addEventListener('fullscreenchange', () => {
  const active = Boolean(document.fullscreenElement);
  fullscreenButton.textContent = active ? 'Exit fullscreen (F)' : 'Fullscreen (F)';
  fullscreenButton.setAttribute('aria-pressed', String(active));
});
// Survives navigation and leaderboard clearing, even when the round is discarded.
let previousAnswer = null;
let savedAttempts = loadResults();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let returnFocus = nameInput;
let timerInterval = null;
let messageTimeout = null;

function showScreen(id) {
  clearTimeout(messageTimeout);
  if (id !== 'game') stopTimer();
  screens.forEach((screen) => { screen.hidden = screen.id !== id; });
  if (id === 'landing') returnFocus.focus();
  else $(`#${id} h2`).focus();
}
function nameError(text) {
  $('#name-error').textContent = text;
  nameInput.setAttribute('aria-invalid', String(Boolean(text)));
}
function message(text) {
  clearTimeout(messageTimeout);
  $('#game-message').textContent = text;
  messageTimeout = setTimeout(() => { $('#game-message').textContent = ''; }, 1600);
}
function renderBoard() {
  board.replaceChildren();
  for (let row = 0; row < RULES.maxGuesses; row += 1) {
    const boardRow = document.createElement('div');
    boardRow.className = 'board-row';
    boardRow.setAttribute('role', 'row');
    for (let column = 0; column < RULES.wordLength; column += 1) {
      const cell = document.createElement('div');
      cell.className = 'tile';
      cell.setAttribute('role', 'cell');
      cell.setAttribute('aria-label', `Row ${row + 1}, letter ${column + 1}, empty`);
      boardRow.append(cell);
    }
    board.append(boardRow);
  }
}
function renderKeyboard() {
  keyboard.replaceChildren();
  for (const letters of ['QWERTYUIOP'.split(''), 'ASDFGHJKL'.split(''), ['Enter', ...'ZXCVBNM', 'Backspace']]) {
    const row = document.createElement('div');
    row.className = 'keyboard-row';
    letters.forEach((key) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `key${key.length > 1 ? ' key-wide' : ''}`;
      button.dataset.key = key;
      button.textContent = key === 'Backspace' ? '⌫' : key;
      button.setAttribute('aria-label', key);
      row.append(button);
    });
    keyboard.append(row);
  }
}
function updateTimer() {
  if (gameState.round) $('#elapsed-time').textContent = formatTime(elapsedMs(gameState.round));
}
function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
}
function syncTimer() {
  stopTimer();
  updateTimer();
  if (!document.hidden && gameState.round?.status === 'playing' && !$('#game').hidden) {
    timerInterval = setInterval(updateTimer, 250);
  }
}
function setInputLocked(locked) {
  keyboard.querySelectorAll('button').forEach((button) => { button.disabled = locked; });
  board.setAttribute('aria-busy', String(locked));
  updateRoundTools();
}
function updateRoundTools() {
  const round = gameState.round;
  $('#hint-button').textContent = `Hint (${round.hintsUsed}/3)`;
  $('#hint-button').disabled = !eligibleHintPositions(round).length;
  $('#retry-button').disabled = round.revealing || round.status !== 'playing';
  $('#hint-strip').textContent = [...round.word.answer].map((letter, index) =>
    round.hintPositions.includes(index) ? letter : '_').join(' ');
}
function startRound(playerName, isRetry = false) {
  const word = selectWord(previousAnswer);
  previousAnswer = word.answer;
  gameState.completedResult = null;
  gameState.round = {
    id: crypto.randomUUID(),
    playerName, word, guesses: [], currentGuess: '',
    hintsUsed: 0, hintPositions: [], isRetry,
    keys: {}, status: 'playing', revealing: false,
    startedAt: Date.now(), completedAt: null, completionTimeMs: null,
  };
  board.classList.remove('celebrating');
  renderBoard();
  renderKeyboard();
  setInputLocked(false);
  $('#game [data-back]').disabled = false;
  $('#category-hint').textContent = `Hint: ${word.category}${isRetry ? ' · Practice' : ''}`;
  clearTimeout(messageTimeout);
  $('#game-message').textContent = '';
  returnFocus = nameInput;
  showScreen('game');
  gameState.round.startedAt = Date.now();
  syncTimer();
}
function paintCurrentRow(typed = false) {
  const round = gameState.round;
  const tiles = [...board.children[round.guesses.length].children];
  tiles.forEach((tile, index) => {
    const letter = round.currentGuess[index] || '';
    tile.textContent = letter;
    tile.classList.toggle('filled', Boolean(letter));
    tile.setAttribute('aria-label', `Row ${round.guesses.length + 1}, letter ${index + 1}, ${letter || 'empty'}`);
  });
  if (typed && !motion.matches) tiles[round.currentGuess.length - 1].animate([
    { transform: 'scale(1)' }, { transform: 'scale(1.07)' }, { transform: 'scale(1)' },
  ], { duration: 120 });
}
async function animate(element, frames, duration) {
  if (motion.matches) return;
  await element.animate(frames, { duration, easing: 'ease-in-out' }).finished.catch(() => {});
}
async function submitGuess() {
  const round = gameState.round;
  const guess = round.currentGuess;
  if (guess.length !== RULES.wordLength) return message('Not enough letters');
  if (!isValidWord(guess)) return message('Word not found');
  clearTimeout(messageTimeout);
  $('#game-message').textContent = '';
  const rowIndex = round.guesses.length;
  const feedback = evaluateGuess(guess, round.word.answer);
  round.guesses.push({ word: guess, feedback });
  round.revealing = true;
  const won = guess === round.word.answer;
  if (won || round.guesses.length === RULES.maxGuesses) {
    round.completedAt = Date.now();
    round.completionTimeMs = elapsedMs(round);
    round.status = won ? 'won' : 'lost';
    gameState.completedResult = Object.freeze({
      id: round.id, playerName: round.playerName, answer: round.word.answer, category: round.word.category,
      won, guessesUsed: round.guesses.length, elapsedMs: round.completionTimeMs,
      completedAt: round.completedAt,
      hintsUsed: round.hintsUsed, isRetry: round.isRetry,
    });
    const stored = saveResult({
      id: round.id, playerName: round.playerName, word: round.word.answer, solved: won,
      guessesUsed: round.guesses.length, elapsedMs: round.completionTimeMs,
      completedAt: new Date(round.completedAt).toISOString(),
      hintsUsed: round.hintsUsed, isRetry: round.isRetry,
    }, savedAttempts);
    savedAttempts = stored.results;
    $('#save-message').textContent = stored.saved ? '' : 'This result could not be saved on this browser.';
    $('#game [data-back]').disabled = true;
    stopTimer();
    updateTimer();
  }
  setInputLocked(true);
  const tiles = [...board.children[rowIndex].children];
  for (let i = 0; i < tiles.length; i += 1) {
    await animate(tiles[i], [{ transform: 'rotateX(0deg)' }, { transform: 'rotateX(90deg)' }], 110);
    if (gameState.round !== round) return;
    tiles[i].dataset.feedback = feedback[i];
    tiles[i].setAttribute('aria-label', `Row ${rowIndex + 1}, letter ${i + 1}, ${guess[i]}, ${feedback[i]}`);
    await animate(tiles[i], [{ transform: 'rotateX(90deg)' }, { transform: 'rotateX(0deg)' }], 110);
    if (gameState.round !== round) return;
  }
  updateKeyFeedback(round.keys, guess, feedback);
  keyboard.querySelectorAll('button').forEach((button) => {
    if (round.keys[button.dataset.key]) button.dataset.feedback = round.keys[button.dataset.key];
  });
  round.revealing = false;
  round.currentGuess = '';
  updateRoundTools();
  if (round.status === 'playing') {
    setInputLocked(false);
    $('#game-title').focus();
    return;
  }
  if (won) {
    board.classList.add('celebrating');
    await Promise.all(tiles.map((tile) => animate(tile, [
      { transform: 'translateY(0)' }, { transform: 'translateY(-9px)' }, { transform: 'translateY(0)' },
    ], 420)));
    board.classList.remove('celebrating');
  }
  if (gameState.round !== round) return;
  $('#result-title').textContent = won ? 'Solved!' : 'Not solved';
  $('#result-answer').textContent = round.word.answer;
  $('#result-guesses').textContent = String(round.guesses.length);
  $('#result-time').textContent = resultTime(round.completionTimeMs);
  const ranked = renderLeaderboard($('#result-leaderboard'), savedAttempts, round.id);
  const current = ranked.find(({ id }) => id === round.id);
  $('#result-rank').textContent = rankLabel(current);
  $('#result-badge').textContent = attemptLabel(current);
  $('#result-badge').hidden = !attemptLabel(current);
  showScreen('result');
  requestAnimationFrame(() => {
    if (!$('#result').hidden && gameState.completedResult?.id === round.id) scrollToAttempt($('#result-leaderboard'), round.id);
  });
}
function handleKey(key) {
  const round = gameState.round;
  if ($('#game').hidden || !round || round.status !== 'playing' || round.revealing) return;
  if (key === 'Enter') { void submitGuess(); return; }
  if (key === 'Backspace') {
    round.currentGuess = round.currentGuess.slice(0, -1);
    paintCurrentRow();
  } else if (/^[a-z]$/i.test(key) && round.currentGuess.length < RULES.wordLength) {
    round.currentGuess += key.toUpperCase();
    paintCurrentRow(true);
  }
}
$('#name-form').addEventListener('submit', (event) => {
  event.preventDefault();
  const playerName = nameInput.value.trim();
  if (!playerName || playerName.length > 24) {
    nameError(playerName ? 'Use 24 characters or fewer.' : 'Please enter your name.');
    nameInput.focus();
    return;
  }
  nameError('');
  nameInput.value = playerName;
  startRound(playerName);
});
nameInput.addEventListener('input', () => nameError(''));
$('#hint-button').addEventListener('click', () => {
  if (revealHint(gameState.round)) updateRoundTools();
});
function retryRound() {
  const round = gameState.round;
  if (!round || round.revealing) return;
  if (round.status === 'playing') {
    if (!window.confirm('Start a new round?')) return;
    round.status = 'abandoned';
  }
  startRound(round.playerName, true);
}
$('#retry-button').addEventListener('click', retryRound);
$('#result-retry').addEventListener('click', retryRound);
function renderFullLeaderboard() {
  renderLeaderboard($('#full-leaderboard'), savedAttempts);
  $('#clear-leaderboard').disabled = savedAttempts.length === 0;
}
$('#leaderboard-button').addEventListener('click', () => {
  returnFocus = $('#leaderboard-button');
  $('#clear-message').textContent = '';
  renderFullLeaderboard();
  showScreen('leaderboard');
});
$('#clear-leaderboard').addEventListener('click', () => {
  if (!savedAttempts.length || !window.confirm('Clear all leaderboard results? This cannot be undone.')) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    $('#clear-message').textContent = 'Leaderboard could not be cleared on this browser.';
    return;
  }
  savedAttempts = [];
  renderFullLeaderboard();
  $('#clear-message').textContent = 'Leaderboard cleared.';
  $('#leaderboard-title').focus();
});
document.querySelectorAll('[data-back]').forEach((button) => {
  button.addEventListener('click', () => {
    if (!$('#game').hidden && gameState.round) {
      if (gameState.round.status !== 'playing') return;
      if (!window.confirm('Leave this round?')) return;
      gameState.round.status = 'abandoned';
      gameState.round = null;
      stopTimer();
    }
    showScreen('landing');
  });
});
$('#next-player').addEventListener('click', () => {
  stopTimer();
  gameState.round = null;
  nameInput.value = '';
  nameError('');
  returnFocus = nameInput;
  showScreen('landing');
});
keyboard.addEventListener('click', (event) => {
  const button = event.target.closest('[data-key]');
  if (button) handleKey(button.dataset.key);
});
document.addEventListener('keydown', (event) => {
  if (event.isComposing || event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')) return;
  if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && document.fullscreenEnabled) {
    event.preventDefault();
    if (!event.repeat) void toggleFullscreen();
    return;
  }
  if ($('#game').hidden) return;
  if (event.key.toLowerCase() === 'f' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
    event.preventDefault();
    if (!event.repeat) handleKey('F');
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    // Modified Enter must not trigger a keyboard button's native click.
    if (event.key === 'Enter') event.preventDefault();
    return;
  }
  if (!/^[a-z]$/i.test(event.key) && !['Enter', 'Backspace'].includes(event.key)) return;
  if (event.key === 'Enter' && event.target.closest('button:not([data-key])')) return;
  event.preventDefault();
  if (!event.repeat) handleKey(event.key);
});
window.addEventListener('beforeunload', (event) => {
  if (gameState.round?.status === 'playing') {
    event.preventDefault();
    event.returnValue = '';
  }
});
document.addEventListener('visibilitychange', syncTimer);
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  const currentAttempt = savedAttempts.find(({ id }) => id === gameState.completedResult?.id);
  savedAttempts = loadResults();
  // Keep this browser tab's just-completed attempt visible even if another tab
  // removes or corrupts storage while its final tiles are still revealing.
  if (currentAttempt && gameState.round?.revealing && event.newValue !== null
    && !savedAttempts.some(({ id }) => id === currentAttempt.id)) savedAttempts.push(currentAttempt);
  if (!$('#leaderboard').hidden) renderFullLeaderboard();
  if (!$('#result').hidden && gameState.completedResult) {
    const ranked = renderLeaderboard($('#result-leaderboard'), savedAttempts, gameState.completedResult.id);
    const current = ranked.find(({ id }) => id === gameState.completedResult.id);
    $('#result-rank').textContent = current ? rankLabel(current) : 'Result removed from leaderboard';
    scrollToAttempt($('#result-leaderboard'), gameState.completedResult.id);
  }
});
startParticles($('#particles'));
