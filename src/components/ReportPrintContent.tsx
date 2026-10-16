import React from 'react';
import { reportCellText, type ReportData } from '../utils/reportData';

export const ReportPrintContent: React.FC<{ report: ReportData }> = ({ report }) => <div dir="rtl" className="report-print-content">
  {report.sections.map((section, index) => <section key={index} style={{ marginBottom: 20 }}>
    <h2 style={{ fontSize: 14, fontWeight: 800, margin: '12px 0' }}>{section.title}</h2>
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, tableLayout: 'fixed' }}>
      <thead><tr>{section.headers.map((header, column) => <th key={column} style={{ border: '1px solid #a8bdcc', padding: 6, background: '#e0eff5', textAlign: 'right' }}>{header}</th>)}</tr></thead>
      <tbody>{section.rows.length ? section.rows.map((row, rowIndex) => <tr key={rowIndex}>{section.headers.map((_, column) => <td key={column} dir="auto" style={{ border: '1px solid #b9cbd4', padding: 6, textAlign: 'right', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{reportCellText(row[column])}</td>)}</tr>) : <tr><td colSpan={section.headers.length} style={{ textAlign: 'center', padding: 20 }}>بدون ردیف مطابق فیلتر</td></tr>}</tbody>
      {!!section.footer?.length && <tfoot>{section.footer.map((row, rowIndex) => <tr key={rowIndex}>{section.headers.map((_, column) => <td key={column} style={{ border: '1px solid #b9cbd4', padding: 6, fontWeight: 700 }}>{reportCellText(row[column])}</td>)}</tr>)}</tfoot>}
    </table>
  </section>)}
</div>;
