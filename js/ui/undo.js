import { esc } from '../core/html.js';

/** 底部撤销条；返回控制器 */
export function showUndo(message, onUndo, timeout = 3000) {
  const root = document.getElementById('modal-root');
  if (!root) return null;
  const bar = document.createElement('div');
  bar.className = 'undo-bar';
  bar.innerHTML = `<span>${esc(message)}</span><button type="button">撤销</button>`;
  root.appendChild(bar);

  let undone = false;
  const close = () => {
    clearTimeout(timer);
    if (bar.isConnected) bar.remove();
  };
  const timer = setTimeout(() => {
    if (!undone) close();
  }, timeout);

  bar.querySelector('button').addEventListener('click', () => {
    undone = true;
    close();
    onUndo();
  });

  return { close };
}
