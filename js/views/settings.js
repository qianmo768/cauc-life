import { esc } from '../core/html.js';
import { api } from '../api.js';
import { dataOverview, dataCounts } from '../core/calc.js';
import { openModal } from '../ui/modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';

function countText(counts) {
  const rows = [
    ['课程', counts.courses],
    ['待办', counts.todos],
    ['作业', counts.assignments],
    ['训练记录', counts.fitnessLogs],
    ['体重记录', counts.weights],
    ['花销记录', counts.expenses],
    ['娱乐记录', counts.funRecords],
    ['想玩清单', counts.wishlist]
  ];
  return rows.map(([label, value]) => `<div class="kv"><span>${label}</span><span class="num">${value} 条</span></div>`).join('');
}

function slotsText(state) {
  const slots = state.data.settings.slots || [];
  return slots.map((s) => `${s.index}. ${s.start}–${s.end}`).join('　');
}

export function render(state, ctx = {}) {
  const overview = dataOverview(state);
  const counts = dataCounts(state);
  const settings = state.data.settings;
  const lastExport = settings && state.data.meta && state.data.meta.lastExportAt;

  return `
    <div class="stack">
      <section class="card pad">
        <div class="card-title"><h3>数据概况</h3><span class="text-xs dim">${overview.count} 条数据</span></div>
        <div class="form-grid">${countText(counts)}</div>
        <div class="divider"></div>
        <div class="kv"><span>上次备份</span><span>${lastExport ? `${esc(String(lastExport).slice(0, 10))}（${overview.daysSinceExport} 天前）` : '还没备份过'}</span></div>
      </section>

      <section class="card pad">
        <div class="card-title"><h3>备份与恢复</h3></div>
        <div class="row wrap">
          <button class="btn primary" type="button" data-action="export">导出备份</button>
          <button class="btn" type="button" data-action="import">导入备份</button>
          <button class="btn" type="button" data-action="restore">从自动快照恢复</button>
        </div>
        <p class="hint" style="margin-top:8px">数据保存在本机，建议每周导出一次。</p>
      </section>

      <section class="card pad">
        <div class="card-title"><h3>外观</h3></div>
        <div class="segmented">
          ${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([value, label]) => `
            <button type="button" class="${settings.theme === value ? 'active' : ''}" data-action="theme" data-value="${value}">${label}</button>`).join('')}
        </div>
      </section>

      <section class="card pad">
        <div class="card-title"><h3>偏好</h3></div>
        <div class="form-grid">
          <div class="field">
            <label>学期起始日期</label>
            <input class="input" type="date" value="${esc(settings.semesterStart || '')}" data-change="semesterStart">
            <span class="hint">用来计算「第几周」</span>
          </div>
          <div class="field">
            <label>一周从哪天开始</label>
            <select class="select" data-change="weekStart">
              ${[1, 2, 3, 4, 5, 6, 7].map((d) => `<option value="${d}" ${Number(settings.weekStart) === d ? 'selected' : ''}>${weekdayLabel(d)}</option>`).join('')}
            </select>
          </div>
          <div class="field full">
            <label>节次时间</label>
            <div class="text-xs dim" style="line-height:1.8">${esc(slotsText(state))}</div>
            <button class="btn sm" type="button" data-action="edit-slots" style="align-self:flex-start;margin-top:6px">修改节次时间</button>
          </div>
        </div>
      </section>

      <section class="card pad">
        <div class="card-title"><h3>危险区</h3></div>
        <div class="row wrap">
          <button class="btn danger" type="button" data-action="clear-module">清空某个模块</button>
          <button class="btn solid-danger" type="button" data-action="clear-all">清空全部数据</button>
        </div>
        <p class="hint" style="margin-top:8px">清空前建议先导出一份备份。</p>
      </section>
    </div>
  `;
}

function weekdayLabel(d) {
  return ['周一', '周二', '周三', '周四', '周五', '周六', '周日'][Number(d) - 1] || '周一';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportDb(store) {
  const res = await fetch(api.exportUrl());
  if (!res.ok) throw new Error('导出失败');
  const disposition = res.headers.get('content-disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/);
  const filename = match ? match[1] : 'cauc-backup.json';
  downloadBlob(await res.blob(), filename);
  store.update((d) => { d.data.meta.lastExportAt = new Date().toISOString(); });
  toast('备份已导出');
}

function pickFile(callback) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    if (file) callback(file);
  });
  input.click();
}

async function importFlow(store) {
  pickFile(async (file) => {
    let payload;
    try {
      payload = JSON.parse(await file.text());
    } catch {
      toast('这个文件不是合法的 JSON', { tone: 'error', duration: 3000 });
      return;
    }
    const choice = await chooseImportMode();
    if (!choice) return;
    try {
      await api.importDb(choice, payload);
      const db = await api.getDb();
      store.init(db);
      toast(choice === 'merge' ? '已合并导入' : '已覆盖导入');
    } catch (err) {
      toast(`导入失败：${err.message}`, { tone: 'error', duration: 4000 });
    }
  });
}

function chooseImportMode() {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const { close } = openModal({
      title: '怎么导入？',
      body: '<p class="text-sm">覆盖：用文件里的数据替换当前全部数据。<br>合并：保留现有记录，只补充或更新文件里的内容。</p>',
      footer: `<button class="btn" type="button" data-cancel>取消</button>
               <button class="btn" type="button" data-merge>合并</button>
               <button class="btn primary" type="button" data-overwrite>覆盖</button>`,
      onClose: () => finish(null),
      onMount: (mask, { close }) => {
        mask.querySelector('[data-cancel]').addEventListener('click', () => { finish(null); close(); });
        mask.querySelector('[data-merge]').addEventListener('click', () => { finish('merge'); close(); });
        mask.querySelector('[data-overwrite]').addEventListener('click', () => { finish('overwrite'); close(); });
      }
    });
  });
}

async function restoreFlow(store) {
  let backups = [];
  try {
    backups = await api.listBackups();
  } catch (err) {
    toast(`读取快照失败：${err.message}`, { tone: 'error' });
    return;
  }
  if (!backups.length) {
    toast('还没有自动快照');
    return;
  }
  const { close } = openModal({
    title: '从快照恢复',
    body: `
      <p class="hint">恢复前会自动保存当前数据的一份快照。</p>
      <ul class="list" style="margin-top:8px">
        ${backups.slice(0, 15).map((b) => `
          <li class="list-item">
            <span class="grow mono text-sm">${esc(b.name)}</span>
            <span class="text-xs dim">${(b.size / 1024).toFixed(1)} KB</span>
            <button class="btn sm" type="button" data-restore="${esc(b.name)}">恢复</button>
          </li>`).join('')}
      </ul>
    `,
    footer: '<button class="btn" type="button" data-cancel>关闭</button>',
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelectorAll('[data-restore]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const name = btn.dataset.restore;
          const ok = await confirmDialog({
            title: '恢复快照',
            message: `用「${name}」替换当前数据？当前数据会先自动备份。`,
            confirmText: '恢复',
            danger: true
          });
          if (!ok) return;
          try {
            await api.restoreBackup(name);
            const db = await api.getDb();
            store.init(db);
            close();
            toast('已恢复');
          } catch (err) {
            toast(`恢复失败：${err.message}`, { tone: 'error' });
          }
        });
      });
    }
  });
}

function openSlotsEditor(store) {
  const slots = store.state.data.settings.slots || [];
  const { close } = openModal({
    title: '节次时间',
    wide: true,
    body: `
      <form class="stack" data-form="slots" onsubmit="return false">
        ${slots.map((s) => `
          <div class="row" style="gap:8px">
            <span style="width:52px">第 ${s.index} 节</span>
            <input class="input" type="time" name="start_${s.index}" value="${esc(s.start)}">
            <span class="dim">—</span>
            <input class="input" type="time" name="end_${s.index}" value="${esc(s.end)}">
          </div>`).join('')}
      </form>
    `,
    footer: `<button class="btn" type="button" data-cancel>取消</button>
             <button class="btn primary" type="button" data-save>保存</button>`,
    onMount: (mask, { close }) => {
      mask.querySelector('[data-cancel]').addEventListener('click', close);
      mask.querySelector('[data-save]').addEventListener('click', () => {
        const form = mask.querySelector('[data-form="slots"]');
        const next = slots.map((s) => ({
          index: s.index,
          start: form.elements[`start_${s.index}`].value || s.start,
          end: form.elements[`end_${s.index}`].value || s.end
        }));
        store.update((d) => { d.data.settings.slots = next; });
        close();
        toast('节次时间已保存');
      });
    }
  });
}

async function clearModule(store) {
  const modules = [
    ['courses', '课程'],
    ['todos', '待办'],
    ['assignments', '作业'],
    ['fitnessLogs', '训练记录'],
    ['weights', '体重记录'],
    ['expenses', '花销记录'],
    ['funRecords', '娱乐记录'],
    ['wishlist', '想玩清单'],
    ['notes', '备忘录']
  ];
  const choice = await new Promise((resolve) => {
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
    const { close } = openModal({
      title: '清空哪个模块',
      body: `<div class="col" style="gap:6px">${modules.map(([key, label]) => `
        <button class="btn" type="button" data-pick="${key}">${label}</button>`).join('')}</div>`,
      footer: '<button class="btn" type="button" data-cancel>取消</button>',
      onClose: () => finish(null),
      onMount: (mask, { close }) => {
        mask.querySelector('[data-cancel]').addEventListener('click', () => { finish(null); close(); });
        mask.querySelectorAll('[data-pick]').forEach((btn) => {
          btn.addEventListener('click', () => { finish(btn.dataset.pick); close(); });
        });
      }
    });
  });
  if (!choice) return;
  const label = (modules.find(([key]) => key === choice) || [])[1] || choice;
  const ok = await confirmDialog({
    title: '确认清空',
    message: `确定清空「${label}」吗？此操作不可撤销，建议先导出备份。`,
    confirmText: '清空',
    danger: true
  });
  if (!ok) return;
  store.update((d) => {
    if (choice === 'fitnessLogs') d.data.fitness.logs = [];
    else if (choice === 'weights') d.data.fitness.weights = [];
    else if (choice === 'expenses') d.data.budget.expenses = [];
    else if (choice === 'funRecords') d.data.fun.records = [];
    else if (choice === 'wishlist') d.data.fun.wishlist = [];
    else if (choice === 'notes') d.data.notes = { text: '', updatedAt: null };
    else d.data[choice] = [];
  });
  toast(`已清空${label}`);
}

async function clearAll(store) {
  const ok = await confirmDialog({
    title: '清空全部数据',
    message: '所有课程、待办、作业、训练、花销、娱乐和备忘都会被删除，设置会保留。确定吗？',
    confirmText: '全部清空',
    danger: true
  });
  if (!ok) return;
  store.update((d) => {
    d.data.courses = [];
    d.data.todos = [];
    d.data.assignments = [];
    d.data.fitness.logs = [];
    d.data.fitness.weights = [];
    d.data.budget.expenses = [];
    d.data.fun.records = [];
    d.data.fun.wishlist = [];
    d.data.notes = { text: '', updatedAt: null };
  });
  toast('数据已清空');
}

export function bind(root, { store, rerender }) {
  root.addEventListener('click', (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'export') exportDb(store).catch((err) => toast(`导出失败：${err.message}`, { tone: 'error' }));
    else if (action === 'import') importFlow(store);
    else if (action === 'restore') restoreFlow(store);
    else if (action === 'edit-slots') openSlotsEditor(store);
    else if (action === 'clear-module') clearModule(store);
    else if (action === 'clear-all') clearAll(store);
    else if (action === 'theme') {
      const value = el.dataset.value;
      document.documentElement.dataset.theme = value;
      store.update((d) => { d.data.settings.theme = value; });
    }
  });

  root.addEventListener('change', (event) => {
    const el = event.target.closest('[data-change]');
    if (!el) return;
    const key = el.dataset.change;
    const value = key === 'weekStart' ? Number(el.value) : el.value;
    store.update((d) => {
      if (key === 'weekStart') d.data.settings.weekStart = value;
      else if (key === 'semesterStart') d.data.settings.semesterStart = value || null;
    });
  });
}
