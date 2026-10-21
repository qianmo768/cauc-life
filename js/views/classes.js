import { esc, uid } from '../core/html.js';
import {
  todayStr, weekdayName, weekdayIndex, startOfWeek, addDays, weekOf, weekDates,
  fmtDateCN, parseTime, nowMinutes, fmtMonthCN
} from '../core/date.js';
import { courseOccurs, courseTimes, findConflicts, validateCourse } from '../core/calc.js';
import { parseJwglTimetable, buildImportPlan, CAUC_SLOTS } from '../core/jwgl.js';
import { openModal } from '../ui/modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';

let offset = 0;

const COLORS = ['#2f6bff', '#e0562f', '#1f9d63', '#a45bd8', '#c98a0b', '#1f8fa8', '#d8447a', '#5c6f8c'];

function shortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatClock(hhmm) {
  if (!hhmm) return '';
  const [h, m] = String(hhmm).split(':');
  return `${Number(h)}:${m}`;
}

/** 把节次两两合并成「1~2 节」这样的行 */
function buildBands(slots) {
  const bands = [];
  for (let i = 0; i < slots.length; i += 2) {
    const first = slots[i];
    const second = slots[i + 1] || slots[i];
    bands.push({
      label: slots[i + 1] ? `${first.index}~${second.index}节` : `${first.index}节`,
      start: first.start,
      end: second.end
    });
  }
  return bands;
}

function currentWeek(state) {
  const settings = state.data.settings;
  const weekStart = settings.weekStart || 1;
  const viewStart = addDays(startOfWeek(todayStr(), weekStart), offset * 7);
  const dates = weekDates(viewStart, weekStart);
  const week = weekOf(viewStart, settings.semesterStart, weekStart);
  return { week, dates };
}

function parityName(parity) {
  return { all: '每周', odd: '单周', even: '双周' }[parity] || '每周';
}

function openOtherCourses(store, rerender) {
  const state = store.state;
  const { week, dates } = currentWeek(state);
  const others = (state.data.courses || []).filter(
    (course) => !dates.some((d) => courseOccurs(course, d, week))
  );

  const body = others.length
    ? `<p class="hint" style="margin-bottom:8px">这些课不在本周（第 ${week} 周）的课表里：</p>
       <ul class="list">
         ${others.map((course) => {
           const weeks = course.weeks || [1, 18];
           return `<li class="list-item">
             <span class="tag course" style="--course:${esc(course.color || COLORS[0])}">${esc(course.name)}</span>
             <span class="grow text-xs dim">第 ${weeks[0]}–${weeks[1]} 周 · ${parityName(course.parity)}</span>
             <button class="btn sm" type="button" data-other-id="${esc(course.id)}">查看</button>
           </li>`;
         }).join('')}
       </ul>`
    : '<p class="text-sm dim">本周的课都在课表里了。</p>';

  openModal({
    title: '其他课程',
    body,
    onMount: (mask, { close }) => {
      mask.querySelectorAll('[data-other-id]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const course = store.state.data.courses.find((c) => c.id === btn.dataset.otherId);
          close();
          if (course) openCourseDetail(course, store, rerender);
        });
      });
    }
  });
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

  const bands = buildBands(slots);
  const year = new Date(`${dates[0]}T00:00:00`).getFullYear();

  // 表头、时间标签、空格子全部显式定位，避免被课程块影响自动排版
  const dayHeaders = dates.map((d, index) => `
    <div class="tt-day ${d === today ? 'today' : ''}" style="grid-column:${index + 2};grid-row:1">
      <span class="tt-day-name">${weekdayName(weekdayIndex(d)).replace('周', '')}</span>
      <span class="tt-day-date">${shortDate(d)}</span>
    </div>`).join('');

  const bandCells = bands.map((band, bandIndex) => `
    <div class="tt-slot" style="grid-column:1;grid-row:${bandIndex + 2}">
      <span class="tt-slot-name">${esc(band.label)}</span>
      <span class="tt-slot-time">${esc(formatClock(band.start))}</span>
      <i class="tt-slot-line" aria-hidden="true"></i>
      <span class="tt-slot-time">${esc(formatClock(band.end))}</span>
    </div>
    ${dates.map((d, dayIndex) => `<div class="tt-cell ${d === today ? 'today-col' : ''}" style="grid-column:${dayIndex + 2};grid-row:${bandIndex + 2}"></div>`).join('')}
  `).join('');

  const blocks = [];
  for (const d of dates) {
    const col = ((weekdayIndex(d) - weekStart + 7) % 7) + 2;
    for (const course of byDate.get(d)) {
      const startBand = Math.floor((Number(course.startSlot) - 1) / 2) + 1;
      const endBand = Math.floor((Number(course.endSlot) - 1) / 2) + 1;
      const span = Math.max(1, endBand - startBand + 1);
      blocks.push(`
        <button class="course-block" type="button" data-action="open-course" data-id="${esc(course.id)}"
          style="grid-column:${col};grid-row:${startBand + 1}/span ${span};--course:${esc(course.color || COLORS[0])}">
          <span class="cb-name">${esc(course.name)}</span>
          ${course.adjusted ? '<span class="cb-flag">调</span>' : ''}
          ${course.teacher ? `<span class="cb-teacher">${esc(course.teacher)}</span>` : ''}
          ${course.location ? `<span class="cb-loc">${esc(course.location)}</span>` : ''}
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
        <div class="row wrap" style="gap:8px">
          <button class="btn sm" type="button" data-action="import-jwgl">导入教务课表</button>
          <button class="btn sm" type="button" data-action="adjustments">调课记录</button>
          <button class="btn primary sm" type="button" data-action="add-course">＋ 添加课程</button>
        </div>
      </div>

      ${hasAny ? `
        <div class="card pad week-card">
          <div class="tt-top">
            <button class="tt-other" type="button" data-action="other-courses">其他课程</button>
            <div class="tt-title">${year} 年 · 第 ${week} 周课表</div>            <a class="tt-gear" href="#/settings" aria-label="课表设置" title="课表设置">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1.11 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z"></path>
              </svg>
            </a>
          </div>
          <div class="tt-times">
            ${bands.map((band) => `<span>${esc(band.label)} ${esc(formatClock(band.start))}–${esc(formatClock(band.end))}</span>`).join('')}
          </div>
          <div class="tt-scroll">
            <div class="tt-grid" style="grid-template-rows: 54px repeat(${bands.length}, minmax(104px, 1fr))">
              <div class="tt-corner" style="grid-column:1;grid-row:1">节次</div>
              ${dayHeaders}
              ${bandCells}
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

function openAdjustments(store, rerender) {
  const list = store.state.data.scheduleChanges || [];
  const dayOptions = (selected) => [1, 2, 3, 4, 5, 6, 7].map((d) => `<option value="${d}" ${Number(selected) === d ? 'selected' : ''}>${weekdayName(d)}</option>`).join('');
  const slotOptions = (selected) => Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${Number(selected) === i + 1 ? 'selected' : ''}>第 ${i + 1} 节</option>`).join('');

  const body = `
    <div class="stack">
      ${list.length ? `
        <ul class="list">
          ${list.map((item) => `
            <li class="list-item">
              <span class="grow">
                ${weekdayName(item.fromDay)} ${item.fromStart}-${item.fromEnd} 节 → ${weekdayName(item.toDay)} ${item.toStart}-${item.toEnd} 节
              </span>
              <span class="text-xs dim">${esc(item.note || '')}</span>
            </li>`).join('')}
        </ul>` : '<p class="text-sm dim">还没有调课记录。</p>'}
      <form class="stack" data-form="adjust">
        <div class="form-grid">
          <div class="field"><label>原星期</label><select class="select" name="fromDay">${dayOptions(1)}</select></div>
          <div class="field"><label>原节次</label>
            <div class="row" style="gap:6px">
              <select class="select" name="fromStart">${slotOptions(1)}</select>
              <span class="dim">至</span>
              <select class="select" name="fromEnd">${slotOptions(2)}</select>
            </div>
          </div>
          <div class="field"><label>新星期</label><select class="select" name="toDay">${dayOptions(1)}</select></div>
          <div class="field"><label>新节次</label>
            <div class="row" style="gap:6px">
              <select class="select" name="toStart">${slotOptions(1)}</select>
              <span class="dim">至</span>
              <select class="select" name="toEnd">${slotOptions(2)}</select>
            </div>
          </div>
          <div class="field full"><label>备注</label><input class="input" name="note" placeholder="例如：老师出差，调到周五"></div>
        </div>
      </form>
    </div>
  `;

  const { close } = openModal({
    title: '调课记录',
    wide: true,
    body,
    footer: `<button class="btn" type="button" data-cancel>关闭</button>
             <button class="btn primary" type="button" data-save>记一条</button>`,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const form = mask.querySelector('[data-form="adjust"]');
        const item = {
          id: uid('adj'),
          fromDay: Number(form.elements.fromDay.value),
          fromStart: Number(form.elements.fromStart.value),
          fromEnd: Number(form.elements.fromEnd.value),
          toDay: Number(form.elements.toDay.value),
          toStart: Number(form.elements.toStart.value),
          toEnd: Number(form.elements.toEnd.value),
          note: form.elements.note.value.trim(),
          createdAt: new Date().toISOString()
        };
        if (item.fromEnd < item.fromStart || item.toEnd < item.toStart) {
          toast('节次范围不对，重新选一下', { tone: 'error' });
          return;
        }
        store.update((d) => {
          d.data.scheduleChanges = [...(d.data.scheduleChanges || []), item];
        });
        close();
        rerender();
        toast('调课记录已保存');
      });
    }
  });
}

function importJwgl(store, rerender) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.html,.htm';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    let parsed;
    try {
      parsed = parseJwglTimetable(await file.text());
    } catch {
      toast('这个网页读不出来', { tone: 'error' });
      return;
    }
    if (!parsed.courses.length) {
      toast(parsed.errors[0] || '没解析到课程', { tone: 'error', duration: 4000 });
      return;
    }
    openImportPreview(store, rerender, parsed);
  });
  input.click();
}

function openImportPreview(store, rerender, parsed) {
  const plan = buildImportPlan(store.state.data.courses, parsed.courses);
  const { close } = openModal({
    title: '导入教务课表',
    wide: true,
    body: `
      <div class="stack">
        <div class="row" style="gap:20px;flex-wrap:wrap">
          <div class="stat"><span class="value num">${parsed.courses.length}</span><span class="label">解析课程</span></div>
          <div class="stat"><span class="value num">${plan.accepted.length}</span><span class="label">将导入</span></div>
          <div class="stat"><span class="value num" style="color:${plan.conflicts.length ? 'var(--warn)' : 'inherit'}">${plan.conflicts.length}</span><span class="label">冲突跳过</span></div>
          <div class="stat"><span class="value num">${plan.kept}</span><span class="label">保留手工课</span></div>
        </div>
        ${plan.conflicts.length ? `<div class="callout danger">与手工课冲突，将跳过：${plan.conflicts.map((item) => esc(item.course.name)).join('、')}</div>` : ''}
        <div class="form-grid">
          <div class="field">
            <label>学期起始日</label>
            <input class="input" type="date" name="semesterStart" value="${esc(store.state.data.settings.semesterStart || '2026-08-31')}">
          </div>
          <div class="field">
            <label>一周从哪天开始</label>
            <select class="select" name="weekStart">
              <option value="1" ${(store.state.data.settings.weekStart || 1) !== 7 ? 'selected' : ''}>周一</option>
              <option value="7" ${(store.state.data.settings.weekStart || 1) === 7 ? 'selected' : ''}>周日</option>
            </select>
          </div>
        </div>
        ${parsed.courses.some((course) => course.weeksUnknown) ? `
          <div class="callout danger">有 ${parsed.courses.filter((course) => course.weeksUnknown).length} 门课没读到周次，会按整学期显示，请导入后核对。</div>` : ''}
        <p class="hint">会替换上一次从教务导入的课程，手工添加的课程保留；冲突课程按你选的规则跳过。</p>
        <label class="row" style="gap:8px;align-items:center">
          <input type="checkbox" name="applySlots" checked>
          <span class="text-sm">同时应用学校作息时间（1-2 节 8:00–9:35、3-4 节 10:05–11:40 …）</span>
        </label>
      </div>
    `,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-confirm>开始导入</button>`,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-confirm]').addEventListener('click', () => {
        const semesterStart = mask.querySelector('[name="semesterStart"]').value || '2026-08-31';
        const weekStart = Number(mask.querySelector('[name="weekStart"]').value) || 1;
        const applySlots = mask.querySelector('[name="applySlots"]').checked;
        store.update((d) => {
          d.data.settings.semesterStart = semesterStart;
          d.data.settings.weekStart = weekStart;
          if (applySlots) d.data.settings.slots = CAUC_SLOTS;
          const kept = (d.data.courses || []).filter((course) => course.source !== 'jwgl');
          d.data.courses = [
            ...kept,
            ...plan.accepted.map((course) => ({ id: uid('c'), ...course }))
          ];
        });
        close();
        rerender();
        toast(`已导入 ${plan.accepted.length} 门课`);
      });
    }
  });
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
    else if (action === 'import-jwgl') { importJwgl(store, rerender); }
    else if (action === 'adjustments') { openAdjustments(store, rerender); }
    else if (action === 'other-courses') { openOtherCourses(store, rerender); }
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
