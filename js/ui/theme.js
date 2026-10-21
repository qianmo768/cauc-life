// 主题与背景：统一在这里落到 <html>/<body> 上
export const DIM_MIN = 0;
export const DIM_MAX = 80;
export const BLUR_MAX = 20;

export function clampDim(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 35;
  return Math.min(DIM_MAX, Math.max(DIM_MIN, Math.round(n)));
}

export function clampBlur(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(BLUR_MAX, Math.max(0, Math.round(n)));
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
  const blur = clampBlur(settings.backgroundBlur);
  document.documentElement.style.setProperty('--bg-dim', String(dim / 100));

  const layer = document.getElementById('app-bg');
  if (!layer) return;

  const image = isImageDataUrl(settings.backgroundImage) ? settings.backgroundImage : null;
  if (image) {
    layer.style.backgroundImage = `url("${image}")`;
    layer.style.filter = blur > 0 ? `blur(${blur}px)` : '';
    layer.style.transform = blur > 0 ? 'scale(1.06)' : '';
    layer.classList.add('show');
    document.body.classList.add('has-bg');
  } else {
    layer.style.backgroundImage = '';
    layer.style.filter = '';
    layer.style.transform = '';
    layer.classList.remove('show');
    document.body.classList.remove('has-bg');
  }
}
