import { RULES } from './words.js';

export function eligibleHintPositions(round) {
  if (round.status !== 'playing' || round.revealing || round.hintsUsed >= 3) return [];
  return Array.from({ length: RULES.wordLength }, (_, index) => index).filter((index) =>
    !round.hintPositions.includes(index)
    && !round.guesses.some(({ feedback }) => feedback[index] === 'correct'));
}

export function revealHint(round, random = Math.random) {
  const eligible = eligibleHintPositions(round);
  if (!eligible.length) return false;
  round.hintPositions.push(eligible[Math.floor(random() * eligible.length)]);
  round.hintsUsed += 1;
  return true;
}

export function evaluateGuess(guess, answer) {
  const feedback = Array(RULES.wordLength).fill('absent');
  const remaining = {};
  for (let i = 0; i < answer.length; i += 1) {
    if (guess[i] === answer[i]) feedback[i] = 'correct';
    else remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < guess.length; i += 1) {
    if (feedback[i] !== 'correct' && remaining[guess[i]] > 0) {
      feedback[i] = 'present';
      remaining[guess[i]] -= 1;
    }
  }
  return feedback;
}

const strength = { absent: 1, present: 2, correct: 3 };
export function updateKeyFeedback(keys, guess, feedback) {
  feedback.forEach((value, index) => {
    const letter = guess[index];
    if ((strength[keys[letter]] || 0) < strength[value]) keys[letter] = value;
  });
}

export function elapsedMs(round, now = Date.now()) {
  return Math.max(0, (round.completedAt ?? now) - round.startedAt);
}

export function formatTime(ms) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
