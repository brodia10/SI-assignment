/** One screen's draft: whether it has anything worth keeping, and what to call it ("purchase order"). */
export interface Draft {
  dirty: boolean;
  what: string;
}

/** The first draft with unsaved work, or null when there's nothing to lose. */
export function firstDirty(drafts: Iterable<Draft>): Draft | null {
  for (const d of drafts) if (d.dirty) return d;
  return null;
}

/**
 * Whether moving from `currentPath` to `nextPath` should ask first. Only a move to another screen does: a change to
 * the same path (e.g. a query string) keeps the draft on screen.
 */
export function shouldBlock(drafts: Iterable<Draft>, currentPath: string, nextPath: string): boolean {
  return currentPath !== nextPath && firstDirty(drafts) !== null;
}
