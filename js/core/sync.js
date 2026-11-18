// 云同步编排：启动拉取、改动推送、冲突合并
import {
  loadConfig, saveConfig, clearConfig, validateToken, findOrCreateGist, pullGist, pushGist
} from './cloud.js';
import { mergeDb } from './merge.js';

export function hasContent(db) {
  const data = db && db.data;
  if (!data) return false;
  const count = (value) => (Array.isArray(value) ? value.length : 0);
  return count(data.courses) + count(data.todos) + count(data.assignments) +
    count(data.budget && data.budget.expenses) +
    count(data.fun && data.fun.records) +
    count(data.fitness && data.fitness.logs) +
    count(data.fun && data.fun.wishlist) > 0;
}

/** 根据本地/云端/上次同步时间决定动作 */
export function chooseSyncAction(local, remote, lastSyncAt) {
  const hasLocal = Boolean(local && local.data);
  const hasRemote = Boolean(remote && remote.data);
  if (!hasRemote) return hasLocal ? 'push' : 'none';
  if (!hasLocal) return 'pull';

  const localHas = hasContent(local);
  const remoteHas = hasContent(remote);

  // 云端没有实际内容时，绝不用它覆盖本机
  if (localHas && !remoteHas) return 'push';
  if (!localHas && remoteHas) return 'pull';
  if (!localHas && !remoteHas) return 'none';

  const localTime = Date.parse(local.updatedAt || 0) || 0;
  const remoteTime = Date.parse(remote.updatedAt || 0) || 0;
  const last = lastSyncAt ? Date.parse(lastSyncAt) || 0 : 0;

  // 两边都在上次同步后改过 → 合并（不管谁更新）
  if (last && localTime > last && remoteTime > last) return 'merge';

  if (remoteTime > localTime) return 'pull';
  if (localTime > remoteTime) return 'push';
  return 'none';
}

export class Sync {
  constructor(store) {
    this.store = store;
    this.timer = null;
    this.syncing = false;
    this.lastError = null;
    this.lastAction = null;
  }

  get config() {
    return loadConfig();
  }

  get enabled() {
    const config = this.config;
    return Boolean(config && config.token && config.gistId);
  }

  async enable(token) {
    const login = await validateToken(token);
    const gist = await findOrCreateGist(token);
    saveConfig({ token, gistId: gist.id, login, lastSyncAt: null });

    // 开启时：本机和云端都有内容就合并，云端为空则以本机为准，最后统一上传
    const remote = await pullGist(token, gist.id).catch(() => null);
    const local = this.store.state;
    let next = local;
    let action = 'push';
    if (hasContent(local) && hasContent(remote)) {
      next = mergeDb(local, remote);
      action = 'merge';
    } else if (!hasContent(local) && hasContent(remote)) {
      next = remote;
      action = 'pull';
    }

    if (next !== local) {
      this.store.replace(next);
      await this.store.flush();
    }
    await pushGist(token, gist.id, this.store.state);
    saveConfig({ ...this.config, lastSyncAt: new Date().toISOString() });
    this.lastAction = action;
    this.lastError = null;
    return { login, gistId: gist.id, ok: true, action };
  }

  /** 强制把本机数据上传到云端（以本机为准） */
  async pushLocal() {
    if (!this.enabled) throw new Error('还没有开启云同步');
    const config = this.config;
    await pushGist(config.token, config.gistId, this.store.state);
    saveConfig({ ...config, lastSyncAt: new Date().toISOString() });
    this.lastError = null;
    this.lastAction = 'push';
    return { ok: true };
  }

  async disable() {
    clearConfig();
    clearTimeout(this.timer);
    this.lastError = null;
  }

  /** 启动时先处理：拉取云端，必要时合并/推送，返回应展示的数据 */
  async prepare(local) {
    if (!this.enabled) return local;
    const config = this.config;

    let remote = null;
    try {
      remote = await pullGist(config.token, config.gistId);
    } catch (err) {
      this.lastError = err.message;
      return local;
    }

    const action = chooseSyncAction(local, remote, config.lastSyncAt);
    let next = local;
    if (action === 'pull') next = remote;
    else if (action === 'merge') next = mergeDb(local, remote);

    if (action === 'push' || action === 'merge') {
      try {
        await pushGist(config.token, config.gistId, next);
      } catch (err) {
        this.lastError = err.message;
      }
    }

    saveConfig({ ...config, lastSyncAt: new Date().toISOString() });
    this.lastAction = action;
    return next;
  }

  async syncNow({ keepalive = false } = {}) {
    if (!this.enabled) return { skipped: true };
    if (this.syncing) return { busy: true };

    this.syncing = true;
    try {
      const config = this.config;
      const remote = await pullGist(config.token, config.gistId);
      const local = this.store.state;
      const action = chooseSyncAction(local, remote, config.lastSyncAt);

      let next = local;
      if (action === 'pull') next = remote;
      else if (action === 'merge') next = mergeDb(local, remote);

      if (next !== local) {
        this.store.replace(next);
        await this.store.flush();
      }
      if (action === 'push' || action === 'merge') {
        await pushGist(config.token, config.gistId, this.store.state, { keepalive });
      }

      saveConfig({ ...config, lastSyncAt: new Date().toISOString() });
      this.lastError = null;
      this.lastAction = action;
      return { ok: true, action };
    } catch (err) {
      this.lastError = err.message;
      return { error: err.message };
    } finally {
      this.syncing = false;
    }
  }

  /** 本地保存后延迟推送，避免每次输入都打 GitHub */
  schedule(delay = 1200) {
    if (!this.enabled) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.syncNow().catch(() => {});
    }, delay);
  }

  start() {
    if (!this.enabled) return;
    window.addEventListener('online', () => { this.syncNow().catch(() => {}); });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.syncNow().catch(() => {});
    });
    window.addEventListener('pagehide', () => {
      this.syncNow().catch(() => {});
    });
    setInterval(() => {
      if (document.visibilityState === 'visible') this.syncNow().catch(() => {});
    }, 5 * 60 * 1000);
  }
}
