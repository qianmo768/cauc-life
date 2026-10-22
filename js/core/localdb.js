// 本地模式的数据存储：IndexedDB 单键存整份 db
const DB_NAME = 'cauc-life';
const DB_VERSION = 1;
const STORE_NAME = 'kv';
const DB_KEY = 'db';

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

export function localGetDb() {
  return run('readonly', (store) => {
    const request = store.get(DB_KEY);
    return { get value() { return request.result || null; } };
  });
}

export function localPutDb(db) {
  return run('readwrite', (store) => {
    store.put(db, DB_KEY);
    return { value: true };
  });
}

export function localClearDb() {
  return run('readwrite', (store) => {
    store.delete(DB_KEY);
    return { value: true };
  });
}

export async function requestPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) {
      return await navigator.storage.persist();
    }
  } catch { /* 忽略 */ }
  return false;
}
