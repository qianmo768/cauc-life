// 本地模式下的「合并导入」：按 id 合并，updatedAt 较新者优先
function mergeList(current, incoming) {
  const map = new Map();
  for (const item of current || []) {
    if (item && item.id) map.set(item.id, item);
  }
  for (const item of incoming || []) {
    if (!item || !item.id) continue;
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    const oldTime = Date.parse(existing.updatedAt || 0) || 0;
    const newTime = Date.parse(item.updatedAt || 0) || 0;
    if (newTime >= oldTime) map.set(item.id, item);
  }
  return [...map.values()];
}

export function mergeDb(current, incoming) {
  const out = structuredClone(current);
  const src = incoming && incoming.data ? incoming.data : null;
  if (!src) throw new Error('导入文件缺少 data');

  out.data.courses = mergeList(out.data.courses, src.courses);
  out.data.todos = mergeList(out.data.todos, src.todos);
  out.data.assignments = mergeList(out.data.assignments, src.assignments);
  out.data.trash = mergeList(out.data.trash, src.trash);
  out.data.scheduleChanges = mergeList(out.data.scheduleChanges, src.scheduleChanges);

  out.data.fitness.logs = mergeList(out.data.fitness.logs, src.fitness && src.fitness.logs);
  out.data.fitness.weights = mergeList(out.data.fitness.weights, src.fitness && src.fitness.weights);

  out.data.budget.expenses = mergeList(out.data.budget.expenses, src.budget && src.budget.expenses);
  out.data.budget.months = { ...(out.data.budget.months || {}), ...((src.budget && src.budget.months) || {}) };

  out.data.fun.records = mergeList(out.data.fun.records, src.fun && src.fun.records);
  out.data.fun.wishlist = mergeList(out.data.fun.wishlist, src.fun && src.fun.wishlist);
  out.data.fun.games = mergeList(out.data.fun.games, src.fun && src.fun.games);

  if (src.notes && src.notes.updatedAt) {
    const oldTime = Date.parse(out.data.notes.updatedAt || 0) || 0;
    const newTime = Date.parse(src.notes.updatedAt) || 0;
    if (newTime >= oldTime) out.data.notes = { ...out.data.notes, ...src.notes };
  }
  out.updatedAt = new Date().toISOString();
  return out;
}
