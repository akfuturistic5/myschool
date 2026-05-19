
import { Link, useParams } from "react-router-dom";
import { useEffect, useState } from "react";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import { all_routes } from "../router/all_routes";
import { apiService, getApiBaseUrl } from "../../core/services/apiService";
import { formatDateMonthDayYear, formatUsdDisplay } from "../../core/utils/dateDisplay";
import { getAccountsErrorMessage } from "./accountsApiErrors";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

const Invoice = () => {
  const routes = all_routes;
  const { id } = useParams();
  const invoiceId = id != null ? parseInt(String(id), 10) : NaN;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inv, setInv] = useState<Record<string, unknown> | null>(null);
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [apiBaseUrl, setApiBaseUrl] = useState("");

  const fullUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith("http")) return path;
    const cleanPath = path.startsWith("/api/") ? path.slice(4) : path;
    const finalPath = cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`;
    return `${apiBaseUrl}${finalPath}`;
  };

  useEffect(() => {
    if (!Number.isFinite(invoiceId)) {
      setLoading(false);
      setError("Invalid invoice.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [res, settingsRes, base] = await Promise.all([
          apiService.getAccountsInvoiceById(invoiceId),
          apiService.getSettings("invoice"),
          getApiBaseUrl()
        ]);
        
        if (cancelled) return;
        setApiBaseUrl(base);

        const data = (res as { data?: unknown })?.data as Record<string, unknown> | undefined;
        if (!data) {
          setError("Invoice not found.");
          setInv(null);
        } else {
          setInv(data);
          if (settingsRes.data) {
            setSettings(settingsRes.data);
          }
        }
      } catch (e: unknown) {
        if (!cancelled) setError(getAccountsErrorMessage(e, "Could not load invoice."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const amountNum =
    inv?.amount != null && Number.isFinite(Number(inv.amount)) ? Number(inv.amount) : null;
  const amountStr = amountNum != null ? formatUsdDisplay(amountNum) : "—";

  const hasItems = inv?.items && Array.isArray(inv.items) && inv.items.length > 0;
  const items = hasItems 
    ? (inv.items as any[])
    : (amountNum != null
        ? [{ description: String(inv?.description || "Basic Salary"), amount: amountNum }]
        : []);

  const earnings = items.filter(item => Number(item.amount) >= 0);
  const deductions = items.filter(item => Number(item.amount) < 0);

  const totalEarnings = earnings.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalDeductions = deductions.reduce((sum, item) => sum + Math.abs(Number(item.amount)), 0);

  const handlePrint = () => {
    const printContent = document.getElementById("print-invoice-section");
    if (!printContent) return;

    const w = window.open("", "_blank");
    if (!w) return;

    const styles = Array.from(document.querySelectorAll("style, link[rel='stylesheet']"))
      .map((tag) => tag.outerHTML)
      .join("");

    w.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Invoice</title>
          ${styles}
          <style>
            body { background: #fff !important; padding: 20px !important; }
            #print-invoice-section { display: block !important; width: 100% !important; margin: 0 !important; }
            .no-print { display: none !important; }
            @media print {
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="row" id="print-invoice-section">
            ${printContent.innerHTML}
          </div>
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

  const getBase64Image = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.setAttribute("crossOrigin", "anonymous");
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL("image/png");
        resolve(dataURL);
      };
      img.onerror = (e) => reject(e);
      img.src = url;
    });
  };

  const handleDownloadPDF = async () => {
    if (!inv) return;
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const logoSrc = settings?.invoice_logo ? fullUrl(settings.invoice_logo) : "";
    const signatureSrc = settings?.invoice_signature_url ? fullUrl(settings.invoice_signature_url) : "";

    // Helper to replace Rupee sign for PDF compatibility
    const pdfAmount = (val: string) => val.replace("₹", "Rs. ");

    try {
      if (logoSrc) {
        const logoData = await getBase64Image(logoSrc);
        doc.addImage(logoData, "PNG", 40, 40, 60, 60, undefined, "FAST");
      }
    } catch (e) {
      console.warn("Failed to load logo for PDF", e);
    }

    doc.setFontSize(22);
    doc.setTextColor(40);
    doc.text(inv.invoice_type === 'Payslip' ? "SALARY SLIP" : "INVOICE", 550, 65, { align: "right" });
    doc.setFontSize(10);
    doc.text(`${inv.invoice_type === 'Payslip' ? "Payslip" : "Invoice"} #: ${inv.invoice_number ?? "—"}`, 550, 80, { align: "right" });

    doc.setFontSize(12);
    doc.text(inv.invoice_type === 'Payslip' ? "Employee Details:" : "Invoice To:", 40, 140);
    doc.setFontSize(10);
    doc.text(`Name: ${inv.customer_name ?? "—"}`, 40, 155);

    if (inv.invoice_type === 'Payslip') {
      doc.text(`Employee ID: ${String(inv.employee_code || "—")}`, 40, 170);
      doc.text(`Department: ${String(inv.department || "—")}`, 40, 185);
      doc.text(`Designation: ${String(inv.designation || "—")}`, 40, 200);
      doc.text(`Date: ${inv.invoice_date ? formatDateMonthDayYear(String(inv.invoice_date)) : "—"}`, 40, 215);
    } else {
      doc.text(`Date: ${inv.invoice_date ? formatDateMonthDayYear(String(inv.invoice_date)) : "—"}`, 40, 170);
      doc.text(`Due Date: ${inv.due_date ? formatDateMonthDayYear(String(inv.due_date)) : "—"}`, 40, 185);
    }

    const tableStartY = inv.invoice_type === 'Payslip' ? 245 : 200;
    let finalTableY;

    if (inv.invoice_type === 'Payslip') {
      // Draw Earnings Table
      autoTable(doc, {
        startY: tableStartY,
        head: [["SL", "Earnings & Allowances", "Amount"]],
        body: earnings.map((item: any, idx: number) => [
          String(idx + 1),
          String(item.description || "—"),
          pdfAmount(formatUsdDisplay(item.amount)),
        ]),
        theme: "grid",
        headStyles: { fillColor: [40, 199, 111], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 6 },
        columnStyles: { 0: { cellWidth: 30 }, 2: { halign: "right", cellWidth: 120 } },
      });

      const earningsTableY = (doc as any).lastAutoTable.finalY + 15;

      // Draw Deductions Table
      autoTable(doc, {
        startY: earningsTableY,
        head: [["SL", "Deductions & Taxes", "Amount"]],
        body: deductions.map((item: any, idx: number) => [
          String(idx + 1),
          String(item.description || "—"),
          pdfAmount(formatUsdDisplay(Math.abs(Number(item.amount)))),
        ]),
        theme: "grid",
        headStyles: { fillColor: [234, 84, 85], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 9, cellPadding: 6 },
        columnStyles: { 0: { cellWidth: 30 }, 2: { halign: "right", cellWidth: 120 } },
      });

      finalTableY = (doc as any).lastAutoTable.finalY + 30;

      // Draw Net Salary card in PDF
      doc.setFontSize(10);
      doc.setFont("Helvetica", "bold");
      doc.text("Gross Earnings:", 400, finalTableY);
      doc.setFont("Helvetica", "normal");
      doc.text(pdfAmount(formatUsdDisplay(totalEarnings)), 550, finalTableY, { align: "right" });

      doc.setFont("Helvetica", "bold");
      doc.text("Total Deductions:", 400, finalTableY + 15);
      doc.setFont("Helvetica", "normal");
      doc.text(pdfAmount(formatUsdDisplay(totalDeductions)), 550, finalTableY + 15, { align: "right" });

      doc.setDrawColor(200);
      doc.line(390, finalTableY + 22, 550, finalTableY + 22);

      doc.setFont("Helvetica", "bold");
      doc.setFontSize(11);
      doc.text("Net Salary Paid:", 400, finalTableY + 38);
      doc.text(pdfAmount(inv.total_amount != null ? formatUsdDisplay(Number(inv.total_amount)) : amountStr), 550, finalTableY + 38, { align: "right" });

      finalTableY = finalTableY + 60;
    } else {
      autoTable(doc, {
        startY: tableStartY,
        head: [["SL", "Item Description", "Amount"]],
        body: [["1", String(inv.description || "—"), pdfAmount(amountStr)]],
        theme: "grid",
        headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255], fontStyle: "bold" },
        styles: { fontSize: 10, cellPadding: 8 },
        columnStyles: { 0: { cellWidth: 40 }, 2: { halign: "right", cellWidth: 100 } },
      });

      finalTableY = (doc as any).lastAutoTable.finalY + 30;
      doc.setFontSize(10);
      doc.setFont("Helvetica", "normal");

      // Amount Breakdown
      doc.text("Subtotal:", 450, finalTableY, { align: "right" });
      doc.text(pdfAmount(amountStr), 550, finalTableY, { align: "right" });

      doc.text("Discount (0%):", 450, finalTableY + 15, { align: "right" });
      doc.text("Rs. 0.00", 550, finalTableY + 15, { align: "right" });

      doc.text("Tax (0%):", 450, finalTableY + 30, { align: "right" });
      doc.text("Rs. 0.00", 550, finalTableY + 30, { align: "right" });

      doc.setFont("Helvetica", "bold");
      doc.text("Total Amount Payable:", 450, finalTableY + 50, { align: "right" });
      doc.text(pdfAmount(amountStr), 550, finalTableY + 50, { align: "right" });

      doc.setFontSize(11);
      doc.setFont("Helvetica", "bold");
      doc.text("Payment Info:", 40, finalTableY + 80);
      doc.setFontSize(10);
      doc.setFont("Helvetica", "normal");
      doc.text(`Method: ${inv.payment_method || "—"}`, 40, finalTableY + 100);
      doc.text(`Status: ${inv.status || "—"}`, 40, finalTableY + 115);
      doc.text(`Amount: ${pdfAmount(amountStr)}`, 40, finalTableY + 130);

      finalTableY = finalTableY + 150;
    }

    const sigY = finalTableY + 20;
    doc.setFont("Helvetica", "bold");
    doc.text(settings?.invoice_signature_name || "Authorized Signatory", 550, sigY, { align: "right" });
    try {
      if (signatureSrc) {
        const sigData = await getBase64Image(signatureSrc);
        doc.addImage(sigData, "PNG", 450, sigY + 5, 100, 40, undefined, "FAST");
      }
    } catch (e) {
      console.warn("Failed to load signature for PDF", e);
    }

    const termsY = sigY + 100;
    doc.setFontSize(10);
    doc.setFont("Helvetica", "bold");
    doc.text("Terms & Conditions:", 40, termsY);
    doc.setFont("Helvetica", "normal");
    const splitTerms = doc.splitTextToSize(settings?.invoice_terms || "Standard business terms apply.", 520);
    doc.text(splitTerms, 40, termsY + 15);

    doc.text(inv.invoice_type === 'Payslip' ? 'This is a computer generated salary slip.' : "Thanks for your Business", 297, termsY + 60, { align: "center" });

    doc.save(`Invoice_${inv.invoice_number || "Draft"}.pdf`);
  };

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content content-two p-4 text-muted">Loading…</div>
      </div>
    );
  }

  if (error || !inv) {
    return (
      <div className="page-wrapper">
        <div className="content content-two p-4">
          <div className="alert alert-danger">{error || "Not found"}</div>
          <Link to={routes.accountsInvoices} className="btn btn-primary">
            Back to Invoices
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3 no-print">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">
                {inv.invoice_type === 'Payslip' ? 'Salary Slip' : 'Invoice'}
              </h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={inv.invoice_type === 'Payslip' ? routes.payroll : routes.accountsInvoices}>
                      {inv.invoice_type === 'Payslip' ? 'HRM' : 'Finance & Accounts'}
                    </Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    View {inv.invoice_type === 'Payslip' ? 'Salary Slip' : 'Invoice'}
                  </li>
                </ol>
              </nav>
            </div>
            <div className="mb-2">
              <Link to={inv.invoice_type === 'Payslip' ? routes.payroll : routes.accountsInvoices} className="btn btn-light me-2">
                Back
              </Link>
              <button className="btn btn-info me-2 text-white" onClick={handleDownloadPDF}>
                Download PDF
              </button>
              <button className="btn btn-primary me-2" onClick={handlePrint}>
                Print
              </button>
              <Link
                to={`/accounts/edit-invoice/${invoiceId}`}
                className="btn btn-secondary"
              >
                Edit
              </Link>
            </div>
          </div>
          <style>
            {`
              @media print {
                /* Explicitly hide standard UI wrappers */
                .header, .sidebar, .sidebar-overlay, .settings-icon, .breadcrumb, .no-print, .btn {
                  display: none !important;
                }
                .main-wrapper, .page-wrapper {
                  margin: 0 !important;
                  padding: 0 !important;
                  min-height: auto !important;
                }
                .content {
                  padding: 0 !important;
                  margin: 0 !important;
                }
                body {
                  background: #fff !important;
                  -webkit-print-color-adjust: exact;
                }
                #print-invoice-section {
                  display: block !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #fff !important;
                }
              }
            `}
          </style>
          <div className="row" id="print-invoice-section">
            <div className="col-md-12">
              <div className="invoice-popup-head d-flex align-items-center justify-content-between mb-4">
                <span>
                  {settings?.invoice_logo ? (
                    <img src={fullUrl(settings.invoice_logo)} alt="School Logo" style={{ height: "60px" }} />
                  ) : (
                    <ImageWithBasePath src="assets/img/logo.svg" alt="Img" />
                  )}
                </span>
                <div className="popup-title">
                  <h2>{inv.invoice_type === 'Payslip' ? 'SALARY SLIP' : 'INVOICE'}</h2>
                  <p>{inv.invoice_type === 'Payslip' ? 'Employee Copy' : 'Original For Recipient'}</p>
                </div>
              </div>
              <div className="tax-info mb-2">
                <div className="mb-4 text-center">
                  <h4 className="text-dark">{inv.invoice_type === 'Payslip' ? 'SALARY SLIP' : 'INVOICE'}</h4>
                  <p># {inv.invoice_number != null ? String(inv.invoice_number) : "—"}</p>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-4">
                    <div className="tax-address">
                      <h5 className="mb-2">
                        {inv.invoice_type === 'Payslip' ? 'Employee Details:' : 'Invoice To:'}
                      </h5>
                      <p className="mb-0 text-dark fw-bold">
                        {inv.customer_name != null ? String(inv.customer_name) : "—"}
                      </p>
                      {inv.invoice_type === 'Payslip' && (
                        <>
                          <p className="mb-0">Employee ID: <span className="text-dark fw-medium">{String(inv.employee_code || "—")}</span></p>
                          <p className="mb-0">Department: <span className="text-dark fw-medium">{String(inv.department || "—")}</span></p>
                          <p className="mb-0">Designation: <span className="text-dark fw-medium">{String(inv.designation || "—")}</span></p>
                        </>
                      )}
                      <p className="mb-0">
                        Date:{" "}
                        <span className="text-dark fw-medium">
                          {inv.invoice_date != null ? formatDateMonthDayYear(String(inv.invoice_date)) : "—"}
                        </span>
                      </p>
                      {inv.invoice_type !== 'Payslip' && (
                        <p className="mb-0">
                          Due Date:{" "}
                          <span className="text-dark fw-medium">
                            {inv.due_date != null ? formatDateMonthDayYear(String(inv.due_date)) : "—"}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {inv.invoice_type === 'Payslip' ? (
                <div className="invoice-table-details mb-4">
                  <div className="row">
                    {/* Earnings and Allowances */}
                    <div className="col-md-6 mb-4">
                      <div className="card shadow-none border h-100">
                        <div className="card-header py-2" style={{ backgroundColor: "rgba(40, 199, 111, 0.08)", borderBottom: "1px solid rgba(40, 199, 111, 0.2)" }}>
                          <h5 className="mb-0 text-success fs-14 fw-bold d-flex align-items-center">
                            <i className="ti ti-circle-chevron-up me-2 fs-18"></i> Earnings &amp; Allowances
                          </h5>
                        </div>
                        <div className="table-responsive no-pagination">
                          <table className="table table-borderless table-center mb-0">
                            <thead>
                              <tr className="border-bottom">
                                <th style={{ width: "30px", padding: "10px" }}>SL</th>
                                <th style={{ padding: "10px" }}>Item Description</th>
                                <th className="text-end" style={{ padding: "10px" }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {earnings.map((item: any, idx: number) => (
                                <tr key={idx} className="border-bottom-0">
                                  <td style={{ padding: "10px" }}>{idx + 1}</td>
                                  <td style={{ padding: "10px" }}>{item.description}</td>
                                  <td className="text-end text-success fw-medium" style={{ padding: "10px" }}>
                                    {formatUsdDisplay(item.amount)}
                                  </td>
                                </tr>
                              ))}
                              {earnings.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="text-center text-muted py-3">No earnings recorded</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="card-footer py-2 mt-auto border-top" style={{ backgroundColor: "rgba(30, 41, 59, 0.02)" }}>
                          <div className="d-flex justify-content-between align-items-center fw-bold text-dark fs-14">
                            <span>Total Earnings</span>
                            <span className="text-success">{formatUsdDisplay(totalEarnings)}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Deductions */}
                    <div className="col-md-6 mb-4">
                      <div className="card shadow-none border h-100">
                        <div className="card-header py-2" style={{ backgroundColor: "rgba(234, 84, 85, 0.08)", borderBottom: "1px solid rgba(234, 84, 85, 0.2)" }}>
                          <h5 className="mb-0 text-danger fs-14 fw-bold d-flex align-items-center">
                            <i className="ti ti-circle-chevron-down me-2 fs-18"></i> Deductions &amp; Taxes
                          </h5>
                        </div>
                        <div className="table-responsive no-pagination">
                          <table className="table table-borderless table-center mb-0">
                            <thead>
                              <tr className="border-bottom">
                                <th style={{ width: "30px", padding: "10px" }}>SL</th>
                                <th style={{ padding: "10px" }}>Item Description</th>
                                <th className="text-end" style={{ padding: "10px" }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {deductions.map((item: any, idx: number) => (
                                <tr key={idx} className="border-bottom-0">
                                  <td style={{ padding: "10px" }}>{idx + 1}</td>
                                  <td style={{ padding: "10px" }}>{item.description}</td>
                                  <td className="text-end text-danger fw-medium" style={{ padding: "10px" }}>
                                    {formatUsdDisplay(Math.abs(Number(item.amount)))}
                                  </td>
                                </tr>
                              ))}
                              {deductions.length === 0 && (
                                <tr>
                                  <td colSpan={3} className="text-center text-muted py-3">No deductions recorded</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        <div className="card-footer py-2 mt-auto border-top" style={{ backgroundColor: "rgba(30, 41, 59, 0.02)" }}>
                          <div className="d-flex justify-content-between align-items-center fw-bold text-dark fs-14">
                            <span>Total Deductions</span>
                            <span className="text-danger">{formatUsdDisplay(totalDeductions)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary Box */}
                  <div className="row justify-content-end mt-2">
                    <div className="col-lg-5 col-md-7">
                      <div className="card shadow-none border bg-light">
                        <div className="card-body p-3">
                          <div className="d-flex justify-content-between mb-2">
                            <span className="text-muted">Gross Earnings</span>
                            <span className="text-dark fw-medium">{formatUsdDisplay(totalEarnings)}</span>
                          </div>
                          <div className="d-flex justify-content-between mb-2 border-bottom pb-2">
                            <span className="text-muted">Total Deductions</span>
                            <span className="text-dark fw-medium">- {formatUsdDisplay(totalDeductions)}</span>
                          </div>
                          <div className="d-flex justify-content-between align-items-center pt-1 fw-bold fs-16 text-dark">
                            <span>Net Salary</span>
                            <span className="text-primary fs-18">
                              {inv.total_amount != null ? formatUsdDisplay(Number(inv.total_amount)) : amountStr}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-center pt-4">This is a computer generated salary slip.</p>
                </div>
              ) : (
                <div className="invoice-table-details">
                  <div className="table-responsive no-pagination mb-4">
                    <table className="table table-borderless table-center mb-0">
                      <thead>
                        <tr>
                          <th style={{ width: "20px" }}>SL</th>
                          <th>Item Description</th>
                          <th className="text-end">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {inv.items && Array.isArray(inv.items) && inv.items.length > 0 ? (
                          inv.items.map((item: any, index: number) => (
                            <tr key={index}>
                              <td>{index + 1}</td>
                              <td>{item.description}</td>
                              <td className="text-end">{formatUsdDisplay(item.amount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td>1</td>
                            <td>{inv.description != null ? String(inv.description) : "—"}</td>
                            <td className="text-end">{amountStr}</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="row">
                    <div className="col-lg-7 col-md-5" />
                    <div className="col-lg-5 col-md-7">
                      <div className="invoice-total-card">
                        <div className="total-amount-tax mb-2">
                          <ul>
                            <li>Subtotal</li>
                            <li>Discount (0%)</li>
                            <li>Tax (0%)</li>
                          </ul>
                          <ul>
                            <li>{amountStr}</li>
                            <li>+ $0.00</li>
                            <li>$0.00</li>
                          </ul>
                        </div>
                        <div className="total-amount-tax mb-3">
                          <ul className="total-amount">
                            <li className="text-dark">Amount Payable</li>
                          </ul>
                          <ul className="total-amount">
                            <li className="text-dark">
                              {inv.total_amount != null ? formatUsdDisplay(Number(inv.total_amount)) : amountStr}
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="payment-info">
                    <div className="row align-items-center">
                      <div className="col-lg-6 mb-4 pt-4">
                        <h5 className="mb-2">Payment Info:</h5>
                        <p className="mb-1">
                          Method :{" "}
                          <span className="fw-medium text-dark">
                            {inv.payment_method != null ? String(inv.payment_method) : "—"}
                          </span>
                        </p>
                        <p className="mb-0">
                          Status :{" "}
                          <span className="fw-medium text-dark">
                            {inv.status != null ? String(inv.status) : "—"}
                          </span>
                        </p>
                        <p className="mb-0">
                          Amount : <span className="fw-medium text-dark">{amountStr}</span>
                        </p>
                      </div>
                      <div className="col-lg-6 text-end mb-4 pt-4 ">
                        <h6 className="mb-2">
                          {settings?.invoice_signature_name || "Authorized Signatory"}
                        </h6>
                        {settings?.invoice_signature_url ? (
                          <img src={fullUrl(settings.invoice_signature_url)} alt="Signature" style={{ height: "60px" }} />
                        ) : (
                          <div style={{ height: "60px", opacity: 0.3, fontStyle: "italic" }}>
                            No signature configured
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="border-bottom text-center pt-4 pb-4">
                    <span className="text-dark fw-medium">Terms &amp; Conditions : </span>
                    <p>
                      {settings?.invoice_terms || "Standard business terms and conditions apply."}
                    </p>
                  </div>
                  <p className="text-center pt-3">Thanks for your Business</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoice;

