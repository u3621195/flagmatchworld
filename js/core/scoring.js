export const COMBO_WINDOW_MS = 5000;
export const PERFECT_BONUS = 5000;
export const TIME_BONUS_PER_SECOND = 50;
export function comboPoints(comboCount) { return Math.max(1, comboCount) * 100; }
export function calculateLevelTotal({ matchScore, remainingSeconds, perfectEligible }) {
  const timeBonus = Math.max(0, Math.floor(remainingSeconds)) * TIME_BONUS_PER_SECOND;
  const perfectBonus = perfectEligible ? PERFECT_BONUS : 0;
  return { matchScore, timeBonus, perfectBonus, total: matchScore + timeBonus + perfectBonus };
}
