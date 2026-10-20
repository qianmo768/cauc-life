// 手机端「更多」抽屉
import { esc } from '../core/html.js';

let activeDrawer = null;

export function openDrawer(items, onPick) {
  closeDrawer();
  const mask = document.createElement('div');
  mask.className = 'drawer-mask';
  mask.innerHTML = `
    <div class="drawer" role="dialog" aria-label="更多功能">
      <div class="drawer-handle"></div>
      <div class="drawer-grid">
        ${items.map((item) => `
          <button class="drawer-item" type="button" data-pick="${esc(item.name)}">
            <span class="icon">${item.icon || ''}</span>
            <span>${esc(item.label)}</span>
          </button>`).join('')}
      </div>
    </div>
  `;
  mask.addEventListener('click', (event) => {
    if (event.target === mask) return closeDrawer();
    const pick = event.target.closest('[data-pick]');
    if (pick) {
      const name = pick.dataset.pick;
      closeDrawer();
      onPick(name);
    }
  });
  document.getElementById('modal-root').appendChild(mask);
  activeDrawer = mask;
}

export function closeDrawer() {
  if (activeDrawer) {
    activeDrawer.remove();
    activeDrawer = null;
  }
}
