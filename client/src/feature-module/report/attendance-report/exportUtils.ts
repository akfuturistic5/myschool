import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

export const exportAttendanceExcel = (filename: string, rows: Record<string, any>[]) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No data available for Excel export.");
  }
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance");
  XLSX.writeFile(workbook, `${filename}.xlsx`);
};

export const exportAttendancePdf = (title: string, filename: string, rows: Record<string, any>[]) => {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No data available for PDF export.");
  }
  const doc = new jsPDF();
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));
  doc.text(title, 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [headers],
    body,
    styles: { fontSize: 8 },
  });
  doc.save(`${filename}.pdf`);
};
