import { esc } from '../core/html.js';
import { fmtMoney, fmtDuration, todayStr, monthKeyOf } from '../core/date.js';
import {
  fitnessWeeklySeries, expenseMonthlySeries, funDailySeries,
  assignmentMonthStats, fitnessWeek, fitnessStreak, gradeStats, courseGradeSummary,
  yearMonthlySeries
} from '../core/calc.js';

function barChart(data, pick, format) {
  const values = data.map((item) => Number(pick(item)) || 0);
  const max = Math.max(...values, 1);
  return `
    <div class="bar-chart">
      ${data.map((item, i) => {
        const value = values[i];
        const height = Math.max(2, Math.round((value / max) * 100));
        return `
          <div class="bar-col" title="${esc(format ? format(value) : value)}">
            <span class="bar-value">${esc(format ? format(value) : value)}</span>
            <div class="bar" style="height:${height}%"></div>
            <span class="bar-label">${esc(item.label)}</span>
          </div>`;
      }).join('')}
    </div>
  `;
}

export function render(state, ctx = {}) {
  const today = todayStr();
  const week = fitnessWeek(state, today);
  const streak = fitnessStreak(state, today);
  const fitness = fitnessWeeklySeries(state, 8);
  const expenses = expenseMonthlySeries(state, 6);
  const fun = funDailySeries(state, 7);
  const homework = assignmentMonthStats(state, monthKeyOf(today));
  const grades = gradeStats(state);
  const courseGrades = courseGradeSummary(state);
  const year = Number(today.slice(0, 4));
  const yearly = yearMonthlySeries(state, year);
  const yearTotal = yearly.reduce((sum, item) => sum + item.total, 0);
  const totalFitness = fitness.reduce((sum, item) => sum + item.count, 0);
  const totalExpense = expenses.reduce((sum, item) => sum + item.total, 0);
  const totalFun = fun.reduce((sum, item) => sum + item.minutes, 0);

  return `
    <div class="stack">
      <div class="card pad">
        <div class="row" style="gap:22px;flex-wrap:wrap">
          <div class="stat"><span class="value num">${week.done}/${week.planned}</span><span class="label">本周训练</span></div>
          <div class="stat"><span class="value num">${streak}</span><span class="label">连续打卡</span></div>
          <div class="stat"><span class="value num">${fmtMoney(totalExpense)}</span><span class="label">半年花销</span></div>
          <div class="stat"><span class="value num">${fmtDuration(totalFun)}</span><span class="label">七天娱乐</span></div>
        </div>
      </div>

      <div class="stats-grid">
        <section class="card pad">
          <div class="card-title"><h3>近 8 周训练次数</h3><span class="text-xs dim">共 ${totalFitness} 次</span></div>
          ${barChart(fitness, (item) => item.count)}
        </section>

        <section class="card pad">
          <div class="card-title"><h3>近 6 个月花销</h3><span class="text-xs dim">共 ${fmtMoney(totalExpense)}</span></div>
          ${barChart(expenses, (item) => item.total, (value) => (value ? `¥${value.toFixed(0)}` : '0'))}
        </section>

        <section class="card pad">
          <div class="card-title"><h3>近 7 天娱乐时长</h3><span class="text-xs dim">共 ${fmtDuration(totalFun)}</span></div>
          ${barChart(fun, (item) => item.minutes, (value) => (value ? `${value}分` : '0'))}
        </section>

        <section class="card pad">
          <div class="card-title"><h3>本月作业提交</h3><span class="text-xs dim">${Number(monthKeyOf(today).slice(5))} 月</span></div>
          <div class="stat" style="margin-bottom:10px">
            <span class="value num">${homework.percent}%</span>
            <span class="label">已交 ${homework.submitted} / 共 ${homework.total}</span>
          </div>
          <div class="progress ${homework.percent >= 100 ? 'ok' : ''}"><i style="width:${homework.percent}%"></i></div>
          <p class="hint" style="margin-top:10px">${homework.total ? (homework.percent >= 100 ? '这个月的作业都交完了 🎉' : `还有 ${homework.total - homework.submitted} 项没交`) : '本月还没有登记作业'}</p>
        </section>

        <section class="card pad">
          <div class="card-title"><h3>成绩概览</h3><span class="text-xs dim">已录入 ${grades.count} 项</span></div>
          ${grades.count ? `
            <div class="row" style="gap:22px;flex-wrap:wrap">
              <div class="stat"><span class="value num">${grades.average}</span><span class="label">平均分</span></div>
              <div class="stat"><span class="value num">${grades.best}</span><span class="label">最高</span></div>
              <div class="stat"><span class="value num">${grades.worst}</span><span class="label">最低</span></div>
            </div>
            <div class="divider"></div>
            <div class="list">
              ${courseGrades.map((row) => `
                <div class="kv"><span>${esc(row.courseName)}</span><span class="num">${row.average} 分 · ${row.count} 项</span></div>`).join('')}
            </div>
          ` : '<p class="text-sm dim">还没有录入成绩。在作业的编辑弹层里可以填成绩。</p>'}
        </section>
      </div>

      <section class="card pad">
        <div class="card-title"><h3>${year} 年度花销</h3><span class="text-xs dim">共 ${fmtMoney(yearTotal)}</span></div>
        ${barChart(yearly, (item) => item.total, (value) => (value ? `¥${value.toFixed(0)}` : '0'))}
      </section>
    </div>
  `;
}

export function bind() {}
