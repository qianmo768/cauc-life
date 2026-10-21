// 首页与各模块共用的取数逻辑（纯函数，不碰 DOM）
import {
  todayStr, weekdayIndex, weekOf, weekDates, addDays, parseTime,
  nowMinutes, diffDays, fmtDateCN, fmtMoney, fmtDuration, startOfWeek,
  monthKeyOf, addMonths
} from './date.js';
import { sum } from './html.js';

export const PRIORITY_RANK = { high: 0, mid: 1, low: 2 };

export function weekInfo(state, dateStr = todayStr()) {
  const settings = (state && state.data && state.data.settings) || {};
  const weekStart = settings.weekStart || 1;
  return {
    week: weekOf(dateStr, settings.semesterStart, weekStart),
    weekStart,
    semesterStart: settings.semesterStart || null
  };
}

/** 课程在某天是否发生（星期、周次范围、单双周、跳过周） */
export function courseOccurs(course, dateStr, week) {
  if (!course) return false;
  if (Number(course.dayOfWeek) !== weekdayIndex(dateStr)) return false;
  if (Array.isArray(course.skips) && course.skips.map(Number).includes(Number(week))) return false;
  const weeks = Array.isArray(course.weeks) && course.weeks.length ? course.weeks : [1, 18];
  const from = Number(weeks[0]) || 1;
  const to = Number(weeks[1]) || from;
  if (week < from || week > to) return false;
  if (course.parity === 'odd' && week % 2 === 0) return false;
  if (course.parity === 'even' && week % 2 !== 0) return false;
  return true;
}

export function coursesOn(state, dateStr) {
  const { week } = weekInfo(state, dateStr);
  return (state.data.courses || [])
    .filter((course) => courseOccurs(course, dateStr, week))
    .sort((a, b) => (Number(a.startSlot) || 0) - (Number(b.startSlot) || 0));
}

/** 课程开始/结束时间（依据设置里的节次时间表） */
export function courseTimes(state, course) {
  const slots = (state.data.settings && state.data.settings.slots) || [];
  const startSlot = slots[Number(course.startSlot) - 1];
  const endSlot = slots[Number(course.endSlot) - 1] || startSlot;
  return {
    start: startSlot ? startSlot.start : '',
    end: endSlot ? endSlot.end : ''
  };
}

/** 今天正在上或下一节要上的课 */
export function nextCourse(state, dateStr = todayStr(), now = new Date()) {
  const courses = coursesOn(state, dateStr);
  const nowMin = nowMinutes(now);
  for (const course of courses) {
    const times = courseTimes(state, course);
    const start = parseTime(times.start);
    const end = parseTime(times.end);
    if (end > nowMin) {
      return {
        course,
        ...times,
        ongoing: start <= nowMin && nowMin < end,
        minutesLeft: Math.max(0, start - nowMin),
        minutesToEnd: Math.max(0, end - nowMin)
      };
    }
  }
  return null;
}

export function sortTodos(list) {
  return [...(list || [])].sort((a, b) => {
    if (Boolean(a.done) !== Boolean(b.done)) return a.done ? 1 : -1;
    const pa = PRIORITY_RANK[a.priority] ?? 1;
    const pb = PRIORITY_RANK[b.priority] ?? 1;
    if (pa !== pb) return pa - pb;
    return (Number(a.order) || 0) - (Number(b.order) || 0);
  });
}

/** 今日待办：今天到期，或被安排到今天 */
export function todosForToday(state, dateStr = todayStr()) {
  const list = (state.data.todos || []).filter((todo) => todo.dueDate === dateStr || todo.planDate === dateStr);
  return sortTodos(list);
}

export function assignmentsDueToday(state, dateStr = todayStr()) {
  return (state.data.assignments || []).filter((item) => {
    if (item.status === 'submitted') return false;
    const date = String(item.dueAt || '').slice(0, 10);
    return date === dateStr;
  });
}

export function homeworkStats(state, dateStr = todayStr()) {
  const pending = (state.data.assignments || []).filter((item) => item.status !== 'submitted');
  const overdue = pending.filter((item) => {
    const date = String(item.dueAt || '').slice(0, 10);
    return date && diffDays(dateStr, date) < 0;
  });
  const sorted = [...pending].sort((a, b) => String(a.dueAt || '').localeCompare(String(b.dueAt || '')));
  return {
    pending: pending.length,
    overdue: overdue.length,
    dueToday: pending.filter((item) => String(item.dueAt || '').slice(0, 10) === dateStr).length,
    nearest: sorted[0] || null
  };
}

export function fitnessWeek(state, dateStr = todayStr()) {
  const { weekStart } = weekInfo(state, dateStr);
  const dates = weekDates(dateStr, weekStart);
  const inWeek = new Set(dates);
  const plan = state.data.fitness.plan || [];
  const planned = plan.filter((p) => p && !p.rest && Array.isArray(p.items) && p.items.length > 0).length;
  const logs = (state.data.fitness.logs || []).filter((log) => inWeek.has(log.date) && log.done);
  return { done: logs.length, planned, dates };
}

export function fitnessStreak(state, dateStr = todayStr()) {
  const doneDays = new Set((state.data.fitness.logs || []).filter((log) => log.done).map((log) => log.date));
  let cursor = dateStr;
  if (!doneDays.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (doneDays.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
    if (streak > 365) break;
  }
  return streak;
}

export function budgetMonth(state, monthKey) {
  const conf = (state.data.budget.months || {})[monthKey] || { total: 0, categories: {} };
  const expenses = (state.data.budget.expenses || []).filter((e) => String(e.date || '').slice(0, 7) === monthKey);
  const spent = sum(expenses, (e) => e.amount);
  const byCategory = {};
  for (const e of expenses) {
    const key = e.category || '其他';
    byCategory[key] = (byCategory[key] || 0) + (Number(e.amount) || 0);
  }
  const total = Number(conf.total) || 0;
  return {
    total,
    spent,
    remaining: total - spent,
    percent: total > 0 ? Math.round((spent / total) * 100) : 0,
    categories: conf.categories || {},
    byCategory,
    expenses
  };
}

export function funWeek(state, dateStr = todayStr()) {
  const { weekStart } = weekInfo(state, dateStr);
  const inWeek = new Set(weekDates(dateStr, weekStart));
  const plan = state.data.fun.plan || [];
  const planned = sum(plan, (p) => (p && Number(p.minutes) > 0 ? p.minutes : 0));
  const records = (state.data.fun.records || []).filter((r) => inWeek.has(r.date));
  return { played: sum(records, (r) => r.minutes), planned, records, dates: [...inWeek] };
}

export function todayProgress(state, dateStr = todayStr(), now = new Date()) {
  const courses = coursesOn(state, dateStr);
  const nowMin = nowMinutes(now);
  const passed = courses.filter((course) => {
    const times = courseTimes(state, course);
    return times.end && parseTime(times.end) <= nowMin;
  }).length;
  const todos = todosForToday(state, dateStr);
  const todoDone = todos.filter((t) => t.done).length;
  const total = courses.length + todos.length;
  const finished = passed + todoDone;
  return {
    total,
    finished,
    percent: total ? Math.round((finished / total) * 100) : 0,
    todoDone,
    todoTotal: todos.length,
    coursePassed: passed,
    courseTotal: courses.length
  };
}

export function dataOverview(state) {
  const d = state.data;
  const count =
    (d.courses || []).length +
    (d.todos || []).length +
    (d.assignments || []).length +
    (d.fitness.logs || []).length +
    (d.fitness.weights || []).length +
    (d.budget.expenses || []).length +
    (d.fun.records || []).length +
    (d.fun.wishlist || []).length +
    (d.notes && d.notes.text ? 1 : 0);
  const lastExport = d.meta && d.meta.lastExportAt ? d.meta.lastExportAt : null;
  return {
    count,
    lastExportAt: lastExport,
    daysSinceExport: lastExport ? Math.max(0, Math.floor((Date.now() - Date.parse(lastExport)) / 86400000)) : null
  };
}

/** 首页八张摘要卡 */
export function summaryCards(state, dateStr = todayStr(), now = new Date()) {
  const { week } = weekInfo(state, dateStr);
  const courses = coursesOn(state, dateStr);
  const next = nextCourse(state, dateStr, now);
  const todos = todosForToday(state, dateStr);
  const allTodos = state.data.todos || [];
  const todoOpen = allTodos.filter((t) => !t.done).length;
  const todoOverdue = allTodos.filter((t) => !t.done && t.dueDate && diffDays(dateStr, t.dueDate) < 0).length;
  const hw = homeworkStats(state, dateStr);
  const fit = fitnessWeek(state, dateStr);
  const streak = fitnessStreak(state, dateStr);
  const budget = budgetMonth(state, dateStr.slice(0, 7));
  const fun = funWeek(state, dateStr);
  const progress = todayProgress(state, dateStr, now);
  const overview = dataOverview(state);

  const nearestHw = hw.nearest && hw.nearest.dueAt ? String(hw.nearest.dueAt).slice(0, 10) : null;
  const nearestLeft = nearestHw ? diffDays(dateStr, nearestHw) : null;

  return [
    {
      key: 'overview',
      icon: '🐟',
      title: '今日概览',
      value: progress.total ? `${progress.finished}/${progress.total}` : '今天空空的',
      sub: progress.total ? `完成度 ${progress.percent}%` : '加两件事就有进度了',
      percent: progress.percent,
      tone: 'brand',
      route: 'home'
    },
    {
      key: 'classes',
      icon: '📚',
      title: '今日课程',
      value: courses.length ? `今天 ${courses.length} 节` : '今天没课',
      sub: next
        ? `${next.ongoing ? '正在上' : next.start} ${next.course.name}`
        : courses.length ? '今天的课都上完了' : '好好休息',
      tone: 'brand',
      route: 'classes'
    },
    {
      key: 'todos',
      icon: '✅',
      title: '待办事务',
      value: `未完成 ${todoOpen} 条`,
      sub: todoOverdue ? `逾期 ${todoOverdue} 条` : '没有逾期',
      tone: todoOverdue ? 'danger' : 'ok',
      route: 'todos'
    },
    {
      key: 'homework',
      icon: '📝',
      title: '作业',
      value: hw.pending ? `未交 ${hw.pending} 项` : '全部交完',
      sub: nearestHw
        ? `最近截止 ${fmtDateCN(nearestHw)}${nearestLeft === 0 ? '（今天）' : nearestLeft > 0 ? `（还剩 ${nearestLeft} 天）` : '（已逾期）'}`
        : '没有待交作业',
      tone: hw.overdue ? 'danger' : 'ok',
      route: 'homework'
    },
    {
      key: 'fitness',
      icon: '💪',
      title: '健身计划',
      value: `本周 ${fit.done}/${fit.planned} 次`,
      sub: streak > 0 ? `连续 ${streak} 天` : '还没开始',
      tone: 'ok',
      route: 'fitness'
    },
    {
      key: 'budget',
      icon: '💰',
      title: '每月花销',
      value: budget.total ? `已花 ${fmtMoney(budget.spent)}` : `已花 ${fmtMoney(budget.spent)}`,
      sub: budget.total
        ? `预算 ${fmtMoney(budget.total)} · ${budget.remaining >= 0 ? `剩 ${fmtMoney(budget.remaining)}` : `超支 ${fmtMoney(-budget.remaining)}`}`
        : '本月还没设预算',
      percent: budget.total ? Math.min(100, budget.percent) : 0,
      tone: budget.total && budget.spent > budget.total ? 'danger' : 'ok',
      route: 'budget'
    },
    {
      key: 'fun',
      icon: '🎮',
      title: '游戏娱乐',
      value: `本周 ${fmtDuration(fun.played)}`,
      sub: fun.planned ? `计划 ${fmtDuration(fun.planned)}` : '还没排娱乐时间',
      percent: fun.planned ? Math.min(100, Math.round((fun.played / fun.planned) * 100)) : 0,
      tone: 'brand',
      route: 'fun'
    },
    {
      key: 'settings',
      icon: '⚙️',
      title: '数据与设置',
      value: `${overview.count} 条数据`,
      sub: overview.lastExportAt ? `上次备份 ${overview.daysSinceExport} 天前` : '还没备份过',
      tone: overview.lastExportAt && overview.daysSinceExport > 7 ? 'warn' : 'ok',
      route: 'settings'
    }
  ];
}

/** 第 N 周在学期里的进度百分比 */
export function semesterProgress(state, dateStr = todayStr()) {
  const { semesterStart, weekStart } = weekInfo(state, dateStr);
  if (!semesterStart) return null;
  const totalWeeks = 20;
  const week = weekOf(dateStr, semesterStart, weekStart);
  const percent = Math.max(0, Math.min(100, Math.round((week / totalWeeks) * 100)));
  return { week, totalWeeks, percent };
}

// ---------- 课程冲突与校验 ----------

export function slotsOverlap(a, b) {
  if (Number(a.dayOfWeek) !== Number(b.dayOfWeek)) return false;
  return !(Number(a.endSlot) < Number(b.startSlot) || Number(b.endSlot) < Number(a.startSlot));
}

function weekRange(course) {
  const weeks = Array.isArray(course.weeks) && course.weeks.length ? course.weeks : [1, 18];
  return [Number(weeks[0]) || 1, Number(weeks[1]) || Number(weeks[0]) || 1];
}

function parityOk(parity, week) {
  if (parity === 'odd') return week % 2 === 1;
  if (parity === 'even') return week % 2 === 0;
  return true;
}

function sharesAnyWeek(a, b) {
  const [aFrom, aTo] = weekRange(a);
  const [bFrom, bTo] = weekRange(b);
  const from = Math.max(aFrom, bFrom);
  const to = Math.min(aTo, bTo);
  for (let w = from; w <= to; w += 1) {
    if (parityOk(a.parity, w) && parityOk(b.parity, w)) return true;
  }
  return false;
}

export function findConflicts(courses, candidate, ignoreId = null) {
  return (courses || []).filter((course) => {
    if (!course || course.id === ignoreId) return false;
    if (!slotsOverlap(course, candidate)) return false;
    return sharesAnyWeek(course, candidate);
  });
}

export function validateCourse(course) {
  const errors = [];
  if (!course || !String(course.name || '').trim()) errors.push('课程名不能为空');
  const day = Number(course && course.dayOfWeek);
  if (!Number.isInteger(day) || day < 1 || day > 7) errors.push('星期不正确');
  const start = Number(course && course.startSlot);
  const end = Number(course && course.endSlot);
  if (!Number.isInteger(start) || start < 1) errors.push('开始节次不正确');
  if (!Number.isInteger(end) || end < 1) errors.push('结束节次不正确');
  if (Number.isInteger(start) && Number.isInteger(end) && end < start) errors.push('结束节次不能早于开始节次');
  const [from, to] = weekRange(course || {});
  if (from < 1 || to < from) errors.push('周次范围不正确');
  return errors;
}

// ---------- 待办分组与排序 ----------

/** 分组：今天（含逾期）/ 本周 / 以后 / 无日期 */
export function groupTodos(state, dateStr = todayStr()) {
  const { weekStart } = weekInfo(state, dateStr);
  const weekEnd = addDays(startOfWeek(dateStr, weekStart), 6);
  const buckets = { today: [], week: [], later: [], none: [] };
  for (const todo of sortTodos(state.data.todos)) {
    if (!todo.dueDate) buckets.none.push(todo);
    else if (todo.dueDate <= dateStr) buckets.today.push(todo);
    else if (todo.dueDate <= weekEnd) buckets.week.push(todo);
    else buckets.later.push(todo);
  }
  // 「今天」组内按截止日期升序，逾期最久的排最前
  buckets.today.sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));
  return buckets;
}

/** 把 fromId 移动到 toId 的位置，并重排 order */
export function reorderTodos(todos, fromId, toId) {
  const list = [...(todos || [])];
  const from = list.findIndex((t) => t.id === fromId);
  const to = list.findIndex((t) => t.id === toId);
  if (from < 0 || to < 0 || from === to) return list;
  const [moved] = list.splice(from, 1);
  list.splice(to, 0, moved);
  return list.map((todo, index) => ({ ...todo, order: index + 1 }));
}

export function todoDueLabel(dueDate, dateStr = todayStr()) {
  if (!dueDate) return '';
  const diff = diffDays(dateStr, dueDate);
  if (diff === 0) return '今天到期';
  if (diff === 1) return '明天到期';
  if (diff === -1) return '逾期 1 天';
  if (diff < 0) return `逾期 ${-diff} 天`;
  return `${fmtDateCN(dueDate)} 到期`;
}

// ---------- 作业 ----------

export const ASSIGNMENT_STATUS = { todo: '未开始', doing: '进行中', submitted: '已交' };

export function sortAssignmentsByDue(list) {
  return [...(list || [])].sort((a, b) => {
    if (a.status === 'submitted' && b.status !== 'submitted') return 1;
    if (b.status === 'submitted' && a.status !== 'submitted') return -1;
    return String(a.dueAt || '9999-12-31').localeCompare(String(b.dueAt || '9999-12-31'));
  });
}

export function groupAssignmentsByCourse(state, list) {
  const map = new Map();
  for (const item of list || []) {
    const key = item.courseName || '未分类';
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return [...map.entries()].map(([name, items]) => ({ name, items: sortAssignmentsByDue(items) }));
}

export function assignmentColor(state, assignment) {
  const course = (state.data.courses || []).find((c) => c.id === assignment.courseId);
  return course ? course.color : '#5c6f8c';
}

export function assignmentDueMeta(assignment, dateStr = todayStr()) {
  if (assignment.status === 'submitted') {
    const at = assignment.submittedAt ? String(assignment.submittedAt).slice(0, 10) : '';
    return { label: at ? `已于 ${fmtDateCN(at)} 提交` : '已提交', tone: 'muted', days: null };
  }
  const date = String(assignment.dueAt || '').slice(0, 10);
  if (!date) return { label: '未设截止时间', tone: 'muted', days: null };
  const days = diffDays(dateStr, date);
  if (days < 0) return { label: `已逾期 ${-days} 天`, tone: 'danger', days };
  if (days === 0) return { label: '今天截止', tone: 'warn', days };
  return { label: `还剩 ${days} 天（${fmtDateCN(date)}）`, tone: days <= 3 ? 'warn' : 'ok', days };
}

// ---------- 健身 ----------

export function planForDate(state, dateStr = todayStr()) {
  const day = weekdayIndex(dateStr);
  return (state.data.fitness.plan || []).find((p) => Number(p.day) === day) || null;
}

export function logForDate(state, dateStr = todayStr()) {
  return (state.data.fitness.logs || []).find((log) => log.date === dateStr) || null;
}

export function buildLogFromPlan(planEntry, dateStr = todayStr()) {
  return {
    date: dateStr,
    title: (planEntry && planEntry.title) || '训练',
    done: false,
    items: ((planEntry && planEntry.items) || []).map((item) => ({
      name: String(item.name || '动作'),
      sets: Math.max(1, Number(item.sets) || 1),
      reps: Math.max(1, Number(item.reps) || 1),
      doneSets: 0
    }))
  };
}

export function isLogComplete(log) {
  if (!log || !Array.isArray(log.items) || !log.items.length) return false;
  return log.items.every((item) => Number(item.doneSets) >= Number(item.sets));
}

/** 点第 index 个圆点：已完成则回退，否则推进到该点 */
export function toggleSet(log, itemIndex, setIndex) {
  const items = (log.items || []).map((item, i) => {
    if (i !== itemIndex) return { ...item };
    const done = Number(item.doneSets) || 0;
    const doneSets = setIndex < done ? setIndex : setIndex + 1;
    return { ...item, doneSets: Math.min(Number(item.sets) || 0, Math.max(0, doneSets)) };
  });
  return { ...log, items, done: items.length ? items.every((i) => Number(i.doneSets) >= Number(i.sets)) : false };
}

export function monthMatrix(monthKey, weekStart = 1) {
  const [year, month] = String(monthKey).split('-').map(Number);
  const total = new Date(year, month, 0).getDate();
  const first = `${monthKey}-01`;
  const offset = (weekdayIndex(first) - weekStart + 7) % 7;
  const cells = Array(offset).fill(null);
  for (let d = 1; d <= total; d += 1) cells.push(`${monthKey}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return { year, month, weeks };
}

export function fitnessMonthCount(state, monthKey) {
  return (state.data.fitness.logs || []).filter((log) => log.done && String(log.date).slice(0, 7) === monthKey).length;
}

export function weightSeries(state, limit = 12) {
  return [...(state.data.fitness.weights || [])]
    .filter((w) => w && w.date && Number(w.kg) > 0)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .slice(-limit);
}

/** 一行一个动作："卧推 4x12" 或 "卧推 4 12" */
export function parsePlanItems(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^(.+?)[\s,，]+(\d+)\s*[x×*]?\s*(\d+)$/i);
      if (!m) return null;
      const sets = Number(m[2]);
      const reps = Number(m[3]);
      if (!sets || !reps) return null;
      return { name: m[1].trim(), sets, reps };
    })
    .filter(Boolean);
}

export function formatPlanItems(items) {
  return (items || []).map((item) => `${item.name} ${item.sets}x${item.reps}`).join('\n');
}

// ---------- 花销 ----------

export const BUDGET_CATEGORIES = ['餐饮', '交通', '日用', '学习', '娱乐', '其他'];

export function budgetBreakdown(state, monthKey) {
  const month = budgetMonth(state, monthKey);
  const rows = BUDGET_CATEGORIES.map((category) => ({
    category,
    spent: month.byCategory[category] || 0,
    budget: Number((month.categories || {})[category]) || 0
  }));
  for (const [category, spent] of Object.entries(month.byCategory)) {
    if (!BUDGET_CATEGORIES.includes(category)) rows.push({ category, spent, budget: 0 });
  }
  return rows
    .filter((row) => row.spent > 0 || row.budget > 0)
    .map((row) => ({
      ...row,
      percent: row.budget > 0 ? Math.round((row.spent / row.budget) * 100) : null
    }))
    .sort((a, b) => b.spent - a.spent);
}

export function expensesByDate(expenses) {
  const map = new Map();
  for (const item of expenses || []) {
    const date = item.date || '';
    if (!map.has(date)) map.set(date, []);
    map.get(date).push(item);
  }
  return [...map.entries()]
    .map(([date, items]) => ({ date, items, total: sum(items, (i) => i.amount) }))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export function expenseTotals(state, monthKey) {
  const month = budgetMonth(state, monthKey);
  return {
    total: month.total,
    spent: month.spent,
    remaining: month.remaining,
    overspent: month.total > 0 && month.spent > month.total
  };
}

// ---------- 娱乐 ----------

export function funPlanForDate(state, dateStr = todayStr()) {
  const day = weekdayIndex(dateStr);
  return (state.data.fun.plan || []).find((p) => Number(p.day) === day) || null;
}

/** 计时器已用时（秒）：暂停时返回累计值，运行中再加上本次时长 */
export function timerElapsed(timer, now = Date.now()) {
  if (!timer) return 0;
  const accumulated = Math.max(0, Number(timer.accumulated) || 0);
  if (timer.running && timer.startedAt) {
    const started = Date.parse(timer.startedAt);
    if (Number.isFinite(started)) return accumulated + Math.max(0, Math.floor((now - started) / 1000));
  }
  return accumulated;
}

export function fmtSeconds(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function funMonthTotal(state, monthKey) {
  return sum((state.data.fun.records || []).filter((r) => String(r.date || '').slice(0, 7) === monthKey), (r) => r.minutes);
}

export function funTodayTotal(state, dateStr = todayStr()) {
  return sum((state.data.fun.records || []).filter((r) => r.date === dateStr), (r) => r.minutes);
}

export function sortFunRecords(records) {
  return [...(records || [])].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
}

// ---------- 设置 ----------

export function dataCounts(state) {
  const d = state.data;
  return {
    courses: (d.courses || []).length,
    todos: (d.todos || []).length,
    assignments: (d.assignments || []).length,
    fitnessLogs: (d.fitness.logs || []).length,
    weights: (d.fitness.weights || []).length,
    expenses: (d.budget.expenses || []).length,
    funRecords: (d.fun.records || []).length,
    wishlist: (d.fun.wishlist || []).length
  };
}

// ---------- 重复待办 ----------

export const REPEAT_LABELS = { none: '不重复', daily: '每天', weekly: '每周' };

export function formatRepeat(repeat) {
  return REPEAT_LABELS[repeat] || '不重复';
}

/** 完成一条重复待办后，下一次要生成的内容（不含 id） */
export function buildNextOccurrence(todo, dateStr = todayStr()) {
  if (!todo || !todo.repeat || todo.repeat === 'none') return null;
  const base = todo.dueDate || dateStr;
  const step = todo.repeat === 'weekly' ? 7 : 1;
  return {
    title: todo.title,
    note: todo.note || '',
    dueDate: addDays(base, step),
    planDate: null,
    priority: todo.priority || 'mid',
    repeat: todo.repeat,
    seriesId: todo.seriesId || todo.id,
    done: false,
    doneAt: null,
    order: Date.now()
  };
}

// ---------- 提醒中心 ----------

export function collectReminders(state, now = new Date(), dateStr = todayStr()) {
  const list = [];

  for (const item of state.data.assignments || []) {
    if (item.status === 'submitted') continue;
    const date = String(item.dueAt || '').slice(0, 10);
    if (!date) continue;
    const left = diffDays(dateStr, date);
    if (left < 0) {
      list.push({ type: '作业', title: item.title, sub: `已逾期 ${-left} 天`, route: 'homework', tone: 'danger' });
    } else if (left === 0) {
      list.push({ type: '作业', title: item.title, sub: '今天截止', route: 'homework', tone: 'warn' });
    }
  }

  for (const todo of state.data.todos || []) {
    if (todo.done || !todo.dueDate) continue;
    const left = diffDays(dateStr, todo.dueDate);
    if (left < 0) {
      list.push({ type: '待办', title: todo.title, sub: `逾期 ${-left} 天`, route: 'todos', tone: 'danger' });
    }
  }

  const upcoming = nextCourse(state, dateStr, now);
  if (upcoming && !upcoming.ongoing && upcoming.minutesLeft <= 30) {
    list.push({
      type: '课程',
      title: upcoming.course.name,
      sub: `${upcoming.start} 开始（还有 ${upcoming.minutesLeft} 分钟）`,
      route: 'classes',
      tone: 'brand'
    });
  }

  return list;
}

// ---------- 统计 ----------

export function fitnessWeeklySeries(state, weeks = 8, dateStr = todayStr()) {
  const { weekStart } = weekInfo(state, dateStr);
  const thisWeek = startOfWeek(dateStr, weekStart);
  const logs = (state.data.fitness.logs || []).filter((log) => log.done);
  const out = [];
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const start = addDays(thisWeek, -7 * i);
    const dates = new Set(weekDates(start, weekStart));
    out.push({
      label: fmtDateCN(start).replace('月', '/').replace('日', ''),
      start,
      count: logs.filter((log) => dates.has(log.date)).length
    });
  }
  return out;
}

export function expenseMonthlySeries(state, months = 6, dateStr = todayStr()) {
  const base = monthKeyOf(dateStr);
  const out = [];
  for (let i = months - 1; i >= 0; i -= 1) {
    const key = addMonths(base, -i);
    const total = sum(
      (state.data.budget.expenses || []).filter((e) => String(e.date || '').slice(0, 7) === key),
      (e) => e.amount
    );
    out.push({ label: `${Number(key.slice(5))}月`, key, total });
  }
  return out;
}

export function funDailySeries(state, days = 7, dateStr = todayStr()) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(dateStr, -i);
    const total = sum(
      (state.data.fun.records || []).filter((r) => r.date === date),
      (r) => r.minutes
    );
    out.push({ label: date.slice(5).replace('-', '/'), date, minutes: total });
  }
  return out;
}

export function assignmentMonthStats(state, monthKey = monthKeyOf(todayStr())) {
  const items = (state.data.assignments || []).filter((a) => String(a.dueAt || '').slice(0, 7) === monthKey);
  const submitted = items.filter((a) => a.status === 'submitted').length;
  return {
    total: items.length,
    submitted,
    percent: items.length ? Math.round((submitted / items.length) * 100) : 0
  };
}

