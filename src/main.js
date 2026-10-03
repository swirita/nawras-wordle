import './style.css';
import { RULES, selectWord } from './words.js';
import { isValidWord } from './dictionary.js';
import { evaluateGuess, updateKeyFeedback, elapsedMs, formatTime } from './round.js';
import { gameState } from './state.js';
import { STORAGE_KEY, loadResults, saveResult, resultTime } from './leaderboard.js';
import { renderLeaderboard, scrollToAttempt } from './leaderboard-view.js';
import { startParticles } from './particles.js';

const $ = (selector) => document.querySelector(selector);
const screens = [...document.querySelectorAll('.screen')];
const nameInput = $('#player-name');
const board = $('#board');
const keyboard = $('#keyboard');
const assignments = new Map();
let savedAttempts = loadResults();
const motion = matchMedia('(prefers-reduced-motion: reduce)');
let returnFocus = nameInput;
let timerInterval = null;
let messageTimeout = null;

function showScreen(id) {
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
function setInputLocked(locked) {
  keyboard.querySelectorAll('button').forEach((button) => { button.disabled = locked; });
  board.setAttribute('aria-busy', String(locked));
}
function startRound(playerName) {
  const playerKey = playerName.toLocaleLowerCase('en');
  if (!assignments.has(playerKey)) assignments.set(playerKey, selectWord());
  gameState.round = {
    id: crypto.randomUUID(),
    playerName, word: assignments.get(playerKey), guesses: [], currentGuess: '',
    keys: {}, status: 'playing', revealing: false,
    startedAt: Date.now(), completedAt: null, completionTimeMs: null,
  };
  board.classList.remove('celebrating');
  renderBoard();
  renderKeyboard();
  setInputLocked(false);
  $('#game [data-back]').disabled = false;
  $('#category-hint').textContent = `Hint: ${gameState.round.word.category}`;
  clearTimeout(messageTimeout);
  $('#game-message').textContent = '';
  returnFocus = nameInput;
  showScreen('game');
  gameState.round.startedAt = Date.now();
  updateTimer();
  stopTimer();
  timerInterval = setInterval(updateTimer, 250);
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
    });
    const stored = saveResult({
      id: round.id, playerName: round.playerName, word: round.word.answer, solved: won,
      guessesUsed: round.guesses.length, elapsedMs: round.completionTimeMs,
      completedAt: new Date(round.completedAt).toISOString(),
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
  $('#result-rank').textContent = won ? `Rank ${current.rank}` : 'Not solved';
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
$('#leaderboard-button').addEventListener('click', () => {
  returnFocus = $('#leaderboard-button');
  renderLeaderboard($('#full-leaderboard'), savedAttempts);
  showScreen('leaderboard');
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
  if ($('#game').hidden || event.isComposing) return;
  if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
    // Modified Enter must not trigger a keyboard button's native click.
    if (event.key === 'Enter') event.preventDefault();
    return;
  }
  if (!/^[a-z]$/i.test(event.key) && !['Enter', 'Backspace'].includes(event.key)) return;
  if (event.key === 'Enter' && event.target.closest('[data-back]')) return;
  event.preventDefault();
  if (!event.repeat) handleKey(event.key);
});
window.addEventListener('beforeunload', (event) => {
  if (gameState.round?.status === 'playing') {
    event.preventDefault();
    event.returnValue = '';
  }
});
document.addEventListener('visibilitychange', updateTimer);
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY && event.key !== null) return;
  const currentAttempt = savedAttempts.find(({ id }) => id === gameState.completedResult?.id);
  savedAttempts = loadResults();
  // Keep this browser tab's just-completed attempt visible even if another tab
  // removes or corrupts storage while its final tiles are still revealing.
  if (currentAttempt && !savedAttempts.some(({ id }) => id === currentAttempt.id)) savedAttempts.push(currentAttempt);
  if (!$('#leaderboard').hidden) renderLeaderboard($('#full-leaderboard'), savedAttempts);
  if (!$('#result').hidden && gameState.completedResult) {
    const ranked = renderLeaderboard($('#result-leaderboard'), savedAttempts, gameState.completedResult.id);
    const current = ranked.find(({ id }) => id === gameState.completedResult.id);
    $('#result-rank').textContent = current?.rank ? `Rank ${current.rank}` : 'Not solved';
    scrollToAttempt($('#result-leaderboard'), gameState.completedResult.id);
  }
});
startParticles($('#particles'));
