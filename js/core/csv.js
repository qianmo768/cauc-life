// 课程表 CSV：导出与解析（纯函数）
const HEADERS = ['课程名', '老师', '地点', '星期', '开始节', '结束节', '起始周', '结束周', '单双周', '颜色', '备注'];

export const CSV_HEADER = HEADERS.join(',');

const DAY_NAMES = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
const PARITY_NAMES = { all: '每周', odd: '单周', even: '双周' };
const PARITY_VALUES = { 每周: 'all', 单周: 'odd', 双周: 'even', 每周一次: 'all' };

function escapeCell(value) {
  const text = String(value === null || value === undefined ? '' : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function coursesToCsv(courses) {
  const rows = [HEADERS.join(',')];
  for (const course of courses || []) {
    const weeks = Array.isArray(course.weeks) && course.weeks.length ? course.weeks : [1, 18];
    rows.push([
      course.name,
      course.teacher || '',
      course.location || '',
      DAY_NAMES[(Number(course.dayOfWeek) || 1) - 1],
      course.startSlot,
      course.endSlot,
      weeks[0],
      weeks[1],
      PARITY_NAMES[course.parity] || '每周',
      course.color || '',
      course.note || ''
    ].map(escapeCell).join(','));
  }
  return rows.join('\r\n');
}

export function splitCsvLine(line) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i += 1; }
        else quoted = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      out.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  out.push(current);
  return out;
}

function parseDay(value) {
  const text = String(value || '').trim();
  const index = DAY_NAMES.indexOf(text);
  if (index >= 0) return index + 1;
  const num = Number(text);
  return Number.isInteger(num) && num >= 1 && num <= 7 ? num : null;
}

export function parseCoursesCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { courses: [], errors: ['文件是空的'] };

  const header = splitCsvLine(lines[0]).map((cell) => cell.trim());
  const column = (name, fallback) => {
    const index = header.indexOf(name);
    return index >= 0 ? index : fallback;
  };

  const idx = {
    name: column('课程名', 0),
    teacher: column('老师', 1),
    location: column('地点', 2),
    day: column('星期', 3),
    start: column('开始节', 4),
    end: column('结束节', 5),
    weekFrom: column('起始周', 6),
    weekTo: column('结束周', 7),
    parity: column('单双周', 8),
    color: column('颜色', 9),
    note: column('备注', 10)
  };

  const courses = [];
  const errors = [];

  lines.slice(1).forEach((line, i) => {
    const rowNumber = i + 2;
    const cells = splitCsvLine(line);
    const cell = (key) => String(cells[idx[key]] === undefined ? '' : cells[idx[key]]).trim();

    const name = cell('name');
    if (!name) { errors.push(`第 ${rowNumber} 行：课程名为空`); return; }

    const day = parseDay(cell('day'));
    if (!day) { errors.push(`第 ${rowNumber} 行：星期无法识别（${cell('day') || '空'}）`); return; }

    const startSlot = Number(cell('start'));
    const endSlot = Number(cell('end'));
    if (!Number.isInteger(startSlot) || startSlot < 1 || !Number.isInteger(endSlot) || endSlot < startSlot) {
      errors.push(`第 ${rowNumber} 行：节次不正确`);
      return;
    }

    const weekFrom = Number(cell('weekFrom')) || 1;
    const weekTo = Number(cell('weekTo')) || weekFrom;
    if (weekTo < weekFrom) { errors.push(`第 ${rowNumber} 行：周次范围不正确`); return; }

    courses.push({
      name,
      teacher: cell('teacher'),
      location: cell('location'),
      dayOfWeek: day,
      startSlot,
      endSlot,
      weeks: [weekFrom, weekTo],
      parity: PARITY_VALUES[cell('parity')] || 'all',
      color: cell('color') || '#2f6bff',
      note: cell('note'),
      skips: []
    });
  });

  return { courses, errors };
}
