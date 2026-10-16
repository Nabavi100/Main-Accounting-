import test from "node:test";
import assert from "node:assert/strict";
import type {
  CashRegisterAccount,
  CashRegisterState,
  FinancialTransaction,
  Party,
} from "../src/types";
import {
  applyTransactionCashAccounts,
  applyTransactionCashRegister,
  applyTransactionParties,
  transactionCashAmount,
  transactionPartyDelta,
} from "../src/utils/transactionLedger";
import {
  convertTreasuryAmount,
  duplicateTreasuryNumber,
  nextTreasuryNumber,
  treasuryEntries,
  treasuryEntryCash,
  treasuryCategory,
  treasurySearchMatch,
} from "../src/utils/treasury";
const party: Party = {
  id: "p",
  name: "شخص نمونه",
  type: "both",
  phone: "",
  balanceUSD: -200,
  balanceAFN: 123.123456,
  createdAt: "2026-10-15",
};
const register: CashRegisterState = {
  usdBalance: 1000,
  afnBalance: 5000,
  exchangeUsdBalance: 10,
  usdToAfnRate: 65,
};
const accounts: CashRegisterAccount[] = [
  {
    id: "usd_cash",
    name: "دالری",
    currency: "USD",
    balance: 1000,
    initialBalance: 1000,
  },
  {
    id: "afn_cash",
    name: "افغانی",
    currency: "AFN",
    balance: 5000,
    initialBalance: 5000,
  },
  {
    id: "bank",
    name: "بانک",
    currency: "USD",
    balance: 10,
    initialBalance: 10,
  },
];
const document = (
  changes: Partial<FinancialTransaction> = {},
): FinancialTransaction => ({
  id: "t",
  transactionNumber: "1",
  type: "receive_payment",
  amount: 100,
  currency: "USD",
  cashRegister: "usd_cash",
  partyId: "p",
  date: "1405/07/23",
  createdAt: "2026-10-15T00:00:00Z",
  description: "تسویه",
  ...changes,
});

for (const type of ["receive_payment", "make_payment"] as const)
  test(`${type}: party, cash, discount and reversal are signed and independent`, () => {
    const tx = document({ type, discountAmount: 5.123456 });
    const sign = type === "receive_payment" ? 1 : -1;
    assert.equal(transactionPartyDelta(tx), sign * 105.123456);
    assert.equal(
      applyTransactionParties([party], tx)[0].balanceUSD,
      type === "receive_payment" ? -94.876544 : -305.123456,
    );
    assert.equal(
      applyTransactionCashAccounts(accounts, tx)[0].balance,
      1000 + sign * 100,
    );
    assert.deepEqual(
      applyTransactionParties(applyTransactionParties([party], tx), tx, true),
      [party],
    );
    assert.deepEqual(
      applyTransactionCashAccounts(
        applyTransactionCashAccounts(accounts, tx),
        tx,
        true,
      ),
      accounts,
    );
    assert.deepEqual(
      applyTransactionCashRegister(
        applyTransactionCashRegister(register, tx),
        tx,
        true,
      ),
      register,
    );
  });
test("cross-currency receipt settles USD debt while depositing only actual AFN cash", () => {
  const tx = document({
    isExchange: true,
    cashAmount: 6500,
    cashCurrency: "AFN",
    cashRegister: "afn_cash",
    discountAmount: 3,
  });
  assert.equal(applyTransactionParties([party], tx)[0].balanceUSD, -97);
  const cash = applyTransactionCashRegister(register, tx);
  assert.equal(cash.afnBalance, 11500);
  assert.equal(cash.usdBalance, 1000);
  assert.deepEqual(applyTransactionCashRegister(cash, tx, true), register);
});
test("six-decimal changes do not disappear under the old four-decimal zero threshold", () => {
  const tx = document({ amount: 0.000001 });
  assert.equal(applyTransactionParties([party], tx)[0].balanceUSD, -199.999999);
  assert.deepEqual(
    applyTransactionParties(applyTransactionParties([party], tx), tx, true),
    [party],
  );
});
test("advances cross zero and negative cash balances are never clamped away", () => {
  const tx = document({ type: "make_payment", amount: 2000 });
  assert.equal(applyTransactionCashAccounts(accounts, tx)[0].balance, -1000);
  assert.equal(
    applyTransactionParties([{ ...party, balanceUSD: 20 }], tx)[0].balanceUSD,
    -1980,
  );
});
test("same-currency transfer is conserved and reversible, without changing a party", () => {
  const tx = document({
    type: "cash_transfer",
    fromCashRegister: "usd_cash",
    toCashRegister: "bank",
    amount: 50,
    partyId: undefined,
  });
  const cash = applyTransactionCashAccounts(accounts, tx);
  assert.equal(cash[0].balance, 950);
  assert.equal(cash[2].balance, 60);
  assert.equal(
    cash.reduce((total, a) => total + a.balance, 0),
    accounts.reduce((total, a) => total + a.balance, 0),
  );
  assert.deepEqual(applyTransactionCashAccounts(cash, tx, true), accounts);
  assert.deepEqual(applyTransactionParties([party], tx), [party]);
});
test("cross-currency transfer posts explicit target amount and reverses both currencies", () => {
  const tx = document({
    type: "cash_transfer",
    fromCashRegister: "usd_cash",
    toCashRegister: "afn_cash",
    isExchange: true,
    targetAmount: 6500,
    targetCurrency: "AFN",
  });
  const cash = applyTransactionCashRegister(register, tx);
  assert.equal(cash.usdBalance, 900);
  assert.equal(cash.afnBalance, 11500);
  assert.deepEqual(applyTransactionCashRegister(cash, tx, true), register);
  assert.equal(treasuryEntryCash(tx, "receipt", accounts).amount, 6500);
  assert.equal(treasuryEntryCash(tx, "payment", accounts).amount, 100);
});
test("explicit zero cash/target amounts do not fall back to a different nominal amount", () => {
  assert.equal(
    transactionCashAmount(document({ isExchange: true, cashAmount: 0 })),
    0,
  );
  const tx = document({
    type: "cash_transfer",
    fromCashRegister: "usd_cash",
    toCashRegister: "afn_cash",
    isExchange: true,
    targetAmount: 0,
  });
  assert.equal(
    applyTransactionCashRegister(register, tx).afnBalance,
    register.afnBalance,
  );
});
test("unknown party currency does not leak into USD balances", () =>
  assert.deepEqual(
    applyTransactionParties([party], document({ currency: "EUR" })),
    [party],
  ));
test("inverse old / post new can change party, currency, cash account and discount exactly", () => {
  const old = document({ discountAmount: 2 });
  const next = document({
    type: "make_payment",
    currency: "AFN",
    amount: 25.123456,
    cashRegister: "afn_cash",
    discountAmount: 3,
  });
  const posted = applyTransactionParties([party], old);
  const edited = applyTransactionParties(
    applyTransactionParties(posted, old, true),
    next,
  );
  assert.deepEqual(applyTransactionParties(edited, next, true), [party]);
});
test("numbering is pure and duplicate matching accepts old prefixes, Persian digits and leading zeros", () => {
  const data = [document({ transactionNumber: "REC-009" })];
  assert.equal(nextTreasuryNumber(data, "receive_payment"), "10");
  assert.equal(nextTreasuryNumber(data, "receive_payment"), "10");
  assert.ok(duplicateTreasuryNumber(data, "receive_payment", "۰۰۹"));
  assert.equal(duplicateTreasuryNumber(data, "make_payment", "9"), false);
  assert.equal(
    duplicateTreasuryNumber(data, "receive_payment", "9", "t"),
    false,
  );
});
test("conversion rejects invalid rates without inventing a fallback quote", () => {
  assert.equal(convertTreasuryAmount(650, 1 / 65, 1), 10);
  assert.equal(convertTreasuryAmount(10, 1, 1 / 65), 650);
  assert.ok(Number.isNaN(convertTreasuryAmount(10, 0, 1)));
  assert.ok(Number.isNaN(convertTreasuryAmount(10, 1, -1)));
});
test("lists include a transfer in both cash directions and sort dates chronologically", () => {
  const old = document({ id: "old", date: "1405/07/22" }),
    newer = document({ id: "new", type: "cash_transfer" });
  assert.deepEqual(
    treasuryEntries([old, newer], "receipt").map((tx) => tx.id),
    ["new", "old"],
  );
  assert.deepEqual(
    treasuryEntries([old, newer], "payment").map((tx) => tx.id),
    ["new"],
  );
});
test("category and search filters use actual metadata without fabricated names or totals", () => {
  assert.equal(treasuryCategory(document({ discountAmount: 2 })), "discount");
  assert.equal(treasuryCategory(document({ invoiceId: "i" })), "invoice");
  assert.ok(
    treasurySearchMatch(
      document({ partyName: "شرکت نمونه", description: "پرداخت کرایه" }),
      "کرايه",
    ),
  );
});
