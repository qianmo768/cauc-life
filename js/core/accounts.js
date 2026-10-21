// 多账户与账单导入
import { splitCsvLine } from './csv.js';

export const DEFAULT_ACCOUNT = { id: 'acc_default', name: '默认账户' };

export function accountsOf(state) {
  const list = state.data && state.data.budget ? state.data.budget.accounts : null;
  return Array.isArray(list) && list.length ? list : [DEFAULT_ACCOUNT];
}

export function accountName(state, id) {
  const found = accountsOf(state).find((account) => account.id === id);
  return found ? found.name : DEFAULT_ACCOUNT.name;
}

export function accountOfExpense(expense) {
  return expense && expense.accountId ? expense.accountId : DEFAULT_ACCOUNT.id;
}

export function accountTotals(state, monthKey) {
  const expenses = (state.data.budget.expenses || []).filter(
    (item) => String(item.date || '').slice(0, 7) === monthKey
  );
  const totals = new Map();
  for (const account of accountsOf(state)) totals.set(account.id, 0);
  for (const item of expenses) {
    const id = accountOfExpense(item);
    totals.set(id, (totals.get(id) || 0) + (Number(item.amount) || 0));
  }
  return accountsOf(state).map((account) => ({
    account,
    spent: Math.round((totals.get(account.id) || 0) * 100) / 100
  })).concat(
    accountsOf(state).some((account) => account.id === DEFAULT_ACCOUNT.id)
      ? []
      : [{
        account: DEFAULT_ACCOUNT,
        spent: Math.round((totals.get(DEFAULT_ACCOUNT.id) || 0) * 100) / 100
      }]
  ).filter((row) => row.spent > 0 || accountsOf(state).some((account) => account.id === row.account.id));
}

function normalizeDate(value) {
  const text = String(value || '').trim().replace(/[./]/g, '-');
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  if (!match) return null;
  const month = String(Number(match[2])).padStart(2, '0');
  const day = String(Number(match[3])).padStart(2, '0');
  return `${match[1]}-${month}-${day}`;
}

/** 账单 CSV：日期,金额,分类,账户,备注 */
export function parseBillCsv(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return { rows: [], errors: ['文件是空的'] };

  const header = splitCsvLine(lines[0]).map((cell) => cell.trim().toLowerCase());
  const indexOf = (...names) => {
    for (const name of names) {
      const index = header.indexOf(name);
      if (index >= 0) return index;
    }
    return -1;
  };
  const idx = {
    date: indexOf('日期', 'date'),
    amount: indexOf('金额', 'amount'),
    category: indexOf('分类', 'category'),
    account: indexOf('账户', 'account'),
    note: indexOf('备注', 'note')
  };
  if (idx.date < 0 || idx.amount < 0) {
    return { rows: [], errors: ['缺少「日期」或「金额」列'] };
  }

  const rows = [];
  const errors = [];
  lines.slice(1).forEach((line, i) => {
    const rowNumber = i + 2;
    const cells = splitCsvLine(line);
    const cell = (key) => (idx[key] >= 0 && cells[idx[key]] !== undefined ? String(cells[idx[key]]).trim() : '');

    const date = normalizeDate(cell('date'));
    if (!date) { errors.push(`第 ${rowNumber} 行：日期不正确`); return; }
    const amount = Number(cell('amount'));
    if (!Number.isFinite(amount) || amount <= 0) { errors.push(`第 ${rowNumber} 行：金额不正确`); return; }

    rows.push({
      date,
      amount: Math.round(amount * 100) / 100,
      category: cell('category') || '其他',
      account: cell('account'),
      note: cell('note')
    });
  });

  return { rows, errors };
}

/** 把导入行里的账户名映射成账户 id，缺的账户自动补建 */
export function mapBillAccounts(accounts, rows) {
  const list = [...(accounts || [])];
  const byName = new Map(list.map((account) => [account.name, account.id]));
  let counter = list.length;

  const mapped = rows.map((row) => {
    let accountId = DEFAULT_ACCOUNT.id;
    if (row.account) {
      if (!byName.has(row.account)) {
        counter += 1;
        const id = `acc_${counter}_${Date.now().toString(36)}`;
        list.push({ id, name: row.account });
        byName.set(row.account, id);
      }
      accountId = byName.get(row.account);
    } else if (list.length) {
      accountId = list[0].id;
    }
    return { ...row, accountId };
  });

  return { accounts: list, rows: mapped };
}
