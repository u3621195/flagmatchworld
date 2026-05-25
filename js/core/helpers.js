import { findValidPair } from './pathfinding.js';

export function useHint(state) {
  if (state.helpers.hint <= 0) return null;
  const pair = findValidPair(state.board, state.rows, state.cols);
  if (!pair) return null;
  state.helpers.hint -= 1;
  state.comboCount = 0;
  state.perfectEligible = false;
  return pair;
}
export function canAutoShuffle(state) { return !findValidPair(state.board, state.rows, state.cols); }
export function useManualShuffle(state) {
  if (state.helpers.shuffle <= 0) return false;
  state.helpers.shuffle -= 1;
  state.comboCount = 0;
  state.perfectEligible = false;
  return true;
}
