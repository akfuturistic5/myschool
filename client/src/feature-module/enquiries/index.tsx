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
  enquiry_type: "",
  student_name: "",
  gender: "",
  date_of_birth: "",
  parent_name: "",
  mobile_number: "",
  previous_school: "",
  target_class_id: "",
  source: "",
  status: "Open",
  address: "",
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

/** Admin / Administrative / headmaster aliases — can log follow-ups on any enquiry */
const isFollowUpPrivilegedUser = (role: string, roleId: number) =>
  roleId === 1 ||
  roleId === 6 ||
  role === "admin" ||
  role === "headmaster" ||
  role === "administrative" ||
  role === "administrator";

const canAccessFollowUpsForEnquiry = (
  role: string,
  roleId: number,
  enquiryCreatedBy: number | null | undefined,
  currentUserId: number | undefined
) =>
  isFollowUpPrivilegedUser(role, roleId) ||
  (Number(enquiryCreatedBy) > 0 && Number(enquiryCreatedBy) === Number(currentUserId));

/** Same as who may log follow-ups: owner or headmaster/admin (not counselor-only). */
const canEditEnquiryStatusFromActivity = (
  role: string,
  roleId: number,
  enquiryOwnerUserId: number | null | undefined,
  currentUserId: number | undefined
) =>
  isFollowUpPrivilegedUser(role, roleId) ||
  (Number(enquiryOwnerUserId) > 0 && Number(enquiryOwnerUserId) === Number(currentUserId));

const ENQUIRY_STATUS_OPTIONS = ["Open", "In Progress", "Converted", "Lost"] as const;

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

const readableDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
};

const toDatetimeLocalValue = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

const formatCounselorOptionLabel = (c: {
  id: number;
  display_name?: string;
  username?: string;
  employee_code?: string;
  designation_name?: string | null;
}) => {
  const name =
    (c.display_name && String(c.display_name).trim()) ||
    [c.username, c.employee_code].filter(Boolean).join(" · ") ||
    `Staff #${c.id}`;
  const des = c.designation_name && String(c.designation_name).trim();
  return des ? `${name} (${des})` : `${name} (Staff)`;
};

const Enquiries = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const selectedAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const normalizedRole = String(user?.role || "").trim().toLowerCase();
  const roleId = Number(user?.user_role_id ?? 0);
  const canManage = roleCanManage(normalizedRole, roleId);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [classOptions, setClassOptions] = useState<Array<{ id: number; class_name?: string }>>([]);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearchText, setDebouncedSearchText] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [addedByFilter, setAddedByFilter] = useState("all");

  const [followUpModalEnquiry, setFollowUpModalEnquiry] = useState<any | null>(null);
  const [followUpForm, setFollowUpForm] = useState({
    remarks: "",
    follow_up_datetime: "",
    next_follow_up_date: "",
    counselor_id: "",
  });
  const [followUpSubmitting, setFollowUpSubmitting] = useState(false);
  const [counselorOptions, setCounselorOptions] = useState<
    Array<{
      id: number;
      display_name?: string;
      employee_code?: string;
      username?: string;
      designation_name?: string | null;
    }>
  >([]);
  const [counselorsLoading, setCounselorsLoading] = useState(false);
  const [activityRows, setActivityRows] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);
  const [listViewTab, setListViewTab] = useState<"enquiries" | "followups">("enquiries");

  const [pendingEnquiryStatus, setPendingEnquiryStatus] = useState<Record<number, string>>({});
  const [enquiryStatusSavingId, setEnquiryStatusSavingId] = useState<number | null>(null);

  const followUpPrivileged = isFollowUpPrivilegedUser(normalizedRole, roleId);
  const showListSwitcher = canManage && Boolean(selectedAcademicYearId);

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
    let mounted = true;
    (async () => {
      try {
        const response = await apiService.getClasses();
        if (!mounted) return;
        setClassOptions(Array.isArray(response?.data) ? response.data : []);
      } catch {
        if (!mounted) return;
        setClassOptions([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchText(searchText.trim());
    }, 300);
    return () => window.clearTimeout(timeoutId);
  }, [searchText]);

  useEffect(() => {
    loadEnquiries();
  }, [debouncedSearchText, filterMonth, fromDate, toDate, addedByFilter]);

  const loadFollowUpActivity = async () => {
    if (!canManage || !selectedAcademicYearId) return;
    try {
      setActivityLoading(true);
      const response = await apiService.getEnquiryFollowUpActivity({
        academic_year_id: selectedAcademicYearId,
        limit: 75,
      });
      setActivityRows(Array.isArray(response?.data) ? response.data : []);
    } catch {
      setActivityRows([]);
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    if (canManage && selectedAcademicYearId) {
      loadFollowUpActivity();
    } else {
      setActivityRows([]);
    }
  }, [canManage, selectedAcademicYearId]);

  useEffect(() => {
    if (!canManage || !selectedAcademicYearId) {
      setListViewTab("enquiries");
    }
  }, [canManage, selectedAcademicYearId]);

  const filteredRows = useMemo(() => rows, [rows]);
  /** Calendar day of follow-up (datetime-local) — used as min for next follow-up date */
  const nextFollowUpDateMin = useMemo(() => {
    const v = followUpForm.follow_up_datetime;
    if (typeof v === "string" && v.length >= 10) return v.slice(0, 10);
    return undefined;
  }, [followUpForm.follow_up_datetime]);
  const exportColumns = useMemo(
    () => [
      { title: "SR", dataKey: "sr" },
      { title: "ENQUIRY DATE", dataKey: "enquiry_date" },
      { title: "STUDENT NAME", dataKey: "student_name" },
      { title: "PARENT NAME", dataKey: "parent_name" },
      { title: "MOBILE NUMBER", dataKey: "mobile_number" },
      { title: "EMAIL", dataKey: "email" },
      { title: "TYPE", dataKey: "enquiry_type" },
      { title: "STATUS", dataKey: "status" },
      { title: "ADDRESS", dataKey: "address" },
      { title: "TARGET CLASS", dataKey: "target_class_name" },
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
        student_name: item.student_name || "-",
        parent_name: item.parent_name || "-",
        mobile_number: item.mobile_number || "-",
        email: item.email || "-",
        enquiry_type: item.enquiry_type || "-",
        status: item.status || "-",
        address: item.address || "-",
        target_class_name: item.target_class_name || "-",
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
      const payload = {
        ...form,
        target_class_id: form.target_class_id ? Number(form.target_class_id) : null,
        academic_year_id: selectedAcademicYearId,
      };
      if (editingId) {
        await apiService.updateEnquiry(editingId, payload);
      } else {
        await apiService.createEnquiry(payload);
      }
      setForm(DEFAULT_FORM);
      setEditingId(null);
      setSuccessMessage(editingId ? "Enquiry updated successfully." : "Enquiry added successfully.");
      await loadEnquiries();
    } catch (err: any) {
      setError(err?.message || "Failed to create enquiry.");
    } finally {
      setFormLoading(false);
    }
  };

  const startEdit = (item: any) => {
    setEditingId(Number(item.id));
    setForm({
      enquiry_date: item.enquiry_date || DEFAULT_FORM.enquiry_date,
      enquiry_type: item.enquiry_type || "",
      student_name: item.student_name || "",
      gender: item.gender || "",
      date_of_birth: item.date_of_birth || "",
      parent_name: item.parent_name || "",
      mobile_number: item.mobile_number || "",
      previous_school: item.previous_school || "",
      target_class_id: item.target_class_id ? String(item.target_class_id) : "",
      source: item.source || "",
      status: item.status || "Open",
      address: item.address || "",
      description: item.description || "",
      email: item.email || "",
    });
    setSuccessMessage(null);
    setError(null);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this enquiry?")) return;
    try {
      setError(null);
      setSuccessMessage(null);
      await apiService.deleteEnquiry(id);
      if (editingId === id) {
        setEditingId(null);
        setForm(DEFAULT_FORM);
      }
      setSuccessMessage("Enquiry deleted successfully.");
      await loadEnquiries();
    } catch (err: any) {
      setError(err?.message || "Failed to delete enquiry.");
    }
  };

  const saveEnquiryStatusFromActivity = async (
    enquiryId: number,
    enquiryOwnerUserId: number | null | undefined
  ) => {
    if (!canEditEnquiryStatusFromActivity(normalizedRole, roleId, enquiryOwnerUserId, user?.id)) return;
    const row = activityRows.find((r) => Number(r.enquiry_id) === enquiryId);
    const current = String(row?.enquiry_status || "Open");
    const draft = pendingEnquiryStatus[enquiryId] !== undefined ? pendingEnquiryStatus[enquiryId] : current;
    if (draft === current) return;
    try {
      setEnquiryStatusSavingId(enquiryId);
      setError(null);
      await apiService.patchEnquiryStatus(enquiryId, { status: draft });
      setPendingEnquiryStatus((prev) => {
        const next = { ...prev };
        delete next[enquiryId];
        return next;
      });
      setSuccessMessage("Enquiry status updated.");
      await loadFollowUpActivity();
      await loadEnquiries();
    } catch (err: any) {
      setError(err?.message || "Failed to update enquiry status.");
    } finally {
      setEnquiryStatusSavingId(null);
    }
  };

  const openFollowUpModal = async (item: any) => {
    if (!canManage) return;
    if (!canAccessFollowUpsForEnquiry(normalizedRole, roleId, item?.created_by, user?.id)) return;
    setFollowUpModalEnquiry(item);
    setSuccessMessage(null);
    setFollowUpForm({
      remarks: "",
      follow_up_datetime: toDatetimeLocalValue(new Date()),
      next_follow_up_date: "",
      counselor_id: "",
    });
    setCounselorOptions([]);
    setCounselorsLoading(true);
    setError(null);
    try {
      const counselorsRes = await apiService.getEnquiryFollowUpCounselors();
      setCounselorOptions(Array.isArray(counselorsRes?.data) ? counselorsRes.data : []);
    } catch (err: any) {
      setCounselorOptions([]);
      setError(err?.message || "Failed to load counselor list.");
      setFollowUpModalEnquiry(null);
    } finally {
      setCounselorsLoading(false);
    }
  };

  const closeFollowUpModal = () => {
    setFollowUpModalEnquiry(null);
    setCounselorOptions([]);
    setFollowUpForm({
      remarks: "",
      follow_up_datetime: "",
      next_follow_up_date: "",
      counselor_id: "",
    });
  };

  const submitFollowUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpModalEnquiry?.id) return;
    const remarks = String(followUpForm.remarks || "").trim();
    if (!remarks) {
      setError("Please enter follow-up remarks.");
      return;
    }
    const dt = followUpForm.follow_up_datetime
      ? new Date(followUpForm.follow_up_datetime)
      : new Date();
    if (Number.isNaN(dt.getTime())) {
      setError("Invalid follow-up date and time.");
      return;
    }
    const followLocalDay =
      followUpForm.follow_up_datetime && followUpForm.follow_up_datetime.length >= 10
        ? followUpForm.follow_up_datetime.slice(0, 10)
        : null;
    if (
      followUpForm.next_follow_up_date &&
      followLocalDay &&
      followUpForm.next_follow_up_date < followLocalDay
    ) {
      setError("Next follow-up date must be on or after the follow-up date.");
      return;
    }
    try {
      setFollowUpSubmitting(true);
      setError(null);
      const payload: Record<string, unknown> = {
        remarks,
        follow_up_date: dt.toISOString(),
      };
      if (followUpForm.next_follow_up_date) {
        payload.next_follow_up_date = followUpForm.next_follow_up_date;
      }
      if (followUpForm.counselor_id) {
        payload.counselor_id = Number(followUpForm.counselor_id);
      }
      await apiService.createEnquiryFollowUp(Number(followUpModalEnquiry.id), payload);
      await loadFollowUpActivity();
      setSuccessMessage("Follow-up saved successfully.");
      closeFollowUpModal();
    } catch (err: any) {
      setError(err?.message || "Failed to save follow-up.");
    } finally {
      setFollowUpSubmitting(false);
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
                  <div className="col-md-3">
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
                    <label className="form-label">Student Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.student_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, student_name: e.target.value }))}
                      maxLength={200}
                      required
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Parent Name</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.parent_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, parent_name: e.target.value }))}
                      maxLength={200}
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
                  <div className="col-md-3">
                    <label className="form-label">Enquiry Type</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.enquiry_type}
                      onChange={(e) => setForm((prev) => ({ ...prev, enquiry_type: e.target.value }))}
                      maxLength={30}
                    />
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">Gender</label>
                    <select
                      className="form-select"
                      value={form.gender}
                      onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
                    >
                      <option value="">Select</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div className="col-md-2">
                    <label className="form-label">DOB</label>
                    <input
                      type="date"
                      className="form-control"
                      value={form.date_of_birth}
                      onChange={(e) => setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))}
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
                  <div className="col-md-3">
                    <label className="form-label">Previous School</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.previous_school}
                      onChange={(e) => setForm((prev) => ({ ...prev, previous_school: e.target.value }))}
                      maxLength={200}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Target Class</label>
                    <select
                      className="form-select"
                      value={form.target_class_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, target_class_id: e.target.value }))}
                    >
                      <option value="">Select</option>
                      {classOptions.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.class_name || `Class ${c.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Source</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.source}
                      onChange={(e) => setForm((prev) => ({ ...prev, source: e.target.value }))}
                      maxLength={50}
                    />
                  </div>
                  <div className="col-md-3">
                    <label className="form-label">Status</label>
                    <input
                      type="text"
                      className="form-control"
                      value={form.status}
                      onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
                      placeholder="Type status"
                      maxLength={50}
                    />
                  </div>
                  <div className="col-md-12">
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
                      {formLoading ? "Saving..." : editingId ? "Update Enquiry" : "Add Enquiry"}
                    </button>
                    {editingId ? (
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => {
                          setEditingId(null);
                          setForm(DEFAULT_FORM);
                        }}
                        disabled={formLoading}
                      >
                        Cancel Edit
                      </button>
                    ) : null}
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-header">
            {showListSwitcher ? (
              <div className="d-flex justify-content-center mb-3">
                <div
                  className="btn-group shadow-sm"
                  role="tablist"
                  aria-label="Enquiry list or follow-up activity"
                  style={{
                    borderRadius: "0.5rem",
                    overflow: "hidden",
                    border: "2px solid var(--bs-primary)",
                  }}
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listViewTab === "enquiries"}
                    className={`btn px-4 py-2 border-0 rounded-0 ${
                      listViewTab === "enquiries" ? "btn-primary fw-bold text-white" : "btn-light text-primary"
                    }`}
                    onClick={() => setListViewTab("enquiries")}
                  >
                    Enquiry List
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={listViewTab === "followups"}
                    className={`btn px-4 py-2 border-0 rounded-0 ${
                      listViewTab === "followups" ? "btn-primary fw-bold text-white" : "btn-light text-primary"
                    }`}
                    onClick={() => setListViewTab("followups")}
                  >
                    Follow-up activity
                  </button>
                </div>
              </div>
            ) : null}
            {!showListSwitcher || listViewTab === "enquiries" ? (
              <>
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h5 className="mb-0">Enquiry List</h5>
                  <div className="dropdown">
                    <button
                      type="button"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown"
                      data-bs-boundary="viewport"
                      data-bs-popper-config='{"strategy":"fixed"}'
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
              </>
            ) : (
              <>
                <h5 className="mb-1">Follow-up activity</h5>
                <p className="text-muted small mb-0">
                  {followUpPrivileged ? (
                    <>
                      All follow-up records for the selected academic year. Headmaster / admin can change any
                      enquiry status from the last column; others see read-only status unless they own the enquiry.
                    </>
                  ) : (
                    <>
                      Rows where you logged the follow-up, you added the enquiry, or you are listed as counselor.
                      Enquiry owners can change status here (filtered by the selected academic year).
                    </>
                  )}
                </p>
              </>
            )}
          </div>
          <div className="card-body">
            {!showListSwitcher || listViewTab === "enquiries" ? (
              <>
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
                          <th>STUDENT NAME</th>
                          <th>PARENT NAME</th>
                          <th>MOBILE NUMBER</th>
                          <th>EMAIL</th>
                          <th>TYPE</th>
                          <th>STATUS</th>
                          <th>ADDRESS</th>
                          <th>TARGET CLASS</th>
                          <th>DESCRIPTION</th>
                          <th>ADDED BY</th>
                          {canManage ? <th>FOLLOW-UPS</th> : null}
                          {canManage ? <th>ACTION</th> : null}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.map((item, index) => (
                          <tr key={item.id}>
                            <td>{index + 1}</td>
                            <td>{readableDate(item.enquiry_date)}</td>
                            <td>{item.student_name || "-"}</td>
                            <td>{item.parent_name || "-"}</td>
                            <td>{item.mobile_number || "-"}</td>
                            <td>{item.email || "-"}</td>
                            <td>{item.enquiry_type || "-"}</td>
                            <td>{item.status || "-"}</td>
                            <td>{item.address || "-"}</td>
                            <td>{item.target_class_name || "-"}</td>
                            <td>
                              {splitTextByWords(item.description, 10).map((line, idx) => (
                                <div key={`${item.id}-desc-${idx}`}>{line}</div>
                              ))}
                            </td>
                            <td>{item.created_by_name || "-"}</td>
                            {canManage ? (
                              <td>
                                {canAccessFollowUpsForEnquiry(
                                  normalizedRole,
                                  roleId,
                                  item.created_by,
                                  user?.id
                                ) ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-info"
                                    onClick={() => openFollowUpModal(item)}
                                  >
                                    Follow-ups
                                  </button>
                                ) : (
                                  <span className="text-muted small">—</span>
                                )}
                              </td>
                            ) : null}
                            {canManage ? (
                              <td className="d-flex gap-1 flex-wrap">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() => startEdit(item)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-danger"
                                  onClick={() => handleDelete(Number(item.id))}
                                >
                                  Delete
                                </button>
                              </td>
                            ) : null}
                          </tr>
                        ))}
                        {!filteredRows.length && (
                          <tr>
                            <td colSpan={canManage ? 14 : 12} className="text-center text-muted">
                              No enquiries found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            ) : (
              <>
                {activityLoading ? (
                  <div className="text-muted">Loading follow-up activity...</div>
                ) : (
                  <div className="table-responsive">
                    <table className="table table-sm table-bordered align-middle">
                      <thead className="table-light">
                        <tr>
                          <th>WHEN</th>
                          <th>ENQUIRY (STUDENT)</th>
                          <th>MOBILE</th>
                          <th>REMARKS</th>
                          <th>NEXT ON</th>
                          <th>COUNSELOR</th>
                          <th>LOGGED BY</th>
                          <th>ENQUIRY OWNER</th>
                          <th>ENQUIRY STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activityRows.map((fu) => {
                          const eid = Number(fu.enquiry_id);
                          const stored = String(fu.enquiry_status || "Open");
                          const selected =
                            pendingEnquiryStatus[eid] !== undefined ? pendingEnquiryStatus[eid] : stored;
                          const canEditStatus = canEditEnquiryStatusFromActivity(
                            normalizedRole,
                            roleId,
                            fu.enquiry_owner_user_id,
                            user?.id
                          );
                          const dirty = selected !== stored;
                          return (
                            <tr key={fu.id}>
                              <td>{readableDateTime(fu.follow_up_date)}</td>
                              <td>{fu.enquiry_student_name || "-"}</td>
                              <td>{fu.enquiry_mobile_number || "-"}</td>
                              <td style={{ maxWidth: "280px", whiteSpace: "pre-wrap" }}>{fu.remarks || "-"}</td>
                              <td>{readableDate(fu.next_follow_up_date)}</td>
                              <td>{fu.counselor_name || "—"}</td>
                              <td>{fu.created_by_name || "-"}</td>
                              <td>{fu.enquiry_owner_name || "-"}</td>
                              <td style={{ minWidth: "200px" }}>
                                {canEditStatus ? (
                                  <div className="d-flex flex-column gap-1">
                                    <select
                                      className="form-select form-select-sm"
                                      value={selected}
                                      onChange={(e) =>
                                        setPendingEnquiryStatus((prev) => ({
                                          ...prev,
                                          [eid]: e.target.value,
                                        }))
                                      }
                                    >
                                      {ENQUIRY_STATUS_OPTIONS.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      className="btn btn-sm btn-outline-primary"
                                      disabled={!dirty || enquiryStatusSavingId === eid}
                                      onClick={() => saveEnquiryStatusFromActivity(eid, fu.enquiry_owner_user_id)}
                                    >
                                      {enquiryStatusSavingId === eid ? "Saving…" : "Save status"}
                                    </button>
                                  </div>
                                ) : (
                                  <span>{stored}</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {!activityRows.length && (
                          <tr>
                            <td colSpan={9} className="text-center text-muted">
                              No follow-up activity for this academic year yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {followUpModalEnquiry ? (
          <div
            className="modal fade show d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="enquiryFollowUpModalTitle"
            style={{ backgroundColor: "rgba(33, 37, 41, 0.45)" }}
          >
            <div className="modal-dialog modal-lg modal-dialog-scrollable">
              <div className="modal-content">
                <div className="modal-header">
                  <div>
                    <h5 className="modal-title" id="enquiryFollowUpModalTitle">
                      Enquiry follow-ups
                    </h5>
                    <div className="small text-muted">
                      {followUpModalEnquiry.student_name || "Student"} · {followUpModalEnquiry.mobile_number || "—"} ·
                      Enquiry owner: {followUpModalEnquiry.created_by_name || "—"}
                    </div>
                  </div>
                  <button type="button" className="btn-close" aria-label="Close" onClick={closeFollowUpModal} />
                </div>
                <div className="modal-body">
                  <div className={`alert small py-2 ${followUpPrivileged ? "alert-secondary" : "alert-info"} mb-3`}>
                    {followUpPrivileged ? (
                      <span>
                        <strong>Headmaster / Admin access:</strong> you can record follow-ups for any enquiry.
                      </span>
                    ) : (
                      <span>
                        <strong>Your enquiry:</strong> you can record follow-ups only for enquiries you originally
                        added.
                      </span>
                    )}
                  </div>

                  <h6 className="text-uppercase text-muted small mb-2">Add follow-up</h6>
                  {counselorsLoading ? (
                    <div className="text-muted small mb-3">Loading staff list…</div>
                  ) : null}
                  <form onSubmit={submitFollowUp} className="border rounded p-3 bg-light">
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label">Follow-up date &amp; time</label>
                        <input
                          type="datetime-local"
                          className="form-control"
                          required
                          value={followUpForm.follow_up_datetime}
                          onChange={(e) => {
                            const nextDt = e.target.value;
                            const minDay = nextDt.length >= 10 ? nextDt.slice(0, 10) : "";
                            setFollowUpForm((prev) => {
                              let nfd = prev.next_follow_up_date;
                              if (minDay && nfd && nfd < minDay) nfd = "";
                              return { ...prev, follow_up_datetime: nextDt, next_follow_up_date: nfd };
                            });
                          }}
                        />
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Next follow-up (date)</label>
                        <input
                          type="date"
                          className="form-control"
                          min={nextFollowUpDateMin}
                          value={followUpForm.next_follow_up_date}
                          onChange={(e) =>
                            setFollowUpForm((prev) => ({ ...prev, next_follow_up_date: e.target.value }))
                          }
                        />
                        <div className="form-text">Optional. Must be on or after the follow-up date.</div>
                      </div>
                      <div className="col-md-4">
                        <label className="form-label">Counselor (staff)</label>
                        <select
                          className="form-select"
                          value={followUpForm.counselor_id}
                          disabled={counselorsLoading}
                          onChange={(e) =>
                            setFollowUpForm((prev) => ({ ...prev, counselor_id: e.target.value }))
                          }
                        >
                          <option value="">Not assigned</option>
                          {counselorOptions.map((c) => (
                            <option key={c.id} value={String(c.id)}>
                              {formatCounselorOptionLabel(c)}
                            </option>
                          ))}
                        </select>
                        <div className="form-text">
                          Active staff only. Shown as name with designation in brackets (e.g. Teacher, Driver).
                        </div>
                      </div>
                      <div className="col-12">
                        <label className="form-label">Remarks</label>
                        <textarea
                          className="form-control"
                          rows={4}
                          required
                          maxLength={8000}
                          placeholder="Call notes, visit summary, parent response, next steps..."
                          value={followUpForm.remarks}
                          onChange={(e) => setFollowUpForm((prev) => ({ ...prev, remarks: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="d-flex gap-2 mt-3">
                      <button type="submit" className="btn btn-primary" disabled={followUpSubmitting || counselorsLoading}>
                        {followUpSubmitting ? "Saving..." : "Save follow-up"}
                      </button>
                      <button type="button" className="btn btn-outline-secondary" onClick={closeFollowUpModal}>
                        Close
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Enquiries;





