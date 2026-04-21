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
        return "Same date par exam time overlap allowed nahi hai. Ek subject ke exam duration ke dauraan dusra subject schedule nahi ho sakta.";
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
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!examId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setMessage(null);
      try {
        const res = await apiService.getExamManageContext(examId);
        const classes = (res as any)?.data?.classes || [];
        const flat: any[] = [];
        for (const c of classes) {
          for (const s of c.sections || []) {
            flat.push({
              class_id: String(c.class_id),
              class_name: c.class_name,
              class_code: c.class_code || "",
              section_id: String(s.section_id),
              section_name: s.section_name,
            });
          }
        }
        if (cancelled) return;
        setContextRows(flat);
        if (flat.length > 0) {
          setClassId(flat[0].class_id);
          setSectionId(flat[0].section_id);
        }
      } catch (e: any) {
        if (!cancelled) setMessage(e?.message || "Failed to load exam context");
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
    if (!examId || !classId || !sectionId) {
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
            exam_date: r.exam_date ? String(r.exam_date).slice(0, 10) : "",
            start_time: r.start_time ? String(r.start_time).slice(0, 5) : "",
            end_time: r.end_time ? String(r.end_time).slice(0, 5) : "",
          }))
        );
        if (!ctxRows.length) setMessage("No subjects found for selected class and section.");
        else setMessage(null);
      } catch (e: any) {
        if (!cancelled) {
          setRows([]);
          setMessage(e?.message || "Failed to load timetable context");
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
      Swal.fire({
        icon: "warning",
        title: "Time slot conflict",
        text: collisionError,
        confirmButtonText: "OK",
      });
      setMessage(collisionError);
      return;
    }
    setRows(next);
    if (message?.toLowerCase().includes("overlap") || message?.toLowerCase().includes("same date")) {
      setMessage(null);
    }
  };

  const save = async () => {
    if (!examId || !classId || !sectionId) return;
    if (!rows.length) {
      setMessage("No subjects available for timetable.");
      return;
    }
    const payload = rows.map((r) => ({
      subject_id: r.subject_id,
      max_marks: Number(r.max_marks),
      passing_marks: Number(r.passing_marks),
      exam_date: r.exam_date || null,
      start_time: r.start_time || null,
      end_time: r.end_time || null,
    }));

    for (const row of payload) {
      const date = row.exam_date ? String(row.exam_date).slice(0, 10) : "";
      const start = row.start_time ? String(row.start_time).slice(0, 5) : "";
      const end = row.end_time ? String(row.end_time).slice(0, 5) : "";
      if (!date && !start && !end) continue;
      if (!date || !start || !end) {
        setMessage("Date, start time and end time must be filled together for each subject.");
        return;
      }
      if (start >= end) {
        setMessage("Start time must be earlier than end time.");
        return;
      }
    }
    const collisionError = getTimeCollisionError(
      payload.map((r) => ({
        subject_id: r.subject_id,
        subject_name: "",
        max_marks: String(r.max_marks),
        passing_marks: String(r.passing_marks),
        exam_date: r.exam_date || "",
        start_time: r.start_time || "",
        end_time: r.end_time || "",
      }))
    );
    if (collisionError) {
      Swal.fire({
        icon: "warning",
        title: "Time slot conflict",
        text: collisionError,
        confirmButtonText: "OK",
      });
      setMessage(collisionError);
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await apiService.saveExamSubjectSetup({
        exam_id: examId,
        class_id: Number(classId),
        section_id: Number(sectionId),
        rows: payload,
      });
      setMessage("Timetable saved successfully.");
    } catch (e: any) {
      setMessage(e?.message || "Failed to save timetable");
    } finally {
      setSaving(false);
    }
  };

  return (
      <div className="page-wrapper">
        <div className="content">
        <div className="page-header d-flex justify-content-between align-items-center">
          <div>
            <h3 className="page-title">Exam Timetable</h3>
            <p className="text-muted mb-0">Subjects are auto-loaded from system mapping.</p>
          </div>
          <Link to={routes.exam} className="btn btn-light">
            Back to exams
                      </Link>
        </div>

        {message && <div className="alert alert-warning">{message}</div>}

        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-3">
              <div className="col-md-4">
                <label className="form-label">Class</label>
                <select
                  className="form-select"
                  value={classId}
                  onChange={(e) => {
                    setClassId(e.target.value);
                    setSectionId("");
                  }}
                >
                  <option value="">Select class</option>
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                        </div>
                        <div className="col-md-4">
                            <label className="form-label">Section</label>
                <select
                  className="form-select"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                >
                  <option value="">Select section</option>
                  {sectionOptions.map((s) => (
                    <option key={s.section_id} value={s.section_id}>
                      {s.section_name}
                    </option>
                  ))}
                </select>
                </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {loading ? (
              <p className="text-muted mb-0">Loading...</p>
            ) : (
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      <th>Subject code</th>
                      <th>Type</th>
                      <th>Max marks</th>
                      <th>Pass marks</th>
                      <th>Date</th>
                      <th>Start</th>
                      <th>End</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={`subject-row-${row.subject_id}`}>
                        <td style={{ minWidth: 200 }}>
                          <div className="fw-semibold">{row.subject_name}</div>
                        </td>
                        <td style={{ minWidth: 140 }}>{row.subject_code || "N/A"}</td>
                        <td style={{ minWidth: 150 }}>{row.subject_mode || "Theory"}</td>
                        <td>
                            <input
                              className="form-control"
                            value={row.max_marks}
                            onChange={(e) => updateRow(i, { max_marks: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            className="form-control"
                            value={row.passing_marks}
                            onChange={(e) => updateRow(i, { passing_marks: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            className="form-control"
                            value={row.exam_date}
                            onChange={(e) => updateRow(i, { exam_date: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className="form-control"
                            value={row.start_time}
                            onChange={(e) => updateRow(i, { start_time: e.target.value })}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className="form-control"
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

            <div className="d-flex gap-2 mt-2">
              <button type="button" className="btn btn-primary" onClick={save} disabled={saving || !rows.length}>
                {saving ? "Saving..." : "Save timetable"}
              </button>
            </div>
            </div>
          </div>
        </div>
    </div>
  );
};

export default ExamSchedule;
