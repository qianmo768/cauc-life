import { esc, uid } from '../core/html.js';
import {
  todayStr, weekdayName, weekdayIndex, startOfWeek, addDays, weekOf, weekDates,
  fmtDateCN, parseTime, nowMinutes, fmtMonthCN
} from '../core/date.js';
import { courseOccurs, courseTimes, findConflicts, validateCourse } from '../core/calc.js';
import { openModal } from '../ui/modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';

let offset = 0;

const COLORS = ['#2f6bff', '#e0562f', '#1f9d63', '#a45bd8', '#c98a0b', '#1f8fa8', '#d8447a', '#5c6f8c'];

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function statusOf(state, course, dateStr, now) {
  const times = courseTimes(state, course);
  const nowMin = nowMinutes(now);
  const start = parseTime(times.start);
  const end = parseTime(times.end);
  if (dateStr !== todayStr()) return '';
  if (nowMin >= end) return '已结束';
  if (nowMin >= start) return '进行中';
  return `${Math.max(0, start - nowMin)} 分钟后`;
}

export function render(state, ctx = {}) {
  const today = todayStr();
  const settings = state.data.settings;
  const weekStart = settings.weekStart || 1;
  const slots = settings.slots || [];
  const base = startOfWeek(today, weekStart);
  const viewStart = addDays(base, offset * 7);
  const dates = weekDates(viewStart, weekStart);
  const week = weekOf(viewStart, settings.semesterStart, weekStart);
  const now = new Date();
  const courses = state.data.courses || [];
  const hasAny = courses.length > 0;

  const byDate = new Map(dates.map((d) => [d, courses.filter((c) => courseOccurs(c, d, week))]));
  const todayCourses = byDate.get(today) || [];

  const headerCells = dates.map((d) => `
    <div class="wg-head ${d === today ? 'today' : ''}">
      <span>${weekdayName(weekdayIndex(d))}</span>
      <span class="dim">${shortDate(d)}</span>
    </div>`).join('');

  const cells = slots.map((slot) => `
    <div class="wg-slot num">${slot.index}</div>
    ${dates.map((d) => `<div class="wg-cell ${d === today ? 'today-col' : ''}" data-slot="${slot.index}"></div>`).join('')}
  `).join('');

  const blocks = [];
  for (const d of dates) {
    const col = ((weekdayIndex(d) - weekStart + 7) % 7) + 2;
    for (const course of byDate.get(d)) {
      const span = Math.max(1, Number(course.endSlot) - Number(course.startSlot) + 1);
      blocks.push(`
        <button class="course-block" type="button" data-action="open-course" data-id="${esc(course.id)}"
          style="grid-column:${col};grid-row:${Number(course.startSlot) + 1}/span ${span};--course:${esc(course.color || COLORS[0])}">
          <span class="cb-name">${esc(course.name)}</span>
          <span class="cb-meta">${esc(course.location || '')}</span>
        </button>`);
    }
  }

  const todayList = todayCourses.length
    ? todayCourses.map((course) => {
      const times = courseTimes(state, course);
      const status = statusOf(state, course, today, now);
      return `
        <div class="day-course">
          <div class="num text-sm strong">${esc(times.start)}</div>
          <div class="grow">
            <div class="strong">${esc(course.name)}</div>
            <div class="text-xs dim">${esc([course.location, course.teacher].filter(Boolean).join(' · '))}</div>
          </div>
          ${status ? `<span class="badge ${status === '进行中' ? 'brand' : 'muted'}">${esc(status)}</span>` : ''}
        </div>`;
    }).join('')
    : '<div class="empty" style="padding:20px 8px"><p class="text-sm dim">今天没课，好好休息</p></div>';

  return `
    <div class="stack">
      <div class="row-between wrap">
        <div class="row">
          <button class="btn icon sm" type="button" data-action="prev-week" aria-label="上一周">‹</button>
          <div class="week-label">
            <span class="strong">第 ${week} 周</span>
            <span class="text-xs dim">${fmtDateCN(dates[0])} — ${fmtDateCN(dates[6])}</span>
          </div>
          <button class="btn icon sm" type="button" data-action="next-week" aria-label="下一周">›</button>
          ${offset !== 0 ? '<button class="btn sm" type="button" data-action="this-week">回到本周</button>' : ''}
        </div>
        <button class="btn primary sm" type="button" data-action="add-course">＋ 添加课程</button>
      </div>

      ${hasAny ? `
        <div class="card pad week-card">
          <div class="week-scroll">
            <div class="week-grid">
              <div class="wg-corner"></div>
              ${headerCells}
              ${cells}
              ${blocks.join('')}
            </div>
          </div>
        </div>

        <div class="card pad mobile-only">
          <div class="card-title"><h3>今天的课</h3><span class="text-xs dim">${todayCourses.length} 节</span></div>
          ${todayList}
        </div>
      ` : `
        <div class="card pad">
          <div class="empty">
            <div class="empty-icon">📚</div>
            <p class="text-lg strong">还没有课程</p>
            <p class="text-sm dim">先加一门课，或者让本鱼填一份示例课表。</p>
            <div class="row" style="margin-top:8px">
              <button class="btn primary sm" type="button" data-action="add-course">添加第一门课</button>
              <button class="btn sm" type="button" data-action="fill-sample">填入示例课表</button>
            </div>
          </div>
        </div>
      `}
    </div>
  `;
}

function slotOptions(selected) {
  return Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    return `<option value="${n}" ${n === Number(selected) ? 'selected' : ''}>第 ${n} 节</option>`;
  }).join('');
}

function courseFormHtml(course = {}, weekStart = 1) {
  const c = {
    name: '',
    teacher: '',
    location: '',
    dayOfWeek: weekStart,
    startSlot: 1,
    endSlot: 2,
    weeks: [1, 18],
    parity: 'all',
    color: COLORS[0],
    note: '',
    ...course
  };
  const weekFrom = c.weeks ? c.weeks[0] : 1;
  const weekTo = c.weeks ? c.weeks[1] : 18;

  return `
    <form class="stack" data-form="course" onsubmit="return false">
      <div class="field">
        <label>课程名 *</label>
        <input class="input" name="name" value="${esc(c.name)}" placeholder="例如：高等数学" autocomplete="off">
      </div>
      <div class="form-grid">
        <div class="field">
          <label>星期</label>
          <select class="select" name="dayOfWeek">
            ${[1, 2, 3, 4, 5, 6, 7].map((d) => `<option value="${d}" ${d === Number(c.dayOfWeek) ? 'selected' : ''}>${weekdayName(d)}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label>单双周</label>
          <select class="select" name="parity">
            <option value="all" ${c.parity === 'all' ? 'selected' : ''}>每周</option>
            <option value="odd" ${c.parity === 'odd' ? 'selected' : ''}>单周</option>
            <option value="even" ${c.parity === 'even' ? 'selected' : ''}>双周</option>
          </select>
        </div>
        <div class="field">
          <label>开始节次</label>
          <select class="select" name="startSlot">${slotOptions(c.startSlot)}</select>
        </div>
        <div class="field">
          <label>结束节次</label>
          <select class="select" name="endSlot">${slotOptions(c.endSlot)}</select>
        </div>
        <div class="field">
          <label>起始周</label>
          <input class="input" type="number" name="weekFrom" min="1" max="30" value="${esc(weekFrom)}">
        </div>
        <div class="field">
          <label>结束周</label>
          <input class="input" type="number" name="weekTo" min="1" max="30" value="${esc(weekTo)}">
        </div>
        <div class="field">
          <label>老师</label>
          <input class="input" name="teacher" value="${esc(c.teacher)}" placeholder="可留空">
        </div>
        <div class="field">
          <label>地点</label>
          <input class="input" name="location" value="${esc(c.location)}" placeholder="可留空">
        </div>
        <div class="field full">
          <label>颜色</label>
          <div class="color-row">
            ${COLORS.map((color, i) => `
              <label class="color-dot" style="--c:${color}">
                <input type="radio" name="color" value="${color}" ${c.color === color ? 'checked' : ''}>
                <span></span>
              </label>`).join('')}
          </div>
        </div>
        <div class="field full">
          <label>备注</label>
          <input class="input" name="note" value="${esc(c.note || '')}" placeholder="可留空">
        </div>
      </div>
      <p class="err hidden" data-error></p>
    </form>
  `;
}

function readCourseForm(mask) {
  const form = mask.querySelector('[data-form="course"]');
  const val = (name) => {
    const el = form.elements[name];
    return el ? String(el.value || '').trim() : '';
  };
  const colorEl = form.querySelector('input[name="color"]:checked');
  return {
    name: val('name'),
    teacher: val('teacher'),
    location: val('location'),
    dayOfWeek: Number(val('dayOfWeek')),
    startSlot: Number(val('startSlot')),
    endSlot: Number(val('endSlot')),
    weeks: [Number(val('weekFrom')), Number(val('weekTo'))],
    parity: val('parity') || 'all',
    color: colorEl ? colorEl.value : COLORS[0],
    note: val('note')
  };
}

function openCourseForm(store, rerender, existing = null) {
  const state = store.state;
  const weekStart = state.data.settings.weekStart || 1;
  const { close } = openModal({
    title: existing ? '编辑课程' : '添加课程',
    wide: true,
    body: courseFormHtml(existing || {}, weekStart),
    footer: `
      <button class="btn" type="button" data-cancel>取消</button>
      <button class="btn primary" type="button" data-save>保存</button>
    `,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const value = readCourseForm(mask);
        const errors = validateCourse(value);
        const errorEl = mask.querySelector('[data-error]');
        if (errors.length) {
          errorEl.textContent = errors[0];
          errorEl.classList.remove('hidden');
          return;
        }
        const conflicts = findConflicts(state.data.courses, value, existing ? existing.id : null);
        store.update((d) => {
          if (existing) {
            const target = d.data.courses.find((c) => c.id === existing.id);
            if (target) Object.assign(target, value);
          } else {
            d.data.courses.push({ id: uid('c'), skips: [], ...value });
          }
        });
        close();
        rerender();
        if (conflicts.length) {
          toast(`时间冲突：${conflicts.map((c) => c.name).join('、')}`, { duration: 2600 });
        } else {
          toast(existing ? '课程已更新' : '课程已添加');
        }
      });
    }
  });
}

function openCourseDetail(course, store, rerender) {
  const state = store.state;
  const times = courseTimes(state, course);
  const weeks = course.weeks || [1, 18];
  const parityName = { all: '每周', odd: '单周', even: '双周' }[course.parity] || '每周';
  const { close } = openModal({
    title: course.name,
    body: `
      <div class="kv"><span>时间</span><span>${weekdayName(course.dayOfWeek)} 第 ${course.startSlot}–${course.endSlot} 节（${esc(times.start)}–${esc(times.end)}）</span></div>
      <div class="kv"><span>周次</span><span>第 ${weeks[0]}–${weeks[1]} 周 · ${parityName}</span></div>
      <div class="kv"><span>老师</span><span>${esc(course.teacher || '未填')}</span></div>
      <div class="kv"><span>地点</span><span>${esc(course.location || '未填')}</span></div>
      ${course.note ? `<div class="kv"><span>备注</span><span>${esc(course.note)}</span></div>` : ''}
    `,
    footer: `
      <button class="btn danger" type="button" data-del>删除</button>
      <button class="btn" type="button" data-skip>本周跳过</button>
      <button class="btn primary" type="button" data-edit>编辑</button>
    `,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-edit]').addEventListener('click', () => {
        close();
        openCourseForm(store, rerender, course);
      });
      mask.querySelector('[data-skip]').addEventListener('click', () => {
        const settings = state.data.settings;
        const week = weekOf(todayStr(), settings.semesterStart, settings.weekStart || 1);
        store.update((d) => {
          const target = d.data.courses.find((c) => c.id === course.id);
          if (!target) return;
          target.skips = Array.isArray(target.skips) ? target.skips : [];
          if (!target.skips.includes(week)) target.skips.push(week);
        });
        close();
        rerender();
        toast(`已跳过第 ${week} 周`);
      });
      mask.querySelector('[data-del]').addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: '删除课程',
          message: `确定删除「${course.name}」吗？这门课的作业记录会保留。`,
          confirmText: '删除',
          danger: true
        });
        if (!ok) return;
        store.update((d) => { d.data.courses = d.data.courses.filter((c) => c.id !== course.id); });
        close();
        rerender();
        toast('课程已删除');
      });
    }
  });
}

function fillSample(store) {
  const today = todayStr();
  const wd = weekdayIndex(today);
  const nextDay = (wd % 7) + 1;
  const samples = [
    { name: '高等数学', teacher: '王老师', location: 'A301', dayOfWeek: wd, startSlot: 1, endSlot: 2, color: COLORS[0] },
    { name: '大学英语', teacher: '刘老师', location: 'B105', dayOfWeek: wd, startSlot: 3, endSlot: 4, color: COLORS[1] },
    { name: '体育', teacher: '陈老师', location: '田径场', dayOfWeek: nextDay, startSlot: 5, endSlot: 6, color: COLORS[2] }
  ];
  store.update((d) => {
    for (const s of samples) {
      d.data.courses.push({ id: uid('c'), weeks: [1, 18], parity: 'all', skips: [], note: '', ...s });
    }
  });
  toast('示例课表已填好');
}

export function bind(root, { store, rerender }) {
  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'prev-week') { offset -= 1; rerender(); }
    else if (action === 'next-week') { offset += 1; rerender(); }
    else if (action === 'this-week') { offset = 0; rerender(); }
    else if (action === 'add-course') { openCourseForm(store, rerender); }
    else if (action === 'fill-sample') { fillSample(store); }
    else if (action === 'open-course') {
      const course = store.state.data.courses.find((c) => c.id === el.dataset.id);
      if (course) openCourseDetail(course, store, rerender);
    }
  });
}

export function resetWeekOffset() {
  offset = 0;
}

export function setWeekOffset(n) {
  offset = Number(n) || 0;
}
