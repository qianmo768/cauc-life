// 与服务端通信；本地模式（PWA）下自动改用 IndexedDB
import { localGetDb, localPutDb } from './core/localdb.js';
import { defaultData } from './core/defaultData.js';

let mode = 'server';

export function setMode(next) {
  mode = next === 'local' ? 'local' : 'server';
}

export function isLocal() {
  return mode === 'local';
}

async function request(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    try {
      const body = await res.json();
      if (body && body.error) message = body.error;
    } catch {
      /* 忽略非 JSON 响应 */
    }
    throw new Error(message);
  }
  return res;
}

const jsonInit = (method, payload) => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
});

export const api = {
  isLocal,
  async getDb() {
    if (mode === 'local') {
      const stored = await localGetDb();
      if (stored) return stored;
      const fresh = defaultData();
      await localPutDb(fresh);
      return fresh;
    }
    return (await request('/api/db')).json();
  },
  async putDb(db) {
    if (mode === 'local') {
      await localPutDb(db);
      return { ok: true };
    }
    return (await request('/api/db', jsonInit('PUT', db))).json();
  },
  async listBackups() {
    if (mode === 'local') return [];
    return (await request('/api/backups')).json();
  },
  async restoreBackup(name) {
    if (mode === 'local') throw new Error('本地模式没有自动快照，请用导出备份');
    return (await request('/api/backups/restore', jsonInit('POST', { name }))).json();
  },
  async importDb(modeName, payload) {
    if (mode === 'local') throw new Error('本地模式请使用设置里的导入');
    return (await request('/api/import', jsonInit('POST', { mode: modeName, payload }))).json();
  },
  async uploadFile(name, dataUrl) {
    if (mode === 'local') {
      return {
        ok: true,
        file: {
          name,
          url: dataUrl,
          size: Math.round((String(dataUrl).length * 3) / 4)
        }
      };
    }
    return (await request('/api/upload', jsonInit('POST', { name, dataUrl }))).json();
  },
  async lookupCover(name) {
    if (mode === 'local') throw new Error('本地模式暂不支持自动找封面，请手动换封面');
    return (await request(`/api/cover?name=${encodeURIComponent(name)}`)).json();
  },
  async saveNow() {
    if (mode === 'local') return { ok: true, name: '已保存到本机' };
    return (await request('/api/save', { method: 'POST' })).json();
  },
  async previewBill(dataUrl) {
    if (mode === 'local') throw new Error('本地模式暂不支持直接读 xlsx，请在电脑上导入后导出备份');
    return (await request('/api/bill/preview', jsonInit('POST', { dataUrl }))).json();
  },
  exportUrl() {
    if (mode === 'local') return null;
    return '/api/export';
  },
  async info() {
    if (mode === 'local') return { ok: true, mode: 'local', lanUrls: [], version: 1 };
    return (await request('/api/info')).json();
  }
};
