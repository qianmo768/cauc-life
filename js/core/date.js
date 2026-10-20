// 日期与格式化工具：全站唯一的时间口径实现
const MS_DAY = 86400000;
const WEEKDAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function toDateStr(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseDate(str) {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayStr(now = new Date()) {
  return toDateStr(now);
}

export function addDays(str, n) {
  const d = parseDate(str);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** 1=周一 … 7=周日 */
export function weekdayIndex(str) {
  const day = parseDate(str).getDay();
  return day === 0 ? 7 : day;
}

/** 以 weekStart（1=周一）为一周开始，返回该周第一天 */
export function startOfWeek(str, weekStart = 1) {
  const diff = (weekdayIndex(str) - weekStart + 7) % 7;
  return addDays(str, -diff);
}

export function diffDays(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / MS_DAY);
}

/** 第几周（1 开始）；未设置学期起始日时返回 1 */
export function weekOf(dateStr, semesterStart, weekStart = 1) {
  if (!semesterStart) return 1;
  const base = startOfWeek(semesterStart, weekStart);
  const cur = startOfWeek(dateStr, weekStart);
  return Math.floor(diffDays(base, cur) / 7) + 1;
}

/** 返回一周 7 天的日期 */
export function weekDates(dateStr, weekStart = 1) {
  const start = startOfWeek(dateStr, weekStart);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function weekdayName(index) {
  return WEEKDAY_NAMES[(index - 1 + 7) % 7];
}

export function fmtDateCN(str) {
  const d = parseDate(str);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function fmtShort(d = new Date()) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function fmtMonthCN(monthKey) {
  const [y, m] = String(monthKey).split('-');
  return `${y}年${Number(m)}月`;
}

export function monthKeyOf(dateStr = todayStr()) {
  return String(dateStr).slice(0, 7);
}

export function monthOf(monthKey) {
  const [y, m] = String(monthKey).split('-').map(Number);
  return { year: y, month: m, days: new Date(y, m, 0).getDate() };
}

export function addMonths(monthKey, n) {
  const [y, m] = String(monthKey).split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

/** 'HH:mm' → 分钟数 */
export function parseTime(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function nowMinutes(d = new Date()) {
  return d.getHours() * 60 + d.getMinutes();
}

export function fmtClock(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

export function fmtDuration(minutes) {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} 分钟`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} 小时` : `${h} 小时 ${m} 分`;
}

export function fmtDurationShort(minutes) {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}分`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export function fmtMoney(n) {
  const v = Number(n) || 0;
  return `¥${v.toFixed(2)}`;
}

/** 距离目标日期还有几天（负数表示已过） */
export function daysUntil(dateStr, base = todayStr()) {
  return diffDays(base, dateStr);
}

export function isOverdue(dateStr, base = todayStr()) {
  return Boolean(dateStr) && diffDays(base, dateStr) < 0;
}

export function isToday(dateStr, base = todayStr()) {
  return dateStr === base;
}

/** 日期在最近 n 天内（含今天，过去方向） */
export function withinLastDays(dateStr, n, base = todayStr()) {
  const d = diffDays(dateStr, base);
  return d >= 0 && d < n;
}

/** ISO 时间 → datetime-local 输入框的值 */
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** datetime-local 的值 → ISO 字符串 */
export function fromLocalInput(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
