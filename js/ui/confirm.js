// 确认弹层，返回 Promise<boolean>
import { esc } from '../core/html.js';
import { openModal } from './modal.js';

export function confirmDialog({
  title = '确认',
  message = '',
  confirmText = '确定',
  cancelText = '取消',
  danger = false
} = {}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const { close } = openModal({
      title,
      body: `<p class="text-sm" style="line-height:1.7">${esc(message)}</p>`,
      footer: `
        <button class="btn" type="button" data-cancel>${esc(cancelText)}</button>
        <button class="btn ${danger ? 'solid-danger' : 'primary'}" type="button" data-ok>${esc(confirmText)}</button>
      `,
      onClose: () => finish(false),
      onMount: (mask, { close }) => {
        mask.querySelector('[data-cancel]').addEventListener('click', () => { finish(false); close(); });
        mask.querySelector('[data-ok]').addEventListener('click', () => { finish(true); close(); });
      }
    });
  });
}
