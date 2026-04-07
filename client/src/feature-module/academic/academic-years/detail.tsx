import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { selectUser } from "../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../core/utils/roleUtils";
import { apiService } from "../../../core/services/apiService";

type Stats = Record<string, number | undefined>;

const STAT_LABELS: { key: keyof Stats; label: string; icon: string }[] = [
  { key: "classes_count", label: "Classes", icon: "ti ti-school-bell" },
  { key: "sections_count", label: "Sections", icon: "ti ti-layout-grid" },
  { key: "students_count", label: "Students (active)", icon: "ti ti-users" },
  { key: "class_schedules_count", label: "Class schedules", icon: "ti ti-calendar-time" },
  { key: "fee_structures_count", label: "Fee structures", icon: "ti ti-report-money" },
  { key: "exams_count", label: "Exams", icon: "ti ti-clipboard-list" },
  { key: "holidays_count", label: "Holidays", icon: "ti ti-beach" },
  { key: "class_syllabus_count", label: "Syllabus rows", icon: "ti ti-book-upload" },
  { key: "promotions_into_count", label: "Promotions into year", icon: "ti ti-arrow-down-circle" },
  { key: "promotions_from_count", label: "Promotions from year", icon: "ti ti-arrow-up-circle" },
  { key: "attendance_records_count", label: "Attendance records", icon: "ti ti-checklist" },
  { key: "teacher_routines_count", label: "Teacher routines", icon: "ti ti-route" },
];

function formatDisplayDate(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const s = String(value).slice(0, 10);
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTs(value: string | null | undefined): string {
  if (value == null || value === "") return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

const AcademicYearDetail = () => {
  const { id: idParam } = useParams();
  const routes = all_routes;
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const dashboard = getDashboardForRole(user);
  const id = idParam && /^\d+$/.test(idParam) ? Number(idParam) : NaN;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [year, setYear] = useState<Record<string, unknown> | null>(null);
  const [stats, setStats] = useState<Stats>({});

  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editCurrent, setEditCurrent] = useState(false);
  const [editActive, setEditActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiService.getAcademicYearSummary(id);
      const ay = res?.data?.academic_year;
      const st = res?.data?.statistics || {};
      if (!ay) {
        setError("Academic year not found.");
        setYear(null);
        setStats({});
        return;
      }
      setYear(ay);
      setStats(st);
      setEditName(String(ay.year_name ?? ""));
      const sd = ay.start_date ? String(ay.start_date).slice(0, 10) : "";
      setEditStart(sd);
      const ed = ay.end_date ? String(ay.end_date).slice(0, 10) : "";
      setEditEnd(ed);
      setEditCurrent(ay.is_current === true || ay.is_current === "t");
      setEditActive(ay.is_active !== false && ay.is_active !== "f");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load academic year");
      setYear(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!Number.isFinite(id)) {
      setLoading(false);
      setError("Invalid academic year.");
      return;
    }
    load();
  }, [id, load]);

  const hasEndDate = useMemo(() => {
    const v = year?.end_date;
    return v != null && String(v).trim() !== "";
  }, [year]);

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(id) || !year) return;
    setSaveError(null);
    setSaveOk(false);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        year_name: editName.trim(),
        start_date: editStart,
        is_current: editCurrent,
        is_active: editActive,
      };
      const trimmedEnd = editEnd.trim();
      if (trimmedEnd === "") {
        payload.end_date = null;
      } else {
        payload.end_date = trimmedEnd;
      }
      await apiService.updateAcademicYear(id, payload);
      setSaveOk(true);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  const handleClearEndDate = async () => {
    if (!Number.isFinite(id)) return;
    setSaveError(null);
    setSaveOk(false);
    setSaving(true);
    try {
      await apiService.updateAcademicYear(id, { end_date: null });
      setEditEnd("");
      setSaveOk(true);
      await load();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (!Number.isFinite(id)) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-warning">Invalid link.</div>
          <Link to={routes.academicYears} className="btn btn-primary">
            Back to Academic Years
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
          <div className="my-auto mb-2">
            <Link
              to={routes.academicYears}
              className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
            >
              <i className="ti ti-arrow-left me-1" />
              All years
            </Link>
            <h3 className="page-title mb-1">
              {year?.year_name ? String(year.year_name) : "Academic year"}
            </h3>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={dashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to={routes.academicYears}>Academic Years</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  Details
                </li>
              </ol>
            </nav>
          </div>
        </div>

        {loading && (
          <div className="card">
            <div className="card-body d-flex align-items-center py-5 text-muted">
              <div className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
              Loading…
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="alert alert-danger d-flex flex-wrap align-items-center justify-content-between gap-2">
            <span>{error}</span>
            <button type="button" className="btn btn-sm btn-outline-danger" onClick={() => navigate(routes.academicYears)}>
              Back to list
            </button>
          </div>
        )}

        {!loading && !error && year && (
          <>
            <div className="row g-3 mb-4">
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-2">Timeline</div>
                    <ul className="list-unstyled mb-0 small">
                      <li className="mb-2">
                        <span className="text-muted">Starts</span>
                        <div className="fw-medium">{formatDisplayDate(String(year.start_date ?? ""))}</div>
                      </li>
                      <li className="mb-2">
                        <span className="text-muted">Ends</span>
                        <div className="fw-medium">
                          {hasEndDate ? formatDisplayDate(String(year.end_date)) : "Not recorded yet"}
                        </div>
                      </li>
                      <li>
                        <span className="text-muted">Record created</span>
                        <div className="fw-medium">{formatTs(String(year.created_at ?? ""))}</div>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100">
                  <div className="card-body">
                    <div className="text-muted text-uppercase small fw-semibold mb-2">Flags</div>
                    <div className="d-flex flex-wrap gap-2">
                      {editCurrent ? (
                        <span className="badge bg-primary">Current year</span>
                      ) : (
                        <span className="badge bg-light text-dark border">Not current</span>
                      )}
                      {editActive ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle">Active</span>
                      ) : (
                        <span className="badge bg-secondary-subtle text-secondary border">Inactive</span>
                      )}
                    </div>
                    <p className="text-muted small mt-3 mb-0">
                      Inactive years stay in this list but are hidden from the header year selector.
                    </p>
                  </div>
                </div>
              </div>
              <div className="col-md-4">
                <div className="card border-0 shadow-sm h-100 bg-primary-subtle border border-primary-subtle">
                  <div className="card-body">
                    <div className="d-flex align-items-start gap-2">
                      <i className="ti ti-info-circle fs-4 text-primary" />
                      <div>
                        <div className="fw-semibold text-primary mb-1">Closing the session</div>
                        <p className="small mb-0 text-body">
                          When the academic year is finished, set the <strong>end date</strong> below. You can adjust
                          other fields if records were entered incorrectly.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card border-0 shadow-sm mb-4">
              <div className="card-header bg-white border-bottom py-3">
                <h5 className="mb-0">Record &amp; dates</h5>
                <p className="text-muted small mb-0 mt-1">Stored in <code>academic_years</code> — same fields as creation, plus end date when known.</p>
              </div>
              <div className="card-body">
                {saveOk && (
                  <div className="alert alert-success py-2" role="status">
                    Saved successfully.
                  </div>
                )}
                {saveError && (
                  <div className="alert alert-danger py-2" role="alert">
                    {saveError}
                  </div>
                )}
                <form onSubmit={handleSaveRecord}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="d-name">
                        Year name
                      </label>
                      <input
                        id="d-name"
                        className="form-control"
                        maxLength={20}
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="d-start">
                        Start date
                      </label>
                      <input
                        id="d-start"
                        type="date"
                        className="form-control"
                        value={editStart}
                        onChange={(e) => setEditStart(e.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6">
                      <label className="form-label" htmlFor="d-end">
                        End date
                      </label>
                      <input
                        id="d-end"
                        type="date"
                        className="form-control"
                        value={editEnd}
                        onChange={(e) => setEditEnd(e.target.value)}
                      />
                      <div className="form-text">Leave empty until the session officially ends.</div>
                    </div>
                    <div className="col-md-6 d-flex align-items-end">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={handleClearEndDate}
                        disabled={saving || !hasEndDate}
                      >
                        Clear end date
                      </button>
                    </div>
                    <div className="col-12">
                      <div className="form-check">
                        <input
                          id="d-current"
                          type="checkbox"
                          className="form-check-input"
                          checked={editCurrent}
                          onChange={(e) => setEditCurrent(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="d-current">
                          Current academic year
                        </label>
                      </div>
                      <div className="form-check">
                        <input
                          id="d-active"
                          type="checkbox"
                          className="form-check-input"
                          checked={editActive}
                          onChange={(e) => setEditActive(e.target.checked)}
                        />
                        <label className="form-check-label" htmlFor="d-active">
                          Active
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 d-flex justify-content-end gap-2">
                    <button type="button" className="btn btn-light" onClick={() => load()} disabled={saving}>
                      Reset from server
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                      {saving ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        <>
                          <i className="ti ti-device-floppy me-1" />
                          Save changes
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            <div className="mb-2 d-flex align-items-center justify-content-between flex-wrap gap-2">
              <h5 className="mb-0">Activity in this academic year</h5>
              <span className="text-muted small">Counts are read-only summaries from your school database.</span>
            </div>
            <div className="row g-3">
              {STAT_LABELS.map(({ key, label, icon }) => (
                <div key={key} className="col-6 col-md-4 col-xl-3">
                  <div className="card border-0 shadow-sm h-100">
                    <div className="card-body">
                      <div className="d-flex align-items-center gap-2 mb-2 text-muted">
                        <i className={icon} />
                        <span className="small text-uppercase fw-semibold">{label}</span>
                      </div>
                      <div className="fs-4 fw-semibold text-dark">
                        {stats[key] != null ? Number(stats[key]).toLocaleString() : "0"}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AcademicYearDetail;
