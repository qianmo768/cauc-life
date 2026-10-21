import { esc, uid } from '../core/html.js';
import { todayStr, weekdayName, weekdayIndex, monthKeyOf, fmtDuration } from '../core/date.js';
import {
  funWeek, funPlanForDate, timerElapsed, fmtSeconds, funMonthTotal,
  funTodayTotal, sortFunRecords
} from '../core/calc.js';
import { openModal } from '../ui/modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { makeTrashEntry } from '../core/trash.js';

const TYPES = { game: '游戏', video: '影视', other: '其他' };

let ticker = null;

function typeLabel(type) {
  return TYPES[type] || '其他';
}

function renderTimer(state) {
  const timer = state.data.fun.timer;
  const running = Boolean(timer && timer.running);
  const seconds = timerElapsed(timer);
  const hasProgress = Boolean(timer) && (seconds > 0 || running);

  return `
    <div class="timer-box">
      <div class="timer-display num" id="timer-display">${fmtSeconds(seconds)}</div>
      <div class="timer-inputs">
        <input class="input" id="timer-name" placeholder="在玩什么" value="${esc(timer ? timer.name || '' : '')}" ${running ? 'disabled' : ''}>
        <select class="select" id="timer-type" ${running ? 'disabled' : ''}>
          ${Object.entries(TYPES).map(([value, label]) => `
            <option value="${value}" ${timer && timer.type === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="row wrap timer-actions">
        ${running
          ? `<button class="btn" type="button" data-action="pause">暂停</button>
             <button class="btn primary" type="button" data-action="stop">结束并记录</button>`
          : hasProgress
            ? `<button class="btn primary" type="button" data-action="resume">继续</button>
               <button class="btn" type="button" data-action="stop">结束并记录</button>`
            : `<button class="btn primary" type="button" data-action="start">开始计时</button>`}
        <button class="btn ghost sm" type="button" data-action="manual">手动补记</button>
      </div>
    </div>
  `;
}

export function render(state, ctx = {}) {
  const today = todayStr();
  const week = funWeek(state, today);
  const monthKey = monthKeyOf(today);
  const monthTotal = funMonthTotal(state, monthKey);
  const todayTotal = funTodayTotal(state, today);
  const todayPlan = funPlanForDate(state, today);
  const plan = state.data.fun.plan || [];
  const records = sortFunRecords(state.data.fun.records).slice(0, 20);
  const wishlist = state.data.fun.wishlist || [];

  return `
    <div class="stack">
      <div class="card pad">
        <div class="row" style="gap:22px">
          <div class="stat"><span class="value num">${fmtDuration(week.played)}</span><span class="label">本周已玩</span></div>
          <div class="stat"><span class="value num">${week.planned ? fmtDuration(week.planned) : '未排'}</span><span class="label">本周计划</span></div>
          <div class="stat"><span class="value num">${fmtDuration(monthTotal)}</span><span class="label">本月累计</span></div>
          <div class="stat"><span class="value num">${fmtDuration(todayTotal)}</span><span class="label">今日</span></div>
          <button class="btn sm" type="button" data-action="open-plan" style="margin-left:auto">编辑娱乐计划</button>
        </div>
        ${todayPlan && todayPlan.minutes ? `<div class="text-xs dim" style="margin-top:8px">今天计划玩 ${fmtDuration(todayPlan.minutes)}</div>` : ''}
        ${week.planned && week.played > week.planned ? '<div class="callout danger" style="margin-top:10px">这周已经超过计划啦，要不要停一停？</div>' : ''}
      </div>

      <section class="card pad">
        <div class="card-title"><h3>计时器</h3><span class="text-xs dim">刷新页面会自动结束并记录</span></div>
        ${renderTimer(state)}
      </section>

      <div class="fun-grid">
        <section class="card pad">
          <div class="card-title"><h3>本周娱乐计划</h3><button class="btn ghost sm" type="button" data-action="open-plan">编辑</button></div>
          <div class="plan-list">
            ${[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const item = plan.find((p) => Number(p.day) === day);
              const minutes = item ? Number(item.minutes) || 0 : 0;
              return `
                <div class="plan-row ${day === weekdayIndex(today) ? 'today' : ''}">
                  <span class="plan-day">${weekdayName(day)}</span>
                  <span class="grow">${minutes ? fmtDuration(minutes) : '不玩'}</span>
                </div>`;
            }).join('')}
          </div>
        </section>

        <section class="card pad">
          <div class="card-title"><h3>想玩清单</h3><span class="text-xs dim">${wishlist.filter((w) => !w.done).length} 个没玩</span></div>
          <form class="wish-form" data-form="wishlist">
            <input class="input" name="name" placeholder="想玩什么？回车添加" autocomplete="off" required>
            <select class="select" name="type">
              ${Object.entries(TYPES).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
            <button class="btn primary sm" type="submit">加</button>
          </form>
          <ul class="wish-list">
            ${wishlist.length ? wishlist.map((item) => `
              <li class="wish-item ${item.done ? 'done' : ''}">
                <input type="checkbox" data-action="wish-done" data-id="${esc(item.id)}" ${item.done ? 'checked' : ''} aria-label="已玩">
                <span class="grow ${item.done ? 'strike' : ''}">${esc(item.name)}</span>
                <span class="tag">${typeLabel(item.type)}</span>
                <button class="btn ghost icon sm" type="button" data-action="wish-del" data-id="${esc(item.id)}" aria-label="删除">🗑</button>
              </li>`).join('')
              : '<li class="text-sm dim">还没有想玩的东西</li>'}
          </ul>
        </section>
      </div>

      <section class="card pad">
        <div class="card-title"><h3>最近记录</h3><button class="btn ghost sm" type="button" data-action="manual">补记一笔</button></div>
        ${records.length ? `
          <ul class="fun-records">
            ${records.map((item) => `
              <li class="fun-record">
                <span class="text-xs dim num">${esc(item.date)}</span>
                <span class="tag">${typeLabel(item.type)}</span>
                <span class="grow">${esc(item.name || '未命名')}</span>
                <span class="num strong">${fmtDuration(item.minutes)}</span>
                <button class="btn ghost icon sm" type="button" data-action="record-del" data-id="${esc(item.id)}" aria-label="删除">🗑</button>
              </li>`).join('')}
          </ul>` : '<div class="empty" style="padding:16px 8px"><p class="text-sm dim">还没有记录，开始计时试试</p></div>'}
      </section>
    </div>
  `;
}

function openPlanEditor(store, rerender) {
  const state = store.state;
  const plan = state.data.fun.plan || [];
  const { close } = openModal({
    title: '本周娱乐计划',
    body: `
      <form class="stack" data-form="fun-plan" onsubmit="return false">
        ${[1, 2, 3, 4, 5, 6, 7].map((day) => {
          const item = plan.find((p) => Number(p.day) === day);
          return `
            <div class="field" style="flex-direction:row;align-items:center;gap:12px">
              <span style="width:48px">${weekdayName(day)}</span>
              <input class="input" type="number" name="day_${day}" min="0" step="10" value="${item ? Number(item.minutes) || 0 : 0}" style="max-width:160px">
              <span class="text-xs dim">分钟</span>
            </div>`;
        }).join('')}
        <p class="hint">填 0 表示当天不玩。</p>
      </form>
    `,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>保存</button>`,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const form = mask.querySelector('[data-form="fun-plan"]');
        const plan = [1, 2, 3, 4, 5, 6, 7].map((day) => ({
          day,
          minutes: Math.max(0, Number(form.elements[`day_${day}`].value) || 0)
        }));
        store.update((d) => { d.data.fun.plan = plan; });
        close();
        rerender();
        toast('娱乐计划已保存');
      });
    }
  });
}

function openManualRecord(store, rerender) {
  const { close } = openModal({
    title: '手动补记',
    body: `
      <form class="stack" data-form="manual" onsubmit="return false">
        <div class="field">
          <label>玩了什么 *</label>
          <input class="input" name="name" placeholder="游戏或影视的名字">
        </div>
        <div class="form-grid">
          <div class="field">
            <label>类型</label>
            <select class="select" name="type">
              ${Object.entries(TYPES).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>时长（分钟）</label>
            <input class="input" type="number" name="minutes" min="1" step="1" value="30">
          </div>
          <div class="field full">
            <label>日期</label>
            <input class="input" type="date" name="date" value="${todayStr()}">
          </div>
        </div>
        <p class="err hidden" data-error></p>
      </form>
    `,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>保存</button>`,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const form = mask.querySelector('[data-form="manual"]');
        const name = form.elements.name.value.trim();
        const minutes = Number(form.elements.minutes.value);
        const err = mask.querySelector('[data-error]');
        if (!name) { err.textContent = '名称不能为空'; err.classList.remove('hidden'); return; }
        if (!minutes || minutes <= 0) { err.textContent = '时长要大于 0'; err.classList.remove('hidden'); return; }
        store.update((d) => {
          d.data.fun.records.push({
            id: uid('f'),
            date: form.elements.date.value || todayStr(),
            name,
            type: form.elements.type.value,
            minutes: Math.round(minutes)
          });
        });
        close();
        rerender();
        toast('已补记');
      });
    }
  });
}

export function bind(root, { store, rerender }) {
  clearInterval(ticker);
  ticker = setInterval(() => {
    const el = root.querySelector('#timer-display');
    if (!el) return;
    const state = store.state;
    el.textContent = fmtSeconds(timerElapsed(state.data.fun.timer));
  }, 1000);

  root.addEventListener('click', async (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'open-plan') { openPlanEditor(store, rerender); return; }
    if (action === 'manual') { openManualRecord(store, rerender); return; }

    if (action === 'start') {
      const name = (root.querySelector('#timer-name')?.value || '').trim() || '娱乐';
      const type = root.querySelector('#timer-type')?.value || 'game';
      store.update((d) => {
        d.data.fun.timer = { running: true, startedAt: new Date().toISOString(), accumulated: 0, name, type };
      });
      toast('开始计时，玩得开心');
      return;
    }

    if (action === 'pause') {
      store.update((d) => {
        const timer = d.data.fun.timer;
        if (!timer) return;
        timer.accumulated = timerElapsed(timer);
        timer.running = false;
        timer.startedAt = null;
      });
      toast('已暂停');
      return;
    }

    if (action === 'resume') {
      store.update((d) => {
        const timer = d.data.fun.timer;
        if (!timer) return;
        timer.running = true;
        timer.startedAt = new Date().toISOString();
      });
      return;
    }

    if (action === 'stop') {
      const state = store.state;
      const timer = state.data.fun.timer;
      if (!timer) return;
      const seconds = timerElapsed(timer);
      const minutes = Math.max(1, Math.round(seconds / 60));
      store.update((d) => {
        d.data.fun.records.push({
          id: uid('f'),
          date: todayStr(),
          name: timer.name || '娱乐',
          type: timer.type || 'game',
          minutes
        });
        d.data.fun.timer = null;
      });
      toast(`记下了 ${fmtDuration(minutes)}`);
      return;
    }

    if (action === 'wish-del') {
      store.update((d) => {
        d.data.fun.wishlist = d.data.fun.wishlist.filter((w) => w.id !== el.dataset.id);
      });
      return;
    }

    if (action === 'record-del') {
      const id = el.dataset.id;
      const record = (store.state.data.fun.records || []).find((r) => r.id === id);
      if (!record) return;
      const ok = await confirmDialog({
        title: '删除记录',
        message: `删除「${record.name}」（${fmtDuration(record.minutes)}）这条记录？`,
        confirmText: '删除',
        danger: true
      });
      if (!ok) return;
      const entry = makeTrashEntry('fun', record, record.name);
      store.update((d) => {
        d.data.fun.records = d.data.fun.records.filter((r) => r.id !== id);
        d.data.trash = [...(d.data.trash || []), entry];
      });
      toast('已移入回收站');
    }
  });

  root.querySelectorAll('[data-action="wish-done"]').forEach((box) => {
    box.addEventListener('change', () => {
      const id = box.dataset.id;
      store.update((d) => {
        const item = d.data.fun.wishlist.find((w) => w.id === id);
        if (item) item.done = box.checked;
      });
    });
  });

  const wishForm = root.querySelector('[data-form="wishlist"]');
  if (wishForm) {
    wishForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const name = wishForm.elements.name.value.trim();
      if (!name) return;
      store.update((d) => {
        d.data.fun.wishlist.push({ id: uid('w'), name, type: wishForm.elements.type.value, note: '', done: false });
      });
    });
  }
}
