import { esc, uid } from '../core/html.js';
import {
  todayStr, weekdayIndex, weekdayName, fmtDateCN, fmtClock, fmtDurationShort,
  monthKeyOf, daysUntil
} from '../core/date.js';
import {
  coursesOn, nextCourse, todosForToday, assignmentsDueToday, summaryCards,
  semesterProgress, weekInfo, courseTimes, todayProgress,
  sortCardsByOrder, DEFAULT_CARD_ORDER
} from '../core/calc.js';

let tickTimer = null;
let layoutEditing = false;

const PRIORITY_LABEL = { high: '高', mid: '中', low: '低' };

function courseRow(state, course, next, now) {
  const times = courseTimes(state, course);
  const isNext = next && next.course && next.course.id === course.id;
  const endMin = times.end ? Number(times.end.slice(0, 2)) * 60 + Number(times.end.slice(3, 5)) : 0;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  let status = 'future';
  if (isNext) status = next.ongoing ? 'ongoing' : 'next';
  else if (endMin && endMin <= nowMin) status = 'past';

  let badge = '';
  if (status === 'ongoing') badge = '<span class="badge brand">进行中</span>';
  else if (status === 'next') badge = `<span class="badge muted">${next.minutesLeft} 分钟后</span>`;

  return `
    <div class="timeline-row ${status}">
      <div class="timeline-time num">${esc(times.start)}<br><span class="dim">${esc(times.end)}</span></div>
      <div class="timeline-dot" style="background:${esc(course.color || 'var(--brand)')}"></div>
      <div class="grow">
        <div class="strong">${esc(course.name)}</div>
        <div class="text-xs dim">${esc([course.location, course.teacher].filter(Boolean).join(' · '))}</div>
      </div>
      ${badge}
    </div>
  `;
}

function todoRow(todo) {
  return `
    <li class="todo-row ${todo.done ? 'done' : ''}">
      <label class="check">
        <input type="checkbox" data-action="toggle-todo" data-id="${esc(todo.id)}" ${todo.done ? 'checked' : ''}>
      </label>
      <span class="grow ${todo.done ? 'strike' : ''}">${esc(todo.title)}</span>
      ${todo.priority === 'high' ? '<span class="badge danger">高</span>' : ''}
    </li>
  `;
}

function memoStateText(notes) {
  if (!notes || !notes.updatedAt) return '还没写过';
  const d = new Date(notes.updatedAt);
  return `已保存 · ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function render(state, ctx = {}) {
  const today = todayStr();
  const now = new Date();
  const info = weekInfo(state, today);
  const courses = coursesOn(state, today);
  const next = nextCourse(state, today, now);
  const todos = todosForToday(state, today);
  const hw = assignmentsDueToday(state, today);
  const cards = summaryCards(state, today, now);
  const settings = state.data.settings || {};
  const hiddenCards = settings.hiddenCards || [];
  const visibleCards = sortCardsByOrder(cards, settings.homeCardOrder || DEFAULT_CARD_ORDER, hiddenCards);
  const sem = semesterProgress(state, today);
  const notes = state.data.notes || { text: '', updatedAt: null };
  const doneCount = todos.filter((t) => t.done).length;
  const visibleTodos = todos.slice(0, 5);

  const lastExportAt = state.data.meta && state.data.meta.lastExportAt;
  const daysSinceExport = lastExportAt
    ? Math.max(0, Math.floor((Date.now() - Date.parse(lastExportAt)) / 86400000))
    : null;
  const needBackup = !lastExportAt || daysSinceExport >= 7;

  return `
    <div class="stack">
      ${needBackup ? `
        <section class="card pad backup-banner">
          <div class="row-between wrap">
            <div>
              <div class="strong">该备份了</div>
              <div class="text-xs dim">${lastExportAt ? `上次导出在 ${daysSinceExport} 天前` : '还没有导出过备份'}</div>
            </div>
            <a class="btn sm" href="#/settings">去备份</a>
          </div>
        </section>` : ''}
      <section class="card pad home-hero">
        <div class="row-between wrap">
          <div>
            <div class="text-xs dim">${weekdayName(weekdayIndex(today))} · ${fmtDateCN(today)}</div>
            <h2 class="hero-week">第 ${info.week} 周</h2>
          </div>
          ${sem
            ? `<div class="text-right"><div class="text-xs dim">学期进度</div><div class="strong num">${sem.percent}%</div></div>`
            : `<a class="btn ghost sm" href="#/settings">设置学期起始日</a>`}
        </div>
        ${sem ? `<div class="progress ok" style="margin-top:10px"><i style="width:${sem.percent}%"></i></div>` : ''}
      </section>

      <div class="home-grid">
        <section class="card pad">
          <div class="card-title">
            <h3>今日课程</h3>
            <a class="text-xs" href="#/classes">完整课表 →</a>
          </div>
          ${courses.length
            ? `<div class="timeline">${courses.map((c) => courseRow(state, c, next, now)).join('')}</div>`
            : `<div class="empty" style="padding:24px 8px"><div class="empty-icon">🫧</div><p class="text-sm dim">今天没课，好好休息</p></div>`}
          ${hw.length ? `
            <div class="divider"></div>
            <a class="text-xs" href="#/homework">📝 今天有 ${hw.length} 项作业到期：${esc(hw.map((h) => h.title).join('、'))}</a>
          ` : ''}
        </section>

        <section class="card pad">
          <div class="card-title">
            <h3>今日待办</h3>
            <span class="text-xs dim num">${doneCount}/${todos.length}</span>
          </div>
          <form data-form="add-todo" class="row" style="margin-bottom:6px">
            <input class="input" name="title" placeholder="加一条今天要做的事，回车添加" autocomplete="off" data-focus-key="add-todo">
            <button class="btn primary sm" type="submit">加</button>
          </form>
          ${visibleTodos.length
            ? `<ul class="todo-list">${visibleTodos.map(todoRow).join('')}</ul>`
            : `<div class="empty" style="padding:20px 8px"><p class="text-sm dim">今天还没有待办，喘口气</p></div>`}
          ${todos.length > 5 ? `<a class="text-xs" href="#/todos">查看全部 ${todos.length} 条 →</a>` : ''}
        </section>
      </div>

      <section class="card pad">
        <div class="card-title">
          <h3>快速备忘录</h3>
          <span class="text-xs dim" id="memo-state">${esc(memoStateText(notes))}</span>
        </div>
        <textarea class="textarea memo" data-action="memo" data-focus-key="memo"
          placeholder="随手写点什么……">${esc(notes.text || '')}</textarea>
      </section>

      <section>
        <div class="section-title">
          <h2>模块摘要</h2>
          <span class="text-xs dim">${layoutEditing ? '拖动卡片排序，点 × 隐藏' : '点一张卡进对应页面'}</span>
          <button class="btn ghost sm" type="button" data-action="toggle-layout">${layoutEditing ? '完成' : '调整布局'}</button>
          ${layoutEditing ? '<button class="btn ghost sm" type="button" data-action="reset-layout">恢复默认</button>' : ''}
        </div>
        <div class="cards-grid">
          ${visibleCards.map((card) => `            <a class="summary-card tone-${esc(card.tone || 'ok')} ${layoutEditing ? 'editing' : ''}"
               href="#/${esc(card.route)}" data-card-key="${esc(card.key)}" draggable="${layoutEditing ? 'true' : 'false'}">
              ${layoutEditing ? `<button class="card-hide" type="button" data-action="hide-card" data-key="${esc(card.key)}" aria-label="隐藏这张卡">×</button>` : ''}
              <div class="summary-head"><span class="icon">${esc(card.icon)}</span><span class="text-xs dim">${esc(card.title)}</span></div>
              <div class="summary-value num">${esc(card.value)}</div>
              <div class="summary-sub text-xs">${esc(card.sub)}</div>
              ${typeof card.percent === 'number' && card.percent > 0
                ? `<div class="progress ${card.tone === 'danger' ? 'danger' : ''}"><i style="width:${Math.min(100, card.percent)}%"></i></div>`
                : ''}
            </a>`).join('')}
        </div>
        ${visibleCards.length ? '' : '<div class="empty" style="padding:20px 8px"><p class="text-sm dim">所有摘要卡都被隐藏了，点「恢复默认」可以找回来。</p></div>'}
        ${layoutEditing && hiddenCards.length ? `
          <div class="row wrap" style="margin-top:10px">
            <span class="text-xs dim">已隐藏：</span>
            ${hiddenCards.map((key) => {
              const card = cards.find((c) => c.key === key);
              return `<button class="btn sm" type="button" data-action="show-card" data-key="${esc(key)}">显示 ${esc(card ? card.title : key)}</button>`;
            }).join('')}
          </div>` : ''}
      </section>
    </div>
  `;
}

export function bind(root, { store, rerender }) {
  clearInterval(tickTimer);
  tickTimer = setInterval(() => rerender(), 60000);

  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    if (action === 'toggle-layout') {
      event.preventDefault();
      layoutEditing = !layoutEditing;
      rerender();
    } else if (action === 'reset-layout') {
      event.preventDefault();
      store.update((d) => {
        delete d.data.settings.homeCardOrder;
        delete d.data.settings.hiddenCards;
      });
    } else if (action === 'hide-card') {
      event.preventDefault();
      event.stopPropagation();
      const key = el.dataset.key;
      store.update((d) => {
        const hidden = new Set(d.data.settings.hiddenCards || []);
        hidden.add(key);
        d.data.settings.hiddenCards = [...hidden];
      });
    } else if (action === 'show-card') {
      event.preventDefault();
      const key = el.dataset.key;
      store.update((d) => {
        d.data.settings.hiddenCards = (d.data.settings.hiddenCards || []).filter((k) => k !== key);
      });
    }
  });

  // 拖拽调整卡片顺序
  if (layoutEditing) {
    const cardEls = [...root.querySelectorAll('[data-card-key]')];
    let dragKey = null;
    cardEls.forEach((el) => {
      el.addEventListener('dragstart', (event) => {
        dragKey = el.dataset.cardKey;
        el.classList.add('dragging');
        if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
      });
      el.addEventListener('dragend', () => {
        el.classList.remove('dragging');
        dragKey = null;
      });
      el.addEventListener('dragover', (event) => event.preventDefault());
      el.addEventListener('drop', (event) => {
        event.preventDefault();
        const targetKey = el.dataset.cardKey;
        if (!dragKey || dragKey === targetKey) return;
        const hidden = store.state.data.settings.hiddenCards || [];
        const keys = [...cardEls.map((c) => c.dataset.cardKey), ...hidden];
        const from = keys.indexOf(dragKey);
        const to = keys.indexOf(targetKey);
        if (from < 0 || to < 0) return;
        keys.splice(from, 1);
        keys.splice(to, 0, dragKey);
        store.update((d) => { d.data.settings.homeCardOrder = keys; });
        dragKey = null;
      });
    });
  }

  const form = root.querySelector('[data-form="add-todo"]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = form.querySelector('input[name="title"]');
      const title = input.value.trim();
      if (!title) return;
      store.update((d) => {
        d.data.todos.push({
          id: uid('t'),
          title,
          note: '',
          dueDate: todayStr(),
          planDate: null,
          priority: 'mid',
          done: false,
          doneAt: null,
          order: Date.now(),
          updatedAt: new Date().toISOString()
        });
      });
    });
  }

  root.querySelectorAll('[data-action="toggle-todo"]').forEach((box) => {
    box.addEventListener('change', () => {
      const id = box.dataset.id;
      store.update((d) => {
        const todo = d.data.todos.find((t) => t.id === id);
        if (!todo) return;
        todo.done = box.checked;
        todo.doneAt = box.checked ? new Date().toISOString() : null;
        todo.updatedAt = new Date().toISOString();
      });
    });
  });

  const memo = root.querySelector('[data-action="memo"]');
  if (memo) {
    let timer = null;
    const saveMemo = async () => {
      const stateEl = root.querySelector('#memo-state');
      store.update((d) => {
        d.data.notes = { text: memo.value, updatedAt: new Date().toISOString() };
      }, { notify: false });
      await store.flush().catch(() => {});
      if (stateEl) {
        const t = new Date();
        stateEl.textContent = `已保存 · ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
      }
    };
    memo.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(saveMemo, 900);
    });
    memo.addEventListener('blur', () => {
      clearTimeout(timer);
      saveMemo();
    });
  }
}
