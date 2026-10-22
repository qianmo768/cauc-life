// 内存状态仓库：唯一写入口，负责通知订阅者与防抖保存
export class Store {
  constructor({ save, delay = 300, onStatus = () => {} } = {}) {
    this._state = null;
    this._save = save;
    this._delay = delay;
    this._onStatus = onStatus;
    this._subs = new Set();
    this._timer = null;
    this._dirty = false;
    this._saving = false;
  }

  init(db) {
    this._state = db;
    this._emit();
  }

  /** 整体替换（导入备份用）：立即通知并安排保存 */
  replace(db) {
    this._state = db;
    this._dirty = true;
    this._emit();
    this._schedule();
    return db;
  }

  get state() {
    return this._state;
  }

  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  _emit() {
    for (const fn of [...this._subs]) fn(this._state);
  }

  /**
   * 修改状态。
   * notify=false 时不触发重渲染（用于输入过程中，避免打断光标）。
   */
  update(mutator, { notify = true, save = true } = {}) {
    const draft = structuredClone(this._state);
    mutator(draft);
    draft.updatedAt = new Date().toISOString();
    this._state = draft;
    if (notify) this._emit();
    if (save) this._schedule();
    return draft;
  }

  _schedule() {
    this._dirty = true;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => {
      this.flush().catch(() => {});
    }, this._delay);
  }

  async flush() {
    clearTimeout(this._timer);
    if (!this._dirty) return;
    if (this._saving) {
      // 上一次还在写，稍后再试
      this._schedule();
      return;
    }
    this._dirty = false;
    this._saving = true;
    this._onStatus('saving');
    try {
      await this._save(this._state);
      this._onStatus('saved', this._state.updatedAt);
    } catch (err) {
      this._dirty = true;
      this._onStatus('error', err);
      throw err;
    } finally {
      this._saving = false;
    }
  }

  dispose() {
    clearTimeout(this._timer);
    this._subs.clear();
  }
}
