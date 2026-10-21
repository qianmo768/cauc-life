import { esc, uid } from '../core/html.js';
import { todayStr, toLocalInput, fromLocalInput, fmtDateCN } from '../core/date.js';
import {
  homeworkStats, sortAssignmentsByDue, groupAssignmentsByCourse,
  assignmentColor, assignmentDueMeta, ASSIGNMENT_STATUS
} from '../core/calc.js';
import { openModal } from '../ui/modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { makeTrashEntry } from '../core/trash.js';
import { api } from '../api.js';
import { parseAssignmentText } from '../core/assignments.js';

let viewMode = 'due';
let statusFilter = 'all';

const STATUS_BADGE = { todo: 'muted', doing: 'brand', submitted: 'ok' };

function cardHtml(state, item, today) {
  const meta = assignmentDueMeta(item, today);
  const color = assignmentColor(state, item);
  const status = ASSIGNMENT_STATUS[item.status] || '未开始';
  const nextAction = item.status === 'submitted'
    ? { action: 'reopen', label: '撤销已交', cls: '' }
    : item.status === 'todo'
      ? { action: 'start', label: '开始做', cls: 'primary' }
      : { action: 'submit', label: '标记已交', cls: 'primary' };

  return `
    <div class="hw-card ${item.status === 'submitted' ? 'is-done' : ''}">
      <div class="row-between">
        <span class="tag course" style="--course:${esc(color)}">${esc(item.courseName || '未分类')}</span>
        <span class="badge ${STATUS_BADGE[item.status] || 'muted'}">${status}</span>
      </div>
      <div class="hw-title">${esc(item.title)}</div>
      <div class="hw-meta ${esc(meta.tone)}">${esc(meta.label)}</div>
      ${typeof item.grade === 'number' ? `<div class="hw-grade">成绩 <strong>${item.grade}</strong> 分</div>` : ''}
      ${(item.attachments || []).length ? `
        <div class="hw-attach">
          ${item.attachments.map((file) => `<a href="${esc(file.url)}" target="_blank" rel="noopener">📎 ${esc(file.name)}</a>`).join('')}
        </div>` : ''}
      ${item.note ? `<div class="text-xs dim">${esc(item.note)}</div>` : ''}
      <div class="hw-actions">
        <button class="btn sm ${nextAction.cls}" type="button" data-action="${nextAction.action}" data-id="${esc(item.id)}">${nextAction.label}</button>
        <button class="btn sm ghost" type="button" data-action="edit" data-id="${esc(item.id)}">编辑</button>
        <button class="btn sm ghost" type="button" data-action="del" data-id="${esc(item.id)}">删除</button>
      </div>
    </div>
  `;
}

export function render(state, ctx = {}) {
  const today = todayStr();
  const all = state.data.assignments || [];
  const stats = homeworkStats(state, today);

  const filtered = all.filter((item) => statusFilter === 'all' || item.status === statusFilter);
  const sorted = sortAssignmentsByDue(filtered);

  const groups = viewMode === 'course'
    ? groupAssignmentsByCourse(state, sorted)
    : [{ name: null, items: sorted }];

  const body = sorted.length
    ? groups.map((group) => `
        ${group.name ? `<div class="group-title">${esc(group.name)}<span class="text-xs dim">${group.items.length}</span></div>` : ''}
        <div class="hw-grid">
          ${group.items.map((item) => cardHtml(state, item, today)).join('')}
        </div>
      `).join('')
    : `<div class="card pad"><div class="empty">
         <div class="empty-icon">📚</div>
         <p class="text-sm dim">${all.length ? '没有符合筛选的作业' : '还没有作业，先记一条吧'}</p>
         <button class="btn primary sm" type="button" data-action="add">添加作业</button>
       </div></div>`;

  return `
    <div class="stack">
      <div class="card pad">
        <div class="row-between wrap">
          <div class="row" style="gap:18px">
            <div class="stat"><span class="value num">${stats.pending}</span><span class="label">未交</span></div>
            <div class="stat"><span class="value num" style="color:${stats.dueToday ? 'var(--warn)' : 'inherit'}">${stats.dueToday}</span><span class="label">今天截止</span></div>
            <div class="stat"><span class="value num" style="color:${stats.overdue ? 'var(--danger)' : 'inherit'}">${stats.overdue}</span><span class="label">已逾期</span></div>
          </div>
          <div class="row wrap">
            <div class="segmented">
              <button type="button" class="${viewMode === 'due' ? 'active' : ''}" data-action="view" data-value="due">按截止</button>
              <button type="button" class="${viewMode === 'course' ? 'active' : ''}" data-action="view" data-value="course">按课程</button>
            </div>
            <button class="btn sm" type="button" data-action="paste-import">粘贴导入</button>
            <button class="btn primary sm" type="button" data-action="add">＋ 添加作业</button>
          </div>
        </div>
        <div class="row wrap" style="margin-top:12px">
          ${[['all', '全部'], ['todo', '未开始'], ['doing', '进行中'], ['submitted', '已交']].map(([key, label]) => `
            <button class="chip ${statusFilter === key ? 'active' : ''}" type="button" data-action="filter" data-value="${key}">${label}</button>`).join('')}
        </div>
      </div>

      ${body}
    </div>
  `;
}

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function courseOptions(state, selectedId) {  return `
    ${(state.data.courses || []).map((c) => `<option value="${esc(c.id)}" ${c.id === selectedId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    <option value="__custom" ${!selectedId ? 'selected' : ''}>其他（手动输入）</option>
  `;
}

function formHtml(state, item = {}) {
  const hasCourse = Boolean(item.courseId);
  return `
    <form class="stack" data-form="assignment" onsubmit="return false">
      <div class="field">
        <label>标题 *</label>
        <input class="input" name="title" value="${esc(item.title || '')}" placeholder="例如：第三章习题" autocomplete="off">
      </div>
      <div class="form-grid">
        <div class="field">
          <label>课程</label>
          <select class="select" name="courseId">${courseOptions(state, item.courseId)}</select>
        </div>
        <div class="field" data-custom-wrap ${hasCourse ? 'hidden' : ''}>
          <label>课程名</label>
          <input class="input" name="customName" value="${esc(hasCourse ? '' : item.courseName || '')}" placeholder="没在课表里就写这里">
        </div>
        <div class="field">
          <label>截止时间</label>
          <input class="input" type="datetime-local" name="dueAt" value="${esc(toLocalInput(item.dueAt) || `${todayStr()}T23:59`)}">
        </div>
        <div class="field">
          <label>状态</label>
          <select class="select" name="status">
            <option value="todo" ${item.status === 'todo' || !item.status ? 'selected' : ''}>未开始</option>
            <option value="doing" ${item.status === 'doing' ? 'selected' : ''}>进行中</option>
            <option value="submitted" ${item.status === 'submitted' ? 'selected' : ''}>已交</option>
          </select>
        </div>
        <div class="field">
          <label>成绩（可留空）</label>
          <input class="input" type="number" name="grade" min="0" max="100" step="0.5" value="${typeof item.grade === 'number' ? item.grade : ''}" placeholder="例如 92">
        </div>
        <div class="field full">
          <label>附件（单个不超过 8 MB）</label>
          <div class="attach-list" data-attach-list></div>
          <input class="input" type="file" data-attach-input style="padding:8px">
        </div>
        <div class="field full">
          <label>备注</label>
          <textarea class="textarea" name="note" style="min-height:70px">${esc(item.note || '')}</textarea>
        </div>
      </div>
      <p class="err hidden" data-error></p>
    </form>
  `;
}

function openForm(store, rerender, existing = null) {
  const state = store.state;
  const { close } = openModal({
    title: existing ? '编辑作业' : '添加作业',
    wide: true,
    body: formHtml(state, existing || {}),
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>保存</button>`,
    onMount: (mask, { close }) => {
      const form = mask.querySelector('[data-form="assignment"]');
      const customWrap = mask.querySelector('[data-custom-wrap]');
      form.elements.courseId.addEventListener('change', () => {
        const isCustom = form.elements.courseId.value === '__custom';
        customWrap.classList.toggle('hidden', !isCustom);
      });
      customWrap.classList.toggle('hidden', form.elements.courseId.value !== '__custom');

      let attachments = [...((existing && existing.attachments) || [])];
      const listEl = mask.querySelector('[data-attach-list]');
      const fileInput = mask.querySelector('[data-attach-input]');

      const renderAttachments = () => {
        listEl.innerHTML = attachments.length
          ? attachments.map((file, index) => `
              <div class="attach-item">
                <a href="${esc(file.url)}" target="_blank" rel="noopener">📎 ${esc(file.name)}</a>
                <span class="text-xs dim">${Math.max(1, Math.round((file.size || 0) / 1024))} KB</span>
                <button class="btn ghost icon sm" type="button" data-remove-attach="${index}" aria-label="移除附件">×</button>
              </div>`).join('')
          : '<span class="text-xs dim">还没有附件</span>';
        listEl.querySelectorAll('[data-remove-attach]').forEach((btn) => {
          btn.addEventListener('click', () => {
            attachments.splice(Number(btn.dataset.removeAttach), 1);
            renderAttachments();
          });
        });
      };
      renderAttachments();

      fileInput.addEventListener('change', async () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        if (file.size > 8 * 1024 * 1024) {
          toast('附件不能超过 8 MB', { tone: 'error' });
          fileInput.value = '';
          return;
        }
        try {
          const dataUrl = await readAsDataUrl(file);
          const result = await api.uploadFile(file.name, dataUrl);
          attachments.push({ id: uid('att'), ...result.file });
          renderAttachments();
          fileInput.value = '';
          toast('附件已上传');
        } catch (err) {
          toast(`上传失败：${err.message}`, { tone: 'error' });
        }
      });

      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const title = form.elements.title.value.trim();
        const errorEl = mask.querySelector('[data-error]');
        if (!title) {
          errorEl.textContent = '标题不能为空';
          errorEl.classList.remove('hidden');
          return;
        }
        const isCustom = form.elements.courseId.value === '__custom';
        const course = (state.data.courses || []).find((c) => c.id === form.elements.courseId.value);
        const courseName = isCustom
          ? (form.elements.customName.value.trim() || '未分类')
          : (course ? course.name : '未分类');
        const rawGrade = form.elements.grade.value.trim();
        const grade = rawGrade === '' ? null : Number(rawGrade);
        if (rawGrade !== '' && (!Number.isFinite(grade) || grade < 0 || grade > 100)) {
          errorEl.textContent = '成绩要在 0–100 之间';
          errorEl.classList.remove('hidden');
          return;
        }
        const patch = {
          title,
          courseId: isCustom ? null : form.elements.courseId.value,
          courseName,
          dueAt: fromLocalInput(form.elements.dueAt.value),
          status: form.elements.status.value,
          grade,
          attachments,
          note: form.elements.note.value.trim(),
          updatedAt: new Date().toISOString()
        };
        if (patch.status === 'submitted' && !existing) patch.submittedAt = new Date().toISOString();

        store.update((d) => {
          if (existing) {
            const target = d.data.assignments.find((a) => a.id === existing.id);
            if (target) Object.assign(target, patch);
          } else {
            d.data.assignments.push({
              id: uid('a'), submittedAt: null, ...patch
            });
          }
        });
        close();
        rerender();
        toast(existing ? '作业已更新' : '作业已添加');
      });
    }
  });
}

function setStatus(store, rerender, id, status) {
  store.update((d) => {
    const item = d.data.assignments.find((a) => a.id === id);
    if (!item) return;
    item.status = status;
    item.updatedAt = new Date().toISOString();
    if (status === 'submitted' && !item.submittedAt) item.submittedAt = new Date().toISOString();
    if (status !== 'submitted') item.submittedAt = null;
  });
  rerender();
}

function openPasteImport(store, rerender) {
  const courses = store.state.data.courses || [];
  const options = [
    ...courses.map((course) => `<option value="${esc(course.name)}">${esc(course.name)}</option>`),
    '<option value="">未分类</option>'
  ].join('');

  const { close } = openModal({
    title: '粘贴导入作业',
    wide: true,
    body: `
      <div class="stack">
        <p class="hint">在学习通里打开作业详情，Ctrl+A 全选复制，粘贴到下面。只会读取作业名和「作答时间」，其它内容不保存。</p>
        <div class="field">
          <label>课程</label>
          <select class="select" name="course">${options}</select>
        </div>
        <div class="field">
          <label>详情页文字</label>
          <textarea class="textarea" name="text" style="min-height:140px" placeholder="作业20261020 (2.1)
作答时间：10-20 10:52 至 10-22 13:30"></textarea>
        </div>
        <p class="err hidden" data-error></p>
      </div>
    `,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>解析并导入</button>`,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const err = mask.querySelector('[data-error]');
        const error = (message) => {
          err.textContent = message;
          err.classList.remove('hidden');
        };

        const courseName = mask.querySelector('[name="course"]').value || '未分类';
        const parsed = parseAssignmentText(mask.querySelector('[name="text"]').value);

        if (!parsed.title) { error('没认出作业名，请把详情页顶部的标题一起复制'); return; }
        if (!parsed.matched) { error('没找到「作答时间」，请把含日期的整行一起复制'); return; }

        store.update((d) => {
          const list = d.data.assignments || [];
          const existing = list.find((item) => item.courseName === courseName && item.title === parsed.title);
          if (existing) {
            existing.startAt = parsed.startAt;
            existing.dueAt = parsed.dueAt;
            existing.updatedAt = new Date().toISOString();
          } else {
            list.push({
              id: uid('a'),
              courseName,
              courseId: null,
              title: parsed.title,
              startAt: parsed.startAt,
              dueAt: parsed.dueAt,
              status: 'todo',
              submittedAt: null,
              note: '',
              attachments: [],
              updatedAt: new Date().toISOString()
            });
          }
        });
        close();
        rerender();
        toast('作业已导入');
      });
    }
  });
}

export function bind(root, { store, rerender }) {
  root.addEventListener('click', async (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;
    const id = el.dataset.id;

    if (action === 'view') { viewMode = el.dataset.value; rerender(); return; }
    if (action === 'filter') { statusFilter = el.dataset.value; rerender(); return; }
    if (action === 'add') { openForm(store, rerender); return; }
    if (action === 'paste-import') { openPasteImport(store, rerender); return; }

    const item = store.state.data.assignments.find((a) => a.id === id);
    if (!item && action !== 'add') return;

    if (action === 'start') setStatus(store, rerender, id, 'doing');
    else if (action === 'submit') { setStatus(store, rerender, id, 'submitted'); toast('已标记为已交 🎉'); }
    else if (action === 'reopen') setStatus(store, rerender, id, 'doing');
    else if (action === 'edit') openForm(store, rerender, item);
    else if (action === 'del') {
      const ok = await confirmDialog({
        title: '删除作业',
        message: `确定删除「${item.title}」吗？`,
        confirmText: '删除',
        danger: true
      });
      if (!ok) return;
      const entry = makeTrashEntry('assignment', item, `${item.courseName || '未分类'} · ${item.title}`);
      store.update((d) => {
        d.data.assignments = d.data.assignments.filter((a) => a.id !== id);
        d.data.trash = [...(d.data.trash || []), entry];
      });
      rerender();
      toast('作业已移入回收站');
    }
  });
}
