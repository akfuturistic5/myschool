import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Swal from "sweetalert2";
import { apiService } from "../../../../core/services/apiService";
import { all_routes } from "../../../router/all_routes";

type Row = {
  subject_id: number;
  subject_name: string;
  subject_code?: string;
  subject_mode?: string;
  max_marks: string;
  passing_marks: string;
  exam_date: string;
  start_time: string;
  end_time: string;
  is_elective?: boolean;
  elective_group_id?: number | null;
};

const toMinutes = (value?: string | null) => {
  if (!value) return null;
  const [h, m] = String(value).slice(0, 5).split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

const getTimeCollisionError = (rows: Row[]) => {
  for (let i = 0; i < rows.length; i += 1) {
    const a = rows[i];
    const aDate = a.exam_date ? String(a.exam_date).slice(0, 10) : "";
    const aStart = a.start_time ? String(a.start_time).slice(0, 5) : "";
    const aEnd = a.end_time ? String(a.end_time).slice(0, 5) : "";
    if (!aDate || !aStart || !aEnd) continue;
    const aStartMin = toMinutes(aStart);
    const aEndMin = toMinutes(aEnd);
    if (aStartMin == null || aEndMin == null || aStartMin >= aEndMin) continue;

    for (let j = i + 1; j < rows.length; j += 1) {
      const b = rows[j];
      const bDate = b.exam_date ? String(b.exam_date).slice(0, 10) : "";
      const bStart = b.start_time ? String(b.start_time).slice(0, 5) : "";
      const bEnd = b.end_time ? String(b.end_time).slice(0, 5) : "";
      if (!bDate || !bStart || !bEnd) continue;
      if (aDate !== bDate) continue;

      const bStartMin = toMinutes(bStart);
      const bEndMin = toMinutes(bEnd);
      if (bStartMin == null || bEndMin == null || bStartMin >= bEndMin) continue;

      const overlaps = aStartMin < bEndMin && bStartMin < aEndMin;
      if (overlaps) {
        // Only allow overlap if BOTH are electives in the same group
        if (a.is_elective && b.is_elective && a.elective_group_id && a.elective_group_id === b.elective_group_id) {
          continue;
        }
        return `Schedule conflict: '${a.subject_name}' and '${b.subject_name}' overlap on ${aDate}. Please ensure each exam has a unique time slot.`;
      }
    }
  }
  return null;
};

const ExamSchedule = () => {
  const routes = all_routes;
  const [search] = useSearchParams();
  const examId = Number(search.get("examId") || "");

  const [rows, setRows] = useState<Row[]>([]);
  const [contextRows, setContextRows] = useState<any[]>([]);
  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiService.getExamManageContext(examId);
        const classes = (res as any)?.data?.classes || [];
        const flat: any[] = [];
        for (const c of classes) {
          if (!c.sections || c.sections.length === 0) {
            flat.push({
              class_id: String(c.class_id),
              class_name: c.class_name,
              class_code: c.class_code || "",
              section_id: "0",
              section_name: "No Section",
            });
          } else {
            for (const s of c.sections) {
              flat.push({
                class_id: String(c.class_id),
                class_name: c.class_name,
                class_code: c.class_code || "",
                section_id: String(s.section_id),
                section_name: s.section_name,
              });
            }
          }
        }
        if (cancelled) return;
        setContextRows(flat);
        if (flat.length > 0) {
          setClassId(flat[0].class_id);
          setSectionId(flat[0].section_id);
        }
      } catch (e: any) {
        if (!cancelled) {
          await Swal.fire({
            icon: "error",
            title: "Load failed",
            text: e?.message || "Failed to load exam context",
            confirmButtonText: "OK",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId]);

  const classOptions = useMemo(() => {
    const m = new Map<string, { class_name: string; class_code: string }>();
    contextRows.forEach((r) =>
      m.set(r.class_id, {
        class_name: r.class_name,
        class_code: r.class_code || "",
      })
    );
    return [...m.entries()].map(([id, meta]) => ({
      id,
      name: meta.class_code ? `${meta.class_name} (${meta.class_code})` : meta.class_name,
    }));
  }, [contextRows]);

  const sectionOptions = useMemo(
    () => contextRows.filter((r) => r.class_id === classId),
    [contextRows, classId]
  );

  useEffect(() => {
    if (!examId || !classId) {
      setRows([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await apiService.getExamSubjectsContext({
          exam_id: String(examId),
          class_id: classId,
          section_id: sectionId,
        });
        if (cancelled) return;
        const ctxRows = (res as any)?.data?.timetable_rows || [];
        const ctxSubjects = (res as any)?.data?.subjects || [];
        const subjectDetailById = new Map<number, { subject_code: string; subject_mode: string }>(
          ctxSubjects.map((s: any) => {
            const theoryHours = Number(s?.theory_hours || 0);
            const practicalHours = Number(s?.practical_hours || 0);
            const subjectMode = practicalHours > 0 ? "Practical" : "Theory";
            return [
              Number(s?.id),
              {
                subject_code: String(s?.subject_code || ""),
                subject_mode: subjectMode,
              },
            ];
          })
        );

        setRows(
          ctxRows.map((r: any) => ({
            ...(subjectDetailById.get(Number(r.subject_id)) || {}),
            subject_id: Number(r.subject_id),
            subject_name: String(r.subject_name || ""),
            subject_code: r.subject_code
              ? String(r.subject_code)
              : subjectDetailById.get(Number(r.subject_id))?.subject_code || "",
            subject_mode: r.subject_mode
              ? String(r.subject_mode)
              : subjectDetailById.get(Number(r.subject_id))?.subject_mode || "Theory",
            max_marks: String(r.max_marks ?? 100),
            passing_marks: String(r.passing_marks ?? 35),
            is_elective: !!r.is_elective,
            elective_group_id: r.elective_group_id || null,
            exam_date: r.exam_date ? String(r.exam_date).slice(0, 10) : "",
            start_time: r.start_time ? String(r.start_time).slice(0, 5) : "",
            end_time: r.end_time ? String(r.end_time).slice(0, 5) : "",
          }))
        );
        if (!ctxRows.length) {
          await Swal.fire({
            icon: "info",
            title: "No subjects",
            text: "No subjects found for selected class and section.",
            confirmButtonText: "OK",
          });
        }
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          await Swal.fire({
            icon: "error",
            title: "Load failed",
            text: e?.message || "Failed to load timetable context",
            confirmButtonText: "OK",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [examId, classId, sectionId]);

  const updateRow = (i: number, patch: Partial<Row>) => {
    const next = rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r));
    const collisionError = getTimeCollisionError(next);
    if (collisionError) {
      void Swal.fire({
        icon: "warning",
        title: "Time slot conflict",
        text: collisionError,
        confirmButtonText: "OK",
      });
      return;
    }
    setRows(next);
  };

  const save = async () => {
    if (!examId || !classId) {
      Swal.fire("Missing Information", "Please select both an exam and a class.", "info");
      return;
    }

    const isSectionRequired = sectionOptions.length > 0 && 
      !(sectionOptions.length === 1 && sectionOptions[0].section_name === "N/A");

    if (isSectionRequired && !sectionId) {
      Swal.fire("Selection Required", "Please select a section for the targeted class.", "warning");
      return;
    }

    if (!rows.length) {
      await Swal.fire({
        icon: "warning",
        title: "Cannot save",
        text: "No subjects available for timetable.",
        confirmButtonText: "OK",
      });
      return;
    }

    for (const r of rows) {
      if (!r.exam_date || !r.start_time || !r.end_time) {
        Swal.fire({
          icon: "warning",
          title: "Incomplete Schedule",
          text: `Please fill in the Date and Timing for all subjects (Missing for ${r.subject_name}).`,
        });
        return;
      }
    }

    const payload = rows.map((r) => ({
      subject_id: r.subject_id,
      max_marks: Number(r.max_marks),
      passing_marks: Number(r.passing_marks),
      exam_date: r.exam_date,
      start_time: r.start_time,
      end_time: r.end_time,
    }));

    for (const row of payload) {
      const date = row.exam_date ? String(row.exam_date).slice(0, 10) : "";
      const start = row.start_time ? String(row.start_time).slice(0, 5) : "";
      const end = row.end_time ? String(row.end_time).slice(0, 5) : "";
      if (!date && !start && !end) continue;
      if (!date || !start || !end) {
        await Swal.fire({
          icon: "warning",
          title: "Incomplete schedule",
          text: "Date, start time and end time must be filled together for each subject.",
          confirmButtonText: "OK",
        });
        return;
      }
      if (start >= end) {
        await Swal.fire({
          icon: "warning",
          title: "Invalid time",
          text: "Start time must be earlier than end time.",
          confirmButtonText: "OK",
        });
        return;
      }
    }
    const collisionError = getTimeCollisionError(rows);
    if (collisionError) {
      await Swal.fire({
        icon: "warning",
        title: "Time slot conflict",
        text: collisionError,
        confirmButtonText: "OK",
      });
      return;
    }

    setSaving(true);
    try {
      await apiService.saveExamSubjectSetup({
        exam_id: examId,
        class_id: Number(classId),
        section_id: sectionId ? Number(sectionId) : null,
        rows: payload,
      });
      await Swal.fire({
        icon: "success",
        title: "Saved",
        text: "Timetable saved successfully.",
        confirmButtonText: "OK",
      });
    } catch (e: any) {
      await Swal.fire({
        icon: "error",
        title: "Save failed",
        text: e?.message || "Failed to save timetable",
        confirmButtonText: "OK",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="d-md-flex d-block align-items-center justify-content-between mb-4">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Exam Timetable Setup</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                <li className="breadcrumb-item">Academic</li>
                <li className="breadcrumb-item"><Link to={routes.exam}>Examinations</Link></li>
                <li className="breadcrumb-item active" aria-current="page">Setup</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
            <Link to={routes.exam} className="btn btn-soft-secondary d-flex align-items-center">
              <i className="ti ti-arrow-left me-2"></i> Back to Exams
            </Link>
            <button
              type="button"
              className="btn btn-primary d-flex align-items-center shadow-sm"
              onClick={save}
              disabled={saving || !rows.length}
            >
              {saving ? (
                <span className="spinner-border spinner-border-sm me-2"></span>
              ) : (
                <i className="ti ti-device-floppy me-2"></i>
              )}
              Save Schedule
            </button>
          </div>
        </div>

        {message && (
          <div className={`alert ${message.includes("success") ? "alert-soft-success" : "alert-soft-warning"} border-0 mb-4 d-flex align-items-center`}>
            <i className={`ti ${message.includes("success") ? "ti-circle-check" : "ti-alert-triangle"} me-2 fs-18`}></i>
            {message}
          </div>
        )}

        <div className="card border-0 shadow-sm mb-4 overflow-hidden">
          <div className="card-header bg-white py-3 border-bottom-0">
            <div className="row g-3 align-items-center">
              <div className="col-md-4">
                <label className="form-label fw-semibold text-muted small text-uppercase">Target Class</label>
                <select
                  className="form-select shadow-none border-light"
                  value={classId}
                  onChange={(e) => {
                    const val = e.target.value;
                    setClassId(val);
                    const filtered = contextRows.filter((r) => r.class_id === val);
                    if (filtered.length === 1) {
                      setSectionId(filtered[0].section_id);
                    } else {
                      setSectionId("");
                    }
                  }}
                >
                  <option value="">Select Class</option>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              {!(sectionOptions.length === 1 && sectionOptions[0].section_id === "0") && (
                <div className="col-md-4">
                  <label className="form-label fw-semibold text-muted small text-uppercase">Section</label>
                  <select
                    className="form-select shadow-none border-light"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    disabled={!classId}
                  >
                    <option value="">Select Section</option>
                    {sectionOptions.map((s) => (
                      <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className={sectionOptions.length === 1 && sectionOptions[0].section_id === "0" ? "col-md-8 pt-4" : "col-md-4 pt-4"}>
                <div className="d-flex align-items-center text-muted small">
                  <i className="ti ti-info-circle me-1"></i>
                  Subjects are synchronized from curriculum mapping.
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card border-0 shadow-sm overflow-hidden">
          <div className="card-header bg-white py-3 border-bottom-0">
            <h5 className="fw-bold mb-0">Subject Assignments</h5>
          </div>
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary mb-3" role="status"></div>
                <p className="text-muted small">Retrieving subject configuration...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-5">
                <div className="mb-3 text-muted opacity-25">
                  <i className="ti ti-book-off fs-1"></i>
                </div>
                <h5 className="fw-bold">No Subjects Available</h5>
                <p className="text-muted small">Select a valid class and section to view subjects.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-nowrap align-middle mb-0">
                  <thead className="bg-light-50">
                    <tr>
                      <th className="py-3 px-4 fw-bold text-dark border-0">Subject</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0">Code / Type</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0" style={{ width: "120px" }}>Max Marks</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0" style={{ width: "120px" }}>Pass Marks</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0" style={{ width: "180px" }}>Exam Date</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0" style={{ width: "150px" }}>Start</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0" style={{ width: "150px" }}>End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={`subject-row-${row.subject_id}`}>
                        <td className="px-4 border-light">
                          <div className="fw-bold text-dark">{row.subject_name}</div>
                        </td>
                        <td className="border-light">
                          <div className="d-flex flex-column">
                            <span className="small text-muted">{row.subject_code || "N/A"}</span>
                            <span className={`badge badge-soft-${row.subject_mode === "Practical" ? "info" : "secondary"} mt-1`} style={{ width: "fit-content" }}>
                              {row.subject_mode || "Theory"}
                            </span>
                          </div>
                        </td>
                        <td className="border-light">
                          <input
                            type="text"
                            className="form-control form-control-sm border-light shadow-none"
                            value={row.max_marks}
                            onChange={(e) => updateRow(i, { max_marks: e.target.value })}
                          />
                        </td>
                        <td className="border-light">
                          <input
                            type="text"
                            className="form-control form-control-sm border-light shadow-none"
                            value={row.passing_marks}
                            onChange={(e) => updateRow(i, { passing_marks: e.target.value })}
                          />
                        </td>
                        <td className="border-light">
                          <div className="input-icon-start">
                            <input
                              type="date"
                              className="form-control form-control-sm border-light shadow-none"
                              value={row.exam_date}
                              onChange={(e) => updateRow(i, { exam_date: e.target.value })}
                            />
                          </div>
                        </td>
                        <td className="border-light">
                          <input
                            type="time"
                            className="form-control form-control-sm border-light shadow-none"
                            value={row.start_time}
                            onChange={(e) => updateRow(i, { start_time: e.target.value })}
                          />
                        </td>
                        <td className="border-light">
                          <input
                            type="time"
                            className="form-control form-control-sm border-light shadow-none"
                            value={row.end_time}
                            onChange={(e) => updateRow(i, { end_time: e.target.value })}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {rows.length > 0 && (
            <div className="card-footer bg-white border-top-0 py-3">
              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-primary px-4 d-flex align-items-center"
                  onClick={save}
                  disabled={saving}
                >
                  {saving ? (
                    <span className="spinner-border spinner-border-sm me-2"></span>
                  ) : (
                    <i className="ti ti-device-floppy me-2"></i>
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExamSchedule;





