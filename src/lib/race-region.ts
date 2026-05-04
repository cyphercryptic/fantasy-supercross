// Single source of truth for 2026 Supercross 250 East/West/Showdown round mapping.
// Used by injury report cron, lineup validation, schedule UI, and team UI.

export const WEST_ROUNDS = new Set([1, 2, 3, 4, 5, 6, 16]);
export const EAST_ROUNDS = new Set([7, 8, 9, 11, 13, 14, 15]);
export const SHOWDOWN_ROUNDS = new Set([10, 12, 17]);

export type RaceRegion = "west" | "east" | "showdown" | null;

export function get250Region(roundNumber: number | null | undefined): RaceRegion {
  if (roundNumber == null) return null;
  if (WEST_ROUNDS.has(roundNumber)) return "west";
  if (EAST_ROUNDS.has(roundNumber)) return "east";
  if (SHOWDOWN_ROUNDS.has(roundNumber)) return "showdown";
  return null;
}
