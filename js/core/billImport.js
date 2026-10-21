// 微信账单 → 花销记录：账户映射、去重、幂等 id

function hash(text) {
  let value = 5381;
  const str = String(text);
  for (let i = 0; i < str.length; i += 1) value = ((value << 5) + value + str.charCodeAt(i)) >>> 0;
  return value.toString(36);
}

export function billRecordKey(transaction) {
  if (transaction.billNo) return transaction.billNo;
  return `b_${hash(`${transaction.date}|${transaction.time}|${transaction.amount}|${transaction.note}`)}`;
}

export function mapBillAccounts(accounts, transactions) {
  const list = [...(accounts || [])];
  const byName = new Map(list.map((account) => [account.name, account.id]));

  const mapped = transactions.map((transaction) => {
    const name = transaction.accountName || '微信零钱';
    if (!byName.has(name)) {
      const id = `acc_bill_${hash(name)}`;
      list.push({ id, name });
      byName.set(name, id);
    }
    return { ...transaction, accountId: byName.get(name) };
  });

  return { accounts: list, transactions: mapped };
}

export function planBillImport(existingExpenses, transactions) {
  const seen = new Set(
    (existingExpenses || []).map((item) => item.billNo).filter(Boolean)
  );
  const fresh = [];
  let duplicates = 0;

  for (const transaction of transactions) {
    if (transaction.billNo && seen.has(transaction.billNo)) {
      duplicates += 1;
      continue;
    }
    fresh.push(transaction);
  }

  return { fresh, duplicates };
}

export function buildBillExpenses(transactions) {
  return transactions.map((transaction) => {
    const key = billRecordKey(transaction);
    return {
      id: `e_bill_${hash(key)}`,
      date: transaction.date,
      time: transaction.time || '',
      amount: transaction.amount,
      kind: transaction.kind || 'expense',
      category: transaction.category || '其他',
      note: transaction.note || '',
      accountId: transaction.accountId,
      billNo: transaction.billNo || key,
      status: transaction.status || '',
      updatedAt: new Date().toISOString()
    };
  });
}
