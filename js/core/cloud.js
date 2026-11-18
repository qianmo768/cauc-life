// GitHub Gist 云同步：数据原样存成 cauc-life-db.json，不改变任何字段
const CONFIG_KEY = 'cauc-life-sync-v1';
const GIST_DESC = 'cauc-life-sync';
const FILE_NAME = 'cauc-life-db.json';
const API = 'https://api.github.com';

const memory = new Map();

function storage() {
  try {
    if (typeof localStorage !== 'undefined' && localStorage) return localStorage;
  } catch { /* 忽略 */ }
  return {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key)
  };
}

export function loadConfig() {
  try {
    const raw = storage().getItem(CONFIG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveConfig(config) {
  try {
    storage().setItem(CONFIG_KEY, JSON.stringify(config));
  } catch { /* 忽略 */ }
}

export function clearConfig() {
  try { storage().removeItem(CONFIG_KEY); } catch { /* 忽略 */ }
}

async function gh(token, path, { method = 'GET', body, keepalive = false } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    keepalive,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (!res.ok) {
    let message = '';
    try {
      const data = await res.json();
      message = data && data.message ? data.message : '';
    } catch { /* 忽略 */ }
    if (res.status === 401) throw new Error('Token 无效或已过期，请重新生成');
    if (res.status === 403) throw new Error('Token 权限不够，需要勾选 gist 权限');
    if (res.status === 404) throw new Error('找不到同步数据，可能 Gist 被删除了');
    throw new Error(`GitHub ${res.status}${message ? `：${message}` : ''}`);
  }
  return res.json();
}

export async function validateToken(token) {
  const user = await gh(token, '/user');
  return user.login;
}

export async function findOrCreateGist(token) {
  for (let page = 1; page <= 3; page += 1) {
    const gists = await gh(token, `/gists?per_page=100&page=${page}`);
    const list = Array.isArray(gists) ? gists : [];
    const existing = list.find((gist) => gist.description === GIST_DESC);
    if (existing && existing.id) return existing;
    if (list.length < 100) break;
  }

  return gh(token, '/gists', {
    method: 'POST',
    body: {
      description: GIST_DESC,
      public: false,
      files: { [FILE_NAME]: { content: '{}' } }
    }
  });
}

export async function pullGist(token, gistId) {
  const gist = await gh(token, `/gists/${gistId}`);
  const file = gist.files && gist.files[FILE_NAME];
  if (!file) return null;

  let content = file.content || '';
  if (file.truncated || !content) {
    const res = await fetch(file.raw_url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('读取云端数据失败');
    content = await res.text();
  }

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function pushGist(token, gistId, db, { keepalive = false } = {}) {
  return gh(token, `/gists/${gistId}`, {
    method: 'PATCH',
    keepalive,
    body: { files: { [FILE_NAME]: { content: JSON.stringify(db) } } }
  });
}

export function encodeSyncHash(token, gistId) {
  return btoa(JSON.stringify({ t: token, g: gistId }));
}

export function decodeSyncHash(value) {
  try {
    const payload = JSON.parse(atob(value));
    if (payload && payload.t && payload.g) return { token: payload.t, gistId: payload.g };
  } catch { /* 忽略 */ }
  return null;
}

/** 把地址栏 #sync=... 解析成配置并保存，然后清掉地址栏里的密钥 */
export function applySyncHash(locationLike) {
  const loc = locationLike || (typeof location !== 'undefined' ? location : null);
  if (!loc || !loc.hash) return null;
  const match = /(?:^#|[&#])sync=([^&]+)/.exec(loc.hash);
  if (!match) return null;
  const parsed = decodeSyncHash(decodeURIComponent(match[1]));
  if (!parsed) return null;
  saveConfig({ ...parsed, lastSyncAt: null });
  try {
    if (loc.href && typeof history !== 'undefined' && history.replaceState) {
      history.replaceState(null, '', `${loc.pathname}${loc.search}`);
    }
  } catch { /* 忽略 */ }
  return parsed;
}
