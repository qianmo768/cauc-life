// 通用弹层
import { esc } from '../core/html.js';

let activeModal = null;

export function openModal({ title = '', body = '', footer = '', wide = false, onMount, onClose } = {}) {
  closeModal();
  const root = document.getElementById('modal-root');
  const mask = document.createElement('div');
  mask.className = 'modal-mask';
  mask.innerHTML = `
    <div class="modal${wide ? ' wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <div class="modal-head">
        <h3>${esc(title)}</h3>
        <button class="modal-close" type="button" data-close="1" aria-label="关闭">✕</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>
  `;

  const close = () => {
    mask.remove();
    document.removeEventListener('keydown', onKey);
    if (activeModal && activeModal.mask === mask) activeModal = null;
    if (typeof onClose === 'function') onClose();
  };

  const onKey = (event) => {
    if (event.key === 'Escape') close();
  };

  mask.addEventListener('click', (event) => {
    if (event.target === mask) close();
    if (event.target.closest('[data-close]')) close();
  });
  document.addEventListener('keydown', onKey);

  root.appendChild(mask);
  activeModal = { mask, close };

  // 把 close 作为参数传进去：调用方在 onMount 里拿不到自己的 const（此时还没赋值）
  if (typeof onMount === 'function') onMount(mask, { close, el: mask });
  const firstInput = mask.querySelector('input, select, textarea');
  if (firstInput) setTimeout(() => firstInput.focus(), 30);

  return { el: mask, close };
}

export function closeModal() {
  if (activeModal) {
    activeModal.close();
    activeModal = null;
  }
}
