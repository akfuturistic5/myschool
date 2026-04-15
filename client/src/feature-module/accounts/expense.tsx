
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import Table from "../../core/common/dataTable/index";
import PredefinedDateRanges from "../../core/common/datePicker";
import CommonSelect from "../../core/common/commonSelect";
import {
  expenseName,
  invoiceNumber,
  paymentMethod,
} from "../../core/common/selectoption/selectoption";
import { DatePicker } from "antd";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import { apiService } from "../../core/services/apiService";
import { formatDateMonthDayYear, formatUsdDisplay, toYmdString } from "../../core/utils/dateDisplay";
import { selectSelectedAcademicYearId } from "../../core/data/redux/academicYearSlice";
import { getAccountsErrorMessage } from "./accountsApiErrors";
import { fetchAllAccountsPages, parseAccountsListResponse } from "./accountsListUtils";
import { exportAccountsExcel, exportAccountsPdf, printAccountsData } from "./accountsExportUtils";
import { createAccountsTableChangeHandler } from "./accountsTableHandlers";

function mapExpenseApiToRow(r: any) {
  return {
    key: r.id,
    raw: r,
    id: r.expense_code,
    expenseName: r.expense_name ?? "",
    description: r.description ?? "",
    category: r.category_name ?? "",
    date: formatDateMonthDayYear(r.expense_date),
    amount: formatUsdDisplay(r.amount),
    invoiceNo: r.invoice_no ?? "",
    paymentMethod: r.payment_method ?? "",
  };
}

const Expense = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([]);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [appliedCategoryId, setAppliedCategoryId] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState<string | null>("");
  const [filterStatus, setFilterStatus] = useState<string | null>("");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortOrderFor = (field: string) =>
    sortBy === field ? (sortDir === "asc" ? ("ascend" as const) : ("descend" as const)) : null;

  const expenseListParams = useMemo(
    () => ({
      search: appliedSearch.trim() || undefined,
      category_id: appliedCategoryId || undefined,
      status: appliedStatus || undefined,
      date_from: appliedDateFrom || undefined,
      date_to: appliedDateTo || undefined,
      ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      ...(sortBy ? { sort_by: sortBy, sort_order: sortDir } : {}),
    }),
    [
      appliedSearch,
      appliedCategoryId,
      appliedStatus,
      appliedDateFrom,
      appliedDateTo,
      academicYearId,
      sortBy,
      sortDir,
    ]
  );

  const emptyForm = {
    expense_name: "",
    category_id: "" as string,
    description: "",
    expense_date: "" as string,
    amount: "",
    invoice_no: "",
    payment_method: "Cash",
    status: "Completed",
  };
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getAccountsExpenseCategories({
          ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
          page_size: 500,
        });
        const { data } = parseAccountsListResponse(res);
        if (cancelled) return;
        setCategoryOptions(
          data.map((c: any) => ({
            value: String(c.id),
            label: c.category_name || `Category ${c.id}`,
          }))
        );
      } catch {
        setCategoryOptions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYearId]);

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
      const res = await apiService.getAccountsExpenses({
        ...expenseListParams,
        page,
        page_size: pageSize,
      });
      const { data: list, total: tot } = parseAccountsListResponse(res);
      setRows(list.map(mapExpenseApiToRow));
      setTotal(tot);
    } catch (e: unknown) {
      setLoadError(getAccountsErrorMessage(e, "Could not load expenses."));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [expenseListParams, page, pageSize]);

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

  const expenseExportColumns = [
    { key: "expense_code", header: "ID" },
    { key: "expense_name", header: "Expense Name" },
    { key: "description", header: "Description" },
    { key: "category_name", header: "Category" },
    { key: "expense_date", header: "Date" },
    { key: "amount", header: "Amount" },
    { key: "invoice_no", header: "Invoice No" },
    { key: "payment_method", header: "Payment Method" },
  ];

  const runExportExcel = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsExpenses({ ...expenseListParams, ...p })
    );
    const flat = list.map((r) => ({
      expense_code: r.expense_code ?? "",
      expense_name: r.expense_name ?? "",
      description: r.description ?? "",
      category_name: r.category_name ?? "",
      expense_date: r.expense_date ?? "",
      amount: r.amount ?? "",
      invoice_no: r.invoice_no ?? "",
      payment_method: r.payment_method ?? "",
    }));
    exportAccountsExcel(flat, expenseExportColumns, "expenses");
  };

  const runExportPdf = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsExpenses({ ...expenseListParams, ...p })
    );
    const flat = list.map((r) => ({
      expense_code: r.expense_code ?? "",
      expense_name: r.expense_name ?? "",
      description: r.description ?? "",
      category_name: r.category_name ?? "",
      expense_date: r.expense_date ?? "",
      amount: r.amount ?? "",
      invoice_no: r.invoice_no ?? "",
      payment_method: r.payment_method ?? "",
    }));
    exportAccountsPdf(flat, expenseExportColumns, "expenses", "Expenses");
  };

  const runPrint = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsExpenses({ ...expenseListParams, ...p })
    );
    const flat = list.map((r) => ({
      expense_code: r.expense_code ?? "",
      expense_name: r.expense_name ?? "",
      description: r.description ?? "",
      category_name: r.category_name ?? "",
      expense_date: r.expense_date ?? "",
      amount: r.amount ?? "",
      invoice_no: r.invoice_no ?? "",
      payment_method: r.payment_method ?? "",
    }));
    printAccountsData("Expenses", expenseExportColumns, flat);
  };

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setFormError(null);
    setAddForm({ ...emptyForm, category_id: categoryOptions[0]?.value || "" });
    setTimeout(() => showModal("add_expenses"), 0);
  };

  const openEdit = useCallback(
    (record: any) => {
      const r = record.raw;
      setSelectedRecord(record);
      setEditForm({
        expense_name: r.expense_name || "",
        category_id: r.category_id != null ? String(r.category_id) : "",
        description: r.description || "",
        expense_date: r.expense_date ? String(r.expense_date).slice(0, 10) : "",
        amount: r.amount != null ? String(r.amount) : "",
        invoice_no: r.invoice_no || "",
        payment_method: r.payment_method && r.payment_method !== "Select" ? r.payment_method : "Cash",
        status: r.status === "Pending" ? "Pending" : "Completed",
      });
      setFormError(null);
      setTimeout(() => showModal("edit_expenses"), 0);
    },
    []
  );

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
        render: (text: any) => (
          <Link to="#" className="link-primary">
            {text}
          </Link>
        ),
      },
      {
        title: "Expense Name",
        dataIndex: "expenseName",
        key: "expense_name",
        sorter: true,
        sortOrder: sortOrderFor("expense_name"),
      },
      {
        title: "Description",
        dataIndex: "description",
        key: "description",
        sorter: true,
        sortOrder: sortOrderFor("description"),
      },
      {
        title: "Category",
        dataIndex: "category",
        key: "category_name",
        sorter: true,
        sortOrder: sortOrderFor("category_name"),
      },
      {
        title: "Date",
        dataIndex: "date",
        key: "expense_date",
        sorter: true,
        sortOrder: sortOrderFor("expense_date"),
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
        render: (text: any) => (
          <Link to="#" className="link-primary">
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
            <div className="d-flex align-items-center">
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
            </div>
          </>
        ),
      },
    ],
    [openEdit, openDelete, sortBy, sortDir]
  );

  const onFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch("");
    setAppliedCategoryId(filterCategoryId && filterCategoryId !== "" ? filterCategoryId : "");
    setAppliedStatus(
      filterStatus && filterStatus !== "" && (filterStatus === "Completed" || filterStatus === "Pending")
        ? filterStatus
        : ""
    );
    setPage(1);
    document.body.click();
  };

  const onFilterReset = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterCategoryId("");
    setFilterStatus("");
    setAppliedSearch("");
    setAppliedCategoryId("");
    setAppliedStatus("");
    setPage(1);
    document.body.click();
  };

  const categorySelectOptions = [{ value: "Select", label: "Select" }, ...categoryOptions];

  const submitAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const amt = Number(String(addForm.amount).replace(/[^0-9.-]/g, ""));
      const cid = parseInt(addForm.category_id, 10);
      if (!addForm.expense_name.trim() || !Number.isFinite(cid) || !Number.isFinite(amt) || amt <= 0) {
        setFormError("Enter expense name, category, and a valid amount.");
        setSaving(false);
        return;
      }
      const ymd = toYmdString(addForm.expense_date);
      if (!ymd) {
        setFormError("Choose a valid date.");
        setSaving(false);
        return;
      }
      await apiService.createAccountsExpense({
        expense_name: addForm.expense_name.trim(),
        category_id: cid,
        expense_date: ymd,
        amount: amt,
        description: addForm.description.trim() || null,
        invoice_no: addForm.invoice_no.trim() || null,
        payment_method:
          addForm.payment_method && addForm.payment_method !== "Select" ? addForm.payment_method : null,
        status: addForm.status === "Pending" ? "Pending" : "Completed",
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      });
      hideModal("add_expenses");
      setAddForm({ ...emptyForm });
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not save expense."));
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
      const cid = parseInt(editForm.category_id, 10);
      if (!editForm.expense_name.trim() || !Number.isFinite(cid) || !Number.isFinite(amt) || amt <= 0) {
        setFormError("Enter expense name, category, and a valid amount.");
        setSaving(false);
        return;
      }
      const ymd = toYmdString(editForm.expense_date);
      if (!ymd) {
        setFormError("Choose a valid date.");
        setSaving(false);
        return;
      }
      await apiService.updateAccountsExpense(id, {
        expense_name: editForm.expense_name.trim(),
        category_id: cid,
        expense_date: ymd,
        amount: amt,
        description: editForm.description.trim() || null,
        invoice_no: editForm.invoice_no.trim() || null,
        payment_method:
          editForm.payment_method && editForm.payment_method !== "Select" ? editForm.payment_method : null,
        status: editForm.status === "Pending" ? "Pending" : "Completed",
        ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      });
      hideModal("edit_expenses");
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not update expense."));
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
      await apiService.deleteAccountsExpense(id);
      hideModal("delete-modal");
      setSelectedRecord(null);
      await load();
    } catch (err: unknown) {
      setFormError(getAccountsErrorMessage(err, "Could not delete expense."));
    } finally {
      setSaving(false);
    }
  };

  const addDateVal: Dayjs | null =
    addForm.expense_date && /^\d{4}-\d{2}-\d{2}$/.test(addForm.expense_date)
      ? dayjs(addForm.expense_date)
      : null;
  const editDateVal: Dayjs | null =
    editForm.expense_date && /^\d{4}-\d{2}-\d{2}$/.test(editForm.expense_date)
      ? dayjs(editForm.expense_date)
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
              <h3 className="page-title mb-1">Expense</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Finance &amp; Accounts</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Expense
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
                  Add Expense
                </Link>
              </div>
            </div>
          </div>
          {/* Page Header */}
          {loadError && (
            <div className="alert alert-danger" role="alert">
              {loadError}
            </div>
          )}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Expense List</h4>
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
                              <label className="form-label">Category</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "", label: "All categories" },
                                  ...categoryOptions,
                                ]}
                                value={filterCategoryId ?? ""}
                                onChange={(v) => setFilterCategoryId(v || "")}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "", label: "All statuses" },
                                  { value: "Completed", label: "Completed" },
                                  { value: "Pending", label: "Pending" },
                                ]}
                                value={filterStatus ?? ""}
                                onChange={(v) => setFilterStatus(v || "")}
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
      {/* Add Expenses */}
      <div className="modal fade" id="add_expenses">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Add Expense</h4>
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
                      <label className="form-label">Expense Name</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addForm.expense_name}
                        onChange={(e) => setAddForm((f) => ({ ...f, expense_name: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Category</label>
                      <CommonSelect
                        className="select"
                        options={categorySelectOptions.filter((o) => o.value !== "Select")}
                        value={addForm.category_id || undefined}
                        onChange={(v) => setAddForm((f) => ({ ...f, category_id: v || "" }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Date</label>
                      <DatePicker
                        className="form-control w-100"
                        placeholder="Select Date"
                        value={addDateVal}
                        onChange={(d) =>
                          setAddForm((f) => ({
                            ...f,
                            expense_date: d && d.isValid() ? d.format("YYYY-MM-DD") : "",
                          }))
                        }
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Amount</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addForm.amount}
                        onChange={(e) => setAddForm((f) => ({ ...f, amount: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Invoice No</label>
                      <input
                        type="text"
                        className="form-control"
                        value={addForm.invoice_no}
                        onChange={(e) => setAddForm((f) => ({ ...f, invoice_no: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Payment Method</label>
                      <CommonSelect
                        className="select"
                        options={paymentMethod}
                        value={addForm.payment_method}
                        onChange={(v) => setAddForm((f) => ({ ...f, payment_method: v || "Cash" }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Status</label>
                      <CommonSelect
                        className="select"
                        options={[
                          { value: "Completed", label: "Completed" },
                          { value: "Pending", label: "Pending" },
                        ]}
                        value={addForm.status}
                        onChange={(v) => setAddForm((f) => ({ ...f, status: v || "Completed" }))}
                      />
                    </div>
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
                  {saving ? "Saving…" : "Add Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
      {/* /Add Expenses */}
      {/* Edit Expenses */}
      <div className="modal fade" id="edit_expenses">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Edit Expense</h4>
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
                      <label className="form-label">Expense Name</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Enter Expense Name"
                        value={editForm.expense_name}
                        onChange={(e) => setEditForm((f) => ({ ...f, expense_name: e.target.value }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Category</label>
                      <CommonSelect
                        className="select"
                        options={categoryOptions}
                        value={editForm.category_id || undefined}
                        onChange={(v) => setEditForm((f) => ({ ...f, category_id: v || "" }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Date</label>
                      <DatePicker
                        className="form-control w-100"
                        placeholder="Select Date"
                        value={editDateVal}
                        onChange={(d) =>
                          setEditForm((f) => ({
                            ...f,
                            expense_date: d && d.isValid() ? d.format("YYYY-MM-DD") : "",
                          }))
                        }
                      />
                    </div>
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
                    <div className="mb-3">
                      <label className="form-label">Payment Method</label>
                      <CommonSelect
                        className="select"
                        options={paymentMethod}
                        value={editForm.payment_method}
                        onChange={(v) => setEditForm((f) => ({ ...f, payment_method: v || "Cash" }))}
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">Status</label>
                      <CommonSelect
                        className="select"
                        options={[
                          { value: "Completed", label: "Completed" },
                          { value: "Pending", label: "Pending" },
                        ]}
                        value={editForm.status}
                        onChange={(v) => setEditForm((f) => ({ ...f, status: v || "Completed" }))}
                      />
                    </div>
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
      {/* /Edit Expenses */}
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
    </div>
  );
};

export default Expense;
