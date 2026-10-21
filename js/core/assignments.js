// 解析从学习通作业详情页复制的文本，只取：作业名、开始时间、截止时间

function inferYear(month, now) {
  const year = now.getFullYear();
  return month < now.getMonth() + 1 - 6 ? year + 1 : year;
}

function toIso(year, month, day, hour, minute) {
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  return date.toISOString();
}

/**
 * 输入样例：
 * 作业20261020 (2.1)
 * 题量：9   满分：100   作答时间：10-20 10:52 至 10-22 13:30
 */
export function parseAssignmentText(text, now = new Date()) {
  const raw = String(text || '');
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

  const match = /作答时间\s*[：:]\s*(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})\s*至\s*(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/.exec(raw);

  let startAt = null;
  let dueAt = null;
  if (match) {
    const startYear = inferYear(Number(match[1]), now);
    const endYear = inferYear(Number(match[5]), now);
    startAt = toIso(startYear, Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4]));
    dueAt = toIso(endYear, Number(match[5]), Number(match[6]), Number(match[7]), Number(match[8]));
  }

  const skip = /^(作答时间|题量|满分|剩余|已完成|待批阅|智能分析|一[、.]|二[、.]|三[、.]|四[、.])/;
  const titleLine = lines.find((line) => !skip.test(line)) || '';

  return {
    title: titleLine.trim(),
    startAt,
    dueAt,
    matched: Boolean(match)
  };
}
