
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
    doc.text("INVOICE", 550, 65, { align: "right" });
    doc.setFontSize(10);
    doc.text(`Invoice #: ${inv.invoice_number ?? "—"}`, 550, 80, { align: "right" });

    doc.setFontSize(12);
    doc.text("Invoice To:", 40, 140);
    doc.setFontSize(10);
    doc.text(`Date: ${inv.invoice_date ? formatDateMonthDayYear(String(inv.invoice_date)) : "—"}`, 40, 160);
    doc.text(`Due Date: ${inv.due_date ? formatDateMonthDayYear(String(inv.due_date)) : "—"}`, 40, 175);

    autoTable(doc, {
      startY: 200,
      head: [["SL", "Item Description", "Amount"]],
      body: [["1", String(inv.description || "—"), pdfAmount(amountStr)]],
      theme: "grid",
      headStyles: { fillColor: [51, 51, 51], textColor: [255, 255, 255], fontStyle: "bold" },
      styles: { fontSize: 10, cellPadding: 8 },
      columnStyles: { 0: { cellWidth: 40 }, 2: { halign: "right", cellWidth: 100 } },
    });

    const finalTableY = (doc as any).lastAutoTable.finalY + 30;
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

    const sigY = finalTableY + 80;
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

    doc.text("Thanks for your Business", 297, termsY + 60, { align: "center" });

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
              <h3 className="page-title mb-1">Invoice</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={routes.accountsInvoices}>Finance &amp; Accounts</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    View Invoice
                  </li>
                </ol>
              </nav>
            </div>
            <div className="mb-2">
              <Link to={routes.accountsInvoices} className="btn btn-light me-2">
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
                  <h2>INVOICE</h2>
                  <p>Original For Recipient</p>
                </div>
              </div>
              <div className="tax-info mb-2">
                <div className="mb-4 text-center">
                  <h4 className="text-dark">INVOICE</h4>
                  <p># {inv.invoice_number != null ? String(inv.invoice_number) : "—"}</p>
                </div>
                <div className="row">
                  <div className="col-md-6 mb-4">
                    <div className="tax-address">
                      <h5 className="mb-2">Invoice To:</h5>
                      <p className="mb-0">
                        Date:{" "}
                        <span className="text-dark fw-medium">
                          {inv.invoice_date != null ? formatDateMonthDayYear(String(inv.invoice_date)) : "—"}
                        </span>
                      </p>
                      <p className="mb-0">
                        Due Date:{" "}
                        <span className="text-dark fw-medium">
                          {inv.due_date != null ? formatDateMonthDayYear(String(inv.due_date)) : "—"}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
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
                      <tr>
                        <td>1</td>
                        <td>{inv.description != null ? String(inv.description) : "—"}</td>
                        <td className="text-end">{amountStr}</td>
                      </tr>
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
                          <li className="text-dark">{amountStr}</li>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Invoice;

