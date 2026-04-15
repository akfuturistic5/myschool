
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Table from "../../core/common/dataTable/index";
import PredefinedDateRanges from "../../core/common/datePicker";
import CommonSelect from "../../core/common/commonSelect";
import {
  transactionDate,
  transactionId,
} from "../../core/common/selectoption/selectoption";
import { all_routes } from "../router/all_routes";
import TooltipOption from "../../core/common/tooltipOption";
import { apiService } from "../../core/services/apiService";
import { formatDateMonthDayYear, formatUsdDisplay } from "../../core/utils/dateDisplay";
import { selectSelectedAcademicYearId } from "../../core/data/redux/academicYearSlice";
import { getAccountsErrorMessage } from "./accountsApiErrors";
import { fetchAllAccountsPages, parseAccountsListResponse } from "./accountsListUtils";
import { exportAccountsExcel, exportAccountsPdf, printAccountsData } from "./accountsExportUtils";
import { createAccountsTableChangeHandler } from "./accountsTableHandlers";

function mapTxApiToRow(r: any) {
  const code = r.transaction_code || `FT${String(r.id).padStart(6, "0")}`;
  return {
    key: r.id,
    raw: r,
    id: code,
    description: r.description ?? "",
    date: formatDateMonthDayYear(r.transaction_date),
    amount: formatUsdDisplay(r.amount),
    type: r.transaction_type ?? r.type ?? "",
    method: r.payment_method ?? r.method ?? "",
    status: r.status ?? "",
  };
}

const AccountsTransactions = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [appliedDateFrom, setAppliedDateFrom] = useState("");
  const [appliedDateTo, setAppliedDateTo] = useState("");
  const [appliedTxType, setAppliedTxType] = useState("");
  const [appliedStatus, setAppliedStatus] = useState("");
  const [appliedCategoryId, setAppliedCategoryId] = useState("");
  const [categoryOptions, setCategoryOptions] = useState<{ value: string; label: string }[]>([
    { value: "", label: "All categories" },
  ]);
  const [filterTxType, setFilterTxType] = useState<string | null>("Select");
  const [filterStatus, setFilterStatus] = useState<string | null>("Select");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const sortOrderFor = (field: string) =>
    sortBy === field ? (sortDir === "asc" ? ("ascend" as const) : ("descend" as const)) : null;

  const txListParams = useMemo(
    () => ({
      search: appliedSearch.trim() || undefined,
      transaction_type:
        appliedTxType && ["Income", "Expense"].includes(appliedTxType) ? appliedTxType : undefined,
      status:
        appliedStatus && ["Completed", "Pending"].includes(appliedStatus) ? appliedStatus : undefined,
      category_id: appliedCategoryId || undefined,
      date_from: appliedDateFrom || undefined,
      date_to: appliedDateTo || undefined,
      ...(academicYearId != null ? { academic_year_id: academicYearId } : {}),
      ...(sortBy ? { sort_by: sortBy, sort_order: sortDir } : {}),
    }),
    [
      appliedSearch,
      appliedTxType,
      appliedStatus,
      appliedCategoryId,
      appliedDateFrom,
      appliedDateTo,
      academicYearId,
      sortBy,
      sortDir,
    ]
  );

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
        setCategoryOptions([
          { value: "", label: "All categories" },
          ...data.map((c: any) => ({
            value: String(c.id),
            label: c.category_name || `Category ${c.id}`,
          })),
        ]);
      } catch {
        /* table still works without category filter */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYearId]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiService.getAccountsTransactions({
        ...txListParams,
        page,
        page_size: pageSize,
      });
      const { data: list, total: tot } = parseAccountsListResponse(res);
      setRows(list.map(mapTxApiToRow));
      setTotal(tot);
    } catch (e: unknown) {
      setLoadError(getAccountsErrorMessage(e, "Could not load transactions."));
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [txListParams, page, pageSize]);

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

  const txExportCols = [
    { key: "transaction_code", header: "ID" },
    { key: "description", header: "Description" },
    { key: "transaction_date", header: "Transaction Date" },
    { key: "amount", header: "Amount" },
    { key: "transaction_type", header: "Type" },
    { key: "payment_method", header: "Payment Method" },
    { key: "category_name", header: "Category" },
    { key: "status", header: "Status" },
  ];

  const runExportExcel = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsTransactions({ ...txListParams, ...p })
    );
    const flat = list.map((r) => ({
      transaction_code:
        r.transaction_code ?? `FT${String(r.id ?? "").padStart(6, "0")}`,
      description: r.description ?? "",
      transaction_date: r.transaction_date ?? "",
      amount: r.amount ?? "",
      transaction_type: r.transaction_type ?? "",
      payment_method: r.payment_method ?? "",
      category_name: r.category_name ?? "",
      status: r.status ?? "",
    }));
    exportAccountsExcel(flat, txExportCols, "transactions");
  };

  const runExportPdf = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsTransactions({ ...txListParams, ...p })
    );
    const flat = list.map((r) => ({
      transaction_code:
        r.transaction_code ?? `FT${String(r.id ?? "").padStart(6, "0")}`,
      description: r.description ?? "",
      transaction_date: r.transaction_date ?? "",
      amount: r.amount ?? "",
      transaction_type: r.transaction_type ?? "",
      payment_method: r.payment_method ?? "",
      category_name: r.category_name ?? "",
      status: r.status ?? "",
    }));
    exportAccountsPdf(flat, txExportCols, "transactions", "Transactions");
  };

  const runPrint = async () => {
    const list = await fetchAllAccountsPages<Record<string, unknown>>(async (p) =>
      apiService.getAccountsTransactions({ ...txListParams, ...p })
    );
    const flat = list.map((r) => ({
      transaction_code:
        r.transaction_code ?? `FT${String(r.id ?? "").padStart(6, "0")}`,
      description: r.description ?? "",
      transaction_date: r.transaction_date ?? "",
      amount: r.amount ?? "",
      transaction_type: r.transaction_type ?? "",
      payment_method: r.payment_method ?? "",
      category_name: r.category_name ?? "",
      status: r.status ?? "",
    }));
    printAccountsData("Transactions", txExportCols, flat);
  };

  useEffect(() => {
    load();
  }, [load]);

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
        title: "Description",
        dataIndex: "description",
        key: "description",
        sorter: true,
        sortOrder: sortOrderFor("description"),
      },
      {
        title: "Transaction Date",
        dataIndex: "date",
        key: "transaction_date",
        sorter: true,
        sortOrder: sortOrderFor("transaction_date"),
      },
      {
        title: "Amount",
        dataIndex: "amount",
        key: "amount",
        sorter: true,
        sortOrder: sortOrderFor("amount"),
      },
      {
        title: "Transaction Type",
        dataIndex: "type",
        key: "transaction_type",
        sorter: true,
        sortOrder: sortOrderFor("transaction_type"),
      },
      {
        title: "Payment Method",
        dataIndex: "method",
        key: "payment_method",
        sorter: true,
        sortOrder: sortOrderFor("payment_method"),
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
          status === "Completed"
            ? "badge-soft-success"
            : status === "Pending"
            ? "badge-soft-warning"
            : ""
        }`}
            >
              <i className="ti ti-circle-filled fs-5 me-1" />
              {status}
            </span>
          </>
        ),
      },
    ],
    [sortBy, sortDir]
  );

  const onFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAppliedSearch("");
    setAppliedTxType(
      filterTxType && filterTxType !== "Select" && ["Income", "Expense"].includes(filterTxType)
        ? filterTxType
        : ""
    );
    setAppliedStatus(
      filterStatus && filterStatus !== "Select" && ["Completed", "Pending"].includes(filterStatus)
        ? filterStatus
        : ""
    );
    setPage(1);
    document.body.click();
  };

  const onFilterReset = (e: React.MouseEvent) => {
    e.preventDefault();
    setFilterTxType("Select");
    setFilterStatus("Select");
    setAppliedSearch("");
    setAppliedDateFrom("");
    setAppliedDateTo("");
    setAppliedTxType("");
    setAppliedStatus("");
    setPage(1);
    document.body.click();
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
              <h3 className="page-title mb-1">Transactions</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Finance &amp; Accounts</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Transactions
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
              <h4 className="mb-3">Transactions List</h4>
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
                              <label className="form-label">
                                Transaction Type
                              </label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "Select", label: "Select" },
                                  { value: "Income", label: "Income" },
                                  { value: "Expense", label: "Expense" },
                                ]}
                                value={filterTxType ?? "Select"}
                                onChange={(v) => setFilterTxType(v)}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={[
                                  { value: "Select", label: "Select" },
                                  { value: "Completed", label: "Completed" },
                                  { value: "Pending", label: "Pending" },
                                ]}
                                value={filterStatus ?? "Select"}
                                onChange={(v) => setFilterStatus(v)}
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
    </div>
  );
};

export default AccountsTransactions;
