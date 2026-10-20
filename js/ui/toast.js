// 提示条
export function toast(message, { tone = 'ok', duration = 1800 } = {}) {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(4px)';
    el.style.transition = 'opacity .18s, transform .18s';
    setTimeout(() => el.remove(), 200);
  }, duration);
}
