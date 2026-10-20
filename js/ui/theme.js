// 主题与背景：统一在这里落到 <html>/<body> 上
export const DIM_MIN = 0;
export const DIM_MAX = 80;

export function clampDim(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 35;
  return Math.min(DIM_MAX, Math.max(DIM_MIN, Math.round(n)));
}

export function applyTheme(theme) {
  document.documentElement.dataset.theme = theme || 'auto';
}

/** 只接受 data:image/... 形式的图片，避免把奇怪的值塞进 CSS */
export function isImageDataUrl(value) {
  return typeof value === 'string' && /^data:image\/[a-z0-9.+-]+;base64,/i.test(value);
}

export function applyBackground(settings = {}) {
  const dim = clampDim(settings.backgroundDim);
  document.documentElement.style.setProperty('--bg-dim', String(dim / 100));

  const layer = document.getElementById('app-bg');
  if (!layer) return;

  const image = isImageDataUrl(settings.backgroundImage) ? settings.backgroundImage : null;
  if (image) {
    layer.style.backgroundImage = `url("${image}")`;
    layer.classList.add('show');
    document.body.classList.add('has-bg');
  } else {
    layer.style.backgroundImage = '';
    layer.classList.remove('show');
    document.body.classList.remove('has-bg');
  }
}
