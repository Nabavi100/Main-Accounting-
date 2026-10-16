import React, { useEffect, useState } from 'react';
import { CalendarDays, Clock3 } from 'lucide-react';
import { useAccounting } from '../context/AccountingContext';
import { formatWorkspaceRate, validCurrencyRate, workspaceDateTime } from '../utils/workspaceHeader';
import { CurrencyRateCalculator } from './CurrencyRateCalculator';

/** Only this small clock updates each second; invoice/treasury drafts are not remounted or recalculated. */
const WorkspaceDateTime: React.FC = () => {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const value = workspaceDateTime(now);
  return <div className="workspace-header-datetime" title={`${value.fullDate}؛ وقت کابل`}>
    <CalendarDays aria-hidden="true" /><time id="workspace-current-date" dateTime={value.iso} aria-label={`تاریخ امروز: ${value.fullDate}`} dir="ltr">{value.date}</time>
    <span className="workspace-header-time-divider" aria-hidden="true" />
    <Clock3 aria-hidden="true" /><time id="workspace-current-time" dateTime={value.iso} aria-label={`ساعت کابل: ${value.time}`} dir="ltr">{value.time}</time>
  </div>;
};
export const WorkspaceHeaderUtilities: React.FC = () => {
  const { cashRegister } = useAccounting();
  const rate = cashRegister.usdToAfnRate;
  return <div className="workspace-header-utilities">
    <WorkspaceDateTime />
    <span className="workspace-usd-quote" role="status" id="workspace-usd-rate" data-rate={validCurrencyRate(rate) ? rate : ''}
      aria-label={`نرخ ثبت‌شده دلار: ${formatWorkspaceRate(rate)} افغانی`} title="نرخ ثبت‌شدهٔ دلار در برنامه؛ نرخ آنلاین بازار نیست.">
      <bdi dir="ltr">1 $ = {formatWorkspaceRate(rate)} ؋</bdi>
    </span>
    <CurrencyRateCalculator compact />
  </div>;
};
