/** Statuts exclus du marketplace et des listes utilisateur */
export const HIDDEN_LISTING_STATUSES = new Set(['deleted', 'moderated']);

export function isListingVisible(status: unknown): boolean {
  return !HIDDEN_LISTING_STATUSES.has(String(status || ''));
}

export function isListingPublic(status: unknown): boolean {
  const s = String(status || '');
  return s === 'open' || s === 'in_progress';
}
