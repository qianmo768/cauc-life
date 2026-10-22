import { esc, uid } from '../core/html.js';
import { api } from '../api.js';
import { dataOverview, dataCounts } from '../core/calc.js';
import { coursesToCsv, parseCoursesCsv } from '../core/csv.js';
import { applyBackground, clampDim, clampBlur, isImageDataUrl } from '../ui/theme.js';
import { TRASH_KIND_LABELS, insertItem } from '../core/trash.js';
import { openModal } from '../ui/modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { toast } from '../ui/toast.js';
import { mergeDb } from '../core/merge.js';

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
  const bgImage = isImageDataUrl(settings.backgroundImage) ? settings.backgroundImage : null;
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
          ${api.isLocal() ? '' : '<button class="btn" type="button" data-action="restore">从自动快照恢复</button>'}
        </div>
        <p class="hint" style="margin-top:8px">${api.isLocal() ? '数据存在手机浏览器里，建议每周导出一次备份。' : '数据保存在本机，建议每周导出一次。'}</p>
      </section>

      <section class="card pad">
        <div class="card-title"><h3>课程表 CSV</h3><span class="text-xs dim">${(state.data.courses || []).length} 门课</span></div>
        <div class="row wrap">
          <button class="btn" type="button" data-action="export-csv">导出课程表</button>
          <button class="btn" type="button" data-action="import-csv">导入课程表</button>
        </div>
        <p class="hint" style="margin-top:8px">表头：课程名、老师、地点、星期、开始节、结束节、起始周、结束周、单双周、颜色、备注。</p>
      </section>

      <section class="card pad">
        <div class="card-title"><h3>回收站</h3><span class="text-xs dim">${(state.data.trash || []).length} 条</span></div>
        ${(state.data.trash || []).length ? `
          <ul class="list">
            ${state.data.trash.slice().reverse().slice(0, 20).map((entry) => `
              <li class="list-item">
                <span class="tag">${esc(TRASH_KIND_LABELS[entry.kind] || '其他')}</span>
                <span class="grow">${esc(entry.label)}</span>
                <span class="text-xs dim">${esc(String(entry.deletedAt).slice(0, 10))}</span>
                <button class="btn sm" type="button" data-action="trash-restore" data-id="${esc(entry.id)}">恢复</button>
                <button class="btn sm ghost" type="button" data-action="trash-delete" data-id="${esc(entry.id)}">彻底删除</button>
              </li>`).join('')}
          </ul>
          <div class="row" style="margin-top:8px">
            <button class="btn sm danger" type="button" data-action="trash-clear">清空回收站</button>
          </div>
        ` : '<p class="text-sm dim">回收站是空的。删除的待办、作业、花销和娱乐记录会在这里保留 30 天。</p>'}
      </section>

      <section class="card pad">
        <div class="card-title"><h3>外观</h3></div>
        <div class="segmented">
          ${[['auto', '跟随系统'], ['light', '浅色'], ['dark', '深色']].map(([value, label]) => `
            <button type="button" class="${settings.theme === value ? 'active' : ''}" data-action="theme" data-value="${value}">${label}</button>`).join('')}
        </div>
      </section>

      <section class="card pad">
        <div class="card-title">
          <h3>背景图</h3>
          ${bgImage ? '<span class="badge ok">已设置</span>' : '<span class="text-xs dim">未设置</span>'}
        </div>
        <div class="row wrap">
          <button class="btn" type="button" data-action="pick-bg">选择图片</button>
          ${bgImage ? '<button class="btn danger" type="button" data-action="clear-bg">移除背景</button>' : ''}
        </div>
        ${bgImage ? `<div class="bg-preview" style="background-image:url('${bgImage}')"></div>` : ''}
        <div class="field" style="margin-top:12px;max-width:380px">
          <label>遮罩暗度 <span id="dim-val">${clampDim(settings.backgroundDim)}%</span></label>
          <input class="range" type="range" min="0" max="80" step="5" value="${clampDim(settings.backgroundDim)}" data-change="backgroundDim">
          <span class="hint">图片会裁剪铺满屏幕，暗一点文字更清楚。</span>
        </div>
        <div class="field" style="margin-top:10px;max-width:380px">
          <label>模糊强度 <span id="blur-val">${clampBlur(settings.backgroundBlur)}px</span></label>
          <input class="range" type="range" min="0" max="20" step="1" value="${clampBlur(settings.backgroundBlur)}" data-change="backgroundBlur">
          <span class="hint">糊一点更像壁纸，也更容易看清字。</span>
        </div>
      </section>

      <section class="card pad">
        <div class="card-title"><h3>${api.isLocal() ? '本地数据' : '手机访问'}</h3><span class="text-xs dim">${api.isLocal() ? '存在手机里' : '同一 WiFi'}</span></div>
        <div id="lan-list" class="stack" style="gap:6px">
          <p class="text-sm dim">正在获取地址……</p>
        </div>
        <p class="hint" style="margin-top:8px">${api.isLocal()
          ? 'PWA 本地模式：数据存在这台手机的浏览器里，不需要电脑。换手机或清理浏览器数据前，记得先导出备份。'
          : '手机连同一个 WiFi，用浏览器打开上面的地址；可以「添加到主屏幕」当 App 用。校园网若开了客户端隔离，改用手机热点让电脑连接。'}</p>
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
  if (api.isLocal()) {
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    const blob = new Blob([JSON.stringify(store.state, null, 2)], { type: 'application/json' });
    downloadBlob(blob, `cauc-backup-${stamp}.json`);
    store.update((d) => { d.data.meta.lastExportAt = new Date().toISOString(); });
    toast('备份已导出');
    return;
  }
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
    if (api.isLocal()) {
      try {
        const next = choice === 'merge' ? mergeDb(store.state, payload) : payload;
        if (!next || !next.data) throw new Error('文件缺少 data');
        store.replace(next);
        await store.flush();
        toast(choice === 'merge' ? '已合并导入' : '已覆盖导入');
      } catch (err) {
        toast(`导入失败：${err.message}`, { tone: 'error', duration: 4000 });
      }
      return;
    }
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
  if (api.isLocal()) {
    toast('本地模式没有自动快照，请用「导出备份」');
    return;
  }
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

// ---------- 背景图 ----------

const MAX_SOURCE_BYTES = 30 * 1024 * 1024;
const MAX_STORED_CHARS = 3.8 * 1024 * 1024;

/** 把图片缩到 1600px 宽以内并转成 JPEG，控制数据体积 */
export function compressImage(file, maxWidth = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const scale = Math.min(1, maxWidth / img.width);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } catch (err) {
        reject(err);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}

export function pickBackground(store) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    if (file.size > MAX_SOURCE_BYTES) {
      toast('图片太大了，请选 30 MB 以内的', { tone: 'error', duration: 3000 });
      return;
    }
    try {
      const dataUrl = await compressImage(file);
      if (dataUrl.length > MAX_STORED_CHARS) {
        toast('压缩后还是太大，换一张小一点的图片吧', { tone: 'error', duration: 3000 });
        return;
      }
      store.update((d) => { d.data.settings.backgroundImage = dataUrl; });
      toast('背景图已更新');
    } catch {
      toast('这张图片读不出来，换一张试试', { tone: 'error' });
    }
  });
  input.click();
}

export function clearBackground(store) {
  store.update((d) => { d.data.settings.backgroundImage = null; });
  toast('已恢复纯色背景');
}

// ---------- 回收站 ----------

export function restoreTrash(store, id) {
  const entry = (store.state.data.trash || []).find((t) => t.id === id);
  if (!entry) return;
  store.update((d) => {
    insertItem(d.data, entry.kind, entry.item);
    d.data.trash = (d.data.trash || []).filter((t) => t.id !== id);
  });
  toast('已恢复');
}

export async function deleteTrash(store, id) {
  const entry = (store.state.data.trash || []).find((t) => t.id === id);
  if (!entry) return;
  const ok = await confirmDialog({
    title: '彻底删除',
    message: `「${entry.label}」将无法恢复，确定吗？`,
    confirmText: '彻底删除',
    danger: true
  });
  if (!ok) return;
  store.update((d) => {
    d.data.trash = (d.data.trash || []).filter((t) => t.id !== id);
  });
  toast('已彻底删除');
}

export async function clearTrash(store) {
  const count = (store.state.data.trash || []).length;
  if (!count) return;
  const ok = await confirmDialog({
    title: '清空回收站',
    message: `回收站里的 ${count} 条内容将被彻底删除，无法恢复。`,
    confirmText: '清空',
    danger: true
  });
  if (!ok) return;
  store.update((d) => { d.data.trash = []; });
  toast('回收站已清空');
}

// ---------- 课程表 CSV ----------

export function exportCourses(store) {
  const csv = coursesToCsv(store.state.data.courses || []);
  downloadBlob(
    new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
    `cauc-courses-${new Date().toISOString().slice(0, 10)}.csv`
  );
  toast('课程表已导出');
}

function chooseCsvMode(count) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const { close } = openModal({
      title: '导入课程表',
      body: `<p class="text-sm">读到 ${count} 门课程。追加会保留现有课表，覆盖会先清空现有课程。</p>`,
      footer: `<button class="btn" type="button" data-cancel>取消</button>
               <button class="btn" type="button" data-append>追加</button>
               <button class="btn primary" type="button" data-replace>覆盖</button>`,
      onClose: () => finish(null),
      onMount: (mask, { close }) => {
        mask.querySelector('[data-cancel]').addEventListener('click', () => { finish(null); close(); });
        mask.querySelector('[data-append]').addEventListener('click', () => { finish('append'); close(); });
        mask.querySelector('[data-replace]').addEventListener('click', () => { finish('replace'); close(); });
      }
    });
  });
}

export function importCourses(store) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,text/csv';
  input.addEventListener('change', async () => {
    const file = input.files && input.files[0];
    if (!file) return;
    let result;
    try {
      result = parseCoursesCsv(await file.text());
    } catch {
      toast('这个 CSV 读不出来', { tone: 'error' });
      return;
    }
    if (!result.courses.length) {
      toast(result.errors[0] || '没有可导入的课程', { tone: 'error', duration: 3500 });
      return;
    }
    if (result.errors.length) {
      toast(`有 ${result.errors.length} 行被跳过：${result.errors[0]}`, { duration: 4000 });
    }
    const mode = await chooseCsvMode(result.courses.length);
    if (!mode) return;
    store.update((d) => {
      const withIds = result.courses.map((course) => ({ id: uid('c'), ...course }));
      d.data.courses = mode === 'replace' ? withIds : [...(d.data.courses || []), ...withIds];
    });
    toast(`已导入 ${result.courses.length} 门课程`);
  });
  input.click();
}

async function copyText(text) {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* 继续用兜底方案 */ }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function loadLanInfo(root) {
  const box = root.querySelector('#lan-list');
  if (!box) return;

  if (api.isLocal()) {
    box.innerHTML = '<p class="text-sm dim">本地模式：数据保存在这台手机的浏览器里，不需要电脑。</p>';
    return;
  }

  api.info().then((info) => {
    const urls = info.lanUrls || [];
    if (!urls.length) {
      box.innerHTML = '<p class="text-sm dim">没检测到局域网地址，检查一下 WiFi。</p>';
      return;
    }
    box.innerHTML = urls.map((url) => `
      <div class="row-between" style="gap:8px">
        <code class="text-sm">${esc(url)}</code>
        <button class="btn sm" type="button" data-copy-url="${esc(url)}">复制</button>
      </div>`).join('');

    box.querySelectorAll('[data-copy-url]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const ok = await copyText(btn.dataset.copyUrl);
        if (ok) toast('地址已复制');
        else toast('复制失败，请手动选中', { tone: 'error' });
      });
    });
  }).catch(() => {
    box.innerHTML = '<p class="text-sm dim">读取地址失败。</p>';
  });
}

export function bind(root, { store, rerender }) {
  loadLanInfo(root);

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
    else if (action === 'pick-bg') pickBackground(store);
    else if (action === 'clear-bg') clearBackground(store);
    else if (action === 'trash-restore') restoreTrash(store, el.dataset.id);
    else if (action === 'trash-delete') deleteTrash(store, el.dataset.id);
    else if (action === 'trash-clear') clearTrash(store);
    else if (action === 'export-csv') exportCourses(store);
    else if (action === 'import-csv') importCourses(store);
    else if (action === 'theme') {
      const value = el.dataset.value;
      document.documentElement.dataset.theme = value;
      store.update((d) => { d.data.settings.theme = value; });
    }
  });

  root.addEventListener('input', (event) => {
    const dimEl = event.target.closest('[data-change="backgroundDim"]');
    if (dimEl) {
      const value = clampDim(dimEl.value);
      store.update((d) => { d.data.settings.backgroundDim = value; }, { notify: false });
      applyBackground(store.state.data.settings);
      const label = root.querySelector('#dim-val');
      if (label) label.textContent = `${value}%`;
      return;
    }

    const blurEl = event.target.closest('[data-change="backgroundBlur"]');
    if (blurEl) {
      const value = clampBlur(blurEl.value);
      store.update((d) => { d.data.settings.backgroundBlur = value; }, { notify: false });
      applyBackground(store.state.data.settings);
      const label = root.querySelector('#blur-val');
      if (label) label.textContent = `${value}px`;
    }
  });

  root.addEventListener('change', (event) => {
    const el = event.target.closest('[data-change]');
    if (!el) return;
    if (el.dataset.change === 'backgroundDim' || el.dataset.change === 'backgroundBlur') return;
    const key = el.dataset.change;
    const value = key === 'weekStart' ? Number(el.value) : el.value;
    store.update((d) => {
      if (key === 'weekStart') d.data.settings.weekStart = value;
      else if (key === 'semesterStart') d.data.settings.semesterStart = value || null;
    });
  });
}
