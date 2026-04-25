import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { apiService } from "../../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../../core/utils/exportUtils";
import { all_routes } from "../../../router/all_routes";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";

const ExamAttendance = () => {
  const routes = all_routes;
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

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [classId, setClassId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [contextRows, setContextRows] = useState<any[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

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
            setMessage("No exam timetable is assigned for your class and section yet.");
          }
          return;
        }

        const res = await apiService.listExams({ academic_year_id: academicYearId || undefined });
        if (cancelled) return;
        setExams((res as any)?.data || []);
      } catch {
        if (!cancelled) setExams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYearId, selfOnly, userLoading, user?.id]);

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
      } catch {
        if (!cancelled) setContextRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExamId, selfOnly]);

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

  const exportColumns = useMemo(
    () => [
      { title: "Subject", dataKey: "subject_name" },
      { title: "Code", dataKey: "subject_code" },
      { title: "Date", dataKey: "exam_date" },
      { title: "Start", dataKey: "start_time" },
      { title: "End", dataKey: "end_time" },
      { title: "Max", dataKey: "max_marks" },
      { title: "Pass", dataKey: "passing_marks" },
    ],
    []
  );

  const selectedExamLabel = useMemo(() => {
    const selected = exams.find((ex: any) => String(ex.id) === String(selectedExamId));
    if (!selected) return "Exam Timetable";
    return `${selected.exam_name || "Exam"}${selected.exam_type ? ` (${selected.exam_type})` : ""}`;
  }, [exams, selectedExamId]);

  const selectedClassSectionLabel = useMemo(() => {
    if (selfOnly) return "Self";
    const match = contextRows.find(
      (r: any) => String(r.class_id) === String(classId) && String(r.section_id) === String(sectionId)
    );
    if (!match) return "Class-Section";
    return `${match.class_name || "Class"}-${match.section_name || "Section"}`;
  }, [selfOnly, contextRows, classId, sectionId]);

  const safeToken = (value: string) =>
    String(value || "")
      .replace(/[^\w\- ]+/g, "")
      .trim()
      .replace(/\s+/g, "_");

  const getExportData = () =>
    rows.map((r: any) => ({
      subject_name: r.subject_name || "-",
      subject_code: r.subject_code || "-",
      exam_date: r.exam_date ? String(r.exam_date).slice(0, 10) : "-",
      start_time: r.start_time ? String(r.start_time).slice(0, 5) : "-",
      end_time: r.end_time ? String(r.end_time).slice(0, 5) : "-",
      max_marks: r.max_marks ?? "-",
      passing_marks: r.passing_marks ?? "-",
    }));

  const handleExport = (type: "pdf" | "excel" | "print") => {
    if (!rows.length) {
      setMessage("No timetable data available to export.");
      return;
    }
    const data = getExportData();
    const title = `Exam Timetable - ${selectedExamLabel} - ${selectedClassSectionLabel}`;
    const fileName = `exam_timetable_${safeToken(selectedExamLabel)}_${safeToken(selectedClassSectionLabel)}`;

    if (type === "pdf") {
      exportToPDF(data, title, fileName, exportColumns);
      return;
    }
    if (type === "excel") {
      exportToExcel(data, fileName, "Exam Timetable");
      return;
    }
    printData(title, exportColumns, data);
  };

  const loadSchedule = async () => {
    if (!selectedExamId) {
      setMessage("Please select exam.");
      return;
    }
    if (!selfOnly && (!classId || !sectionId)) {
      setMessage("Please select class and section.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const res = await apiService.viewExamSchedule({
        exam_id: selectedExamId,
        class_id: selfOnly ? undefined : classId,
        section_id: selfOnly ? undefined : sectionId,
      });
      const data = (res as any)?.data || [];
      setRows(data);
      if (!data.length) setMessage("No timetable found for selected filters.");
    } catch (e: any) {
      setRows([]);
      setMessage(e?.message || "Failed to load exam timetable");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="page-header d-flex justify-content-between align-items-center">
          <h3 className="page-title mb-0">Exam Timetable</h3>
          <Link to={routes.exam} className="btn btn-light">
            Back to exams
          </Link>
        </div>

        {message && <div className="alert alert-warning">{message}</div>}

        <div className="card mb-3">
          <div className="card-body">
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label">Exam</label>
                <select className="form-select" value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
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
                <button type="button" className="btn btn-primary w-100" onClick={loadSchedule} disabled={loading}>
                  {loading ? "Loading..." : "View"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body">
            {rows.length > 0 && (
              <div className="d-flex justify-content-end mb-3">
                <div className="dropdown">
                  <button
                    type="button"
                    className="btn btn-outline-primary dropdown-toggle"
                    data-bs-toggle="dropdown"
                    aria-expanded="false"
                    disabled={loading}
                  >
                    Export
                  </button>
                  <ul className="dropdown-menu">
                    <li>
                      <button type="button" className="dropdown-item" onClick={() => handleExport("pdf")}>
                        Export as PDF
                      </button>
                    </li>
                    <li>
                      <button type="button" className="dropdown-item" onClick={() => handleExport("print")}>
                        Print
                      </button>
                    </li>
                    <li>
                      <button type="button" className="dropdown-item" onClick={() => handleExport("excel")}>
                        Export as Excel
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            )}
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Date</th>
                    <th>Start</th>
                    <th>End</th>
                    <th>Max</th>
                    <th>Pass</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, idx: number) => (
                    <tr key={`${r.exam_id}-${r.subject_id}-${idx}`}>
                      <td>{r.subject_name}</td>
                      <td>{r.subject_code || "-"}</td>
                      <td>{r.exam_date ? String(r.exam_date).slice(0, 10) : "-"}</td>
                      <td>{r.start_time ? String(r.start_time).slice(0, 5) : "-"}</td>
                      <td>{r.end_time ? String(r.end_time).slice(0, 5) : "-"}</td>
                      <td>{r.max_marks}</td>
                      <td>{r.passing_marks}</td>
                    </tr>
                  ))}
                  {!rows.length && !loading && (
                    <tr>
                      <td colSpan={7} className="text-center text-muted">
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

export default ExamAttendance;





