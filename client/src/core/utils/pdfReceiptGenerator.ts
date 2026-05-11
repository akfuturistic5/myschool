
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

/**
 * High-fidelity Fee Receipt PDF Generator
 * Matches the official document branding established in the Exam module.
 * Primary Colors: Dark Blue (#1a337e) and Gold (#f8c12e)
 */

interface ReceiptData {
  school: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo_url?: string;
  };
  student: {
    name: string;
    admission_number: string;
    roll_number?: string;
    class_name: string;
    section_name: string;
  };
  academic_year: string;
  payment: {
    receipt_no: string;
    date: string;
    payment_mode: string;
    remarks?: string;
    items: Array<{
      fee_type: string;
      amount: number;
    }>;
    total_paid: number;
    fine_paid?: number;
    new_balance?: number;
  };
}

export const generateFeeReceipt = async (data: ReceiptData) => {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "pt",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const blueColor = [26, 51, 126]; // #1a337e
  const goldColor = [248, 193, 46]; // #f8c12e

  // Helper to draw horizontal gold divider
  const drawDivider = (y: number) => {
    doc.setDrawColor(goldColor[0], goldColor[1], goldColor[2]);
    doc.setLineWidth(1.5);
    doc.line(margin, y, pageWidth - margin, y);
  };

  // --- 1. Header Section ---
  let currentY = 50;

  // School Logo (Placeholder logic if no logo)
  if (data.school.logo_url) {
    try {
      // Note: In a real browser environment, you'd fetch the image as a base64 string
      // For now, we'll reserve space and use text if it fails
      doc.addImage(data.school.logo_url, "PNG", margin, currentY, 50, 50);
    } catch (e) {
      doc.setFillColor(blueColor[0], blueColor[1], blueColor[2]);
      doc.rect(margin, currentY, 50, 50, "F");
    }
  } else {
    doc.setFillColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.rect(margin, currentY, 50, 50, "F");
  }

  // School Info
  doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text(data.school.name.toUpperCase(), margin + 65, currentY + 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(data.school.address, margin + 65, currentY + 30);
  doc.text(`Phone: ${data.school.phone} | Email: ${data.school.email}`, margin + 65, currentY + 42);

  currentY += 70;
  drawDivider(currentY);
  currentY += 25;

  // --- 2. Receipt Title & Receipt Metadata ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
  doc.text("FEE RECEIPT", pageWidth / 2, currentY, { align: "center" as const });
  
  doc.setFontSize(10);
  doc.text(`Academic Year: ${data.academic_year}`, pageWidth - margin, currentY, { align: "right" as const });

  currentY += 20;

  // Metadata Grid
  const gridY = currentY;
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");

  // Left Column
  doc.text("Receipt No:", margin, currentY + 15);
  doc.text("Payment Date:", margin, currentY + 30);
  doc.text("Payment Mode:", margin, currentY + 45);

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(data.payment.receipt_no, margin + 80, currentY + 15);
  doc.text(dayjs(data.payment.date).format("DD-MM-YYYY"), margin + 80, currentY + 30);
  doc.text(data.payment.payment_mode, margin + 80, currentY + 45);

  // Right Column (Student Details)
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");
  doc.text("Student Name:", pageWidth / 2 + 20, currentY + 15);
  doc.text("Adm No / Roll:", pageWidth / 2 + 20, currentY + 30);
  doc.text("Class & Sec:", pageWidth / 2 + 20, currentY + 45);

  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(data.student.name, pageWidth / 2 + 100, currentY + 15);
  doc.text(`${data.student.admission_number} ${data.student.roll_number ? `/ ${data.student.roll_number}` : ""}`, pageWidth / 2 + 100, currentY + 30);
  doc.text(`${data.student.class_name} - ${data.student.section_name}`, pageWidth / 2 + 100, currentY + 45);

  currentY += 65;

  // --- 3. Fees Table ---
  autoTable(doc, {
    startY: currentY,
    head: [["#", "Description", "Amount"]],
    body: [
      ...data.payment.items.map((item, index) => [
        index + 1,
        item.fee_type,
        { content: item.amount.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: "right" as const } }
      ]),
      ...(data.payment.fine_paid && data.payment.fine_paid > 0 ? [[
        "",
        "Fine",
        { content: data.payment.fine_paid.toLocaleString(undefined, { minimumFractionDigits: 2 }), styles: { halign: "right" as const } }
      ]] : [])
    ],
    theme: "grid",
    headStyles: {
      fillColor: blueColor as [number, number, number],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center" as const,
    },
    columnStyles: {
      0: { cellWidth: 40, halign: "center" as const },
      2: { cellWidth: 100, halign: "right" as const },
    },
    margin: { left: margin, right: margin },
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // --- 4. Summary ---
  const summaryWidth = 180;
  const summaryX = pageWidth - margin - summaryWidth;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text("Total Paid:", summaryX, currentY);
  
  doc.setTextColor(0);
  doc.setFont("helvetica", "bold");
  doc.text(`${data.payment.total_paid.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - margin, currentY, { align: "right" as const });

  if (data.payment.new_balance !== undefined) {
    currentY += 15;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text("Outstanding Balance:", summaryX, currentY);
    
    doc.setTextColor(blueColor[0], blueColor[1], blueColor[2]);
    doc.setFont("helvetica", "bold");
    doc.text(`${data.payment.new_balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, pageWidth - margin, currentY, { align: "right" as const });
  }

  // Remarks
  if (data.payment.remarks) {
    currentY += 30;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.text("Remarks:", margin, currentY);
    doc.setTextColor(50);
    doc.text(data.payment.remarks, margin, currentY + 12, { maxWidth: pageWidth / 2 });
  }

  // --- 5. Footer / Signatures ---
  const footerY = pageHeight - 100;
  drawDivider(footerY - 10);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.setFont("helvetica", "normal");

  doc.text("Student/Parent Signature", margin + 10, footerY + 40);
  doc.line(margin, footerY + 30, margin + 120, footerY + 30);

  doc.text("Authorized Accountant", pageWidth - margin - 120 + 10, footerY + 40);
  doc.line(pageWidth - margin - 120, footerY + 30, pageWidth - margin, footerY + 30);

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text("This is a computer generated receipt and does not require a physical signature.", pageWidth / 2, pageHeight - 30, { align: "center" as const });

  // Save the PDF
  doc.save(`Receipt_${data.payment.receipt_no}.pdf`);
};
