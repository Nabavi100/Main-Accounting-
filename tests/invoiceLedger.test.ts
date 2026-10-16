import test from "node:test";
import assert from "node:assert/strict";
import type {
  CashRegisterAccount,
  CashRegisterState,
  Invoice,
  InvoiceType,
  Party,
} from "../src/types";
import {
  addInvoiceLedgerAmount,
  applyInvoiceCashAccounts,
  applyInvoiceCashRegister,
  applyInvoicePartyBalance,
  createTradeEntityId,
  invoiceCashDirection,
  invoiceStockDirection,
} from "../src/utils/invoiceLedger";

const party: Party = {
  id: "p",
  name: "شخص آزمایشی",
  phone: "",
  type: "both",
  balanceUSD: 12.25,
  balanceAFN: -500,
  createdAt: "2026-10-15",
};
const register: CashRegisterState = {
  usdBalance: 1000,
  afnBalance: 10000,
  exchangeUsdBalance: 20,
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
    id: "bank",
    name: "بانک",
    currency: "USD",
    balance: 100,
    initialBalance: 100,
  },
];
const invoice = (
  type: InvoiceType,
  overrides: Partial<Invoice> = {},
): Invoice => ({
  id: "i",
  invoiceNumber: "1",
  type,
  date: "1405/07/23",
  partyId: "p",
  partyName: party.name,
  currency: "USD",
  warehouseId: "w",
  items: [],
  subtotal: 100,
  discount: 0,
  totalAmount: 100,
  paidAmount: 10,
  balanceAmount: 90,
  paymentStatus: "partial",
  cashRegisterId: "usd_cash",
  createdAt: "2026-10-15",
  ...overrides,
});

for (const type of ["buy", "sell", "return_buy", "return_sell"] as const) {
  test(`${type}: party and cash posting / reversal preserve opening balances and do not mutate input`, () => {
    const document = invoice(type);
    const sign = type === "buy" || type === "return_sell" ? 1 : -1;
    assert.equal(invoiceStockDirection(type), sign);
    assert.equal(invoiceCashDirection(type), -sign);
    const updatedParty = applyInvoicePartyBalance([party], document);
    assert.equal(updatedParty[0].balanceUSD, 12.25 + sign * 90);
    assert.equal(updatedParty[0].balanceAFN, -500);
    assert.deepEqual(applyInvoicePartyBalance(updatedParty, document, true), [
      party,
    ]);
    assert.equal(
      applyInvoiceCashRegister(register, document).usdBalance,
      1000 - sign * 10,
    );
    assert.deepEqual(
      applyInvoiceCashRegister(
        applyInvoiceCashRegister(register, document),
        document,
        true,
      ),
      register,
    );
    assert.deepEqual(
      applyInvoiceCashAccounts(
        applyInvoiceCashAccounts(accounts, document),
        document,
        true,
      ),
      accounts,
    );
    assert.equal(party.balanceUSD, 12.25);
    assert.equal(register.usdBalance, 1000);
    assert.equal(accounts[0].balance, 1000);
  });
}

test("editing a USD purchase adds the replacement payable, rather than subtracting it", () => {
  const old = invoice("buy");
  const next = invoice("buy", {
    totalAmount: 150,
    paidAmount: 20,
    balanceAmount: 130,
  });
  const current = applyInvoicePartyBalance([party], old);
  assert.equal(
    applyInvoicePartyBalance(
      applyInvoicePartyBalance(current, old, true),
      next,
    )[0].balanceUSD,
    142.25,
  );
  const cash = applyInvoiceCashRegister(register, old);
  assert.equal(
    applyInvoiceCashRegister(applyInvoiceCashRegister(cash, old, true), next)
      .usdBalance,
    980,
  );
});

test("editing party / currency / cash account reverses the old ledger before applying the new one", () => {
  const second = { ...party, id: "q", balanceUSD: 0, balanceAFN: 0 };
  const old = invoice("sell");
  const next = invoice("buy", {
    partyId: "q",
    currency: "AFN",
    paidAmount: 650,
    totalAmount: 1300,
    balanceAmount: 650,
    cashRegisterId: "afn_cash",
  });
  const posted = applyInvoicePartyBalance([party, second], old);
  const replaced = applyInvoicePartyBalance(
    applyInvoicePartyBalance(posted, old, true),
    next,
  );
  assert.deepEqual(replaced[0], party);
  assert.equal(replaced[1].balanceAFN, 650);
  assert.equal(replaced[1].balanceUSD, 0);
  const cash = applyInvoiceCashRegister(
    applyInvoiceCashRegister(
      applyInvoiceCashRegister(register, old),
      old,
      true,
    ),
    next,
  );
  assert.equal(cash.usdBalance, 1000);
  assert.equal(cash.afnBalance, 9350);
});

test("overdrawn cash is not erased; deleting the invoice cannot manufacture money", () => {
  const buy = invoice("buy", {
    paidAmount: 1500,
    totalAmount: 1500,
    balanceAmount: 0,
  });
  const posted = applyInvoiceCashRegister(register, buy);
  assert.equal(posted.usdBalance, -500);
  assert.deepEqual(applyInvoiceCashRegister(posted, buy, true), register);
  const postedAccounts = applyInvoiceCashAccounts(accounts, buy);
  assert.equal(postedAccounts[0].balance, -500);
  assert.deepEqual(
    applyInvoiceCashAccounts(postedAccounts, buy, true),
    accounts,
  );
});

test("a custom bank account changes only that account, and credit invoices do not touch cash", () => {
  const bankInvoice = invoice("sell", { cashRegisterId: "bank" });
  assert.deepEqual(applyInvoiceCashRegister(register, bankInvoice), register);
  const changed = applyInvoiceCashAccounts(accounts, bankInvoice);
  assert.equal(changed[0].balance, 1000);
  assert.equal(changed[1].balance, 110);
  assert.strictEqual(
    applyInvoiceCashRegister(register, invoice("buy", { paidAmount: 0 })),
    register,
  );
});

test("six decimal ledger addition is reversible without small floating-point residuals", () => {
  assert.equal(addInvoiceLedgerAmount(0.1, 0.2), 0.3);
  assert.equal(
    addInvoiceLedgerAmount(addInvoiceLedgerAmount(5, -0.15), 0.15),
    5,
  );
  assert.equal(addInvoiceLedgerAmount(-1, -1), -2);
});

test("document IDs are unique even when date and randomness repeat on an insecure origin", () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const now = Date.now;
  const random = Math.random;
  try {
    Object.defineProperty(globalThis, "crypto", {
      value: undefined,
      configurable: true,
    });
    Date.now = () => 123456;
    Math.random = () => 0.5;
    const first = createTradeEntityId("inv");
    const second = createTradeEntityId("inv");
    assert.ok(first.startsWith("inv-"));
    assert.notEqual(first, second);
  } finally {
    Date.now = now;
    Math.random = random;
    if (descriptor) Object.defineProperty(globalThis, "crypto", descriptor);
    else delete (globalThis as any).crypto;
  }
});
