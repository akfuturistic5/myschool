import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDepartments } from "../../../core/hooks/useDepartments";
import { useDesignations } from "../../../core/hooks/useDesignations";
import { all_routes } from "../../router/all_routes";
import TooltipOption from "../../../core/common/tooltipOption";
import { apiService } from "../../../core/services/apiService";
import { formatRosterHolidayStatus } from "./rosterHolidayLabels";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";

const normalizeTimeForInput = (value: unknown): string => {
  const raw = String(value || "").trim();
  if (!raw) return "";
  // Accept HH:mm or HH:mm:ss from API/DB and render as HH:mm in time input.
  const match = raw.match(/^(\d{2}):(\d{2})(?::\d{2})?$/);
  if (!match) return "";
  return `${match[1]}:${match[2]}`;
};

const getTodayLocalYMD = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const StaffAttendance = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const today = getTodayLocalYMD();
  const [attendanceDate, setAttendanceDate] = useState(today);
  const [departmentId, setDepartmentId] = useState<number | null>(null);
  const [designationId, setDesignationId] = useState<number | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [rowState, setRowState] = useState<
    Record<number, { status: string; checkInTime: string; checkOutTime: string; remark: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [activeHoliday, setActiveHoliday] = useState<any>(null);
  /** Past dates: roster is view-only until user clicks Edit, then Save changes persists (server upserts). */
  const [pastDateEditMode, setPastDateEditMode] = useState(false);

  const isPastMarkingDate = attendanceDate < today;
  const markingFieldsLocked = !!activeHoliday || (isPastMarkingDate && !pastDateEditMode);

  useEffect(() => {
    setPastDateEditMode(attendanceDate >= getTodayLocalYMD());
  }, [attendanceDate]);

  const { departments } = useDepartments();
  const { designations } = useDesignations();

  const departmentNameOptions = useMemo(
    () => (departments || []).map((d: any) => ({ id: d.originalData?.id ?? d.key, label: d.department })),
    [departments]
  );
  const designationNameOptions = useMemo(
    () => (designations || []).map((d: any) => ({ id: d.originalData?.id ?? d.key, label: d.designation })),
    [designations]
  );

  const fetchRoster = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAttendanceMarkingRoster("staff", {
        date: attendanceDate,
        departmentId,
        designationId,
        academicYearId,
      });
      const roster = Array.isArray(response?.data) ? response.data : [];
      setActiveHoliday(response?.holiday || null);
      setRows(roster);
      const state: Record<number, { status: string; checkInTime: string; checkOutTime: string; remark: string }> = {};
      roster.forEach((r: any) => {
        state[r.entity_id] = {
          status: r.status || "present",
          checkInTime: normalizeTimeForInput(r.check_in_time),
          checkOutTime: normalizeTimeForInput(r.check_out_time),
          remark: r.remark || "",
        };
      });
      setRowState(state);
    } catch (err: any) {
      setError(err?.message || "Failed to load staff roster");
      setRows([]);
      setActiveHoliday(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [attendanceDate, departmentId, designationId, academicYearId]);

  const handleSave = async () => {
    if (rows.length === 0) return;
    try {
      setSaving(true);
      setError(null);
      setMessage(null);
      await apiService.saveAttendance({
        entityType: "staff",
        attendanceDate,
        academicYearId,
        records: rows.map((r: any) => ({
          entityId: r.entity_id,
          status: rowState[r.entity_id]?.status || "present",
          checkInTime: rowState[r.entity_id]?.checkInTime || null,
          checkOutTime: rowState[r.entity_id]?.checkOutTime || null,
          remark: rowState[r.entity_id]?.remark || "",
          departmentId,
          designationId,
        })),
      });
      setMessage(isPastMarkingDate ? "Staff attendance updated successfully." : "Staff attendance saved successfully.");
      if (isPastMarkingDate) setPastDateEditMode(false);
      await fetchRoster();
    } catch (err: any) {
      setError(err?.message || "Failed to save staff attendance");
    } finally {
      setSaving(false);
    }
  };

  const handlePrimaryMarkingAction = () => {
    if (isPastMarkingDate && !pastDateEditMode) {
      setPastDateEditMode(true);
      setMessage(null);
      setError(null);
      return;
    }
    void handleSave();
  };

  const statusOptions = ["present", "late", "absent", "half_day"];
  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Staff Attendance</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Staff Attendance
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
            <TooltipOption />
            </div>
          </div>
          {/* /Page Header */}
          <div className="card">
            <div className="card-header">
              <div className="row g-2">
                <div className="col-md-3">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={attendanceDate}
                    max={today}
                    onChange={(e) => {
                      const next = e.target.value;
                      setAttendanceDate(next && next > today ? today : next);
                    }}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Department</label>
                  <select className="form-select" value={departmentId ?? ""} onChange={(e) => setDepartmentId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">All Departments</option>
                    {departmentNameOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label">Designation</label>
                  <select className="form-select" value={designationId ?? ""} onChange={(e) => setDesignationId(e.target.value ? Number(e.target.value) : null)}>
                    <option value="">All Designations</option>
                    {designationNameOptions.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                  </select>
                </div>
                <div className="col-md-3 d-flex align-items-end">
                  <button
                    type="button"
                    className="btn btn-primary w-100"
                    onClick={handlePrimaryMarkingAction}
                    disabled={saving || loading || rows.length === 0 || !!activeHoliday}
                  >
                    {saving
                      ? "Saving..."
                      : isPastMarkingDate && !pastDateEditMode
                        ? "Edit Attendance"
                        : isPastMarkingDate
                          ? "Save changes"
                          : "Save Attendance"}
                  </button>
                </div>
              </div>
            </div>
            <div className="card-body">
              {error && <div className="alert alert-danger">{error}</div>}
              {message && <div className="alert alert-success">{message}</div>}
              {activeHoliday && (
                <div className="alert alert-info">
                  Holiday (auto): {activeHoliday.title}. Manual attendance marking is disabled for this date.
                </div>
              )}
              {loading ? (
                <div className="text-muted">Loading roster...</div>
              ) : rows.length === 0 ? (
                <div className="text-muted">No staff found.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-striped">
                    <thead><tr><th>Name</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Remark</th></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.entity_id}>
                          <td>{r.entity_name}</td>
                          <td>
                            {activeHoliday ? (
                              <span className="fw-medium text-body-secondary">
                                {formatRosterHolidayStatus(rowState[r.entity_id]?.status) ||
                                  (String(activeHoliday?.holiday_type || "").toLowerCase() === "weekly"
                                    ? "Weekly holiday"
                                    : "Holiday")}
                              </span>
                            ) : (
                              <select
                                className="form-select"
                                value={rowState[r.entity_id]?.status || "present"}
                                disabled={markingFieldsLocked}
                                onChange={(e) =>
                                  setRowState((prev) => ({
                                    ...prev,
                                    [r.entity_id]: {
                                      status: e.target.value,
                                      checkInTime: prev[r.entity_id]?.checkInTime || "",
                                      checkOutTime: prev[r.entity_id]?.checkOutTime || "",
                                      remark: prev[r.entity_id]?.remark || "",
                                    },
                                  }))
                                }
                              >
                                {statusOptions.map((s) => (
                                  <option key={s} value={s}>
                                    {s.replace("_", " ")}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                          <td>
                            <input
                              type="time"
                              className="form-control"
                              disabled={markingFieldsLocked}
                              value={rowState[r.entity_id]?.checkInTime || ""}
                              onChange={(e) =>
                                setRowState((prev) => ({
                                  ...prev,
                                  [r.entity_id]: {
                                    status: prev[r.entity_id]?.status || "present",
                                    checkInTime: e.target.value,
                                    checkOutTime: prev[r.entity_id]?.checkOutTime || "",
                                    remark: prev[r.entity_id]?.remark || "",
                                  },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              type="time"
                              className="form-control"
                              disabled={markingFieldsLocked}
                              value={rowState[r.entity_id]?.checkOutTime || ""}
                              onChange={(e) =>
                                setRowState((prev) => ({
                                  ...prev,
                                  [r.entity_id]: {
                                    status: prev[r.entity_id]?.status || "present",
                                    checkInTime: prev[r.entity_id]?.checkInTime || "",
                                    checkOutTime: e.target.value,
                                    remark: prev[r.entity_id]?.remark || "",
                                  },
                                }))
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="form-control"
                              disabled={markingFieldsLocked}
                              value={rowState[r.entity_id]?.remark || ""}
                              onChange={(e) =>
                                setRowState((prev) => ({
                                  ...prev,
                                  [r.entity_id]: {
                                    status: prev[r.entity_id]?.status || "present",
                                    checkInTime: prev[r.entity_id]?.checkInTime || "",
                                    checkOutTime: prev[r.entity_id]?.checkOutTime || "",
                                    remark: e.target.value,
                                  },
                                }))
                              }
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffAttendance;

