// Points awarded by finishing position
const POINTS_TABLE: Record<number, number> = {
  1: 10,
  2: 8,
  3: 7,
  4: 6,
  5: 5,
  6: 4,
  7: 4,
  8: 3,
  9: 3,
  10: 3,
  11: 2,
  12: 2,
  13: 2,
  14: 2,
  15: 1,
  16: 1,
  17: 1,
  18: 1,
  19: 1,
  20: 1,
  21: 1,
  22: 1,
};

export function getPointsForPosition(position: number): number {
  return POINTS_TABLE[position] ?? 0;
}

// Bonus point types
export const BONUS_LCQ_WIN = 1;
export const BONUS_HOLESHOT = 1;

export { POINTS_TABLE };
