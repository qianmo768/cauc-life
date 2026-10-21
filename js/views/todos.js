import { esc, uid } from '../core/html.js';
import { todayStr, weekdayName, startOfWeek, addDays } from '../core/date.js';
import { groupTodos, reorderTodos, todoDueLabel, buildNextOccurrence, formatRepeat } from '../core/calc.js';
import { openModal } from '../ui/modal.js';
import { showUndo } from '../ui/undo.js';
import { toast } from '../ui/toast.js';
import { makeTrashEntry } from '../core/trash.js';

let filter = 'all';
let dragId = null;
let selectMode = false;
const selected = new Set();

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
  const check = selectMode
    ? `<input type="checkbox" class="todo-check" data-action="select" data-id="${esc(todo.id)}"
        ${selected.has(todo.id) ? 'checked' : ''} aria-label="选择这条待办">`
    : `<input type="checkbox" class="todo-check" data-action="toggle" data-id="${esc(todo.id)}"
        ${todo.done ? 'checked' : ''} aria-label="标记完成">`;
  return `
    <li class="todo-item ${todo.done ? 'done' : ''} ${selected.has(todo.id) ? 'selected' : ''}" draggable="${selectMode ? 'false' : 'true'}" data-id="${esc(todo.id)}">
      ${check}
      <div class="grow">
        <div class="todo-title">${esc(todo.title)}</div>
        <div class="todo-meta">
          ${todo.dueDate ? `<span class="text-xs ${overdue ? 'overdue' : 'dim'}">${esc(todoDueLabel(todo.dueDate, today))}</span>` : ''}
          ${priorityBadge(todo.priority)}
          ${todo.repeat && todo.repeat !== 'none' ? `<span class="badge muted">${formatRepeat(todo.repeat)}</span>` : ''}
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
          <div class="row wrap" style="gap:8px">
            <div class="segmented">
              ${[['all', '全部'], ['open', '未完成'], ['done', '已完成']].map(([key, label]) => `
                <button type="button" class="${filter === key ? 'active' : ''}" data-action="filter" data-value="${key}">${label}</button>`).join('')}
            </div>
            <button class="btn sm" type="button" data-action="select-mode">${selectMode ? '退出批量' : '批量'}</button>
          </div>
        </div>
      </div>

      ${selectMode ? `
        <div class="card pad batch-bar">
          <span class="strong">已选 ${selected.size} 条</span>
          <div class="row wrap" style="gap:8px">
            <button class="btn sm" type="button" data-action="select-all">全选未完成</button>
            <button class="btn sm primary" type="button" data-action="batch-done" ${selected.size ? '' : 'disabled'}>标记完成</button>
            <button class="btn sm danger" type="button" data-action="batch-del" ${selected.size ? '' : 'disabled'}>删除</button>
          </div>
        </div>` : ''}

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
        <div class="field">
          <label>重复</label>
          <select class="select" name="repeat">
            <option value="none" ${!todo.repeat || todo.repeat === 'none' ? 'selected' : ''}>不重复</option>
            <option value="daily" ${todo.repeat === 'daily' ? 'selected' : ''}>每天</option>
            <option value="weekly" ${todo.repeat === 'weekly' ? 'selected' : ''}>每周</option>
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
          repeat: form.elements.repeat.value || 'none',
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
  const entry = makeTrashEntry('todo', todo, todo.title);
  store.update((d) => {
    d.data.todos = d.data.todos.filter((t) => t.id !== todo.id);
    d.data.trash = [...(d.data.trash || []), entry];
  });
  rerender();
  showUndo('已移入回收站', () => {
    store.update((d) => {
      d.data.todos.push(todo);
      d.data.trash = (d.data.trash || []).filter((t) => t.id !== entry.id);
    });
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
    if (action === 'select-mode') {
      selectMode = !selectMode;
      selected.clear();
      rerender();
      return;
    }
    if (action === 'select-all') {
      for (const todo of store.state.data.todos) {
        if (!todo.done) selected.add(todo.id);
      }
      rerender();
      return;
    }
    if (action === 'batch-done') {
      if (!selected.size) return;
      const count = selected.size;
      store.update((d) => {
        for (const todo of d.data.todos) {
          if (!selected.has(todo.id)) continue;
          todo.done = true;
          todo.doneAt = new Date().toISOString();
          todo.updatedAt = new Date().toISOString();
        }
      });
      selected.clear();
      selectMode = false;
      rerender();
      toast(`已完成 ${count} 条`);
      return;
    }
    if (action === 'batch-del') {
      if (!selected.size) return;
      const removed = store.state.data.todos.filter((t) => selected.has(t.id));
      const entries = removed.map((t) => makeTrashEntry('todo', t, t.title));
      store.update((d) => {
        d.data.todos = d.data.todos.filter((t) => !selected.has(t.id));
        d.data.trash = [...(d.data.trash || []), ...entries];
      });
      selected.clear();
      selectMode = false;
      rerender();
      showUndo(`已删除 ${removed.length} 条待办`, () => {
        store.update((d) => {
          d.data.todos.push(...removed);
          const ids = new Set(entries.map((e) => e.id));
          d.data.trash = (d.data.trash || []).filter((e) => !ids.has(e.id));
        });
        rerender();
      });
      return;
    }
    if (action === 'toggle' || action === 'select') return;
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

        // 完成重复待办后，自动生成下一次
        if (box.checked) {
          const next = buildNextOccurrence(todo, todayStr());
          if (next) {
            const exists = d.data.todos.some(
              (t) => t.seriesId === next.seriesId && t.dueDate === next.dueDate && !t.done
            );
            if (!exists) {
              d.data.todos.push({ id: uid('t'), ...next, updatedAt: new Date().toISOString() });
            }
          }
        }
      });
    });
  });

  root.querySelectorAll('[data-action="select"]').forEach((box) => {
    box.addEventListener('change', () => {
      if (box.checked) selected.add(box.dataset.id);
      else selected.delete(box.dataset.id);
      rerender();
    });
  });

  root.querySelectorAll('.todo-item[draggable="true"]').forEach((li) => {    li.addEventListener('dragstart', (event) => {
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

  // 手机左滑删除
  if (!selectMode) {
    root.querySelectorAll('.todo-item').forEach((li) => {
      let startX = 0;
      let dx = 0;
      let swiping = false;

      li.addEventListener('touchstart', (event) => {
        startX = event.touches[0].clientX;
        dx = 0;
        swiping = true;
        li.classList.add('swiping');
      }, { passive: true });

      li.addEventListener('touchmove', (event) => {
        if (!swiping) return;
        dx = Math.min(0, event.touches[0].clientX - startX);
        li.style.transform = `translateX(${Math.max(dx, -96)}px)`;
      }, { passive: true });

      li.addEventListener('touchend', () => {
        if (!swiping) return;
        swiping = false;
        li.classList.remove('swiping');
        li.style.transform = '';
        if (dx < -60) {
          const todo = store.state.data.todos.find((t) => t.id === li.dataset.id);
          if (todo) deleteTodo(store, rerender, todo);
        }
        dx = 0;
      });
    });
  }
}
