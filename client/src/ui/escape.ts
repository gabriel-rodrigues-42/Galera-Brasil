/** Escapes user-authored text before interpolating into an innerHTML template
 * literal. See DESIGN.md §9 — required for any chat/guestbook/post/hub field
 * that came from another player. */
export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
