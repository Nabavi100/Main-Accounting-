import { CloseButton } from './CloseButton';
import React, { useEffect, useState } from 'react';
import { Banknote } from 'lucide-react';
import { ReferenceTreasuryForm } from './ReferenceTreasuryForm';
import { ReferenceTreasuryList } from './ReferenceTreasuryList';
import type { NavTab } from './Sidebar';

type TreasuryTab = 'create_receipt' | 'list_receipts' | 'create_payment' | 'list_payments';
interface Props {
  initialTab?: TreasuryTab | 'cash_transfer';
  initialPartyId?: string;
  embeddedInCenter?: boolean;
  onViewInvoice?: (id: string) => void;
  onNavigate?: (tab: NavTab) => void;
}
const pages = {
  create_receipt: { title: 'ثبت دریافت (ورودی)', destination: 'new_receipt' },
  list_receipts: { title: 'لیست دریافت‌ها', destination: 'receipts_list' },
  create_payment: { title: 'ثبت پرداخت (خروجی)', destination: 'new_payment' },
  list_payments: { title: 'لیست پرداخت‌ها', destination: 'payments_list' },
} as const;

/** Sidebar shortcuts and shared center actions use the same real form/list destinations. */
export const ReceiptPaymentHubView: React.FC<Props> = ({ initialTab = 'create_receipt', initialPartyId, embeddedInCenter = false, onNavigate }) => {
  const [page, setPage] = useState<TreasuryTab>(initialTab === 'cash_transfer' ? 'create_payment' : initialTab);
  useEffect(() => { setPage(initialTab === 'cash_transfer' ? 'create_payment' : initialTab); }, [initialTab]);
  const navigate = (next: TreasuryTab) => { setPage(next); onNavigate?.(pages[next].destination); };
  const Heading = embeddedInCenter ? 'h2' : 'h1';
  return (
    <section className="reference-treasury" dir="rtl" aria-labelledby="treasury-page-title">
      <div className="treasury-page-heading app-page-form-heading">
        <div><Heading id="treasury-page-title"><Banknote aria-hidden="true" />{pages[page].title}</Heading>
        <p>ثبت و پیگیری اسناد مالی و کنترل ماندهٔ صندوق‌ها</p></div>
        {page.startsWith('create_') && <CloseButton label="بستن فرم" aria-label="بستن فرم خزانه و بازگشت به فهرست" onClick={() => navigate(page === 'create_receipt' ? 'list_receipts' : 'list_payments')} />}
      </div>
      <div className="treasury-panel">
        {page === 'create_receipt' ? <ReferenceTreasuryForm key="receipt-create" direction="receipt" initialPartyId={initialPartyId} onSaved={() => navigate('list_receipts')} />
          : page === 'create_payment' ? <ReferenceTreasuryForm key="payment-create" direction="payment" initialPartyId={initialPartyId} initialMode={initialTab === 'cash_transfer' ? 'transfer' : undefined} onSaved={() => navigate('list_payments')} />
          : <ReferenceTreasuryList key={page} direction={page === 'list_receipts' ? 'receipt' : 'payment'} onNew={() => navigate(page === 'list_receipts' ? 'create_receipt' : 'create_payment')} />}
      </div>
    </section>
  );
};
