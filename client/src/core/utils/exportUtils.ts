import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export const exportToExcel = (data: any[], fileName: string, sheetName: string = "Data") => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const exportToPDF = (data: any[], title: string, fileName: string, columns: { title: string; dataKey: string }[]) => {
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
  });

  doc.save(`${fileName}.pdf`);
};

function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export const printData = (title: string, columns: { title: string; dataKey: string }[], data: any[]) => {
  const w = window.open("", "_blank");
  if (!w) return;

  const head = `<thead><tr>${columns.map((c) => `<th>${escapeHtml(c.title)}</th>`).join("")}</tr></thead>`;
  const body = `<tbody>${data.map((row) => 
    `<tr>${columns.map((c) => `<td>${escapeHtml(row[c.dataKey] ?? "")}</td>`).join("")}</tr>`
  ).join("")}</tbody>`;

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
