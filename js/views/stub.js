// 占位视图：后续里程碑逐个替换
export function render(state, ctx = {}) {
  const title = ctx.title || '这个模块';
  return `
    <div class="card pad">
      <div class="empty">
        <div class="empty-icon">🐟</div>
        <p class="text-lg strong">${title} 正在搭建中</p>
        <p class="text-sm dim">本鱼正在按计划施工，下个阶段就轮到这儿。</p>
      </div>
    </div>
  `;
}

export function bind() {}
