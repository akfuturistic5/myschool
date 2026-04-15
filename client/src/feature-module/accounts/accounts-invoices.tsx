
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link, generatePath } from "react-router-dom";
import Table from "../../core/common/dataTable/index";
import type { TableData } from "../../core/data/interface";
import {
  invoiceNumber,
  paymentMethod,
  transactionDate,
} from "../../core/common/selectoption/selectoption";
import CommonSelect from "../../core/common/commonSelect";
import PredefinedDateRanges from "../../core/common/datePicker";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import { apiService } from "../../core/services/apiService";
import { formatDateMonthDayYear, formatUsdDisplay } from "../../core/utils/dateDisplay";
import { selectSelectedAcademicYearId } from "../../core/data/redux/academicYearSlice";
import { getAccountsErrorMessage } from "./accountsApiErrors";
import { fetchAllAccountsPages, parseAccountsListResponse } from "./accountsListUtils";
import { exportAccountsExcel, exportAccountsPdf, printAccountsData } from "./accountsExportUtils";
import { createAccountsTableChangeHandler } from "./accountsTableHandlers";

function mapInvoiceApiToRow(r: any) {
  return {
    key: r.id,
    raw: r,
    invoiceNumber: r.invoice_number ?? "",
    date: formatDateMonthDayYear(r.invoice_date),
    description: r.description ?? "",
    amount: formatUsdDisplay(r.amount),
    paymentMethod: r.payment_method ?? "",
    dueDate: formatDateMonthDayYear(r.due_date),
    status: r.status ?? "",
  };
}

const AccountsInvoices = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedPaymentMethod, setAppliedPaymentMethod] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>("Select");
  const [filterPayment, setFilterPayment] = useState<string | null>("Select");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);

  const sortOrderFor = (field: string) =>
    sortBy === field ? (sortDir === "asc" ? ("ascend" as const) : ("descend" as const)) : null;

  const listParams = useMemo(
    () => ({
      search: appliedSearch.trim() || undefined,
      status:
        appliedStatus && ["Paid", "Pending", "Overdue"].includes(appliedStatus)
          ? appliedStatus
          : undefined,
      payment_method: appliedPaymentMethod.trim() || undefined,
      date_from: appliedDateFrom || undefined,
      date_to: appliedDateTo || undefined,
      ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      ...(sortBy ? { sort_by: sortBy, sort_order: sortDir } : {}),
    }),
    [appliedSearch, appliedStatus, appliedPaymentMethod, appliedDateFrom, appliedDateTo, academicYearId, sortBy, sortDir]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiService.getAccountsInvoices({
        ...listParams,
        page,
        page_size: pageSize,
      });
      const { data: list, total: tot } = parseAccountsListResponse(res);
      setRows(list.map(mapInvoiceApiToRow));
      setTotal(tot);
    } catch (e: unknown) {
      setLoadError(getAccountsErrorMessage(e, "Could not load invoices."));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [listParams, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTableChange = useMemo(
    () =>
      createAccountsTableChangeHandler({
        setPage,
        setPageSize,
        setSortBy,
        setSortDir,
      }),
    []
  );

  const exportColumns = [
    { key: "invoice_number", header: "Invoice Number" },
    { key: "invoice_date", header: "Invoice Date" },
    { key: "description", header: "Description" },
    { key: "amount", header: "Amount" },
    { key: "payment_method", header: "Payment Method" },
    { key: "due_date", header: "Due Date" },
    { key: "status", header: "Status" },
  ];

  const runExportExcel = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsInvoices({ ...listParams, ...p })
    );
    const flat = list.map((r) => ({
      invoice_number: r.invoice_number ?? "",
      invoice_date: r.invoice_date ?? "",
      description: r.description ?? "",
      amount: r.amount ?? "",
      payment_method: r.payment_method ?? "",
      due_date: r.due_date ?? "",
      status: r.status ?? "",
    }));
    exportAccountsExcel(flat, exportColumns, "invoices");
  };

  const runExportPdf = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsInvoices({ ...listParams, ...p })
    );
    const flat = list.map((r) => ({
      invoice_number: r.invoice_number ?? "",
      invoice_date: r.invoice_date ?? "",
      description: r.description ?? "",
      amount: r.amount ?? "",
      payment_method: r.payment_method ?? "",
      due_date: r.due_date ?? "",
      status: r.status ?? "",
    }));
    exportAccountsPdf(flat, exportColumns, "invoices", "Invoices");
  };

  const runPrint = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsInvoices({ ...listParams, ...p })
    );
    const flat = list.map((r) => ({
      invoice_number: r.invoice_number ?? "",
      invoice_date: r.invoice_date ?? "",
      description: r.description ?? "",
      amount: r.amount ?? "",
      payment_method: r.payment_method ?? "",
      due_date: r.due_date ?? "",
      status: r.status ?? "",
    }));
    printAccountsData("Invoices", exportColumns, flat);
  };

  const showModal = (id: string) => {
    const el = document.getElementById(id);
    const bootstrap = (window as any).bootstrap;
    if (el && bootstrap?.Modal) {
      const m = bootstrap.Modal.getInstance(el) || new bootstrap.Modal(el);
      m.show();
    }
  };

  const hideModal = (id: string) => {
    const el = document.getElementById(id);
    const bootstrap = (window as any).bootstrap;
    if (el && bootstrap?.Modal) {
      const m = bootstrap.Modal.getInstance(el);
      m?.hide();
    }
  };

  const openDelete = useCallback((record: any) => {
    setSelectedRecord(record);
    setFormError(null);
    setTimeout(() => showModal("delete-modal"), 0);
  }, []);

  const columns = useMemo(
    () => [
      {
        title: "Invoice Number",
        dataIndex: "invoiceNumber",
        key: "invoice_number",
        sorter: true,
        sortOrder: sortOrderFor("invoice_number"),
        render: (text: any, record: any) => (
          <Link
            to={generatePath(routes.invoice, { id: String(record.raw?.id) })}
            className="link-primary"
          >
            {text}
          </Link>
        ),
      },
      {
        title: "Date",
        dataIndex: "date",
        key: "invoice_date",
        sorter: true,
        sortOrder: sortOrderFor("invoice_date"),
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        sorter: true,
        sortOrder: sortOrderFor("description"),
      },
      {
        title: "Amount",
        dataIndex: "amount",
        key: "amount",
        sorter: true,
        sortOrder: sortOrderFor("amount"),
      },
      {
        title: "Payment Method",
        dataIndex: "paymentMethod",
        key: "payment_method",
        sorter: true,
        sortOrder: sortOrderFor("payment_method"),
      },
      {
        title: "Due Date",
        dataIndex: "dueDate",
        key: "due_date",
        sorter: true,
        sortOrder: sortOrderFor("due_date"),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        sorter: true,
        sortOrder: sortOrderFor("status"),
        render: (status: any) => (
          <>
            <span
              className={`badge d-inline-flex align-items-center badge-soft-success
        ${
          status === "Paid"
            ? "badge-soft-success"
            : status === "Overdue"
            ? "badge-soft-warning"
            : status === "Pending"
            ? "badge-soft-info"
            : ""
        }`}
            >
              <i className="ti ti-circle-filled fs-5 me-1" />
              {status}
            </span>
          </>
        ),
      },
      {
        title: "Action",
        dataIndex: "action",
        key: "_action",
        render: (_: any, record: any) => (
          <>
            {" "}
            <div className="dropdown">
              <Link
                to="#"
                className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="ti ti-dots-vertical fs-14" />
              </Link>
              <ul className="dropdown-menu dropdown-menu-right p-3">
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to={generatePath(routes.invoice, { id: String(record.raw?.id) })}
                  >
                    <i className="ti ti-menu me-2" />
                    View Invoice
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to={generatePath(routes.editInvoice, { id: String(record.raw?.id) })}
                  >
                    <i className="ti ti-edit-circle me-2" />
                    Edit
                  </Link>
                </li>
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openDelete(record);
                    }}
                  >
                    <i className="ti ti-trash-x me-2" />
                    Delete
                  </Link>
                </li>
              </ul>
            </div>
          </>
        ),
      },
    ],
    [openDelete, routes.invoice, routes.editInvoice, sortBy, sortDir]
  );

  const onFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch("");
    setAppliedStatus(
      filterStatus && filterStatus !== "Select" && ["Paid", "Pending", "Overdue"].includes(filterStatus)
        ? filterStatus
        : ""
    );
    setAppliedPaymentMethod(
      filterPayment && filterPayment !== "Select" ? filterPayment.trim() : ""
    );
    setPage(1);
    document.body.click();
  };

  const onFilterReset = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterPayment("Select");
    setFilterStatus("Select");
    setAppliedSearch("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setAppliedStatus("");
    setAppliedPaymentMethod("");
    setPage(1);
    document.body.click();
  };

  const submitDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = selectedRecord?.raw?.id;
    if (id == null) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.deleteAccountsInvoice(id);
      hideModal("delete-modal");
      setSelectedRecord(null);
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not delete invoice."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {" "}
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Invoices</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Finance &amp; Accounts</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Invoices
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={load}
                onPrint={runPrint}
                onExportPdf={runExportPdf}
                onExportExcel={runExportExcel}
              />
              <div className="mb-2">
                <Link
                  to={routes.addInvoice}
                  className="btn btn-primary d-flex align-items-center"
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Invoices
                </Link>
              </div>
            </div>
          </div>
          {/* /Page Header */}
          {loadError && (
            <div className="alert alert-danger" role="alert">
              {loadError}
            </div>
          )}
          {/* Filter Section */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Invoices List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges
                    onChange={(dates) => {
                      setAppliedDateFrom(dates[0] ? dates[0].format("YYYY-MM-DD") : "");
                      setAppliedDateTo(dates[1] ? dates[1].format("YYYY-MM-DD") : "");
                      setPage(1);
                    }}
                  />
                </div>
                <div className="dropdown mb-3 me-2">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                    data-bs-auto-close="outside"
                  >
                    <i className="ti ti-filter me-2" />
                    Filter
                  </Link>
                  <div className="dropdown-menu drop-width">
                    <form onSubmit={onFilterSubmit}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 pb-0 border-bottom">
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "Select", label: "Select" },
                                  { value: "Paid", label: "Paid" },
                                  { value: "Pending", label: "Pending" },
                                  { value: "Overdue", label: "Overdue" },
                                ]}
                                value={filterStatus ?? "Select"}
                                onChange={(v) => setFilterStatus(v)}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Payment Method</label>
                              <CommonSelect
                                className="select"
                                options={paymentMethod}
                                value={filterPayment ?? "Select"}
                                onChange={(v) => setFilterPayment(v)}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3" onClick={onFilterReset}>
                          Reset
                        </Link>
                        <button type="submit" className="btn btn-primary">
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

              </div>
            </div>
            <div className="card-body p-0 py-3">
              {formError && (
                <div className="alert alert-warning mx-3" role="alert">
                  {formError}
                </div>
              )}
              {loading ? (
                <div className="p-4 text-center text-muted">Loading…</div>
              ) : (
                <Table
                  dataSource={rows}
                  columns={columns}
                  Selection={true}
                  showSearch={true}
                  onTableChange={handleTableChange}
                  pagination={{
                    current: page,
                    pageSize,
                    total,
                    showSizeChanger: true,
                    pageSizeOptions: ["10", "20", "30"],
                    showTotal: (tot, range) => `${range[0]}-${range[1]} of ${tot} items`,
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
      {/* Delete Modal */}
      <div className="modal fade" id="delete-modal">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <form onSubmit={submitDelete}>
              <div className="modal-body text-center">
                <span className="delete-icon">
                  <i className="ti ti-trash-x" />
                </span>
                <h4>Confirm Deletion</h4>
                <p>
                  You want to delete all the marked items, this cant be undone once you delete.
                </p>
                <div className="d-flex justify-content-center">
                  <Link to="#" className="btn btn-light me-3" data-bs-dismiss="modal">
                    Cancel
                  </Link>
                  <button type="submit" className="btn btn-danger" disabled={saving}>
                    {saving ? "…" : "Yes, Delete"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Delete Modal */}
    </div>
  );
};

export default AccountsInvoices;
