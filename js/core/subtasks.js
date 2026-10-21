// 子任务：解析、合并、进度
import { uid } from './html.js';

export function parseSubtaskLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** 编辑时按标题保留已完成的子任务，避免勾选状态丢失 */
export function mergeSubtasks(existing, lines) {
  const list = Array.isArray(existing) ? existing : [];
  const byTitle = new Map(list.map((item) => [item.title, item]));
  return lines.map((title) => {
    const found = byTitle.get(title);
    return found ? found : { id: uid('st'), title, done: false };
  });
}

export function subtaskProgress(subtasks) {
  const list = subtasks || [];
  const done = list.filter((item) => item.done).length;
  return {
    done,
    total: list.length,
    percent: list.length ? Math.round((done / list.length) * 100) : 0
  };
}

export function subtaskText(subtasks) {
  return (subtasks || []).map((item) => item.title).join('\n');
}
