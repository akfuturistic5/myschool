import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../router/all_routes";
import { apiService } from "../../core/services/apiService";
import { selectUser } from "../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../core/data/redux/academicYearSlice";
import { exportToExcel, exportToPDF, printData } from "../../core/utils/exportUtils";

const DEFAULT_FORM = {
  enquiry_date: new Date().toISOString().slice(0, 10),
  name: "",
  mobile_number: "",
  address: "",
  enquiry_about: "",
  description: "",
  email: "",
};

const roleCanManage = (role: string, roleId: number) =>
  roleId === 1 ||
  roleId === 2 ||
  roleId === 6 ||
  role === "admin" ||
  role === "headmaster" ||
  role === "administrative" ||
  role === "teacher";

const readableDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
};

const splitTextByWords = (value: string | null | undefined, wordsPerLine = 10) => {
  const normalized = String(value || "").trim();
  if (!normalized) return ["-"];
  const words = normalized.split(/\s+/);
  const lines: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerLine) {
    lines.push(words.slice(i, i + wordsPerLine).join(" "));
  }
  return lines;
};

const Enquiries = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const selectedAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const normalizedRole = String(user?.role || "").trim().toLowerCase();
  const roleId = Number(user?.role_id ?? user?.user_role_id ?? 0);
  const canManage = roleCanManage(normalizedRole, roleId);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [addedByFilter, setAddedByFilter] = useState("all");

  const loadEnquiries = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getEnquiries({
        academic_year_id: selectedAcademicYearId || undefined,
        search: debouncedSearchText || undefined,
        month: filterMonth || undefined,
        from_date: fromDate || undefined,
        to_date: toDate || undefined,
        added_by: addedByFilter || "all",
      });
      setRows(Array.isArray(response?.data) ? response.data : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Failed to fetch enquiries.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEnquiries();
  }, [selectedAcademicYearId]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  useEffect(() => {
    loadEnquiries();
  }, [debouncedSearchText, filterMonth, fromDate, toDate, addedByFilter]);

  const filteredRows = useMemo(() => rows, [rows]);
  const exportColumns = useMemo(
    () => [
      { title: "SR", dataKey: "sr" },
      { title: "ENQUIRY DATE", dataKey: "enquiry_date" },
      { title: "NAME", dataKey: "name" },
      { title: "MOBILE NUMBER", dataKey: "mobile_number" },
      { title: "EMAIL", dataKey: "email" },
      { title: "ADDRESS", dataKey: "address" },
      { title: "ENQUIRY ABOUT", dataKey: "enquiry_about" },
      { title: "DESCRIPTION", dataKey: "description" },
      { title: "ADDED BY", dataKey: "created_by_name" },
    ],
    []
  );
  const exportRows = useMemo(
    () =>
      (filteredRows || []).map((item, index) => ({
        sr: index + 1,
        enquiry_date: readableDate(item.enquiry_date),
        name: item.name || "-",
        mobile_number: item.mobile_number || "-",
        email: item.email || "-",
        address: item.address || "-",
        enquiry_about: item.enquiry_about || "-",
        description: item.description || "-",
        created_by_name: item.created_by_name || "-",
      })),
    [filteredRows]
  );

  const handleExportExcel = () => {
    if (!exportRows.length) return;
    exportToExcel(exportRows, "enquiries-list", "Enquiries");
  };

  const handleExportPdf = () => {
    if (!exportRows.length) return;
    exportToPDF(exportRows, "Enquiries", "enquiries-list", exportColumns);
  };

  const handlePrint = () => {
    if (!exportRows.length) return;
    printData("Enquiries", exportColumns, exportRows);
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAcademicYearId) {
      setError("Please select an academic year from header first.");
      return;
    }
    try {
      setFormLoading(true);
      setError(null);
      setSuccessMessage(null);
      await apiService.createEnquiry({
        ...form,
        academic_year_id: selectedAcademicYearId,
      });
      setForm(DEFAULT_FORM);
      setSuccessMessage("Enquiry added successfully.");
      await loadEnquiries();
    } catch (err: any) {
      setError(err?.message || "Failed to create enquiry.");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Enquiries</h3>
            <ol className="breadcrumb mb-0">
              <li className="breadcrumb-item">
                <Link to={routes.adminDashboard}>Dashboard</Link>
              </li>
              <li className="breadcrumb-item active">Enquiries</li>
            </ol>
          </div>
        </div>

        {canManage && (
          <div className="card mb-3">
            <div className="card-header">
              <h5 className="mb-0">Add Enquiry</h5>
            </div>
            <div className="card-body">
              <form onSubmit={onSubmit}>
                <div className="row g-2">
                  <div className="col-md-2">
                    <label className="form-label">Enquiry Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.enquiry_date}
                      onChange={(e) => setForm((prev) => ({ ...prev, enquiry_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      maxLength={160}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Mobile Number</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.mobile_number}
                      onChange={(e) => setForm((prev) => ({ ...prev, mobile_number: e.target.value }))}
                      maxLength={20}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Enquiry About</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.enquiry_about}
                      onChange={(e) => setForm((prev) => ({ ...prev, enquiry_about: e.target.value }))}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Email (Optional)</label>
                    <input
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                      maxLength={254}
                      placeholder="example@mail.com"
                    />
                  </div>
                  <div className="col-md-4">
                    <label className="form-label">Address</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.address}
                      onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
                      maxLength={500}
                    />
                  </div>
                  <div className="col-md-8">
                    <label className="form-label">Description</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.description}
                      onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                      maxLength={2000}
                    />
                  </div>
                  <div className="col-12 d-flex gap-2 mt-2">
                    <button type="submit" className="btn btn-primary" disabled={formLoading}>
                      {formLoading ? "Saving..." : "Add Enquiry"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            <div className="d-flex align-items-center justify-content-between mb-2">
              <h5 className="mb-0">Enquiry List</h5>
              <div className="dropdown">
                <button
                  type="button"
                  className="btn btn-outline-light bg-white dropdown-toggle"
                  data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                  disabled={!exportRows.length}
                >
                  <i className="ti ti-file-export me-2" />
                  Export
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <button type="button" className="dropdown-item" onClick={handleExportPdf}>
                      Export as PDF
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={handleExportExcel}>
                      Export as Excel
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={handlePrint}>
                      Print
                    </button>
                  </li>
                </ul>
              </div>
            </div>
            <div className="overflow-auto">
              <div className="d-flex flex-nowrap align-items-end gap-2">
                <div style={{ minWidth: "260px" }}>
                  <label className="form-label mb-1">Search</label>
                  <input
                    className="form-control bg-white border"
                    placeholder="Search name/mobile/about"
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                  />
                </div>
                <div style={{ width: "170px", flex: "0 0 170px" }}>
                  <label className="form-label mb-1">Filter by Month</label>
                  <input
                    type="month"
                    className="form-control bg-white border"
                    style={{ width: "170px" }}
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(e.target.value)}
                  />
                </div>
                <div style={{ width: "170px", flex: "0 0 170px" }}>
                  <label className="form-label mb-1">From Date</label>
                  <input
                    type="date"
                    className="form-control bg-white border"
                    style={{ width: "170px" }}
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                  />
                </div>
                <div style={{ width: "170px", flex: "0 0 170px" }}>
                  <label className="form-label mb-1">To Date</label>
                  <input
                    type="date"
                    className="form-control bg-white border"
                    style={{ width: "170px" }}
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                  />
                </div>
                <div style={{ width: "170px", flex: "0 0 170px" }}>
                  <label className="form-label mb-1">Added By</label>
                  <select
                    className="form-select bg-white border"
                    style={{ width: "170px" }}
                    value={addedByFilter}
                    onChange={(e) => setAddedByFilter(e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="me">Only Added By Me</option>
                    <option value="headmaster">Headmaster Only</option>
                    <option value="administrative">Administrative Only</option>
                    <option value="teacher">Teacher Only</option>
                  </select>
                </div>
                <div style={{ minWidth: "160px" }}>
                  <button
                    type="button"
                    className="btn btn-outline-secondary w-100"
                    onClick={() => {
                      setFilterMonth("");
                      setFromDate("");
                      setToDate("");
                      setAddedByFilter("all");
                      setSearchText("");
                    }}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}
            {successMessage && <div className="alert alert-success">{successMessage}</div>}
            {loading ? (
              <div className="text-muted">Loading enquiries...</div>
            ) : (
              <div className="table-responsive">
                <table className="table table-striped table-bordered align-middle">
                  <thead>
                    <tr>
                      <th>SR</th>
                      <th>ENQUIRY DATE</th>
                      <th>NAME</th>
                      <th>MOBILE NUMBER</th>
                      <th>EMAIL</th>
                      <th>ADDRESS</th>
                      <th>ENQUIRY ABOUT</th>
                      <th>DESCRIPTION</th>
                      <th>ADDED BY</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>{readableDate(item.enquiry_date)}</td>
                        <td>{item.name || "-"}</td>
                        <td>{item.mobile_number || "-"}</td>
                        <td>{item.email || "-"}</td>
                        <td>{item.address || "-"}</td>
                        <td>{item.enquiry_about || "-"}</td>
                        <td>
                          {splitTextByWords(item.description, 10).map((line, idx) => (
                            <div key={`${item.id}-desc-${idx}`}>{line}</div>
                          ))}
                        </td>
                        <td>{item.created_by_name || "-"}</td>
                      </tr>
                    ))}
                    {!filteredRows.length && (
                      <tr>
                        <td colSpan={9} className="text-center text-muted">
                          No enquiries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Enquiries;





