// 空状态
import { esc } from '../core/html.js';

export function emptyState({ icon = '🐟', title = '', desc = '', action = null } = {}) {
  return `
    <div class="empty">
      <div class="empty-icon">${esc(icon)}</div>
      ${title ? `<p class="text-lg strong">${esc(title)}</p>` : ''}
      ${desc ? `<p class="text-sm dim">${esc(desc)}</p>` : ''}
      ${action ? `<button class="btn primary sm" type="button" data-action="${esc(action.action)}">${esc(action.label)}</button>` : ''}
    </div>
  `;
}
