import { api } from './api.js';
import { Store } from './store.js';
import { createRouter } from './router.js';
import { toast } from './ui/toast.js';
import { openDrawer, closeDrawer } from './ui/drawer.js';
import { closeModal } from './ui/modal.js';
import { openCommandPalette, openShortcutsHelp } from './ui/command.js';
import { icon, esc, uid } from './core/html.js';
import { timerElapsed } from './core/calc.js';
import { todayStr } from './core/date.js';
import { openQuickAdd } from './ui/quick-add.js';
import { applyTheme, applyBackground } from './ui/theme.js';
import { purgeTrash } from './core/trash.js';
import * as home from './views/home.js';
import * as classes from './views/classes.js';
import * as todos from './views/todos.js';
import * as homework from './views/homework.js';
import * as fitness from './views/fitness.js';
import * as budget from './views/budget.js';
import * as fun from './views/fun.js';
import * as settings from './views/settings.js';

const ICONS = {
  home: icon('<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/>'),
  classes: icon('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'),
  todos: icon('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m7.5 12 3 3 6-6"/>'),
  homework: icon('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  fitness: icon('<path d="M6 7v10M18 7v10M3 9v6M21 9v6M6 12h12"/>'),
  budget: icon('<rect x="3" y="6" width="18" height="14" rx="2"/><path d="M3 10h18"/><circle cx="16.5" cy="15" r="1"/>'),
  fun: icon('<rect x="2" y="7" width="20" height="11" rx="5"/><path d="M7 10v4M5 12h4"/><circle cx="16" cy="11.5" r="1"/><circle cx="18" cy="13.5" r="1"/>'),
  settings: icon('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M19.1 4.9 17 7M7 17l-2.1 2.1"/>')
};

export const NAV = [
  { name: 'home', label: '首页', title: '首页总览', sub: '今天该看什么，一屏看完', icon: ICONS.home },
  { name: 'classes', label: '课程', title: '今日课程', sub: '按星期和节次看课表', icon: ICONS.classes },
  { name: 'todos', label: '待办', title: '待办事务', sub: '短期的、要动手做的事', icon: ICONS.todos },
  { name: 'homework', label: '作业', title: '作业', sub: '截止时间与提交状态', icon: ICONS.homework },
  { name: 'fitness', label: '健身', title: '健身计划', sub: '练什么、练了没、坚持了多久', icon: ICONS.fitness },
  { name: 'budget', label: '花销', title: '每月花销规划', sub: '预算、记账、还剩多少', icon: ICONS.budget },
  { name: 'fun', label: '娱乐', title: '游戏娱乐', sub: '给玩乐留时间，也知道玩了多久', icon: ICONS.fun },
  { name: 'settings', label: '设置', title: '数据与设置', sub: '备份、主题与偏好', icon: ICONS.settings }
];

const TAB_ITEMS = [
  { name: 'home', label: '首页', icon: ICONS.home },
  { name: 'classes', label: '课表', icon: ICONS.classes },
  { name: 'todos', label: '待办', icon: ICONS.todos },
  { name: 'more', label: '更多', icon: ICONS.settings }
];

// 各路由对应的视图模块；里程碑推进时逐个替换
const VIEWS = {
  home,
  classes,
  todos,
  homework,
  fitness,
  budget,
  fun,
  settings
};

const app = document.getElementById('app');

// 背景图层：铺在整个应用下面，随设置更新
const bgLayer = document.createElement('div');
bgLayer.id = 'app-bg';
bgLayer.className = 'app-bg';
bgLayer.setAttribute('aria-hidden', 'true');
document.body.insertBefore(bgLayer, document.body.firstChild);

function navLink(item) {
  return `<a href="#/${item.name}" data-nav="${item.name}">
    <span class="icon">${item.icon}</span><span class="label">${esc(item.label)}</span>
  </a>`;
}

app.innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">
        <div class="brand-mark">🐟</div>
        <div>
          <div class="brand-name">校园生活小管家</div>
          <div class="brand-sub">只在这台电脑上跑</div>
        </div>
      </div>
      <nav class="nav">${NAV.map(navLink).join('')}</nav>
      <div class="sidebar-foot">
        <div class="text-xs dim" id="save-state">就绪</div>
      </div>
    </aside>
    <div class="main">
      <header class="topbar">
        <div class="grow">
          <h1 id="page-title">首页总览</h1>
          <div class="sub" id="page-sub"></div>
        </div>
        <div class="row" style="gap:8px">
          <button class="btn ghost sm topbar-search" type="button" data-action="open-search" title="搜索（Ctrl+K）">
            <span aria-hidden="true">🔍</span><span class="search-label">搜索</span><kbd>Ctrl K</kbd>
          </button>
          <button class="btn primary sm" data-action="quick-add">＋ 添加</button>
        </div>
      </header>
      <section class="view" id="view"></section>
    </div>
    <nav class="tabbar">
      <div class="tabs">
        ${TAB_ITEMS.map((t) => (t.name === 'more'
          ? `<button type="button" data-tab="more" data-action="open-more">
               <span class="icon">${t.icon}</span><span>${esc(t.label)}</span>
             </button>`
          : `<a href="#/${t.name}" data-tab="${t.name}">
               <span class="icon">${t.icon}</span><span>${esc(t.label)}</span>
             </a>`)).join('')}
      </div>
    </nav>
    <button class="fab" data-action="quick-add" aria-label="快速添加">＋</button>
  </div>
`;

let viewEl = document.getElementById('view');
const titleEl = document.getElementById('page-title');
const subEl = document.getElementById('page-sub');
const saveStateEl = document.getElementById('save-state');

const store = new Store({
  save: (db) => api.putDb(db),
  onStatus: (type, payload) => {
    if (!saveStateEl) return;
    if (type === 'saving') {
      saveStateEl.textContent = '保存中……';
    } else if (type === 'saved') {
      const t = new Date();
      saveStateEl.textContent = `已保存 · ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    } else if (type === 'error') {
      saveStateEl.textContent = '保存失败，请重试';
      toast(`保存失败：${payload && payload.message ? payload.message : '未知原因'}`, { tone: 'error', duration: 4000 });
    }
  }
});

let currentRoute = 'home';

function setActive(name) {
  document.querySelectorAll('[data-nav]').forEach((el) => {
    el.classList.toggle('active', el.dataset.nav === name);
  });
  document.querySelectorAll('[data-tab]').forEach((el) => {
    const key = el.dataset.tab;
    const active = key === name || (key === 'more' && ['homework', 'fitness', 'budget', 'fun', 'settings'].includes(name));
    el.classList.toggle('active', active);
  });
}

function renderRoute(name) {
  currentRoute = name;
  const item = NAV.find((n) => n.name === name) || NAV[0];
  titleEl.textContent = item.title;
  subEl.textContent = item.sub;
  setActive(name);

  const view = VIEWS[name] || VIEWS.home;
  const active = document.activeElement;
  const focusKey = active && active.dataset ? active.dataset.focusKey : null;
  const selectionStart = focusKey && typeof active.selectionStart === 'number' ? active.selectionStart : null;

  // 每次渲染换一个新的容器，避免视图在 #view 上叠加事件监听
  const fresh = document.createElement('section');
  fresh.id = 'view';
  fresh.className = 'view';
  viewEl.replaceWith(fresh);
  viewEl = fresh;

  viewEl.innerHTML = view.render(store.state, { title: item.title, route: name, store });
  if (typeof view.bind === 'function') view.bind(viewEl, { store, route: name, rerender: () => renderRoute(currentRoute) });

  if (focusKey) {
    const next = viewEl.querySelector(`[data-focus-key="${focusKey}"]`);
    if (next) {
      next.focus();
      if (selectionStart !== null && typeof next.setSelectionRange === 'function') {
        try { next.setSelectionRange(selectionStart, selectionStart); } catch { /* ignore */ }
      }
    }
  }
  window.scrollTo(0, 0);
}

const router = createRouter({
  routes: Object.fromEntries(NAV.map((n) => [n.name, n])),
  fallback: 'home',
  onChange: renderRoute
});

store.subscribe((state) => {
  applyTheme(state.data.settings.theme);
  applyBackground(state.data.settings);
  renderRoute(currentRoute);
});

// 全局快速添加与搜索
document.addEventListener('click', (event) => {
  const more = event.target.closest('[data-action="open-more"]');
  if (more) {
    event.preventDefault();
    const items = NAV.filter((n) => ['homework', 'fitness', 'budget', 'fun', 'settings'].includes(n.name));
    openDrawer(items, (name) => router.go(name));
    return;
  }

  const search = event.target.closest('[data-action="open-search"]');
  if (search) {
    event.preventDefault();
    openCommandPalette(store, { go: (name) => router.go(name) });
    return;
  }

  const trigger = event.target.closest('[data-action="quick-add"]');
  if (trigger) {
    event.preventDefault();
    openQuickAdd(store);
  }
});

// 键盘快捷键
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeModal();
    closeDrawer();
    return;
  }

  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    openCommandPalette(store, { go: (name) => router.go(name) });
    return;
  }

  const target = event.target;
  const typing = target && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable);
  if (typing) return;

  if (event.key === '/') {
    event.preventDefault();
    openCommandPalette(store, { go: (name) => router.go(name) });
  } else if (event.key === '?') {
    event.preventDefault();
    openShortcutsHelp();
  } else if (event.key === 'n' || event.key === 'N') {
    event.preventDefault();
    openQuickAdd(store);
  } else if (/^[1-9]$/.test(event.key)) {
    const item = NAV[Number(event.key) - 1];
    if (item) router.go(item.name);
  }
});

// 上次关页面时计时器还在跑：补一条记录并清空
function recoverRunningTimer(db) {  const timer = db.data.fun && db.data.fun.timer;
  if (!timer || !timer.running) return false;
  const seconds = timerElapsed(timer);
  const minutes = Math.max(1, Math.round(seconds / 60));
  db.data.fun.records.push({
    id: uid('f'),
    date: todayStr(),
    name: timer.name || '娱乐',
    type: timer.type || 'game',
    minutes
  });
  db.data.fun.timer = null;
  return true;
}

// 回收站只保留 30 天
function purgeOldTrash(db) {
  const before = (db.data.trash || []).length;
  db.data.trash = purgeTrash(db.data.trash);
  return db.data.trash.length !== before;
}

async function boot() {
  try {
    const db = await api.getDb();
    applyTheme(db.data.settings.theme);
    applyBackground(db.data.settings);
    const recovered = recoverRunningTimer(db);
    const purged = purgeOldTrash(db);
    store.init(db);
    if (recovered || purged) {
      store.update(() => {}, { notify: false });
      await store.flush().catch(() => {});
      if (recovered) toast('上次的计时已自动记下');
    }
    router.start();
  } catch (err) {
    viewEl.innerHTML = `
      <div class="card pad">
        <div class="empty">
          <div class="empty-icon">🫧</div>
          <p class="text-lg strong">连不上本机服务</p>
          <p class="text-sm dim">${esc(err.message || '请先启动 server.js，再刷新页面。')}</p>
          <p class="text-xs dim">在项目目录运行：node server.js</p>
        </div>
      </div>
    `;
  }
}

boot();
