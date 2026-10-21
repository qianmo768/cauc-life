// 回收站：删除的东西先放这里，30 天内可恢复
export const TRASH_KIND_LABELS = {
  todo: '待办',
  assignment: '作业',
  expense: '花销',
  fun: '娱乐记录'
};

export const TRASH_KEEP_DAYS = 30;

export function makeTrashEntry(kind, item, label, now = new Date()) {
  return {
    id: `trash_${now.getTime().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    kind,
    label: String(label || ''),
    item: structuredClone(item),
    deletedAt: now.toISOString()
  };
}

/** 从数据里移除指定条目，返回被移除的对象；找不到返回 null */
export function removeItem(data, kind, id) {
  let list;
  if (kind === 'todo') list = data.todos;
  else if (kind === 'assignment') list = data.assignments;
  else if (kind === 'expense') list = data.budget.expenses;
  else if (kind === 'fun') list = data.fun.records;
  else return null;

  if (!Array.isArray(list)) return null;
  const index = list.findIndex((item) => item.id === id);
  if (index < 0) return null;
  return list.splice(index, 1)[0];
}

export function insertItem(data, kind, item) {
  if (!item) return false;
  if (kind === 'todo') { data.todos = data.todos || []; data.todos.push(item); }
  else if (kind === 'assignment') { data.assignments = data.assignments || []; data.assignments.push(item); }
  else if (kind === 'expense') { data.budget.expenses = data.budget.expenses || []; data.budget.expenses.push(item); }
  else if (kind === 'fun') { data.fun.records = data.fun.records || []; data.fun.records.push(item); }
  else return false;
  return true;
}

/** 丢掉超过保留期的条目 */
export function purgeTrash(list, now = Date.now(), days = TRASH_KEEP_DAYS) {
  const cutoff = now - days * 86400000;
  return (list || []).filter((entry) => {
    const time = Date.parse(entry && entry.deletedAt);
    return Number.isFinite(time) && time >= cutoff;
  });
}
