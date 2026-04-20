import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportToExcel = (data: any[], fileName: string, sheetName: string = "Data") => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

type AutoTableUserOptions = Record<string, unknown>;

export const exportToPDF = (
  data: any[],
  title: string,
  fileName: string,
  columns: { title: string; dataKey: string }[],
  autoTableOverrides?: AutoTableUserOptions
) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  
  doc.setFontSize(18);
  doc.text(title, 40, 40);
  
  const date = new Date().toLocaleDateString();
  doc.setFontSize(10);
  doc.text(`Generated on: ${date}`, 40, 60);

  const body = data.map((row) => columns.map((c) => String(row[c.dataKey] ?? "")));
  
  autoTable(doc, {
    startY: 70,
    head: [columns.map(c => c.title)],
    body: body,
    theme: 'striped',
    headStyles: { fillColor: [67, 97, 238], textColor: [255, 255, 255] },
    margin: { left: 40, right: 40 },
    ...(autoTableOverrides || {}),
  });

  doc.save(`${fileName}.pdf`);
};

/** Excel: one sheet with header row + body — matches on-screen timetable (days × periods). */
export const exportTimetableGridToExcel = (
  headers: string[],
  bodyRows: string[][],
  fileName: string,
  sheetName: string = "Timetable"
) => {
  const safeName = String(sheetName).slice(0, 31) || "Timetable";
  const aoa = [headers, ...bodyRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const n = headers.length;
  ws["!cols"] = [{ wch: 14 }, ...Array.from({ length: Math.max(0, n - 1) }, () => ({ wch: 22 }))];
  const rowCount = aoa.length;
  ws["!rows"] = Array.from({ length: rowCount }, (_, r) => ({
    hpt: r === 0 ? 42 : 48,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

/** PDF: landscape A4, compact type; multiline cells use \\n (same grid as UI). */
export const exportTimetableGridToPDF = (
  title: string,
  headers: string[],
  bodyRows: string[][],
  fileName: string,
  autoTableOverrides?: AutoTableUserOptions
) => {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.text(title, 40, 34);
  doc.setFontSize(9);
  doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 40, 50);

  const colCount = headers.length;
  const fontSize = colCount > 12 ? 6 : colCount > 8 ? 7 : 8;
  /** Taller rows for readability; vertical padding only — column widths unchanged. */
  const padV = 5;
  const padH = 2;
  const bodyMinH = colCount > 12 ? 32 : 38;
  const headMinH = 28;

  autoTable(doc, {
    startY: 56,
    head: [headers],
    body: bodyRows,
    theme: "grid",
    styles: {
      fontSize,
      cellPadding: { top: padV, right: padH, bottom: padV, left: padH },
      overflow: "linebreak",
      valign: "top",
      minCellHeight: bodyMinH,
    },
    headStyles: {
      fillColor: [67, 97, 238],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      valign: "middle",
      cellPadding: { top: 6, right: padH, bottom: 6, left: padH },
      minCellHeight: headMinH,
    },
    margin: { left: 36, right: 36, bottom: 28 },
    tableWidth: pageW - 72,
    columnStyles: {
      0: { cellWidth: 52, halign: "left" },
    },
    ...(autoTableOverrides || {}),
  });

  doc.save(`${fileName}.pdf`);
};

export const printTimetableGrid = (title: string, headers: string[], bodyRows: string[][]) => {
  const w = window.open("", "_blank");
  if (!w) return;

  const head = `<thead><tr>${headers
    .map((h) => `<th>${escapeHtml(h).replace(/\n/g, "<br/>")}</th>`)
    .join("")}</tr></thead>`;
  const body = `<tbody>${bodyRows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell).replace(/\n/g, "<br/>")}</td>`).join("")}</tr>`
    )
    .join("")}</tbody>`;

  w.document.open();
  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 16px; color: #333; }
          h2 { font-size: 18px; margin-bottom: 12px; border-bottom: 2px solid #4361ee; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; table-layout: fixed; }
          th, td { border: 1px solid #e0e0e0; padding: 12px 8px; text-align: left; vertical-align: top; word-wrap: break-word; }
          th { background-color: #f8f9fa; font-weight: 600; color: #4361ee; }
          tr:nth-child(even) td { background-color: #fcfcfc; }
          @media print {
            body { padding: 0; }
            h2 { color: #000; }
            @page { size: landscape; }
          }
        </style>
      </head>
      <body>
        <h2>${escapeHtml(title)}</h2>
        <table>${head}${body}</table>
      </body>
    </html>
  `);
  w.document.close();

  setTimeout(() => {
    if (w && !w.closed) {
      w.focus();
      w.print();
      w.close();
    }
  }, 400);
};

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type PrintDataOptions = {
  /** Avoid repeating the table header on every printed page (one header at the top only). */
  singleHeaderOnPrint?: boolean;
};

export const printData = (
  title: string,
  columns: { title: string; dataKey: string }[],
  data: any[],
  options?: PrintDataOptions
) => {
  const w = window.open("", "_blank");
  if (!w) return;

  const head = `<thead><tr>${columns.map((c) => `<th>${escapeHtml(c.title)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${data.map((row) => 
    `<tr>${columns.map((c) => `<td>${escapeHtml(row[c.dataKey] ?? "")}</td>`).join("")}</tr>`
  ).join("")}</tbody>`;

  const printTheadCss =
    options?.singleHeaderOnPrint === true
      ? `@media print {
            thead { display: table-row-group; }
          }`
      : "";

  w.document.open();
  w.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8"/>
        <title>${escapeHtml(title)}</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 20px; color: #333; }
          h2 { font-size: 20px; margin-bottom: 15px; border-bottom: 2px solid #4361ee; padding-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
          th, td { border: 1px solid #e0e0e0; padding: 10px; text-align: left; }
          th { background-color: #f8f9fa; font-weight: 600; color: #4361ee; }
          tr:nth-child(even) { background-color: #fcfcfc; }
          @media print {
            body { padding: 0; }
            h2 { color: #000; boarder-color: #000; }
          }
          ${printTheadCss}
        </style>
      </head>
      <body>
        <h2>${escapeHtml(title)}</h2>
        <table>${head}${body}</table>
      </body>
    </html>
  `);
  w.document.close();

  setTimeout(() => {
    if (w && !w.closed) {
      w.focus();
      w.print();
      w.close();
    }
  }, 500);
};
