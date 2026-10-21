import { esc, uid } from '../core/html.js';
import { todayStr, monthKeyOf, fmtMonthCN, addMonths, fmtMoney } from '../core/date.js';
import { budgetBreakdown, expensesByDate, expenseTotals, BUDGET_CATEGORIES, budgetMonth } from '../core/calc.js';
import { openModal } from '../ui/modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { makeTrashEntry } from '../core/trash.js';

let monthKey = monthKeyOf(todayStr());

function barPercent(row, totalSpent) {
  if (row.budget > 0) return Math.min(100, Math.round((row.spent / row.budget) * 100));
  if (totalSpent > 0) return Math.min(100, Math.round((row.spent / totalSpent) * 100));
  return 0;
}

function renderBreakdown(rows, totalSpent) {
  if (!rows.length) {
    return '<div class="text-sm dim">这个月还没有支出记录</div>';
  }
  return rows.map((row) => {
    const pct = barPercent(row, totalSpent);
    const over = row.budget > 0 && row.spent > row.budget;
    return `
      <div class="bar-row">
        <div class="row-between">
          <span>${esc(row.category)}</span>
          <span class="num text-xs ${over ? 'overdue' : 'dim'}">
            ${fmtMoney(row.spent)}${row.budget > 0 ? ` / ${fmtMoney(row.budget)}` : ''}
          </span>
        </div>
        <div class="progress ${over ? 'danger' : row.budget > 0 && row.spent > row.budget * 0.8 ? 'warn' : ''}">
          <i style="width:${pct}%"></i>
        </div>
      </div>`;
  }).join('');
}

export function render(state, ctx = {}) {
  const totals = expenseTotals(state, monthKey);
  const month = budgetMonth(state, monthKey);
  const groups = expensesByDate(month.expenses);
  const breakdown = budgetBreakdown(state, monthKey);
  const hasBudget = totals.total > 0;
  const overspent = totals.overspent;

  return `
    <div class="stack">
      <div class="row-between wrap">
        <div class="row">
          <button class="btn icon sm" type="button" data-action="prev-month" aria-label="上个月">‹</button>
          <span class="strong">${fmtMonthCN(monthKey)}</span>
          <button class="btn icon sm" type="button" data-action="next-month" aria-label="下个月">›</button>
          ${monthKey !== monthKeyOf(todayStr()) ? '<button class="btn sm" type="button" data-action="this-month">本月</button>' : ''}
        </div>
        <button class="btn primary sm" type="button" data-action="add">＋ 记一笔</button>
      </div>

      <section class="card pad">
        <div class="row-between wrap">
          <div>
            <div class="text-xs dim">本月预算</div>
            <div class="budget-num num">${hasBudget ? fmtMoney(totals.total) : '未设置'}</div>
          </div>
          <button class="btn sm" type="button" data-action="edit-budget">设置预算</button>
        </div>
        <div class="budget-stats">
          <div class="stat"><span class="value num">${fmtMoney(totals.spent)}</span><span class="label">已花</span></div>
          <div class="stat">
            <span class="value num" style="color:${overspent ? 'var(--danger)' : totals.remaining < totals.total * 0.2 ? 'var(--warn)' : 'inherit'}">
              ${totals.remaining >= 0 ? fmtMoney(totals.remaining) : `-${fmtMoney(-totals.remaining)}`}
            </span>
            <span class="label">${totals.remaining >= 0 ? '剩余' : '超支'}</span>
          </div>
          <div class="stat"><span class="value num">${hasBudget ? `${month.percent}%` : '—'}</span><span class="label">预算使用</span></div>
        </div>
        ${hasBudget ? `<div class="progress ${overspent ? 'danger' : ''}" style="margin-top:10px"><i style="width:${Math.min(100, month.percent)}%"></i></div>` : ''}
        ${overspent ? `<div class="callout danger" style="margin-top:10px">本月已超支 ${fmtMoney(totals.spent - totals.total)}，剩下的日子悠着点 🐟</div>` : ''}
      </section>

      <div class="budget-grid">
        <section class="card pad">
          <div class="card-title"><h3>分类占比</h3></div>
          <div class="bar-list">${renderBreakdown(breakdown, totals.spent)}</div>
        </section>

        <section class="card pad">
          <div class="card-title"><h3>记一笔</h3></div>
          <form class="expense-form" data-form="expense">
            <input class="input" type="number" name="amount" step="0.01" min="0.01" placeholder="金额" required>
            <select class="select" name="category">
              ${BUDGET_CATEGORIES.map((c) => `<option value="${esc(c)}">${esc(c)}</option>`).join('')}
            </select>
            <input class="input" type="date" name="date" value="${todayStr()}">
            <input class="input" name="note" placeholder="备注（可留空）">
            <button class="btn primary" type="submit">记下</button>
          </form>
        </section>
      </div>

      <section class="card pad">
        <div class="card-title"><h3>明细</h3><span class="text-xs dim">${month.expenses.length} 笔</span></div>
        ${groups.length ? groups.map((group) => `
          <div class="date-group">
            <div class="row-between group-title" style="margin:8px 0 2px">
              <span>${esc(group.date)}</span>
              <span class="num text-xs dim">${fmtMoney(group.total)}</span>
            </div>
            <ul class="expense-list">
              ${group.items.map((item) => `
                <li class="expense-row">
                  <span class="tag">${esc(item.category || '其他')}</span>
                  <span class="grow">${esc(item.note || '—')}</span>
                  <span class="num strong">${fmtMoney(item.amount)}</span>
                  <button class="btn ghost icon sm" type="button" data-action="edit" data-id="${esc(item.id)}" aria-label="编辑">✎</button>
                  <button class="btn ghost icon sm" type="button" data-action="del" data-id="${esc(item.id)}" aria-label="删除">🗑</button>
                </li>`).join('')}
            </ul>
          </div>`).join('')
          : '<div class="empty" style="padding:20px 8px"><p class="text-sm dim">还没有支出记录</p></div>'}
      </section>
    </div>
  `;
}

function openBudgetEditor(store, rerender) {
  const state = store.state;
  const conf = (state.data.budget.months || {})[monthKey] || { total: 0, categories: {} };
  const { close } = openModal({
    title: `设置 ${fmtMonthCN(monthKey)} 预算`,
    body: `
      <form class="stack" data-form="budget" onsubmit="return false">
        <div class="field">
          <label>总预算</label>
          <input class="input" type="number" name="total" min="0" step="1" value="${Number(conf.total) || 0}">
        </div>
        <div class="form-grid">
          ${BUDGET_CATEGORIES.map((cat) => `
            <div class="field">
              <label>${esc(cat)}</label>
              <input class="input" type="number" name="cat_${esc(cat)}" min="0" step="1" value="${Number((conf.categories || {})[cat]) || 0}">
            </div>`).join('')}
        </div>
        <p class="hint">分类预算可以留 0，只做记录。</p>
      </form>
    `,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>保存</button>`,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const form = mask.querySelector('[data-form="budget"]');
        const categories = {};
        for (const cat of BUDGET_CATEGORIES) {
          const value = Number(form.elements[`cat_${cat}`].value) || 0;
          if (value > 0) categories[cat] = value;
        }
        store.update((d) => {
          d.data.budget.months = d.data.budget.months || {};
          d.data.budget.months[monthKey] = { total: Number(form.elements.total.value) || 0, categories };
        });
        close();
        rerender();
        toast('预算已保存');
      });
    }
  });
}

function openExpenseForm(store, rerender, existing = null) {
  const item = existing || { amount: '', category: BUDGET_CATEGORIES[0], date: todayStr(), note: '' };
  const { close } = openModal({
    title: existing ? '编辑这笔' : '记一笔',
    body: `
      <form class="stack" data-form="expense-edit" onsubmit="return false">
        <div class="field">
          <label>金额 *</label>
          <input class="input" type="number" name="amount" step="0.01" min="0.01" value="${esc(item.amount)}">
        </div>
        <div class="form-grid">
          <div class="field">
            <label>分类</label>
            <select class="select" name="category">
              ${BUDGET_CATEGORIES.map((c) => `<option value="${esc(c)}" ${c === item.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label>日期</label>
            <input class="input" type="date" name="date" value="${esc(item.date || todayStr())}">
          </div>
        </div>
        <div class="field">
          <label>备注</label>
          <input class="input" name="note" value="${esc(item.note || '')}">
        </div>
        <p class="err hidden" data-error></p>
      </form>
    `,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>保存</button>`,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const form = mask.querySelector('[data-form="expense-edit"]');
        const amount = Number(form.elements.amount.value);
        const err = mask.querySelector('[data-error]');
        if (!amount || amount <= 0) {
          err.textContent = '金额必须大于 0';
          err.classList.remove('hidden');
          return;
        }
        const patch = {
          amount: Math.round(amount * 100) / 100,
          category: form.elements.category.value,
          date: form.elements.date.value || todayStr(),
          note: form.elements.note.value.trim()
        };
        store.update((d) => {
          if (existing) {
            const target = d.data.budget.expenses.find((e) => e.id === existing.id);
            if (target) Object.assign(target, patch);
          } else {
            d.data.budget.expenses.push({ id: uid('e'), ...patch });
          }
        });
        close();
        rerender();
        toast(existing ? '已更新' : '已记下');
      });
    }
  });
}

export function bind(root, { store, rerender }) {
  root.addEventListener('click', async (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'prev-month') { monthKey = addMonths(monthKey, -1); rerender(); return; }
    if (action === 'next-month') { monthKey = addMonths(monthKey, 1); rerender(); return; }
    if (action === 'this-month') { monthKey = monthKeyOf(todayStr()); rerender(); return; }
    if (action === 'add') { openExpenseForm(store, rerender); return; }
    if (action === 'edit-budget') { openBudgetEditor(store, rerender); return; }

    const id = el.dataset.id;
    const item = (store.state.data.budget.expenses || []).find((e) => e.id === id);
    if (!item) return;

    if (action === 'edit') openExpenseForm(store, rerender, item);
    else if (action === 'del') {
      const ok = await confirmDialog({
        title: '删除这笔',
        message: `确定删除 ${item.date} 的 ${fmtMoney(item.amount)}（${item.category}）吗？`,
        confirmText: '删除',
        danger: true
      });
      if (!ok) return;
      const entry = makeTrashEntry('expense', item, `${item.category || '其他'} ${fmtMoney(item.amount)}`);
      store.update((d) => {
        d.data.budget.expenses = d.data.budget.expenses.filter((e) => e.id !== id);
        d.data.trash = [...(d.data.trash || []), entry];
      });
      rerender();
      toast('已移入回收站');
    }
  });

  const form = root.querySelector('[data-form="expense"]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = Number(form.elements.amount.value);
      if (!amount || amount <= 0) return;
      const date = form.elements.date.value || todayStr();
      store.update((d) => {
        d.data.budget.expenses.push({
          id: uid('e'),
          amount: Math.round(amount * 100) / 100,
          category: form.elements.category.value,
          date,
          note: form.elements.note.value.trim()
        });
      });
      if (date.slice(0, 7) !== monthKey) monthKey = date.slice(0, 7);
      toast('已记下');
    });
  }
}
