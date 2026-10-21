// 全局搜索面板（Ctrl+K）
import { esc } from '../core/html.js';
import { buildSearchIndex, searchItems, searchActions, TYPE_LABELS, NAV_ACTIONS } from '../core/search.js';
import { openModal } from './modal.js';

const SHORTCUTS = [
  ['Ctrl / ⌘ + K', '打开搜索'],
  ['/', '打开搜索'],
  ['N', '快速添加'],
  ['1 – 9', '切换模块'],
  ['Esc', '关闭弹层'],
  ['?', '查看快捷键']
];

export function openShortcutsHelp() {
  openModal({
    title: '键盘快捷键',
    body: `
      <div class="stack">
        ${SHORTCUTS.map(([key, desc]) => `
          <div class="kv"><span class="mono">${esc(key)}</span><span>${esc(desc)}</span></div>`).join('')}
      </div>
      <p class="hint" style="margin-top:10px">在输入框里打字时，单键快捷键不会生效。</p>
    `
  });
}

export function openCommandPalette(store, { go }) {
  const index = buildSearchIndex(store.state);
  let entries = [];
  let active = 0;

  const { close } = openModal({
    title: '搜索',
    body: `
      <div class="cmd">
        <input class="input cmd-input" id="cmd-input" autocomplete="off"
          placeholder="搜课程、待办、作业、花销、娱乐…（Esc 关闭）">
        <div class="cmd-results" id="cmd-results"></div>
      </div>
    `,
    onMount: (mask, api) => {
      const input = mask.querySelector('#cmd-input');
      const resultsEl = mask.querySelector('#cmd-results');

      const renderResults = () => {
        const q = input.value;
        const actions = q ? searchActions(q) : NAV_ACTIONS.map((a) => ({ ...a, route: a.route }));
        const items = searchItems(index, q, 8);
        entries = [
          ...actions.map((a) => ({ kind: 'nav', title: a.title, route: a.route, sub: '转到' })),
          ...items.map((item) => ({
            kind: 'item',
            type: item.type,
            title: item.title,
            sub: item.sub,
            route: item.route
          }))
        ];
        if (active >= entries.length) active = Math.max(0, entries.length - 1);

        resultsEl.innerHTML = entries.length
          ? entries.map((entry, i) => `
              <button class="cmd-item ${i === active ? 'active' : ''}" type="button" data-index="${i}">
                <span class="cmd-kind">${entry.kind === 'nav' ? '转到' : esc(TYPE_LABELS[entry.type] || '')}</span>
                <span class="grow cmd-title">${esc(entry.title)}</span>
                <span class="cmd-sub">${esc(entry.sub || '')}</span>
              </button>`).join('')
          : '<div class="empty" style="padding:24px 12px"><p class="text-sm dim">没有找到匹配的内容</p></div>';
      };

      const pick = (entry) => {
        if (!entry) return;
        api.close();
        go(entry.route);
      };

      input.addEventListener('input', () => {
        active = 0;
        renderResults();
      });

      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          active = Math.min(active + 1, entries.length - 1);
          renderResults();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          active = Math.max(active - 1, 0);
          renderResults();
        } else if (event.key === 'Enter') {
          event.preventDefault();
          pick(entries[active]);
        }
      });

      resultsEl.addEventListener('click', (event) => {
        const btn = event.target.closest('[data-index]');
        if (btn) pick(entries[Number(btn.dataset.index)]);
      });

      renderResults();
      setTimeout(() => input.focus(), 30);
    }
  });

  return { close };
}
