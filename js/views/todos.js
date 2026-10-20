import { esc, uid } from '../core/html.js';
import { todayStr, weekdayName, startOfWeek, addDays } from '../core/date.js';
import { groupTodos, reorderTodos, todoDueLabel } from '../core/calc.js';
import { openModal } from '../ui/modal.js';
import { showUndo } from '../ui/undo.js';
import { toast } from '../ui/toast.js';

let filter = 'all';
let dragId = null;

const PRIORITY = {
  high: { label: '高', cls: 'danger' },
  mid: { label: '中', cls: 'warn' },
  low: { label: '低', cls: 'muted' }
};

function priorityBadge(p) {
  const item = PRIORITY[p] || PRIORITY.mid;
  return `<span class="badge ${item.cls}">${item.label}</span>`;
}

function todoItem(todo, today) {
  const overdue = todo.dueDate && todo.dueDate < today && !todo.done;
  return `
    <li class="todo-item ${todo.done ? 'done' : ''}" draggable="true" data-id="${esc(todo.id)}">
      <input type="checkbox" class="todo-check" data-action="toggle" data-id="${esc(todo.id)}"
        ${todo.done ? 'checked' : ''} aria-label="标记完成">
      <div class="grow">
        <div class="todo-title">${esc(todo.title)}</div>
        <div class="todo-meta">
          ${todo.dueDate ? `<span class="text-xs ${overdue ? 'overdue' : 'dim'}">${esc(todoDueLabel(todo.dueDate, today))}</span>` : ''}
          ${priorityBadge(todo.priority)}
          ${todo.note ? `<span class="text-xs dim">· ${esc(todo.note)}</span>` : ''}
        </div>
      </div>
      <button class="btn ghost icon sm" type="button" data-action="edit" data-id="${esc(todo.id)}" aria-label="编辑">✎</button>
      <button class="btn ghost icon sm" type="button" data-action="del" data-id="${esc(todo.id)}" aria-label="删除">🗑</button>
    </li>
  `;
}

export function render(state, ctx = {}) {
  const today = todayStr();
  const groups = groupTodos(state, today);
  const all = state.data.todos || [];
  const open = all.filter((t) => !t.done);
  const done = all.filter((t) => t.done);
  const overdue = open.filter((t) => t.dueDate && t.dueDate < today);
  const weekStart = startOfWeek(today, state.data.settings.weekStart || 1);
  const weekRange = `${weekStart.slice(5)} ~ ${addDays(weekStart, 6).slice(5)}`;

  const sections = [
    { key: 'today', label: '今天', list: groups.today },
    { key: 'week', label: `本周（${weekRange}）`, list: groups.week },
    { key: 'later', label: '以后', list: groups.later },
    { key: 'none', label: '无日期', list: groups.none }
  ];

  const openSections = sections
    .map((s) => ({ ...s, list: s.list.filter((t) => !t.done) }))
    .filter((s) => s.list.length > 0);

  const showGroups = filter !== 'done';
  let body = '';

  if (showGroups) {
    body = openSections.length
      ? openSections.map((s) => `
          <div class="group-block">
            <div class="group-title">${esc(s.label)}<span class="text-xs dim">${s.list.length}</span></div>
            <ul class="todo-list">${s.list.map((t) => todoItem(t, today)).join('')}</ul>
          </div>`).join('')
      : `<div class="empty"><div class="empty-icon">🎉</div><p class="text-sm dim">没有未完成的待办，今天可以摸鱼了</p></div>`;
  }

  const doneList = filter === 'all' || filter === 'done'
    ? done.map((t) => todoItem(t, today)).join('')
    : '';

  return `
    <div class="stack">
      <div class="card pad">
        <div class="row-between wrap">
          <div class="row" style="gap:16px">
            <div class="stat"><span class="value num">${open.length}</span><span class="label">未完成</span></div>
            <div class="stat"><span class="value num" style="color:${overdue.length ? 'var(--danger)' : 'inherit'}">${overdue.length}</span><span class="label">已逾期</span></div>
          </div>
          <div class="segmented">
            ${[['all', '全部'], ['open', '未完成'], ['done', '已完成']].map(([key, label]) => `
              <button type="button" class="${filter === key ? 'active' : ''}" data-action="filter" data-value="${key}">${label}</button>`).join('')}
          </div>
        </div>
      </div>

      <div class="card pad">
        <form class="todo-add" data-form="add-todo">
          <input class="input" name="title" placeholder="要做点什么？回车添加" autocomplete="off" required>
          <input class="input" type="date" name="dueDate" value="${today}" aria-label="截止日期">
          <select class="select" name="priority" aria-label="优先级">
            <option value="high">高优先级</option>
            <option value="mid" selected>中优先级</option>
            <option value="low">低优先级</option>
          </select>
          <button class="btn primary" type="submit">添加</button>
        </form>
      </div>

      ${showGroups ? `<div class="card pad">${body}</div>` : ''}

      ${doneList ? `
        <details class="card pad" ${filter === 'done' ? 'open' : ''}>
          <summary class="group-title" style="margin:0">已完成 ${done.length} 条</summary>
          <ul class="todo-list" style="margin-top:8px">${doneList}</ul>
        </details>` : ''}

      ${filter === 'done' && !doneList ? `
        <div class="card pad"><div class="empty"><p class="text-sm dim">还没有完成的待办</p></div></div>` : ''}
    </div>
  `;
}

function todoFormHtml(todo) {
  return `
    <form class="stack" data-form="todo" onsubmit="return false">
      <div class="field">
        <label>标题 *</label>
        <input class="input" name="title" value="${esc(todo.title || '')}" autocomplete="off">
      </div>
      <div class="form-grid">
        <div class="field">
          <label>截止日期</label>
          <input class="input" type="date" name="dueDate" value="${esc(todo.dueDate || '')}">
        </div>
        <div class="field">
          <label>优先级</label>
          <select class="select" name="priority">
            <option value="high" ${todo.priority === 'high' ? 'selected' : ''}>高</option>
            <option value="mid" ${todo.priority === 'mid' ? 'selected' : ''}>中</option>
            <option value="low" ${todo.priority === 'low' ? 'selected' : ''}>低</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label>备注</label>
        <textarea class="textarea" name="note" style="min-height:70px">${esc(todo.note || '')}</textarea>
      </div>
      <p class="err hidden" data-error></p>
    </form>
  `;
}

function openTodoForm(store, rerender, existing) {
  const { close } = openModal({
    title: existing ? '编辑待办' : '新建待办',
    body: todoFormHtml(existing || {}),
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>保存</button>`,
    onMount: (mask, { close }) => {
      const form = mask.querySelector('[data-form="todo"]');
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const title = form.elements.title.value.trim();
        if (!title) {
          const err = mask.querySelector('[data-error]');
          err.textContent = '标题不能为空';
          err.classList.remove('hidden');
          return;
        }
        const patch = {
          title,
          dueDate: form.elements.dueDate.value || null,
          priority: form.elements.priority.value,
          note: form.elements.note.value.trim(),
          updatedAt: new Date().toISOString()
        };
        store.update((d) => {
          if (existing) {
            const target = d.data.todos.find((t) => t.id === existing.id);
            if (target) Object.assign(target, patch);
          } else {
            d.data.todos.push({
              id: uid('t'), ...patch, planDate: null, done: false, doneAt: null, order: Date.now()
            });
          }
        });
        close();
        rerender();
        toast(existing ? '待办已更新' : '待办已添加');
      });
    }
  });
}

function deleteTodo(store, rerender, todo) {
  store.update((d) => { d.data.todos = d.data.todos.filter((t) => t.id !== todo.id); });
  rerender();
  showUndo('已删除一条待办', () => {
    store.update((d) => { d.data.todos.push(todo); });
    rerender();
  });
}

export function bind(root, { store, rerender }) {
  const form = root.querySelector('[data-form="add-todo"]');
  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const title = form.elements.title.value.trim();
      if (!title) return;
      const dueDate = form.elements.dueDate.value || null;
      const priority = form.elements.priority.value;
      store.update((d) => {
        d.data.todos.push({
          id: uid('t'), title, dueDate, planDate: null, priority,
          note: '', done: false, doneAt: null, order: Date.now(), updatedAt: new Date().toISOString()
        });
      });
    });
  }

  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id;

    if (action === 'filter') {
      filter = el.dataset.value;
      rerender();
      return;
    }
    if (action === 'toggle') return;
    if (action === 'edit') {
      const todo = store.state.data.todos.find((t) => t.id === id);
      if (todo) openTodoForm(store, rerender, todo);
      return;
    }
    if (action === 'del') {
      const todo = store.state.data.todos.find((t) => t.id === id);
      if (todo) deleteTodo(store, rerender, todo);
    }
  });

  root.querySelectorAll('[data-action="toggle"]').forEach((box) => {
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

  root.querySelectorAll('.todo-item[draggable="true"]').forEach((li) => {
    li.addEventListener('dragstart', (event) => {
      dragId = li.dataset.id;
      li.classList.add('dragging');
      event.dataTransfer.setData('text/plain', dragId);
      event.dataTransfer.effectAllowed = 'move';
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      dragId = null;
    });
    li.addEventListener('dragover', (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    });
    li.addEventListener('drop', (event) => {
      event.preventDefault();
      const targetId = li.dataset.id;
      if (!dragId || dragId === targetId) return;
      store.update((d) => {
        d.data.todos = reorderTodos(d.data.todos, dragId, targetId);
      });
      dragId = null;
    });
  });
}
