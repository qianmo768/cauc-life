// 全局搜索：把各模块的数据摊平成可检索条目
import { fmtDateCN, fmtMoney, fmtDuration } from './date.js';

export const TYPE_LABELS = {
  course: '课程',
  todo: '待办',
  assignment: '作业',
  expense: '花销',
  fun: '娱乐'
};

const ROUTES = {
  course: 'classes',
  todo: 'todos',
  assignment: 'homework',
  expense: 'budget',
  fun: 'fun'
};

export const NAV_ACTIONS = [
  { title: '首页总览', route: 'home', keywords: 'home 首页 概览 今天' },
  { title: '今日课程', route: 'classes', keywords: 'classes 课程 课表 周课表' },
  { title: '待办事务', route: 'todos', keywords: 'todos 待办 任务' },
  { title: '作业', route: 'homework', keywords: 'homework 作业 提交' },
  { title: '健身计划', route: 'fitness', keywords: 'fitness 健身 训练 打卡' },
  { title: '每月花销规划', route: 'budget', keywords: 'budget 花销 预算 记账' },
  { title: '游戏娱乐', route: 'fun', keywords: 'fun 娱乐 游戏 计时' },
  { title: '统计', route: 'stats', keywords: 'stats 统计 图表 趋势 复盘' },
  { title: '数据与设置', route: 'settings', keywords: 'settings 设置 备份 主题' }
];

export function buildSearchIndex(state) {
  const d = state.data;
  const items = [];

  for (const course of d.courses || []) {
    items.push({
      type: 'course',
      id: course.id,
      title: course.name,
      sub: [course.teacher, course.location].filter(Boolean).join(' · '),
      route: ROUTES.course,
      keywords: `${course.name} ${course.teacher || ''} ${course.location || ''} ${course.note || ''}`
    });
  }

  for (const todo of d.todos || []) {
    items.push({
      type: 'todo',
      id: todo.id,
      title: todo.title,
      sub: todo.dueDate ? `截止 ${fmtDateCN(todo.dueDate)}` : '无日期',
      route: ROUTES.todo,
      keywords: `${todo.title} ${todo.note || ''}`
    });
  }

  for (const item of d.assignments || []) {
    items.push({
      type: 'assignment',
      id: item.id,
      title: item.title,
      sub: [item.courseName, item.status === 'submitted' ? '已交' : ''].filter(Boolean).join(' · '),
      route: ROUTES.assignment,
      keywords: `${item.title} ${item.courseName || ''} ${item.note || ''}`
    });
  }

  for (const item of d.budget.expenses || []) {
    items.push({
      type: 'expense',
      id: item.id,
      title: `${item.category || '其他'} ${fmtMoney(item.amount)}`,
      sub: [item.note, item.date].filter(Boolean).join(' · '),
      route: ROUTES.expense,
      keywords: `${item.note || ''} ${item.category || ''} ${item.amount}`
    });
  }

  for (const item of d.fun.records || []) {
    items.push({
      type: 'fun',
      id: item.id,
      title: item.name,
      sub: `${fmtDuration(item.minutes)} · ${item.date}`,
      route: ROUTES.fun,
      keywords: `${item.name} ${item.type || ''}`
    });
  }

  return items;
}

function scoreOf(item, q) {
  const title = String(item.title || '').toLowerCase();
  if (title.startsWith(q)) return 100;
  if (title.includes(q)) return 60;
  const keywords = String(item.keywords || '').toLowerCase();
  if (keywords.includes(q)) return 30;
  return 0;
}

export function searchItems(index, query, limit = 8) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return index.slice(0, limit);
  return index
    .map((item) => ({ item, score: scoreOf(item, q) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function searchActions(query, limit = 4) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  return NAV_ACTIONS
    .filter((action) => action.title.toLowerCase().includes(q) || action.keywords.toLowerCase().includes(q))
    .slice(0, limit);
}
