// 本地模式的数据存储：IndexedDB 单键存整份 db，并用 localStorage 做一份镜像
const DB_NAME = 'cauc-life';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const DB_KEY = 'db';
const MIRROR_KEY = 'cauc-life-mirror-v1';
const MIRROR_LIMIT = 4.2 * 1024 * 1024;

function openDb() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in window)) {
      reject(new Error('这个浏览器不支持本地存储'));
      return;
    }
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('打开本地数据库失败'));
  });
}

function run(mode, handler) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    let result;
    try {
      result = handler(store);
    } catch (err) {
      reject(err);
      return;
    }
    tx.oncomplete = () => {
      db.close();
      resolve(result && result.value !== undefined ? result.value : result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('本地数据库操作失败'));
    };
  }));
}

function mirrorStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readMirror() {
  const storage = mirrorStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(MIRROR_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeMirror(db) {
  const storage = mirrorStorage();
  if (!storage) return false;
  try {
    const raw = JSON.stringify(db);
    if (raw.length > MIRROR_LIMIT) {
      storage.removeItem(MIRROR_KEY);
      return false;
    }
    storage.setItem(MIRROR_KEY, raw);
    return true;
  } catch {
    try { storage.removeItem(MIRROR_KEY); } catch { /* 忽略 */ }
    return false;
  }
}

export async function localGetDb() {
  let stored = null;
  try {
    stored = await run('readonly', (store) => {
      const request = store.get(DB_KEY);
      return { get value() { return request.result || null; } };
    });
  } catch {
    stored = null;
  }
  if (stored) return stored;

  // IndexedDB 空了（被清理/首次）或不可用，尝试从镜像恢复
  const mirror = readMirror();
  if (mirror) {
    try {
      await run('readwrite', (store) => {
        store.put(mirror, DB_KEY);
        return { value: true };
      });
    } catch { /* 镜像能读出来就先用着 */ }
    return mirror;
  }
  return null;
}

export async function localPutDb(db) {
  let idbError = null;
  try {
    await run('readwrite', (store) => {
      store.put(db, DB_KEY);
      return { value: true };
    });
  } catch (err) {
    idbError = err;
  }
  const mirrored = writeMirror(db);
  if (idbError && !mirrored) throw idbError;
  return true;
}

export async function localClearDb() {
  await run('readwrite', (store) => {
    store.delete(DB_KEY);
    return { value: true };
  });
  const storage = mirrorStorage();
  if (storage) {
    try { storage.removeItem(MIRROR_KEY); } catch { /* 忽略 */ }
  }
  return true;
}

export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch { /* 忽略 */ }
  return false;
}

export async function storageInfo() {
  let persisted = null;
  let usage = null;
  let quota = null;
  try {
    if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted();
  } catch { /* 忽略 */ }
  try {
    if (navigator.storage && navigator.storage.estimate) {
      const estimate = await navigator.storage.estimate();
      usage = typeof estimate.usage === 'number' ? estimate.usage : null;
      quota = typeof estimate.quota === 'number' ? estimate.quota : null;
    }
  } catch { /* 忽略 */ }
  return { persisted, usage, quota, mirror: Boolean(readMirror()) };
}
