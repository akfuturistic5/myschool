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

  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  const isDateHeader = (header: string) => /^\d{4}-\d{2}-\d{2}$/.test(String(header || "").trim());
  const statusShort = (value: unknown) => {
    const s = String(value ?? "").trim().toLowerCase();
    if (!s || s === "not marked") return "";
    if (s === "present") return "P";
    if (s === "late") return "L";
    if (s === "absent") return "A";
    if (s === "holiday" || s === "weekly holiday") return "H";
    if (s === "half day" || s === "half_day") return "F";
    return s.slice(0, 1).toUpperCase();
  };
  const formatDayLabel = (header: string) => {
    const parts = String(header || "").split("-");
    return parts.length === 3 ? parts[2] : header;
  };

  const staticHeaders = headers.filter((h) => !isDateHeader(h));
  const dayHeaders = headers.filter((h) => isDateHeader(h));

  // For monthly attendance matrix, render clean landscape pages by chunking day columns.
  if (dayHeaders.length > 0) {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    const marginX = 30;
    const pageHeight = doc.internal.pageSize.getHeight();
    const sectionGap = 32;
    const firstPageStartY = 54;
    const continuationStartY = 64;
    let currentY = firstPageStartY;

    // Fixed ranges: 1-10, 11-20, 21-last day of month
    const dayChunks = [dayHeaders.slice(0, 10), dayHeaders.slice(10, 20), dayHeaders.slice(20)].filter(
      (chunk) => chunk.length > 0
    );

    for (let i = 0; i < dayChunks.length; i += 1) {
      const dayChunk = dayChunks[i];
      const chunkHeaders = [...staticHeaders, ...dayChunk];
      const startDay = i === 0 ? 1 : i === 1 ? 11 : 21;
      const endDay = startDay + dayChunk.length - 1;

      const body = rows.map((row) =>
        chunkHeaders.map((header) => {
          if (dayChunk.includes(header)) return statusShort(row[header]);
          return String(row[header] ?? "");
        })
      );

      const sectionTitle = `${title} (Days ${startDay}-${endDay})`;
      const estimatedRowHeight = 18;
      const estimatedHeadHeight = 24;
      const estimatedTitleHeight = 16;
      const estimatedTableHeight = estimatedTitleHeight + estimatedHeadHeight + rows.length * estimatedRowHeight + sectionGap;
      if (currentY + estimatedTableHeight > pageHeight - 20) {
        doc.addPage("a4", "landscape");
        currentY = continuationStartY;
      }

      doc.setFontSize(14);
      doc.text(sectionTitle, marginX, currentY - 14);

      autoTable(doc, {
        startY: currentY,
        margin: { left: marginX, right: marginX },
        head: [chunkHeaders.map((header) => (dayChunk.includes(header) ? formatDayLabel(header) : header))],
        body,
        styles: {
          fontSize: 8,
          cellPadding: 4,
          halign: "center",
          valign: "middle",
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [41, 128, 185],
          textColor: [255, 255, 255],
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: Object.fromEntries(
          chunkHeaders.map((header, index) => {
            if (header.toLowerCase() === "student") return [index, { halign: "left", cellWidth: 130 }];
            if (header.toLowerCase() === "rollno") return [index, { cellWidth: 55 }];
            if (dayChunk.includes(header)) return [index, { cellWidth: 24 }];
            return [index, { cellWidth: "auto" }];
          })
        ),
      });

      currentY = ((doc as any).lastAutoTable?.finalY || currentY) + sectionGap;
    }

    doc.save(`${filename}.pdf`);
    return;
  }

  const doc = new jsPDF();
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? "")));
  doc.text(title, 14, 14);
  autoTable(doc, {
    startY: 20,
    head: [headers],
    body,
    styles: { fontSize: 8, cellPadding: 4 },
    headStyles: {
      fillColor: [41, 128, 185],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
  });
  doc.save(`${filename}.pdf`);
};
