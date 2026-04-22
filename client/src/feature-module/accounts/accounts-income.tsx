
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import Table from "../../core/common/dataTable/index";
import PredefinedDateRanges from "../../core/common/datePicker";
import CommonSelect from "../../core/common/commonSelect";
import {
  incomeName,
  invoiceNumber,
  paymentMethod,
  source,
} from "../../core/common/selectoption/selectoption";
import { DatePicker } from "antd";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import ImageWithBasePath from "../../core/common/imageWithBasePath";
import { apiService } from "../../core/services/apiService";
import { formatDateMonthDayYear, formatUsdDisplay, toYmdString } from "../../core/utils/dateDisplay";
import { selectSelectedAcademicYearId } from "../../core/data/redux/academicYearSlice";
import { getAccountsErrorMessage } from "./accountsApiErrors";
import { fetchAllAccountsPages, parseAccountsListResponse } from "./accountsListUtils";
import { exportAccountsExcel, exportAccountsPdf, printAccountsData } from "./accountsExportUtils";
import { createAccountsTableChangeHandler } from "./accountsTableHandlers";

function mapIncomeApiToRow(r: any) {
  return {
    key: r.id,
    raw: r,
    id: r.income_code,
    incomeName: r.income_name ?? "",
    description: r.description ?? "",
    source: r.source ?? "",
    date: formatDateMonthDayYear(r.income_date),
    amount: formatUsdDisplay(r.amount),
    invoiceNo: r.invoice_no ?? "",
    paymentMethod: r.payment_method ?? "",
  };
}

const AccountsIncome = () => {
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
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [appliedPaymentMethod, setAppliedPaymentMethod] = useState("");
  const [filterPayment, setFilterPayment] = useState<string | null>("Select");
  const [viewingIncome, setViewingIncome] = useState<any | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortOrderFor = (field: string) =>
    sortBy === field ? (sortDir === "asc" ? ("ascend" as const) : ("descend" as const)) : null;

  const incomeListParams = useMemo(
    () => ({
      search: appliedSearch.trim() || undefined,
      payment_method: appliedPaymentMethod.trim() || undefined,
      date_from: appliedDateFrom || undefined,
      date_to: appliedDateTo || undefined,
      ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      ...(sortBy ? { sort_by: sortBy, sort_order: sortDir } : {}),
    }),
    [appliedSearch, appliedPaymentMethod, appliedDateFrom, appliedDateTo, academicYearId, sortBy, sortDir]
  );

  const emptyAdd = {
    income_name: "",
    source: "",
    description: "",
    income_date: "" as string,
    amount: "",
    invoice_no: "",
    payment_method: "Cash",
  };
  const [addForm, setAddForm] = useState({ ...emptyAdd });
  const [editForm, setEditForm] = useState({ ...emptyAdd });

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

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiService.getAccountsIncome({
        ...incomeListParams,
        page,
        page_size: pageSize,
      });
      const { data: list, total: tot } = parseAccountsListResponse(res);
      setRows(list.map(mapIncomeApiToRow));
      setTotal(tot);
    } catch (e: unknown) {
      setLoadError(getAccountsErrorMessage(e, "Could not load income records."));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [incomeListParams, page, pageSize]);

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

  const incomeExportColumns = [
    { key: "income_code", header: "ID" },
    { key: "income_name", header: "Income Name" },
    { key: "description", header: "Description" },
    { key: "source", header: "Source" },
    { key: "income_date", header: "Date" },
    { key: "amount", header: "Amount" },
    { key: "invoice_no", header: "Invoice No" },
    { key: "payment_method", header: "Payment Method" },
  ];

  const runExportExcel = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsIncome({ ...incomeListParams, ...p })
    );
    const flat = list.map((r) => ({
      income_code: r.income_code ?? "",
      income_name: r.income_name ?? "",
      description: r.description ?? "",
      source: r.source ?? "",
      income_date: r.income_date ?? "",
      amount: r.amount ?? "",
      invoice_no: r.invoice_no ?? "",
      payment_method: r.payment_method ?? "",
    }));
    exportAccountsExcel(flat, incomeExportColumns, "income");
  };

  const runExportPdf = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsIncome({ ...incomeListParams, ...p })
    );
    const flat = list.map((r) => ({
      income_code: r.income_code ?? "",
      income_name: r.income_name ?? "",
      description: r.description ?? "",
      source: r.source ?? "",
      income_date: r.income_date ?? "",
      amount: r.amount ?? "",
      invoice_no: r.invoice_no ?? "",
      payment_method: r.payment_method ?? "",
    }));
    exportAccountsPdf(flat, incomeExportColumns, "income", "Income");
  };

  const runPrint = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsIncome({ ...incomeListParams, ...p })
    );
    const flat = list.map((r) => ({
      income_code: r.income_code ?? "",
      income_name: r.income_name ?? "",
      description: r.description ?? "",
      source: r.source ?? "",
      income_date: r.income_date ?? "",
      amount: r.amount ?? "",
      invoice_no: r.invoice_no ?? "",
      payment_method: r.payment_method ?? "",
    }));
    printAccountsData("Income", incomeExportColumns, flat);
  };

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setFormError(null);
    setAddForm({ ...emptyAdd });
    setTimeout(() => showModal("add_income"), 0);
  };

  const openView = useCallback((record: any) => {
    setViewingIncome(record);
    setTimeout(() => showModal("view_invoice"), 0);
  }, []);

  const openEdit = useCallback((record: any) => {
    const r = record.raw;
    setSelectedRecord(record);
    setEditForm({
      income_name: r.income_name || "",
      source: r.source || "",
      description: r.description || "",
      income_date: r.income_date ? String(r.income_date).slice(0, 10) : "",
      amount: r.amount != null ? String(r.amount) : "",
      invoice_no: r.invoice_no || "",
      payment_method: r.payment_method && r.payment_method !== "Select" ? r.payment_method : "Cash",
    });
    setFormError(null);
    setTimeout(() => showModal("edit_income"), 0);
  }, []);

  const openDelete = useCallback((record: any) => {
    setSelectedRecord(record);
    setFormError(null);
    setTimeout(() => showModal("delete-modal"), 0);
  }, []);

  const columns = useMemo(
    () => [
      {
        title: "ID",
        dataIndex: "id",
        key: "id",
        sorter: true,
        sortOrder: sortOrderFor("id"),
        render: (text: any, record: any) => (
          <Link
            to="#"
            className="link-primary"
            onClick={(e) => {
              e.preventDefault();
              openView(record);
            }}
          >
            {text}
          </Link>
        ),
      },
      {
        title: "Income Name",
        dataIndex: "incomeName",
        key: "income_name",
        sorter: true,
        sortOrder: sortOrderFor("income_name"),
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        sorter: true,
        sortOrder: sortOrderFor("description"),
      },
      {
        title: "Source",
        dataIndex: "source",
        key: "source",
        sorter: true,
        sortOrder: sortOrderFor("source"),
      },
      {
        title: "Date",
        dataIndex: "date",
        key: "income_date",
        sorter: true,
        sortOrder: sortOrderFor("income_date"),
      },
      {
        title: "Amount",
        dataIndex: "amount",
        key: "amount",
        sorter: true,
        sortOrder: sortOrderFor("amount"),
      },
      {
        title: "Invoice No",
        dataIndex: "invoiceNo",
        key: "invoice_no",
        sorter: true,
        sortOrder: sortOrderFor("invoice_no"),
        render: (text: any, record: any) => (
          <Link
            to="#"
            className="link-primary"
            onClick={(e) => {
              e.preventDefault();
              openView(record);
            }}
          >
            {text}
          </Link>
        ),
      },
      {
        title: "Payment Method",
        dataIndex: "paymentMethod",
        key: "payment_method",
        sorter: true,
        sortOrder: sortOrderFor("payment_method"),
      },
      {
        title: "Action",
        dataIndex: "action",
        key: "_action",
        render: (_: any, record: any) => (
          <>
            <div className="dropdown">
              <Link
                to="#"
                className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
                data-bs-toggle="dropdown"
                aria-expanded="false"
              >
                <i className="ti ti-dots-vertical fs-14" />
              </Link>
              <ul className="dropdown-menu dropdown-menu-end p-2">
                <li>
                  <Link
                    className="dropdown-item rounded-1"
                    to="#"
                    onClick={(e) => {
                      e.preventDefault();
                      openEdit(record);
                    }}
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
    [openView, openEdit, openDelete, sortBy, sortDir]
  );

  const onFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch("");
    setAppliedPaymentMethod(
      filterPayment && filterPayment !== "Select" ? filterPayment.trim() : ""
    );
    setPage(1);
    document.body.click();
  };

  const onFilterReset = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterPayment("Select");
    setAppliedSearch("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setAppliedPaymentMethod("");
    setPage(1);
    document.body.click();
  };

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const amt = Number(String(addForm.amount).replace(/[^0-9.-]/g, ""));
      if (!addForm.income_name.trim() || !Number.isFinite(amt) || amt <= 0) {
        setFormError("Enter a valid income name and amount.");
        setSaving(false);
        return;
      }
      const ymd = toYmdString(addForm.income_date);
      if (!ymd) {
        setFormError("Choose a valid date.");
        setSaving(false);
        return;
      }
      await apiService.createAccountsIncome({
        income_name: addForm.income_name.trim(),
        source: addForm.source.trim() || null,
        description: addForm.description.trim() || null,
        income_date: ymd,
        amount: amt,
        invoice_no: addForm.invoice_no.trim() || null,
        payment_method:
          addForm.payment_method && addForm.payment_method !== "Select" ? addForm.payment_method : null,
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      });
      hideModal("add_income");
      setAddForm({ ...emptyAdd });
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not save income."));
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = selectedRecord?.raw?.id;
    if (id == null) return;
    setSaving(true);
    setFormError(null);
    try {
      const amt = Number(String(editForm.amount).replace(/[^0-9.-]/g, ""));
      if (!editForm.income_name.trim() || !Number.isFinite(amt) || amt <= 0) {
        setFormError("Enter a valid income name and amount.");
        setSaving(false);
        return;
      }
      const ymd = toYmdString(editForm.income_date);
      if (!ymd) {
        setFormError("Choose a valid date.");
        setSaving(false);
        return;
      }
      await apiService.updateAccountsIncome(id, {
        income_name: editForm.income_name.trim(),
        source: editForm.source.trim() || null,
        description: editForm.description.trim() || null,
        income_date: ymd,
        amount: amt,
        invoice_no: editForm.invoice_no.trim() || null,
        payment_method:
          editForm.payment_method && editForm.payment_method !== "Select" ? editForm.payment_method : null,
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      });
      hideModal("edit_income");
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not update income."));
    } finally {
      setSaving(false);
    }
  };

  const submitDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = selectedRecord?.raw?.id;
    if (id == null) return;
    setSaving(true);
    setFormError(null);
    try {
      await apiService.deleteAccountsIncome(id);
      hideModal("delete-modal");
      setSelectedRecord(null);
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not delete income."));
    } finally {
      setSaving(false);
    }
  };

  const addDateVal: Dayjs | null =
    addForm.income_date && /^\d{4}-\d{2}-\d{2}$/.test(addForm.income_date)
      ? dayjs(addForm.income_date)
      : null;
  const editDateVal: Dayjs | null =
    editForm.income_date && /^\d{4}-\d{2}-\d{2}$/.test(editForm.income_date)
      ? dayjs(editForm.income_date)
      : null;

  return (
    <div>
      {" "}
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Income</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Finance &amp; Accounts</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Income
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
                  to="#"
                  className="btn btn-primary d-flex align-items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    openAdd();
                  }}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  Add Income
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
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Income List</h4>
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
                          <div className="col-md-12">
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
      {/* Add Income */}
      <div className="modal fade" id="add_income">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Income</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitAdd}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Income Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addForm.income_name}
                        onChange={(e) => setAddForm((f) => ({ ...f, income_name: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Source</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addForm.source}
                        onChange={(e) => setAddForm((f) => ({ ...f, source: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Date</label>
                      <div className="input-icon position-relative">
                        <span className="input-icon-addon">
                          <i className="ti ti-calendar" />
                        </span>
                        <DatePicker
                          className="form-control datetimepicker"
                          placeholder="Select Date"
                          value={addDateVal}
                          onChange={(d) =>
                            setAddForm((f) => ({
                              ...f,
                              income_date: d && d.isValid() ? d.format("YYYY-MM-DD") : "",
                            }))
                          }
                        />
                      </div>
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Amount</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addForm.amount}
                        onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Invoice No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addForm.invoice_no}
                        onChange={(e) => setAddForm((f) => ({ ...f, invoice_no: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Payment Method</label>
                      <CommonSelect
                        className="select"
                        options={paymentMethod}
                        value={addForm.payment_method}
                        onChange={(v) =>
                          setAddForm((f) => ({ ...f, payment_method: v || "Cash" }))
                        }
                      />
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-0">
                      <label className="form-label">Description</label>
                      <textarea
                        rows={4}
                        className="form-control"
                        value={addForm.description}
                        onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <Link
                  to="#"
                  className="btn btn-light me-2"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Add Income"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Income */}
      {/* Edit Income */}
      <div className="modal fade" id="edit_income">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Income</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Income Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Income Name"
                        value={editForm.income_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, income_name: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-3">
                      <label className="form-label">Source</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Source"
                        value={editForm.source}
                        onChange={(e) => setEditForm((f) => ({ ...f, source: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Date of Birth</label>
                      <DatePicker
                        className="form-control datetimepicker"
                        placeholder="Select Date"
                        value={editDateVal}
                        onChange={(d) =>
                          setEditForm((f) => ({
                            ...f,
                            income_date: d && d.isValid() ? d.format("YYYY-MM-DD") : "",
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Amount</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Amount"
                        value={editForm.amount}
                        onChange={(e) => setEditForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Invoice No</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Invoice No"
                        value={editForm.invoice_no}
                        onChange={(e) => setEditForm((f) => ({ ...f, invoice_no: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div className="col-md-6">
                    <div className="mb-3">
                      <label className="form-label">Payment Method</label>
                      <CommonSelect
                        className="select"
                        options={paymentMethod}
                        value={editForm.payment_method}
                        onChange={(v) =>
                          setEditForm((f) => ({ ...f, payment_method: v || "Cash" }))
                        }
                      />
                    </div>
                  </div>
                  <div className="col-md-12">
                    <div className="mb-0">
                      <label className="form-label">Description</label>
                      <textarea
                        rows={4}
                        className="form-control"
                        placeholder="text"
                        value={editForm.description}
                        onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <Link
                  to="#"
                  className="btn btn-light me-2"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </Link>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Edit Income */}
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
                  You want to delete all the marked items, this cant be undone
                  once you delete.
                </p>
                <div className="d-flex justify-content-center">
                  <Link
                    to="#"
                    className="btn btn-light me-3"
                    data-bs-dismiss="modal"
                  >
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
      {/* View Modal */}
      <div className="modal fade" id="view_invoice">
        <div className="modal-dialog modal-dialog-centered  modal-xl invoice-modal">
          <div className="modal-content">
            <div className="modal-wrapper">
              <div className="invoice-popup-head d-flex align-items-center justify-content-between mb-4">
                <span>
                  <ImageWithBasePath src="assets/img/logo.svg" alt="Img" />
                </span>
                <div className="popup-title">
                  <h2>UNIVERSITY NAME</h2>
                  <p>Original For Recipient</p>
                </div>
              </div>
              <div className="tax-info mb-2">
                <div className="mb-4 text-center">
                  <h1>Tax Invoice</h1>
                </div>
                <div className="row">
                  <div className="col-lg-4">
                    <div className="tax-invoice-info d-flex align-items-center justify-content-between">
                      <h5>Student Name :</h5>
                      <h6>Walter Roberson</h6>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="tax-invoice-info d-flex align-items-center justify-content-between">
                      <h5>Student ID :</h5>
                      <h6>DD465123</h6>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="tax-invoice-info d-flex align-items-center justify-content-between">
                      <h5>Term :</h5>
                      <h6>Term 1</h6>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="tax-invoice-info d-flex align-items-center justify-content-between">
                      <h5>Invoice No :</h5>
                      <h6>{viewingIncome?.invoiceNo || "—"}</h6>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="tax-invoice-info d-flex align-items-center justify-content-between">
                      <h5>Invoice Date :</h5>
                      <h6>{viewingIncome?.date || "—"}</h6>
                    </div>
                  </div>
                  <div className="col-lg-4">
                    <div className="tax-invoice-info d-flex align-items-center justify-content-between">
                      <h5>Due Date :</h5>
                      <h6>{viewingIncome?.date || "—"}</h6>
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <h6 className="mb-1">Bill To :</h6>
                  <p>
                    <span className="text-dark">Walter Roberson</span> <br />
                    299 Star Trek Drive, Panama City, Florida, 32405, USA.{" "}
                    <br />
                    walter@gmail.com <br />
                    +45 5421 4523
                  </p>
                </div>
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
                          <td>{viewingIncome?.description || viewingIncome?.incomeName || "—"}</td>
                          <td>{viewingIncome?.date || "—"}</td>
                          <td>{viewingIncome?.amount || "—"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="row">
                  <div className="col-lg-6">
                    <div className="mb-3">
                      <h5 className="mb-1">Important Note: </h5>
                      <p className="text-dark mb-0">
                        Delivery dates are not guaranteed and Seller has
                      </p>
                      <p className="text-dark">
                        no liability for damages that may be incurred due to any
                        delay. has
                      </p>
                    </div>
                    <div>
                      <h5 className="mb-1">Total amount ( in words):</h5>
                      <p className="text-dark fw-medium">
                        USD Ten Thousand One Hundred Sixty Five Only
                      </p>
                    </div>
                  </div>
                  <div className="col-lg-6">
                    <div className="total-amount-tax">
                      <ul>
                        <li className="fw-medium text-dark">Subtotal</li>
                        <li className="fw-medium text-dark">Discount 0%</li>
                        <li className="fw-medium text-dark">IGST 18.0%</li>
                      </ul>
                      <ul>
                        <li>$10,000.00</li>
                        <li>+ $0.00</li>
                        <li>$10,000.00</li>
                      </ul>
                    </div>
                    <div className="total-amount-tax mb-3">
                      <ul className="total-amount">
                        <li className="text-dark">Amount Payable</li>
                      </ul>
                      <ul className="total-amount">
                        <li className="text-dark">{viewingIncome?.amount || "$0.00"}</li>
                      </ul>
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
                          {viewingIncome?.paymentMethod || "—"}
                        </span>
                      </p>
                      <p className="mb-0">
                        Amount :{" "}
                        <span className="fw-medium text-dark">{viewingIncome?.amount || "—"}</span>
                      </p>
                    </div>
                    <div className="col-lg-6 text-end mb-4 pt-4 ">
                      <h6 className="mb-2">For Dreamguys</h6>
                      <ImageWithBasePath src="assets/img/icons/signature.svg" alt="Img" />
                    </div>
                  </div>
                </div>
                <div className="border-bottom text-center pt-4 pb-4">
                  <span className="text-dark fw-medium">
                    Terms &amp; Conditions :{" "}
                  </span>
                  <p>
                    Here we can write a additional notes for the client to get a
                    better understanding of this invoice.
                  </p>
                </div>
                <p className="text-center pt-3">Thanks for your Business</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /View Modal */}
    </div>
  );
};

export default AccountsIncome;

