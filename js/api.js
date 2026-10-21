// 与服务端通信
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
  async getDb() {
    return (await request('/api/db')).json();
  },
  async putDb(db) {
    return (await request('/api/db', jsonInit('PUT', db))).json();
  },
  async listBackups() {
    return (await request('/api/backups')).json();
  },
  async restoreBackup(name) {
    return (await request('/api/backups/restore', jsonInit('POST', { name }))).json();
  },
  async importDb(mode, payload) {
    return (await request('/api/import', jsonInit('POST', { mode, payload }))).json();
  },
  async uploadFile(name, dataUrl) {
    return (await request('/api/upload', jsonInit('POST', { name, dataUrl }))).json();
  },
  exportUrl() {
    return '/api/export';
  },
  async info() {
    return (await request('/api/info')).json();
  }
};
