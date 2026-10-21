// 教务系统课表 HTML 解析器（正方系统「个人课表查询」表格视图）
const MARKERS = /[★■◆☆]/g;

const PALETTE = ['#2f6bff', '#e0562f', '#1f9d63', '#a45bd8', '#c98a0b', '#1f8fa8', '#d8447a', '#5c6f8c'];

/** CAUC 作息时间（1-2 节 8:00–9:35 …） */
export const CAUC_SLOTS = [
  ['08:00', '08:45'], ['08:50', '09:35'],
  ['10:05', '10:50'], ['10:55', '11:40'],
  ['13:30', '14:15'], ['14:20', '15:05'],
  ['15:35', '16:20'], ['16:25', '17:10'],
  ['18:30', '19:15'], ['19:20', '20:05'],
  ['20:10', '20:55'], ['21:00', '21:45']
].map(([start, end], index) => ({ index: index + 1, start, end }));

function stripTags(html) {
  return String(html || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return PALETTE[hash % PALETTE.length];
}

/** 从 "3-5周,7-16周" 或 "第6周" 解析出 [[3,5],[7,16]] / [[6,6]] */
export function parseWeekRanges(text) {
  const ranges = [];
  const tokens = String(text || '').split(/[,，、]/);
  for (const token of tokens) {
    const range = /(\d+)\s*[-–~]\s*(\d+)/.exec(token);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (from >= 1 && to >= from) ranges.push([from, to]);
      continue;
    }
    const single = /第?\s*(\d+)\s*周/.exec(token) || /^\s*(\d+)\s*$/.exec(token);
    if (single) {
      const week = Number(single[1]);
      if (week >= 1) ranges.push([week, week]);
    }
  }
  return ranges;
}

function findField(block, label) {
  // 情况一：文字直接放在 span 里
  const insideRe = new RegExp(`title="${label}\\s*"[^>]*>([\\s\\S]*?)</span>`, 'i');
  const inside = insideRe.exec(block);
  if (inside) {
    const text = stripTags(inside[1]);
    if (text) return text;
  }
  // 情况二：span 里只有图标，文字在紧随其后的 font 中
  const afterRe = new RegExp(`title="${label}\\s*"[^>]*>[\\s\\S]*?</span>\\s*<font[^>]*>([^<]*)</font>`, 'i');
  const after = afterRe.exec(block);
  return after ? stripTags(after[1]) : '';
}

function parseCourseBlock(block, position) {
  const titleMatch = /<(?:span|u)[^>]*class="title[^"]*"[^>]*>([\s\S]*?)<\/(?:span|u)>/.exec(block);
  const titleInner = titleMatch ? titleMatch[1] : '';
  // 红色斜体是「待筛选」，不导入
  if (titleInner.includes('color="red"')) return null;
  const rawTitle = titleMatch ? stripTags(titleInner) : '';
  if (!rawTitle) return null;

  const adjusted = rawTitle.includes('【调】');
  const name = rawTitle.replace('【调】', '').replace(MARKERS, '').trim();
  if (!name) return null;

  const plain = stripTags(block);
  const scheduleText = findField(block, '节/周') || plain;
  const slotMatch = /\((\d+)\s*-\s*(\d+)\s*节\)/.exec(scheduleText);
  const startSlot = slotMatch ? Number(slotMatch[1]) : position.startSlot;
  const endSlot = slotMatch ? Number(slotMatch[2]) : position.endSlot;
  const weekText = scheduleText.replace(/\((\d+)\s*-\s*(\d+)\s*节\)/, '');
  let ranges = parseWeekRanges(weekText);
  let weeksUnknown = false;

  // 没解析到周次时标记出来，导入预览会提示
  if (!ranges.length) {
    ranges = [[1, 18]];
    weeksUnknown = true;
  }

  return {
    name,
    teacher: findField(block, '教师'),
    location: findField(block, '上课地点'),
    dayOfWeek: position.dayOfWeek,
    startSlot,
    endSlot,
    weeks: [ranges[0][0], ranges[ranges.length - 1][1]],
    weekRanges: ranges,
    weeksUnknown,
    parity: 'all',
    color: colorFor(name),
    skips: [],
    note: '',
    source: 'jwgl',
    adjusted
  };
}

export function parseJwglTimetable(html) {
  const text = String(html || '');
  const table = /<table[^>]*id="kbgrid_table_0"[\s\S]*?<\/table>/i.exec(text);
  if (!table) {
    return { courses: [], errors: ['没找到课表表格（请确认保存的是「个人课表查询」页面）'], meta: null };
  }

  const errors = [];
  const courses = [];
  const cells = table[0].matchAll(/<td([^>]*class="td_wrap"[^>]*)>([\s\S]*?)<\/td>/g);

  for (const cell of cells) {
    const attrs = cell[1];
    const inner = cell[2];
    const idMatch = /id="(\d+)-(\d+)"/.exec(attrs);
    if (!idMatch) continue;
    const dayOfWeek = Number(idMatch[1]);
    const startSlot = Number(idMatch[2]);
    const rowspan = Number((/rowspan="(\d+)"/.exec(attrs) || [])[1] || 1);
    if (dayOfWeek < 1 || dayOfWeek > 7) continue;

    const blocks = inner.matchAll(/<div class="timetable_con[^"]*">([\s\S]*?)<\/div>/g);
    for (const block of blocks) {
      const course = parseCourseBlock(block[1], {
        dayOfWeek,
        startSlot,
        endSlot: startSlot + rowspan - 1
      });
      if (course) courses.push(course);
    }
  }

  const semesterMatch = /(\d{4}-\d{4})\s*学年第\s*(\d+)\s*学期/.exec(stripTags(table[0]));
  return {
    courses,
    errors,
    meta: semesterMatch ? { year: semesterMatch[1], term: Number(semesterMatch[2]) } : null
  };
}

function rangesOf(course) {
  if (Array.isArray(course.weekRanges) && course.weekRanges.length) {
    return course.weekRanges.map((range) => [Number(range[0]), Number(range[1])]);
  }
  const weeks = Array.isArray(course.weeks) && course.weeks.length ? course.weeks : [1, 18];
  return [[Number(weeks[0]) || 1, Number(weeks[1]) || 1]];
}

function weeksOverlap(a, b) {
  return rangesOf(a).some(([aFrom, aTo]) =>
    rangesOf(b).some(([bFrom, bTo]) => Math.max(aFrom, bFrom) <= Math.min(aTo, bTo))
  );
}

/** 导入预览：与手工课程冲突的导入项会被跳过 */
export function buildImportPlan(existingCourses, importedCourses) {
  const manual = (existingCourses || []).filter((course) => course.source !== 'jwgl');
  const conflicts = [];
  const accepted = [];

  for (const course of importedCourses) {
    const clash = manual.find((item) => {
      if (Number(item.dayOfWeek) !== Number(course.dayOfWeek)) return false;
      const overlapSlot = !(Number(item.endSlot) < Number(course.startSlot) || Number(course.endSlot) < Number(item.startSlot));
      if (!overlapSlot) return false;
      return weeksOverlap(item, course);
    });
    if (clash) conflicts.push({ course, clash });
    else accepted.push(course);
  }

  return { accepted, conflicts, kept: manual.length };
}
