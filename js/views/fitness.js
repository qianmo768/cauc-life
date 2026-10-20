import { esc } from '../core/html.js';
import { todayStr, weekdayName, weekdayIndex, monthKeyOf, fmtMonthCN, addMonths, pad2 } from '../core/date.js';
import {
  fitnessWeek, fitnessStreak, planForDate, logForDate, buildLogFromPlan,
  toggleSet, isLogComplete, monthMatrix, fitnessMonthCount, weightSeries,
  parsePlanItems, formatPlanItems
} from '../core/calc.js';
import { openModal } from '../ui/modal.js';
import { toast } from '../ui/toast.js';

let calMonth = monthKeyOf(todayStr());

function normalizePlan(plan) {
  const list = Array.isArray(plan) ? plan : [];
  return [1, 2, 3, 4, 5, 6, 7].map((day) => {
    const found = list.find((p) => Number(p.day) === day);
    return {
      day,
      title: found ? found.title || '休息' : '休息',
      rest: found ? Boolean(found.rest) : true,
      items: found && Array.isArray(found.items) ? found.items : []
    };
  });
}

function setDots(item, itemIndex) {
  const total = Math.max(1, Number(item.sets) || 1);
  const done = Number(item.doneSets) || 0;
  const dots = Array.from({ length: total }, (_, i) => `
    <button class="set-dot ${i < done ? 'on' : ''}" type="button"
      data-action="set" data-item="${itemIndex}" data-set="${i}" aria-label="第 ${i + 1} 组"></button>`).join('');
  return `<div class="set-dots">${dots}<span class="text-xs dim">${done}/${total}</span></div>`;
}

function renderToday(state, today) {
  const plan = planForDate(state, today);
  const log = logForDate(state, today);
  const isRest = !plan || plan.rest || !plan.items || plan.items.length === 0;

  if (isRest) {
    return `
      <div class="empty" style="padding:20px 8px">
        <div class="empty-icon">🛌</div>
        <p class="text-sm dim">今天安排的是休息，好好恢复</p>
        <button class="btn sm" type="button" data-action="open-plan">去改周计划</button>
      </div>`;
  }

  // 旧记录可能还没跟上新计划，动作以计划为准补齐
  const effective = log && Array.isArray(log.items) && log.items.length ? log : buildLogFromPlan(plan, today);
  const complete = isLogComplete(effective);

  return `
    <div class="row-between wrap" style="margin-bottom:10px">
      <div class="strong">${esc(effective.title)}</div>
      ${complete
        ? '<span class="badge ok">今日已打卡</span>'
        : `<button class="btn primary sm" type="button" data-action="finish">全部完成</button>`}
    </div>
    <div class="fit-items">
      ${effective.items.map((item, i) => `
        <div class="fit-item">
          <div class="row-between">
            <span class="strong">${esc(item.name)}</span>
            <span class="text-xs dim">${item.sets} 组 × ${item.reps} 次</span>
          </div>
          ${setDots(item, i)}
        </div>`).join('')}
    </div>
    ${log ? `<button class="btn sm ghost" type="button" data-action="undo-log" style="margin-top:8px">撤销今日打卡</button>` : ''}
  `;
}

function renderCalendar(state, today) {
  const matrix = monthMatrix(calMonth, 1);
  const doneDays = new Set((state.data.fitness.logs || []).filter((l) => l.done).map((l) => l.date));
  const head = ['一', '二', '三', '四', '五', '六', '日'].map((d) => `<div class="cal-head">${d}</div>`).join('');
  const cells = matrix.weeks.flat().map((date) => {
    if (!date) return '<div class="cal-cell empty"></div>';
    const day = Number(date.slice(8));
    const cls = [
      'cal-cell',
      doneDays.has(date) ? 'done' : '',
      date === today ? 'today' : '',
      String(date).slice(0, 7) !== calMonth ? 'dim' : ''
    ].filter(Boolean).join(' ');
    return `<div class="${cls}">${day}</div>`;
  }).join('');

  return `
    <div class="row-between" style="margin-bottom:10px">
      <button class="btn icon sm" type="button" data-action="prev-month" aria-label="上个月">‹</button>
      <span class="strong">${fmtMonthCN(calMonth)}</span>
      <button class="btn icon sm" type="button" data-action="next-month" aria-label="下个月">›</button>
    </div>
    <div class="cal-grid">${head}${cells}</div>
    <div class="text-xs dim" style="margin-top:8px">本月已打卡 ${fitnessMonthCount(state, calMonth)} 天</div>
  `;
}

function weightChart(list) {
  if (list.length < 2) return '';
  const width = 300;
  const height = 90;
  const pad = 8;
  const values = list.map((w) => Number(w.kg));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = list.map((w, i) => {
    const x = pad + (i / (list.length - 1)) * (width - pad * 2);
    const y = height - pad - ((Number(w.kg) - min) / range) * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `
    <svg class="weight-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="体重变化">
      <polyline points="${points}" fill="none" stroke="var(--brand)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"></polyline>
    </svg>`;
}

export function render(state, ctx = {}) {
  const today = todayStr();
  const week = fitnessWeek(state, today);
  const streak = fitnessStreak(state, today);
  const plan = normalizePlan(state.data.fitness.plan);
  const weights = weightSeries(state, 12);
  const lastWeights = [...weights].reverse().slice(0, 5);

  return `
    <div class="stack">
      <div class="card pad">
        <div class="row" style="gap:22px">
          <div class="stat"><span class="value num">${week.done}/${week.planned}</span><span class="label">本周训练</span></div>
          <div class="stat"><span class="value num">${streak}</span><span class="label">连续天数</span></div>
          <div class="stat"><span class="value num">${fitnessMonthCount(state, monthKeyOf(today))}</span><span class="label">本月打卡</span></div>
          <button class="btn sm" type="button" data-action="open-plan" style="margin-left:auto">编辑周计划</button>
        </div>
      </div>

      <section class="card pad">
        <div class="card-title"><h3>今日训练</h3><span class="text-xs dim">${weekdayName(weekdayIndex(today))}</span></div>
        ${renderToday(state, today)}
      </section>

      <div class="fit-grid">
        <section class="card pad">
          <div class="card-title"><h3>一周安排</h3><button class="btn ghost sm" type="button" data-action="open-plan">编辑</button></div>
          <div class="plan-list">
            ${plan.map((p) => `
              <div class="plan-row ${Number(p.day) === weekdayIndex(today) ? 'today' : ''}">
                <span class="plan-day">${weekdayName(p.day)}</span>
                <span class="grow">${esc(p.rest ? '休息' : (p.title || '训练'))}</span>
                <span class="text-xs dim">${p.rest ? '' : `${p.items.length} 个动作`}</span>
              </div>`).join('')}
          </div>
        </section>

        <section class="card pad">
          <div class="card-title"><h3>打卡日历</h3></div>
          ${renderCalendar(state, today)}
        </section>
      </div>

      <section class="card pad">
        <div class="card-title"><h3>体重记录</h3><span class="text-xs dim">最近 ${lastWeights.length} 次</span></div>
        <form class="weight-form" data-form="weight">
          <input class="input" type="date" name="date" value="${today}" aria-label="日期">
          <input class="input" type="number" name="kg" step="0.1" min="20" max="300" placeholder="体重 kg" aria-label="体重">
          <button class="btn primary sm" type="submit">记录</button>
        </form>
        ${weightChart(weights)}
        ${lastWeights.length
          ? `<div class="weight-list">${lastWeights.map((w) => `<div class="kv"><span>${esc(w.date)}</span><span class="num strong">${Number(w.kg).toFixed(1)} kg</span></div>`).join('')}</div>`
          : '<div class="text-sm dim" style="margin-top:8px">还没有体重记录</div>'}
      </section>
    </div>
  `;
}

function openPlanEditor(store, rerender) {
  const plan = normalizePlan(store.state.data.fitness.plan);
  const body = `
    <form class="stack" data-form="plan" onsubmit="return false">
      ${plan.map((p) => `
        <div class="plan-edit" data-day="${p.day}">
          <div class="row-between">
            <span class="strong">${weekdayName(p.day)}</span>
            <label class="row text-xs"><input type="checkbox" class="plan-rest" ${p.rest ? 'checked' : ''}> 休息日</label>
          </div>
          <input class="input plan-title" value="${esc(p.rest ? '休息' : p.title)}" placeholder="部位或项目，例如：胸">
          <textarea class="textarea plan-items" placeholder="每行一个动作，例如：卧推 4x12">${esc(formatPlanItems(p.items))}</textarea>
        </div>`).join('')}
      <p class="hint">动作格式：名称 组数x次数，一行一个。</p>
    </form>
  `;

  const { close } = openModal({
    title: '编辑周计划',
    wide: true,
    body,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>保存</button>`,
    onMount: (mask, { close }) => {
      mask.querySelectorAll('.plan-rest').forEach((box) => {
        box.addEventListener('change', () => {
          const row = box.closest('.plan-edit');
          row.querySelector('.plan-items').disabled = box.checked;
        });
      });
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const rows = [...mask.querySelectorAll('.plan-edit')];
        const next = rows.map((row) => {
          const day = Number(row.dataset.day);
          const rest = row.querySelector('.plan-rest').checked;
          const title = row.querySelector('.plan-title').value.trim() || (rest ? '休息' : '训练');
          const items = rest ? [] : parsePlanItems(row.querySelector('.plan-items').value);
          return { day, title, rest, items };
        });
        store.update((d) => { d.data.fitness.plan = next; });
        close();
        rerender();
        toast('周计划已更新');
      });
    }
  });
}

export function bind(root, { store, rerender }) {
  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const today = todayStr();

    if (action === 'open-plan') { openPlanEditor(store, rerender); return; }
    if (action === 'prev-month') { calMonth = addMonths(calMonth, -1); rerender(); return; }
    if (action === 'next-month') { calMonth = addMonths(calMonth, 1); rerender(); return; }

    if (action === 'set') {
      const itemIndex = Number(el.dataset.item);
      const setIndex = Number(el.dataset.set);
      store.update((d) => {
        const plan = planForDate(d, today);
        if (!plan) return;
        let log = (d.data.fitness.logs || []).find((l) => l.date === today);
        if (!log) {
          log = buildLogFromPlan(plan, today);
          d.data.fitness.logs.push(log);
        } else if (!Array.isArray(log.items) || !log.items.length) {
          log.items = buildLogFromPlan(plan, today).items;
        }
        const updated = toggleSet(log, itemIndex, setIndex);
        log.items = updated.items;
        log.done = updated.done;
        log.completedAt = updated.done ? new Date().toISOString() : null;
      });
      const nowDone = isLogComplete(logForDate(store.state, today));
      if (nowDone) toast('今日训练完成 💪');
      return;
    }

    if (action === 'finish') {
      store.update((d) => {
        const plan = planForDate(d, today);
        if (!plan) return;
        let log = (d.data.fitness.logs || []).find((l) => l.date === today);
        if (!log) {
          log = buildLogFromPlan(plan, today);
          d.data.fitness.logs.push(log);
        } else if (!Array.isArray(log.items) || !log.items.length) {
          log.items = buildLogFromPlan(plan, today).items;
        }
        log.items = (log.items || []).map((item) => ({ ...item, doneSets: Number(item.sets) || 0 }));
        log.done = true;
        log.completedAt = new Date().toISOString();
      });
      toast('今日训练完成 💪');
      return;
    }

    if (action === 'undo-log') {
      store.update((d) => {
        d.data.fitness.logs = (d.data.fitness.logs || []).filter((l) => l.date !== today);
      });
      toast('已撤销今日打卡');
    }
  });

  const weightForm = root.querySelector('[data-form="weight"]');
  if (weightForm) {
    weightForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const date = weightForm.elements.date.value || todayStr();
      const kg = Number(weightForm.elements.kg.value);
      if (!kg || kg <= 0) return;
      store.update((d) => {
        d.data.fitness.weights = (d.data.fitness.weights || []).filter((w) => w.date !== date);
        d.data.fitness.weights.push({ date, kg });
      });
      toast('体重已记录');
    });
  }
}
