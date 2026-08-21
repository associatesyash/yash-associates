import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export function exportToExcel(
  rows: Record<string, any>[],
  filename: string,
  sheetName: string = 'Sheet1'
): void {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

export function exportMultiSheet(
  sheets: { name: string; rows: Record<string, any>[] }[],
  filename: string
): void {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, filename);
}

export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  filename: string,
  businessName: string = 'YASH ASSOCIATES'
): void {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text(businessName, 14, 20);
  doc.setFontSize(12);
  doc.text(title, 14, 28);
  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 34);

  autoTable(doc, {
    head: [headers],
    body: rows.map((r) => r.map((c) => String(c))),
    startY: 40,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [30, 58, 95] },
  });

  doc.save(filename);
}

export function printInvoice(
  businessInfo: { name: string; address: string; mobile: string; email: string; gstNumber: string },
  invoice: {
    invoiceNo: string;
    date: number;
    partyName: string;
    grandTotal: number;
    paymentReceived: number;
    outstanding: number;
    notes: string;
    paymentMode: string;
  },
  items: { productDesc: string; qty: number; unit: string; rate: number; discount: number; amount: number }[]
): void {
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;

  const dateStr = new Date(invoice.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const rowsHtml = items.map((item, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${item.productDesc}</td>
      <td style="text-align:right">${item.qty} ${item.unit}</td>
      <td style="text-align:right">₹${item.rate.toFixed(2)}</td>
      <td style="text-align:right">₹${item.discount.toFixed(2)}</td>
      <td style="text-align:right">₹${item.amount.toFixed(2)}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <html>
    <head>
      <title>Invoice ${invoice.invoiceNo}</title>
      <style>
        * { font-family: 'Inter', Arial, sans-serif; box-sizing: border-box; }
        body { padding: 40px; color: #1a1a1a; }
        .header { display: flex; justify-content: space-between; border-bottom: 3px solid #1e3a5f; padding-bottom: 20px; margin-bottom: 20px; }
        .biz-name { font-size: 24px; font-weight: bold; color: #1e3a5f; }
        .biz-info { font-size: 12px; color: #555; margin-top: 4px; }
        .invoice-title { font-size: 20px; font-weight: bold; text-align: right; }
        .invoice-meta { font-size: 12px; color: #555; text-align: right; margin-top: 4px; }
        .party-box { margin: 20px 0; padding: 12px; background: #f8f9fa; border-left: 4px solid #1e3a5f; }
        .party-label { font-size: 11px; color: #888; text-transform: uppercase; }
        .party-name { font-size: 16px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th { background: #1e3a5f; color: white; padding: 10px; text-align: left; font-size: 12px; }
        td { padding: 8px 10px; border-bottom: 1px solid #e0e0e0; font-size: 12px; }
        .totals { margin-left: auto; width: 300px; margin-top: 20px; }
        .totals-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; }
        .totals-row.grand { font-weight: bold; font-size: 16px; border-top: 2px solid #1e3a5f; padding-top: 10px; margin-top: 6px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #888; text-align: center; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <div class="biz-name">${businessInfo.name}</div>
          <div class="biz-info">${businessInfo.address || ''}</div>
          <div class="biz-info">${businessInfo.mobile ? 'Mob: ' + businessInfo.mobile : ''} ${businessInfo.email ? ' | ' + businessInfo.email : ''}</div>
          <div class="biz-info">${businessInfo.gstNumber ? 'GST: ' + businessInfo.gstNumber : ''}</div>
        </div>
        <div>
          <div class="invoice-title">INVOICE</div>
          <div class="invoice-meta"><strong>${invoice.invoiceNo}</strong></div>
          <div class="invoice-meta">Date: ${dateStr}</div>
        </div>
      </div>
      <div class="party-box">
        <div class="party-label">Bill To</div>
        <div class="party-name">${invoice.partyName}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width:40px">#</th>
            <th>Product</th>
            <th style="text-align:right">Qty</th>
            <th style="text-align:right">Rate</th>
            <th style="text-align:right">Disc</th>
            <th style="text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div class="totals">
        <div class="totals-row grand">
          <span>Grand Total</span>
          <span>₹${invoice.grandTotal.toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span>Payment Received (${invoice.paymentMode})</span>
          <span>₹${invoice.paymentReceived.toFixed(2)}</span>
        </div>
        <div class="totals-row">
          <span>Outstanding</span>
          <span>₹${invoice.outstanding.toFixed(2)}</span>
        </div>
      </div>
      ${invoice.notes ? `<p style="margin-top:20px;font-size:12px;"><strong>Notes:</strong> ${invoice.notes}</p>` : ''}
      <div class="footer">This is a computer generated invoice from ${businessInfo.name}</div>
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 250);
}
