// 全局快速添加：选类型 → 极简录入
import { esc, uid } from '../core/html.js';
import { todayStr } from '../core/date.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';
import { BUDGET_CATEGORIES } from '../core/calc.js';

const TYPES = [
  { key: 'todo', label: '待办', icon: '✅' },
  { key: 'assignment', label: '作业', icon: '📝' },
  { key: 'expense', label: '记账', icon: '💰' },
  { key: 'fun', label: '娱乐', icon: '🎮' },
  { key: 'note', label: '便签', icon: '📌' }
];

export const QUICK_TYPES = TYPES;

export function openQuickAdd(store) {
  const { close } = openModal({
    title: '快速添加',
    body: `
      <div class="quick-grid">
        ${TYPES.map((t) => `
          <button class="quick-item" type="button" data-quick="${t.key}">
            <span class="icon">${t.icon}</span><span>${t.label}</span>
          </button>`).join('')}
      </div>
    `,
    onMount: (mask, { close }) => {
      mask.querySelectorAll('[data-quick]').forEach((btn) => {
        btn.addEventListener('click', () => {
          close();
          openForm(store, btn.dataset.quick);
        });
      });
    }
  });
}

function openForm(store, type) {
  if (type === 'todo') return formModal(store, '记一条待办', [
    { name: 'title', label: '做什么', type: 'text', placeholder: '例如：交英语作文' },
    { name: 'dueDate', label: '截止', type: 'date', value: todayStr() }
  ], (values) => {
    if (!values.title.trim()) return '标题不能为空';
    store.update((d) => {
      d.data.todos.push({
        id: uid('t'), title: values.title.trim(), dueDate: values.dueDate || null,
        planDate: null, priority: 'mid', note: '', done: false, doneAt: null,
        order: Date.now(), updatedAt: new Date().toISOString()
      });
    });
    toast('待办已添加');
    return null;
  });

  if (type === 'assignment') return formModal(store, '记一份作业', [
    { name: 'courseName', label: '课程', type: 'text', placeholder: '例如：高等数学' },
    { name: 'title', label: '作业', type: 'text', placeholder: '例如：第三章习题' },
    { name: 'dueDate', label: '截止', type: 'date', value: todayStr() }
  ], (values) => {
    if (!values.title.trim()) return '作业名不能为空';
    store.update((d) => {
      d.data.assignments.push({
        id: uid('a'),
        courseId: null,
        courseName: values.courseName.trim() || '未分类',
        title: values.title.trim(),
        dueAt: values.dueDate ? `${values.dueDate}T23:59:00` : null,
        status: 'todo',
        submittedAt: null,
        note: '',
        updatedAt: new Date().toISOString()
      });
    });
    toast('作业已添加');
    return null;
  });

  if (type === 'expense') return formModal(store, '记一笔', [
    { name: 'amount', label: '金额', type: 'number', placeholder: '0.00', step: '0.01' },
    { name: 'category', label: '分类', type: 'select', options: BUDGET_CATEGORIES },
    { name: 'note', label: '备注', type: 'text', placeholder: '可留空' }
  ], (values) => {
    const amount = Number(values.amount);
    if (!amount || amount <= 0) return '金额要大于 0';
    store.update((d) => {
      d.data.budget.expenses.push({
        id: uid('e'), amount: Math.round(amount * 100) / 100,
        category: values.category || '其他', date: todayStr(), note: values.note.trim()
      });
    });
    toast('已记下');
    return null;
  });

  if (type === 'fun') return formModal(store, '补记娱乐', [
    { name: 'name', label: '玩了什么', type: 'text', placeholder: '游戏或影视名字' },
    { name: 'minutes', label: '时长（分钟）', type: 'number', value: '30' },
    { name: 'type', label: '类型', type: 'select', options: ['game', 'video', 'other'], labels: { game: '游戏', video: '影视', other: '其他' } }
  ], (values) => {
    const minutes = Number(values.minutes);
    if (!values.name.trim()) return '名称不能为空';
    if (!minutes || minutes <= 0) return '时长要大于 0';
    store.update((d) => {
      d.data.fun.records.push({
        id: uid('f'), date: todayStr(), name: values.name.trim(),
        type: values.type || 'game', minutes: Math.round(minutes)
      });
    });
    toast('已补记');
    return null;
  });

  if (type === 'note') return formModal(store, '写点备忘', [
    { name: 'text', label: '内容', type: 'textarea', placeholder: '随手记两句……' }
  ], (values) => {
    if (!values.text.trim()) return '内容不能为空';
    store.update((d) => {
      const old = d.data.notes && d.data.notes.text ? `${d.data.notes.text}\n` : '';
      d.data.notes = { text: `${old}${values.text.trim()}`, updatedAt: new Date().toISOString() };
    });
    toast('已记到备忘录');
    return null;
  });

  return null;
}

function fieldHtml(field) {
  const label = `<label>${esc(field.label)}</label>`;
  if (field.type === 'select') {
    const options = (field.options || []).map((value) => {
      const text = (field.labels && field.labels[value]) || value;
      return `<option value="${esc(value)}">${esc(text)}</option>`;
    }).join('');
    return `<div class="field">${label}<select class="select" name="${esc(field.name)}">${options}</select></div>`;
  }
  if (field.type === 'textarea') {
    return `<div class="field">${label}<textarea class="textarea" name="${esc(field.name)}" placeholder="${esc(field.placeholder || '')}"></textarea></div>`;
  }
  const attrs = [
    `class="input"`,
    `name="${esc(field.name)}"`,
    `type="${esc(field.type || 'text')}"`,
    field.value !== undefined ? `value="${esc(field.value)}"` : '',
    field.placeholder ? `placeholder="${esc(field.placeholder)}"` : '',
    field.step ? `step="${esc(field.step)}"` : ''
  ].filter(Boolean).join(' ');
  return `<div class="field">${label}<input ${attrs}></div>`;
}

function formModal(store, title, fields, onSubmit) {
  const { close } = openModal({
    title,
    body: `
      <form class="stack" data-form="quick" onsubmit="return false">
        ${fields.map(fieldHtml).join('')}
        <p class="err hidden" data-error></p>
      </form>
    `,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>添加</button>`,
    onMount: (mask, { close }) => {
      const form = mask.querySelector('[data-form="quick"]');
      const errorEl = mask.querySelector('[data-error]');
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const values = {};
        for (const field of fields) values[field.name] = form.elements[field.name].value;
        const error = onSubmit(values);
        if (error) {
          errorEl.textContent = error;
          errorEl.classList.remove('hidden');
          return;
        }
        close();
      });
    }
  });
}
