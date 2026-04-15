import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";

const ExamResult = () => {
  const routes = all_routes;
  const location = useLocation();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { user, loading: userLoading } = useCurrentUser();
  const roleTokens = [user?.role_name, user?.role, (user as any)?.display_role]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);
  const selfOnly = roleTokens.some(
    (r) =>
      r === "student" ||
      r === "parent" ||
      r === "guardian" ||
      r === "father" ||
      r === "mother" ||
      r.includes("student") ||
      r.includes("parent") ||
      r.includes("guardian")
  );
  const teacherOnly = roleTokens.some((r) => r === "teacher" || r.includes("teacher"));

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [contextRows, setContextRows] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [marksSubjects, setMarksSubjects] = useState<any[]>([]);
  const [marksStudents, setMarksStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [autoLoadFromQuery, setAutoLoadFromQuery] = useState(false);
  const hasHydratedFromQueryRef = useRef(false);

  const queryParams = useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
  const queryExamId = queryParams.get("exam_id") || "";
  const queryClassId = queryParams.get("class_id") || "";
  const querySectionId = queryParams.get("section_id") || "";

  const normalizeExamId = (value: any): string => {
    if (value == null) return "";
    if (typeof value === "object") {
      if ("id" in value) return String((value as any).id || "");
      return "";
    }
    return String(value);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (userLoading || !user?.id) return;
        if (selfOnly) {
          const res = await apiService.listSelfExams({ academic_year_id: academicYearId || undefined });
          if (cancelled) return;
          const nextExams = (res as any)?.data || [];
          setExams(nextExams);
          if (nextExams.length > 0) {
            setSelectedExamId(String(nextExams[0].id));
            setMessage(null);
          } else {
            setMessage("No exam result is assigned for your class and section yet.");
          }
          return;
        }

        const res = await apiService.listExams({ academic_year_id: academicYearId || undefined });
        if (cancelled) return;
        const nextExams = (res as any)?.data || [];
        setExams(nextExams);
        const current = normalizeExamId(
          !hasHydratedFromQueryRef.current && queryExamId ? queryExamId : selectedExamId
        );
        const hasCurrent = nextExams.some((ex: any) => normalizeExamId(ex?.id) === current);
        if (nextExams.length > 0 && (!current || !hasCurrent)) {
          setSelectedExamId(normalizeExamId(nextExams[0]?.id));
          setMessage(null);
        } else if (current) {
          setSelectedExamId(current);
        }
      } catch {
        if (!cancelled) setExams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYearId, selfOnly, userLoading, user?.id, selectedExamId, queryExamId]);

  useEffect(() => {
    if (!selectedExamId || selfOnly) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getExamManageContext(Number(selectedExamId));
        const classes = (res as any)?.data?.classes || [];
        const flat: any[] = [];
        for (const c of classes) {
          for (const s of c.sections || []) {
            flat.push({
              class_id: String(c.class_id),
              class_name: c.class_name,
              section_id: String(s.section_id),
              section_name: s.section_name,
            });
          }
        }
        if (cancelled) return;
        setContextRows(flat);
        if (flat.length > 0) {
          const queryComboExists = flat.some(
            (r) => String(r.class_id) === String(queryClassId) && String(r.section_id) === String(querySectionId)
          );
          if (!hasHydratedFromQueryRef.current && queryComboExists) {
            setClassId(String(queryClassId));
            setSectionId(String(querySectionId));
            setAutoLoadFromQuery(!!queryExamId);
            hasHydratedFromQueryRef.current = true;
          } else {
            setClassId(flat[0].class_id);
            setSectionId(flat[0].section_id);
          }
        }
      } catch {
        if (!cancelled) setContextRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExamId, selfOnly, queryClassId, querySectionId, queryExamId]);

  useEffect(() => {
    if (selfOnly || !autoLoadFromQuery) return;
    if (!selectedExamId || !classId || !sectionId) return;
    setAutoLoadFromQuery(false);
    loadResults(normalizeExamId(selectedExamId));
  }, [selfOnly, autoLoadFromQuery, selectedExamId, classId, sectionId]);

  const returnToExamResult = useMemo(() => {
    const params = new URLSearchParams();
    if (selectedExamId) params.set("exam_id", String(selectedExamId));
    if (classId) params.set("class_id", String(classId));
    if (sectionId) params.set("section_id", String(sectionId));
    const qs = params.toString();
    return `${routes.examResult}${qs ? `?${qs}` : ""}`;
  }, [routes.examResult, selectedExamId, classId, sectionId]);

  const classOptions = useMemo(() => {
    const m = new Map<string, string>();
    contextRows.forEach((r) => m.set(r.class_id, r.class_name));
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [contextRows]);
  const sectionOptions = useMemo(
    () => contextRows.filter((r) => r.class_id === classId),
    [contextRows, classId]
  );

  const loadResults = async (examIdOverride?: string) => {
    const fallbackExamId = exams.length ? normalizeExamId(exams[0]?.id) : "";
    const examIdToUse = normalizeExamId(examIdOverride || selectedExamId || fallbackExamId);
    if (!examIdToUse) {
      setMessage("Please select exam.");
      return;
    }
    if (examIdToUse !== normalizeExamId(selectedExamId)) {
      setSelectedExamId(examIdToUse);
    }
    if (!selfOnly && (!classId || !sectionId)) {
      setMessage("Please select class and section.");
      return;
    }
    if (teacherOnly && marksStudents.length > 0) {
      const draftRows: any[] = [];
      for (const student of marksStudents) {
        for (const cell of student.cells || []) {
          const hasMarks = !(cell.marks_obtained === "" || cell.marks_obtained == null);
          if (!cell.is_absent && !hasMarks) continue;
          draftRows.push({
            student_id: Number(student.student_id),
            subject_id: Number(cell.subject_id),
            is_absent: !!cell.is_absent,
            marks_obtained: cell.is_absent ? null : Number(cell.marks_obtained),
          });
        }
      }
      if (draftRows.length > 0) {
        try {
          await apiService.saveExamMarks({
            exam_id: Number(examIdToUse),
            class_id: Number(classId),
            section_id: Number(sectionId),
            rows: draftRows,
          });
        } catch (e: any) {
          setMessage(e?.message || "Failed to save marks before loading results");
          return;
        }
      }
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiService.viewExamResults({
        exam_id: examIdToUse,
        class_id: selfOnly ? undefined : classId,
        section_id: selfOnly ? undefined : sectionId,
      });
      const data = (res as any)?.data || [];
      setRows(data);
      if (!data.length) setMessage("No result found for selected filters.");
    } catch (e: any) {
      setRows([]);
      setMessage(e?.message || "Failed to load exam results");
    } finally {
      setLoading(false);
    }
  };

  const loadMarksContext = async () => {
    if (!selectedExamId || !classId || !sectionId) {
      setMessage("Please select exam, class and section.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiService.getExamMarksContext({
        exam_id: selectedExamId,
        class_id: classId,
        section_id: sectionId,
      });
      const data = (res as any)?.data || {};
      setMarksSubjects(data.subjects || []);
      setMarksStudents(data.students || []);
      if (!(data.students || []).length) setMessage("No students found for selected class and section.");
    } catch (e: any) {
      setMarksSubjects([]);
      setMarksStudents([]);
      setMessage(e?.message || "Failed to load marks sheet");
    } finally {
      setLoading(false);
    }
  };

  const updateMarkCell = (studentId: number, subjectId: number, patch: any) => {
    setMarksStudents((prev: any[]) =>
      prev.map((s) => {
        if (Number(s.student_id) !== Number(studentId)) return s;
        return {
          ...s,
          cells: (s.cells || []).map((c: any) => {
            if (Number(c.subject_id) !== Number(subjectId)) return c;
            const next = { ...c, ...patch };
            if (next.is_absent) next.marks_obtained = null;
            return next;
          }),
        };
      })
    );
  };

  const saveMarks = async () => {
    if (!selectedExamId || !classId || !sectionId) {
      setMessage("Please select exam, class and section.");
      return;
    }
    const payloadRows: any[] = [];
    for (const student of marksStudents) {
      for (const cell of student.cells || []) {
        const hasMarks = !(cell.marks_obtained === "" || cell.marks_obtained == null);
        if (!cell.is_absent && !hasMarks) continue;
        payloadRows.push({
          student_id: Number(student.student_id),
          subject_id: Number(cell.subject_id),
          is_absent: !!cell.is_absent,
          marks_obtained: cell.is_absent ? null : Number(cell.marks_obtained),
        });
      }
    }
    if (!payloadRows.length) {
      setMessage("Please enter at least one mark or mark at least one subject absent.");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await apiService.saveExamMarks({
        exam_id: Number(normalizeExamId(selectedExamId)),
        class_id: Number(classId),
        section_id: Number(sectionId),
        rows: payloadRows,
      });
      setMessage("Marks saved successfully.");
      await loadResults(normalizeExamId(selectedExamId));
    } catch (e: any) {
      setMessage(e?.message || "Failed to save marks");
    } finally {
      setSaving(false);
    }
  };

  const selfSummary = useMemo(() => {
    if (!selfOnly || !rows.length) return null;
    const totalMax = rows.reduce((sum: number, r: any) => sum + Number(r.max_marks || 0), 0);
    const totalObtained = rows.reduce(
      (sum: number, r: any) => sum + (r.is_absent ? 0 : Number(r.marks_obtained || 0)),
      0
    );
    const hasPending = rows.some((r: any) => !r.is_absent && (r.marks_obtained == null || r.marks_obtained === ""));
    const hasFail = rows.some(
      (r: any) =>
        r.is_absent ||
        (r.marks_obtained != null && r.marks_obtained !== "" && Number(r.marks_obtained) < Number(r.passing_marks || 0))
    );
    const percentage = totalMax > 0 ? ((totalObtained * 100) / totalMax).toFixed(2) : "0.00";
    const p = Number(percentage);
    const grade =
      p >= 91 ? "A+" :
      p >= 86 ? "A" :
      p >= 76 ? "B+" :
      p >= 66 ? "B" :
      p >= 50 ? "C" : "D";
    return {
      totalMax,
      totalObtained,
      percentage,
      grade,
      status: hasPending ? "PENDING" : hasFail ? "FAIL" : "PASS",
    };
  }, [rows, selfOnly]);

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="page-header d-flex justify-content-between align-items-center">
          <h3 className="page-title mb-0">Exam Result</h3>
          <Link to={routes.exam} className="btn btn-light">
            Back to exams
          </Link>
        </div>

        {message && <div className="alert alert-warning">{message}</div>}

        {selfOnly && (
          <div className="card mb-3">
            <div className="card-body">
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Exam</th>
                      <th>Type</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exams.map((ex: any) => (
                      <tr key={ex.id}>
                        <td>{ex.exam_name}</td>
                        <td>{ex.exam_type || "-"}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setSelectedExamId(String(ex.id));
                              loadResults(String(ex.id));
                            }}
                          >
                            View Result
                          </button>
                        </td>
                      </tr>
                    ))}
                    {!exams.length && (
                      <tr>
                        <td colSpan={3} className="text-center text-muted">
                          No exams found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {selfOnly && selfSummary && (
          <div className="card mb-3">
            <div className="card-body">
              <div className="row g-3">
                <div className="col-md-3"><strong>Total Obtained:</strong> {selfSummary.totalObtained}</div>
                <div className="col-md-3"><strong>Total Max:</strong> {selfSummary.totalMax}</div>
                <div className="col-md-3"><strong>Percentage:</strong> {selfSummary.percentage}%</div>
                <div className="col-md-3"><strong>Grade:</strong> {selfSummary.grade}</div>
                <div className="col-md-3"><strong>Status:</strong> {selfSummary.status}</div>
              </div>
            </div>
          </div>
        )}

        {!selfOnly && (
        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Exam</label>
                <select
                  className="form-select"
                  value={normalizeExamId(selectedExamId)}
                  onChange={(e) => {
                    setSelectedExamId(e.target.value);
                    setMessage(null);
                  }}
                >
                  <option value="">Select exam</option>
                  {exams.map((ex: any) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.exam_name} ({ex.exam_type})
                    </option>
                  ))}
                </select>
              </div>
              {!selfOnly && (
                <>
                  <div className="col-md-3">
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
                  <div className="col-md-3">
                    <label className="form-label">Section</label>
                    <select className="form-select" value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                      <option value="">Select section</option>
                      {sectionOptions.map((s) => (
                        <option key={s.section_id} value={s.section_id}>
                          {s.section_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-primary w-100"
                    onClick={() => loadResults(normalizeExamId(selectedExamId))}
                    disabled={loading}
                  >
                  {loading ? "Loading..." : "View Result"}
                </button>
              </div>
              {teacherOnly && (
                <div className="col-md-2">
                  <button type="button" className="btn btn-outline-primary w-100" onClick={loadMarksContext} disabled={loading}>
                    Load Marks
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        )}

        {teacherOnly && !selfOnly && marksSubjects.length > 0 && (
          <div className="card mb-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Marks Entry</h5>
              <button type="button" className="btn btn-success" onClick={saveMarks} disabled={saving}>
                {saving ? "Saving..." : "Save Marks"}
              </button>
            </div>
            <div className="card-body">
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Student</th>
                      {marksSubjects.map((s: any) => (
                        <th key={s.subject_id}>
                          {s.subject_name} ({s.subject_code || "-"})<br />
                          <small>Max: {s.max_marks} | Pass: {s.passing_marks}</small>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {marksStudents.map((st: any) => (
                      <tr key={st.student_id}>
                        <td>{st.student_name}</td>
                        {(st.cells || []).map((cell: any) => (
                          <td key={`${st.student_id}-${cell.subject_id}`}>
                            <input
                              type="number"
                              className="form-control mb-1"
                              min={0}
                              max={cell.max_marks}
                              disabled={!!cell.is_absent}
                              value={cell.marks_obtained ?? ""}
                              onChange={(e) => updateMarkCell(st.student_id, cell.subject_id, { marks_obtained: e.target.value })}
                            />
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`abs-${st.student_id}-${cell.subject_id}`}
                                checked={!!cell.is_absent}
                                onChange={(e) => updateMarkCell(st.student_id, cell.subject_id, { is_absent: e.target.checked })}
                              />
                              <label className="form-check-label" htmlFor={`abs-${st.student_id}-${cell.subject_id}`}>
                                Absent
                              </label>
                            </div>
                          </td>
                        ))}
                      </tr>
                    ))}
                    {!marksStudents.length && (
                      <tr>
                        <td colSpan={marksSubjects.length + 1} className="text-center text-muted">
                          No students found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="card">
          <div className="card-body">
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    {selfOnly ? (
                      <>
                        <th>Subject</th>
                        <th>Code</th>
                        <th>Obtained</th>
                        <th>Max</th>
                        <th>Pass Marks</th>
                        <th>Status</th>
                      </>
                    ) : (
                      <>
                        <th>Student</th>
                        <th>Total Obtained</th>
                        <th>Total Max</th>
                        <th>Percentage</th>
                        <th>Grade</th>
                        <th>Status</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {selfOnly
                    ? rows.map((r: any, idx: number) => {
                        const isPending = !r.is_absent && (r.marks_obtained == null || r.marks_obtained === "");
                        const failed =
                          !!r.is_absent ||
                          (!isPending && Number(r.marks_obtained ?? 0) < Number(r.passing_marks ?? 0));
                        return (
                          <tr key={`${r.subject_id}-${idx}`}>
                            <td>{r.subject_name || "-"}</td>
                            <td>{r.subject_code || "-"}</td>
                            <td>{r.is_absent ? "ABSENT" : (r.marks_obtained ?? "-")}</td>
                            <td>{r.max_marks ?? "-"}</td>
                            <td>{r.passing_marks ?? "-"}</td>
                            <td>{isPending ? "PENDING" : failed ? "FAIL" : "PASS"}</td>
                          </tr>
                        );
                      })
                    : rows.map((r: any) => (
                        <tr key={r.student_id}>
                          <td>
                            <Link
                              to={routes.studentResult}
                              state={{
                                studentId: Number(r.student_id),
                                fromExamResult: true,
                                returnTo: returnToExamResult,
                              }}
                            >
                              {r.student_name || "-"}
                            </Link>
                          </td>
                          <td>{r.total_obtained ?? "-"}</td>
                          <td>{r.total_max ?? "-"}</td>
                          <td>{r.percentage == null ? "-" : r.percentage}</td>
                          <td>{r.grade || "-"}</td>
                          <td>{r.result_status || "-"}</td>
                        </tr>
                      ))}
                  {!rows.length && !loading && (
                    <tr>
                      <td colSpan={selfOnly ? 6 : 6} className="text-center text-muted">
                        No data
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ExamResult;