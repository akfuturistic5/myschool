import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { selectUser } from "../../../core/data/redux/authSlice";
import { getDashboardForRole } from "../../../core/utils/roleUtils";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";

function toDateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function addDaysIso(dateOnly: string, days: number): string | null {
  const s = toDateOnly(dateOnly);
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  // Noon local time avoids DST edge issues when adding days.
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function extractApiError(err: unknown): { message: string; code?: string; details?: unknown } {
  const fallback = { message: err instanceof Error ? err.message : "Request failed" };
  if (!(err instanceof Error)) return fallback;

  const raw = String(err.message || "");
  const marker = "message: ";
  const idx = raw.indexOf(marker);
  if (idx === -1) return fallback;
  const jsonPart = raw.slice(idx + marker.length).trim();
  try {
    const parsed = JSON.parse(jsonPart);
    return {
      message: parsed?.message || fallback.message,
      code: parsed?.code,
      details: parsed?.data,
    };
  } catch {
    return fallback;
  }
}

const AcademicYearCreate = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const user = useSelector(selectUser);
  const dashboard = getDashboardForRole(user);
  const [yearName, setYearName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [isCurrent, setIsCurrent] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasAnyYears, setHasAnyYears] = useState(false);
  const [previousEndDate, setPreviousEndDate] = useState<string | null>(null);
  const [previousYearId, setPreviousYearId] = useState<number | null>(null);
  const [copyFromPrevious, setCopyFromPrevious] = useState(true);
  const [copyOptions, setCopyOptions] = useState({
    classes: true,
    sections: true,
    subjects: false,
    teacherAssignments: false,
    timetable: false,
    departments: false,
    designations: false,
    transport: false,
  });

  const withDependencies = (next: typeof copyOptions) => {
    const result = { ...next };
    // Do not auto-enable hidden modules. Keep exactly user-selected modules.
    // Only clear dependent modules when parent modules are disabled.
    if (!result.classes) {
      result.sections = false;
      result.subjects = false;
      result.teacherAssignments = false;
      result.timetable = false;
    }
    if (!result.subjects) {
      result.teacherAssignments = false;
    }
    if (!result.sections || !result.subjects) {
      result.timetable = false;
    }
    if (!result.departments) {
      result.designations = false;
    }
    return result;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await apiService.getAcademicYearsManage();
        const data = Array.isArray(res?.data) ? res.data : [];
        const any = data.length > 0;
        // "Previous/last" year = latest by start_date (tie-breaker id).
        let latest = null as null | { sd: string; id: number; ed: string | null };
        for (const row of data) {
          const sd = toDateOnly(row?.start_date) || "";
          const id = Number(row?.id) || 0;
          if (!latest) {
            latest = { sd, id, ed: toDateOnly(row?.end_date) };
            continue;
          }
          if (sd.localeCompare(latest.sd) > 0 || (sd === latest.sd && id > latest.id)) {
            latest = { sd, id, ed: toDateOnly(row?.end_date) };
          }
        }
        if (mounted) {
          setHasAnyYears(any);
          setPreviousEndDate(latest?.ed ?? null);
          setPreviousYearId(latest?.id ?? null);
          setCopyFromPrevious(any);
        }
      } catch {
        // Non-blocking: if this fails, user can still select any date; backend will enforce rules.
        if (mounted) {
          setHasAnyYears(false);
          setPreviousEndDate(null);
          setPreviousYearId(null);
          setCopyFromPrevious(false);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const minStartDate = useMemo(() => {
    if (!previousEndDate) return null;
    return addDaysIso(previousEndDate, 1);
  }, [previousEndDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const name = yearName.trim();
    if (!name || !startDate) {
      setError("Year name and start date are required.");
      return;
    }
    if (hasAnyYears && !previousEndDate) {
      await Swal.fire({
        icon: "warning",
        title: "End date required",
        text: "Please fill the current/previous academic year end date before creating a new academic year.",
        confirmButtonText: "OK",
      });
      return;
    }
    if (minStartDate && startDate && startDate.localeCompare(minStartDate) < 0) {
      setError(`Start date must be after the previous academic year end date (${previousEndDate}).`);
      return;
    }
    setSubmitting(true);
    try {
      const effectiveCopyOptions = withDependencies(copyOptions);
      const shouldClone = copyFromPrevious && !!previousYearId && Object.values(effectiveCopyOptions).some(Boolean);
      if (copyFromPrevious && effectiveCopyOptions.sections && !effectiveCopyOptions.classes) {
        setError("Sections cloning requires Classes.");
        return;
      }
      if (copyFromPrevious && effectiveCopyOptions.subjects && !effectiveCopyOptions.classes) {
        setError("Subjects cloning requires Classes.");
        return;
      }
      if (copyFromPrevious && effectiveCopyOptions.teacherAssignments && !effectiveCopyOptions.classes) {
        setError("Teacher Assignments cloning requires Classes.");
        return;
      }
      if (copyFromPrevious && effectiveCopyOptions.teacherAssignments && !effectiveCopyOptions.subjects) {
        setError("Teacher Assignments cloning requires Subjects.");
        return;
      }
      if (
        copyFromPrevious &&
        effectiveCopyOptions.timetable &&
        (!effectiveCopyOptions.classes || !effectiveCopyOptions.sections || !effectiveCopyOptions.subjects)
      ) {
        setError("Timetable cloning requires Classes, Sections, and Subjects.");
        return;
      }
      if (copyFromPrevious && effectiveCopyOptions.designations && !effectiveCopyOptions.departments) {
        setError("Designations cloning requires Departments.");
        return;
      }
      if (copyFromPrevious && !previousYearId) {
        setError("No previous academic year found to copy from.");
        return;
      }
      const res = await apiService.createAcademicYear({
        year_name: name,
        start_date: startDate,
        is_current: isCurrent,
        is_active: isActive,
        ...(shouldClone
          ? {
              copy_from_year_id: previousYearId,
              copy_options: effectiveCopyOptions,
            }
          : {}),
      });
      const newId = res?.data?.id;
      if (res?.clone?.summary) {
        const s = res.clone.summary;
        const detailLines = [
          `Classes: ${s.classes_cloned ?? 0}`,
          `Sections: ${s.sections_cloned ?? 0}`,
          `Subjects: ${s.subjects_cloned ?? 0}`,
          `Teacher Assignments: ${s.assignments_cloned ?? 0}`,
          `Timetable: ${s.timetable_entries_cloned ?? 0}`,
        ];
        await Swal.fire({
          icon: "success",
          title: "Academic year created and cloned",
          html: `<div style="text-align:left">${detailLines.map((x) => `<div>${x}</div>`).join("")}</div>`,
          confirmButtonText: "OK",
        });
      } else {
        await Swal.fire({
          icon: "success",
          title: "Academic year created",
          text: "Academic year was created successfully.",
          confirmButtonText: "OK",
        });
      }
      if (newId != null) {
        navigate(`/academic/academic-years/${newId}`, { replace: true });
        return;
      }
      navigate(routes.academicYears, { replace: true });
    } catch (err) {
      const parsedErr = extractApiError(err);
      const msg = parsedErr.message || "Failed to create academic year";
      const lower = String(msg).toLowerCase();
      const duplicateName =
        parsedErr.code === "ACADEMIC_YEAR_NAME_EXISTS" ||
        lower.includes("academic year with this name already exists");
      if (duplicateName) {
        await Swal.fire({
          icon: "warning",
          title: "Duplicate academic year name",
          text: "Same academic year name already exists. Please enter a different year name.",
          confirmButtonText: "OK",
        });
        return;
      }
      await Swal.fire({
        icon: "error",
        title: "Academic year cloning failed",
        text: parsedErr.code ? `${msg} (${parsedErr.code})` : msg,
        confirmButtonText: "OK",
      });
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
              Back to list
            </Link>
            <h3 className="page-title mb-1">Create academic year</h3>
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item">
                  <Link to={dashboard}>Dashboard</Link>
                </li>
                <li className="breadcrumb-item">
                  <Link to={routes.academicYears}>Academic Years</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  New
                </li>
              </ol>
            </nav>
          </div>
        </div>

        <div className="row justify-content-center">
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm">
              <div className="card-header bg-white border-bottom py-3">
                <h5 className="mb-0">Academic session details</h5>
                <p className="text-muted small mb-0 mt-1">
                  End date is optional on this form and can be filled later from the academic year detail page when
                  the session ends. Note: you must record the end date of the current/previous year before creating the
                  next academic year.
                </p>
              </div>
              <div className="card-body">
                {error && (
                  <div className="alert alert-danger" role="alert">
                    {error}
                  </div>
                )}
                <form onSubmit={handleSubmit} noValidate>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="ay-year-name">
                      Year name <span className="text-danger">*</span>
                    </label>
                    <input
                      id="ay-year-name"
                      type="text"
                      className="form-control"
                      maxLength={20}
                      placeholder="e.g. 2026-27"
                      value={yearName}
                      onChange={(e) => setYearName(e.target.value)}
                      required
                      autoComplete="off"
                    />
                    <div className="form-text">Unique label (max 20 characters). Must not match an existing year.</div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label" htmlFor="ay-start">
                      Start date <span className="text-danger">*</span>
                    </label>
                    <input
                      id="ay-start"
                      type="date"
                      className="form-control"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      min={minStartDate || undefined}
                      required
                    />
                    {previousEndDate && minStartDate && (
                      <div className="form-text">
                        The previous academic year ends on <strong>{previousEndDate}</strong>. Start date must be{" "}
                        <strong>{minStartDate}</strong> or later.
                      </div>
                    )}
                  </div>
                  <div className="mb-3 form-check">
                    <input
                      id="ay-current"
                      type="checkbox"
                      className="form-check-input"
                      checked={isCurrent}
                      onChange={(e) => setIsCurrent(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="ay-current">
                      Mark as current academic year
                    </label>
                    <div className="form-text">
                      Only one year should be current. Checking this clears the current flag from other years.
                    </div>
                  </div>
                  <div className="mb-4 form-check">
                    <input
                      id="ay-active"
                      type="checkbox"
                      className="form-check-input"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <label className="form-check-label" htmlFor="ay-active">
                      Active (visible in dropdowns and day-to-day use)
                    </label>
                  </div>
                  <div className="mb-4 border rounded p-3 bg-light-subtle">
                    <div className="form-check mb-2">
                      <input
                        id="ay-copy-prev"
                        type="checkbox"
                        className="form-check-input"
                        checked={copyFromPrevious}
                        onChange={(e) => setCopyFromPrevious(e.target.checked)}
                        disabled={!previousYearId}
                      />
                      <label className="form-check-label fw-semibold" htmlFor="ay-copy-prev">
                        Copy data from previous academic year
                      </label>
                    </div>
                    <div className="small text-muted mb-2">
                      {previousYearId
                        ? `Source year id: ${previousYearId}.`
                        : "No previous academic year available, so cloning is disabled."}
                    </div>
                    {copyFromPrevious && previousYearId && (
                      <div className="row g-2">
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              id="copy-classes"
                              type="checkbox"
                              className="form-check-input"
                              checked={copyOptions.classes}
                              onChange={(e) =>
                                setCopyOptions((prev) => withDependencies({ ...prev, classes: e.target.checked }))
                              }
                            />
                            <label className="form-check-label" htmlFor="copy-classes">Classes</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              id="copy-sections"
                              type="checkbox"
                              className="form-check-input"
                              checked={copyOptions.sections}
                              disabled={!copyOptions.classes}
                              onChange={(e) =>
                                setCopyOptions((prev) => withDependencies({ ...prev, sections: e.target.checked }))
                              }
                            />
                            <label className="form-check-label" htmlFor="copy-sections">Sections</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              id="copy-subjects"
                              type="checkbox"
                              className="form-check-input"
                              checked={copyOptions.subjects}
                              disabled={!copyOptions.classes}
                              onChange={(e) =>
                                setCopyOptions((prev) => withDependencies({ ...prev, subjects: e.target.checked }))
                              }
                            />
                            <label className="form-check-label" htmlFor="copy-subjects">Subjects</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              id="copy-assignments"
                              type="checkbox"
                              className="form-check-input"
                              checked={copyOptions.teacherAssignments}
                              disabled={!copyOptions.classes || !copyOptions.subjects}
                              onChange={(e) =>
                                setCopyOptions((prev) =>
                                  withDependencies({ ...prev, teacherAssignments: e.target.checked })
                                )
                              }
                            />
                            <label className="form-check-label" htmlFor="copy-assignments">Teacher Assignments</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              id="copy-timetable"
                              type="checkbox"
                              className="form-check-input"
                              checked={copyOptions.timetable}
                              disabled={!copyOptions.classes || !copyOptions.sections || !copyOptions.subjects}
                              onChange={(e) =>
                                setCopyOptions((prev) => withDependencies({ ...prev, timetable: e.target.checked }))
                              }
                            />
                            <label className="form-check-label" htmlFor="copy-timetable">Timetable</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              id="copy-departments"
                              type="checkbox"
                              className="form-check-input"
                              checked={copyOptions.departments}
                              onChange={(e) =>
                                setCopyOptions((prev) => withDependencies({ ...prev, departments: e.target.checked }))
                              }
                            />
                            <label className="form-check-label" htmlFor="copy-departments">Departments</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              id="copy-designations"
                              type="checkbox"
                              className="form-check-input"
                              checked={copyOptions.designations}
                              disabled={!copyOptions.departments}
                              onChange={(e) =>
                                setCopyOptions((prev) =>
                                  withDependencies({ ...prev, designations: e.target.checked })
                                )
                              }
                            />
                            <label className="form-check-label" htmlFor="copy-designations">Designations</label>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="form-check">
                            <input
                              id="copy-transport"
                              type="checkbox"
                              className="form-check-input"
                              checked={copyOptions.transport}
                              onChange={(e) =>
                                setCopyOptions((prev) => withDependencies({ ...prev, transport: e.target.checked }))
                              }
                            />
                            <label className="form-check-label" htmlFor="copy-transport">Transport</label>
                          </div>
                        </div>
                        <div className="col-12">
                          <div className="form-text">
                            Dependencies: Sections and Subjects require Classes. Teacher Assignments require Classes +
                            Subjects. Timetable requires Classes + Sections + Subjects. Designations require
                            Departments.
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="d-flex flex-wrap gap-2 justify-content-end">
                    <Link to={routes.academicYears} className="btn btn-light">
                      Cancel
                    </Link>
                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                      {submitting ? (
                        <>
                          <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden />
                          Saving…
                        </>
                      ) : (
                        <>
                          <i className="ti ti-device-floppy me-1" />
                          Create academic year
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AcademicYearCreate;
