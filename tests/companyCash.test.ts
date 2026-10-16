import test from 'node:test';
import assert from 'node:assert/strict';
import type {
  CashRegisterAccount,
  CashRegisterState,
  ExpenseItem,
  FinancialTransaction,
  IncomeItem,
  Party,
} from '../src/types';
import {
  companyCashAccountId,
  companyCashConversion,
  companyCashTransaction,
  duplicateCompanyCashNumber,
  nextCompanyCashNumber,
  ownedCompanyCashSource,
  projectCompanyCashTransactions,
  syncCompanyCashTransaction,
  validateCompanyCashDocument,
} from '../src/utils/companyCash';
import {
  applyTransactionCashAccounts,
  applyTransactionCashRegister,
  applyTransactionParties,
} from '../src/utils/transactionLedger';
import {
  treasuryCategory,
  treasuryEntries,
  treasuryEntryCash,
} from '../src/utils/treasury';

const accounts: CashRegisterAccount[] = [
  {
    id: 'afn_cash',
    name: 'صندوق افغانی',
    currency: 'AFN',
    balance: 100,
    initialBalance: 100,
  },
  {
    id: 'usd_cash',
    name: 'صندوق دالری',
    currency: 'USD',
    balance: 20,
    initialBalance: 20,
  },
  {
    id: 'bank',
    name: 'بانک نمونه',
    currency: 'USD',
    balance: 7,
    initialBalance: 7,
  },
];
const register: CashRegisterState = {
  afnBalance: 100,
  usdBalance: 20,
  exchangeUsdBalance: 0,
  usdToAfnRate: 70,
};
const income: IncomeItem = {
  id: 'income-1',
  incomeNumber: 'INC-001',
  title: 'عاید خدمات',
  categoryId: 'service',
  amount: 25.123456,
  currency: 'AFN',
  date: '1405/07/23',
  cashRegisterId: 'afn_cash',
  payer: 'پرداخت‌کنندهٔ نمونه',
  createdAt: '2026-10-15T08:00:00Z',
};
const expense: ExpenseItem = {
  ...income,
  id: 'expense-1',
  expenseNumber: 'EXP-001',
  title: 'کرایهٔ حمل',
  amount: 150.654321,
  recipient: 'دریافت‌کنندهٔ نمونه',
};
const ordinary: FinancialTransaction = {
  id: 'ordinary',
  transactionNumber: '101',
  type: 'receive_payment',
  date: '1405/07/23',
  description: 'دریافت عادی',
  amount: 10,
  currency: 'USD',
  cashRegister: 'usd_cash',
  partyId: 'customer',
  createdAt: income.createdAt,
};

test('company income credits precisely one selected cash account and reverses exactly', () => {
  const tx = companyCashTransaction('income', income);
  const posted = applyTransactionCashAccounts(accounts, tx);
  assert.equal(posted[0].balance, 125.123456);
  assert.equal(posted[1].balance, 20);
  assert.equal(posted[2].balance, 7);
  assert.deepEqual(applyTransactionCashAccounts(posted, tx, true), accounts);
  const cash = applyTransactionCashRegister(register, tx);
  assert.equal(cash.afnBalance, 125.123456);
  assert.deepEqual(applyTransactionCashRegister(cash, tx, true), register);
});
test('expense preserves a permitted negative balance and does not manufacture funds on delete', () => {
  const tx = companyCashTransaction('expense', expense);
  const posted = applyTransactionCashAccounts(accounts, tx);
  assert.equal(posted[0].balance, -50.654321);
  assert.deepEqual(applyTransactionCashAccounts(posted, tx, true), accounts);
  const cash = applyTransactionCashRegister(register, tx);
  assert.equal(cash.afnBalance, -50.654321);
  assert.deepEqual(applyTransactionCashRegister(cash, tx, true), register);
});
test('bank income does not also increase the built-in USD register', () => {
  const tx = companyCashTransaction('income', {
    ...income,
    currency: 'USD',
    cashRegisterId: 'bank',
  });
  const posted = applyTransactionCashAccounts(accounts, tx);
  assert.equal(posted[2].balance, 32.123456);
  assert.equal(posted[1].balance, 20);
  assert.deepEqual(applyTransactionCashRegister(register, tx), register);
});
test('moving an expense to a different cashbox restores old cash before posting new cash', () => {
  const old = companyCashTransaction('expense', expense),
    next = companyCashTransaction('expense', {
      ...expense,
      cashRegisterId: 'bank',
      currency: 'USD',
      amount: 4.123456,
    });
  const moved = applyTransactionCashAccounts(
    applyTransactionCashAccounts(
      applyTransactionCashAccounts(accounts, old),
      old,
      true,
    ),
    next,
  );
  assert.equal(moved[0].balance, 100);
  assert.equal(moved[2].balance, 2.876544);
  assert.deepEqual(applyTransactionCashAccounts(moved, next, true), accounts);
});
test('income and expense mirrors never post a payer/payee to party receivables', () => {
  const parties = [
    {
      id: 'customer',
      name: income.payer,
      type: 'customer',
      phone: '',
      balanceUSD: -9,
      balanceAFN: -3,
      createdAt: income.createdAt,
    },
  ] as Party[];
  assert.deepEqual(
    applyTransactionParties(parties, companyCashTransaction('income', income)),
    parties,
  );
  assert.deepEqual(
    applyTransactionParties(
      parties,
      companyCashTransaction('expense', expense),
    ),
    parties,
  );
});
test('AFN/USD conversions retain six decimals in both directions', () => {
  assert.equal(
    companyCashConversion(1.123456, 'USD', 'AFN', 70.123456, true),
    78.780617,
  );
  assert.equal(companyCashConversion(1, 'AFN', 'USD', 65, true), 0.015385);
  assert.equal(
    companyCashConversion(0.123456, 'AFN', 'AFN', 0, false),
    0.123456,
  );
});
test('invalid exchange rates, unchecked mismatches and unsupported cross-quotes are rejected', () => {
  for (const rate of [0, -1, Infinity, NaN])
    assert.ok(
      Number.isNaN(companyCashConversion(100, 'USD', 'AFN', rate, true)),
    );
  assert.ok(Number.isNaN(companyCashConversion(100, 'USD', 'AFN', 65, false)));
  assert.ok(Number.isNaN(companyCashConversion(100, 'EUR', 'AFN', 65, true)));
  assert.equal(companyCashConversion(12, 'EUR', 'EUR', 0, false), 12);
});
test('nonfinite and nonpositive amounts cannot be converted into a cash posting', () => {
  for (const amount of [0, -1, Infinity, NaN])
    assert.ok(
      Number.isNaN(companyCashConversion(amount, 'AFN', 'AFN', 1, false)),
    );
});
test('source validation rejects unknown cashboxes and currency mismatch', () => {
  assert.equal(validateCompanyCashDocument(income, accounts), null);
  assert.ok(
    validateCompanyCashDocument(
      { ...income, cashRegisterId: 'missing' },
      accounts,
    ),
  );
  assert.ok(
    validateCompanyCashDocument(
      { ...income, cashRegisterId: 'usd_cash' },
      accounts,
    ),
  );
});
test('source validation rejects invalid amount/title/date before any posting', () => {
  for (const amount of [0, -1, Infinity, NaN])
    assert.ok(validateCompanyCashDocument({ ...income, amount }, accounts));
  assert.ok(validateCompanyCashDocument({ ...income, title: ' ' }, accounts));
  assert.ok(
    validateCompanyCashDocument({ ...income, date: '1405/13/40' }, accounts),
  );
});
test('legacy source documents without a cash ID resolve to their original built-in currency cashbox', () => {
  assert.equal(
    companyCashAccountId({ ...income, cashRegisterId: undefined }),
    'afn_cash',
  );
  assert.equal(
    companyCashAccountId({
      ...income,
      currency: 'USD',
      cashRegisterId: undefined,
    }),
    'usd_cash',
  );
});
test('legacy income transaction IDs resolve to their authoritative source', () => {
  const source = ownedCompanyCashSource(
    { id: `tx-inc-${income.id}` },
    [income],
    [expense],
  );
  assert.equal(source?.kind, 'income');
  assert.equal(source?.document.id, income.id);
  assert.equal(
    ownedCompanyCashSource(ordinary, [income], [expense]),
    undefined,
  );
});
test('explicit source ownership works independently of transaction ID', () => {
  assert.equal(
    ownedCompanyCashSource(
      { id: 'custom', expenseId: expense.id },
      [],
      [expense],
    )?.kind,
    'expense',
  );
});
test('projection surfaces old income and expense sources without mutating stored transactions or balances', () => {
  const stored = [ordinary];
  const before = structuredClone({
    stored,
    accounts,
    register,
    income,
    expense,
  });
  const projected = projectCompanyCashTransactions(stored, [income], [expense]);
  assert.equal(projected.length, 3);
  assert.equal(treasuryEntries(projected, 'receipt').length, 2);
  assert.equal(treasuryEntries(projected, 'payment').length, 1);
  assert.deepEqual({ stored, accounts, register, income, expense }, before);
});
test('projection de-duplicates stale legacy and explicit linked mirrors but preserves ordinary transactions', () => {
  const legacy = {
    ...companyCashTransaction('income', income),
    incomeId: undefined,
    amount: 1,
  };
  const duplicate = { ...legacy, id: 'old-duplicate', incomeId: income.id };
  const projected = projectCompanyCashTransactions(
    [ordinary, legacy, duplicate],
    [income],
    [expense],
  );
  assert.equal(projected.length, 3);
  assert.equal(projected.filter((tx) => tx.incomeId === income.id).length, 1);
  assert.equal(
    projected.find((tx) => tx.incomeId === income.id)?.amount,
    income.amount,
  );
  assert.ok(projected.includes(ordinary));
});
test('synchronization restores a missing source mirror without a second cash posting', () => {
  const synchronized = syncCompanyCashTransaction(
    [ordinary],
    'expense',
    expense,
  );
  assert.equal(synchronized.length, 2);
  assert.equal(synchronized[0].expenseId, expense.id);
  assert.equal(synchronized[0].type, 'expense');
  assert.equal(
    treasuryEntryCash(synchronized[0], 'payment', accounts).amount,
    expense.amount,
  );
});
test('synchronization retains mirror identity/creation time while refreshing its source number and amount', () => {
  const existing = {
    ...companyCashTransaction('income', income),
    id: 'custom-id',
    createdAt: '2020-01-01',
  };
  const updated = syncCompanyCashTransaction([existing, ordinary], 'income', {
    ...income,
    incomeNumber: 'INC-002',
    amount: 8,
  });
  assert.equal(updated[0].id, existing.id);
  assert.equal(updated[0].createdAt, existing.createdAt);
  assert.equal(updated[0].transactionNumber, 'INC-002');
  assert.equal(updated[0].amount, 8);
  assert.equal(updated[0].partyId, undefined);
});
test('source vouchers have independent canonical duplicate guards without overwriting old records', () => {
  assert.equal(duplicateCompanyCashNumber([income], 'income', 'INC-۰۰۱'), true);
  assert.equal(duplicateCompanyCashNumber([income], 'income', '1'), true);
  assert.equal(
    duplicateCompanyCashNumber([income], 'income', 'INC-001', income.id),
    false,
  );
  assert.equal(
    duplicateCompanyCashNumber([expense], 'expense', 'EXP-002'),
    false,
  );
});
test('next source numbers advance from existing historical numbers and preserve their own prefixes', () => {
  assert.equal(nextCompanyCashNumber([income], 'income'), 'INC-002');
  assert.equal(
    nextCompanyCashNumber(
      [{ ...expense, expenseNumber: 'Exp0025' }],
      'expense',
    ),
    'EXP-026',
  );
});
test('income/expense categories are distinct from personal/invoice receipts and payments', () => {
  assert.equal(
    treasuryCategory(companyCashTransaction('income', income)),
    'income',
  );
  assert.equal(
    treasuryCategory(companyCashTransaction('expense', expense)),
    'expense',
  );
  assert.equal(treasuryCategory(ordinary), 'personal');
});
