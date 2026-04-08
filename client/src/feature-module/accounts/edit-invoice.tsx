
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import CommonSelect from "../../core/common/commonSelect";
import { paymentMethod } from "../../core/common/selectoption/selectoption";
import { DatePicker } from "antd";
import { Editor } from "primereact/editor";
import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../router/all_routes";
import { apiService } from "../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../core/data/redux/academicYearSlice";
import { getAccountsErrorMessage } from "./accountsApiErrors";
import { toYmdString } from "../../core/utils/dateDisplay";

const EditInvoice = () => {
  const { id } = useParams();
  const invoiceId = id != null ? parseInt(String(id), 10) : NaN;
  const routes = all_routes;
  const navigation = useNavigate();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notesHtml, setNotesHtml] = useState("");
  const [termsHtml, setTermsHtml] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [amount, setAmount] = useState("");
  const [payment, setPayment] = useState("Cash");
  const [status, setStatus] = useState("Pending");

  useEffect(() => {
    if (!Number.isFinite(invoiceId)) {
      setLoading(false);
      setFormError("Invalid invoice.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFormError(null);
      try {
        const res = await apiService.getAccountsInvoiceById(invoiceId);
        const r = (res as { data?: unknown })?.data as Record<string, unknown> | undefined;
        if (cancelled || !r) return;
        setInvoiceNumber(String(r.invoice_number ?? ""));
        setInvoiceDate(
          r.invoice_date ? String(r.invoice_date).slice(0, 10) : ""
        );
        setDueDate(r.due_date ? String(r.due_date).slice(0, 10) : "");
        setAmount(r.amount != null ? String(r.amount) : "");
        setPayment(
          r.payment_method && String(r.payment_method) !== "Select"
            ? String(r.payment_method)
            : "Cash"
        );
        setStatus(
          ["Paid", "Pending", "Overdue"].includes(String(r.status))
            ? String(r.status)
            : "Pending"
        );
        const desc = r.description != null ? String(r.description) : "";
        setNotesHtml(desc ? `<p>${desc.replace(/</g, "")}</p>` : "");
      } catch (e: unknown) {
        if (!cancelled) setFormError(getAccountsErrorMessage(e, "Could not load invoice."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [invoiceId]);

  const invDay: Dayjs | null =
    invoiceDate && /^\d{4}-\d{2}-\d{2}$/.test(invoiceDate) ? dayjs(invoiceDate) : null;
  const dueDay: Dayjs | null =
    dueDate && /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dayjs(dueDate) : null;

  const stripHtml = (s: string) =>
    s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(invoiceId)) return;
    setFormError(null);
    setSaving(true);
    try {
      const inv = toYmdString(invoiceDate);
      const due = toYmdString(dueDate);
      const amt = Number(String(amount).replace(/[^0-9.-]/g, ""));
      if (!invoiceNumber.trim() || !inv || !due || !Number.isFinite(amt) || amt <= 0) {
        setFormError("Enter invoice number, valid dates, and a positive amount.");
        setSaving(false);
        return;
      }
      const desc = stripHtml(notesHtml) || null;
      await apiService.updateAccountsInvoice(invoiceId, {
        invoice_number: invoiceNumber.trim(),
        invoice_date: inv,
        due_date: due,
        description: desc,
        amount: amt,
        payment_method: payment && payment !== "Select" ? payment : null,
        status: status as "Paid" | "Pending" | "Overdue",
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      });
      navigation(routes.accountsInvoices);
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not update invoice."));
    } finally {
      setSaving(false);
    }
  };

  const amtNum = Number(String(amount).replace(/[^0-9.-]/g, ""));
  const displayTotal = Number.isFinite(amtNum) ? amtNum : 0;

  if (loading) {
    return (
      <div className="page-wrapper">
        <div className="content content-two p-4 text-muted">Loading…</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Edit Invoice</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={routes.accountsInvoices}>Finance &amp; Accounts</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Edit Invoice
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          <div className="row">
            <div className="col-md-12">
              <form onSubmit={handleSubmit}>
                {formError && (
                  <div className="alert alert-warning" role="alert">
                    {formError}
                  </div>
                )}
                <div className="card">
                  <div className="card-body pb-0">
                    <div className="card">
                      <div className="card-header bg-light">
                        <div className="d-flex align-items-center">
                          <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                            <i className="ti ti-user-check fs-16" />
                          </span>
                          <h4 className="text-dark">Customer Information</h4>
                        </div>
                      </div>
                      <div className="card-body pb-0">
                        <div className="info-section">
                          <div className="row">
                            <div className="col-lg-3 col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Invoice Number</label>
                                <input
                                  type="text"
                                  className="form-control"
                                  value={invoiceNumber}
                                  onChange={(e) => setInvoiceNumber(e.target.value)}
                                  required
                                />
                              </div>
                            </div>
                            <div className="col-lg-3 col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Invoice Date</label>
                                <div className="input-icon position-relative">
                                  <span className="input-icon-addon">
                                    <i className="ti ti-calendar" />
                                  </span>
                                  <DatePicker
                                    className="form-control datetimepicker"
                                    placeholder="Select Date"
                                    value={invDay}
                                    onChange={(d) =>
                                      setInvoiceDate(d && d.isValid() ? d.format("YYYY-MM-DD") : "")
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="col-lg-3 col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Due Date</label>
                                <div className="input-icon position-relative">
                                  <span className="input-icon-addon">
                                    <i className="ti ti-calendar" />
                                  </span>
                                  <DatePicker
                                    className="form-control datetimepicker"
                                    placeholder="Select Date"
                                    value={dueDay}
                                    onChange={(d) =>
                                      setDueDate(d && d.isValid() ? d.format("YYYY-MM-DD") : "")
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                            <div className="col-lg-3 col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Payment Method</label>
                                <CommonSelect
                                  className="select"
                                  options={paymentMethod}
                                  value={payment}
                                  onChange={(v) => setPayment(v || "Cash")}
                                />
                              </div>
                            </div>
                            <div className="col-lg-3 col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Status</label>
                                <CommonSelect
                                  className="select"
                                  options={[
                                    { value: "Pending", label: "Pending" },
                                    { value: "Paid", label: "Paid" },
                                    { value: "Overdue", label: "Overdue" },
                                  ]}
                                  value={status}
                                  onChange={(v) => setStatus(v || "Pending")}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-header bg-light">
                        <div className="d-flex align-items-center">
                          <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                            <i className="ti ti-shopping-cart-copy fs-16" />
                          </span>
                          <h4 className="text-dark">Product Information</h4>
                        </div>
                      </div>
                      <div className="card-body pb-0">
                        <div className="invoice-product-table">
                          <div className="table-responsive invoice-table">
                            <table className="table">
                              <thead>
                                <tr>
                                  <th>Description</th>
                                  <th>Due Date</th>
                                  <th>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td colSpan={2}>Line items are summarized in Notes below.</td>
                                  <td>
                                    <input
                                      type="text"
                                      className="form-control"
                                      value={amount}
                                      onChange={(e) => setAmount(e.target.value)}
                                    />
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="invoice-info">
                      <div className="row">
                        <div className="col-xxl-9 col-lg-8">
                          <div className="row">
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Notes</label>
                                <Editor
                                  value={notesHtml}
                                  onTextChange={(e) => setNotesHtml(e.htmlValue ?? "")}
                                  style={{ height: "130px" }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-xxl-3 col-lg-4">
                          <div className="card invoice-amount-details">
                            <ul>
                              <li>
                                <span>Subtotal</span>
                                <h6>
                                  {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                  }).format(displayTotal)}
                                </h6>
                              </li>
                              <li>
                                <span>Discount</span>
                                <h6>$0.00</h6>
                              </li>
                              <li>
                                <span>Tax</span>
                                <h6>$0.00</h6>
                              </li>
                              <li>
                                <h5>Total</h5>
                                <h5>
                                  {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                  }).format(displayTotal)}
                                </h5>
                              </li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-end">
                  <button
                    type="button"
                    className="btn btn-light me-3"
                    onClick={() => navigation(routes.accountsInvoices)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={saving}>
                    {saving ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditInvoice;
