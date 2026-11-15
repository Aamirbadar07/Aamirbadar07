// Cards and lists are ordered by a numeric `position`. To move an item we
// only rewrite that one row: its new position is the midpoint of its new
// neighbours, so nothing else has to be renumbered.

const GAP = 1024

/** Position for an item dropped between `before` and `after` (either may be missing). */
export function positionBetween(before?: number, after?: number): number {
  if (before === undefined && after === undefined) return GAP
  if (before === undefined) return after! - GAP
  if (after === undefined) return before + GAP
  return (before + after) / 2
}

export const byPosition = (a: { position: number }, b: { position: number }) =>
  a.position - b.position
