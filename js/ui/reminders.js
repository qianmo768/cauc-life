// 提醒中心：把到期作业、逾期待办、即将开始的课聚在一起
import { esc } from '../core/html.js';
import { collectReminders } from '../core/calc.js';
import { openModal } from './modal.js';

export function reminderCount(state, now = new Date()) {
  return collectReminders(state, now).length;
}

export function openReminderCenter(state, { go }) {
  const items = collectReminders(state, new Date());

  const body = items.length
    ? `<ul class="list">
        ${items.map((item) => `
          <li class="list-item">
            <span class="badge ${esc(item.tone)}">${esc(item.type)}</span>
            <span class="grow">${esc(item.title)}</span>
            <span class="text-xs dim">${esc(item.sub)}</span>
            <button class="btn sm" type="button" data-reminder-route="${esc(item.route)}">去看看</button>
          </li>`).join('')}
      </ul>`
    : `<div class="empty" style="padding:24px 8px">
         <div class="empty-icon">🌤️</div>
         <p class="text-sm dim">暂时没有需要提醒的事</p>
       </div>`;

  const { close } = openModal({
    title: '提醒',
    body,
    onMount: (mask, { close }) => {
      mask.querySelectorAll('[data-reminder-route]').forEach((btn) => {
        btn.addEventListener('click', () => {
          close();
          go(btn.dataset.reminderRoute);
        });
      });
    }
  });
}
