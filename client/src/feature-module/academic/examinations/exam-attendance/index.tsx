import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { apiService } from "../../../../core/services/apiService";
import { exportToExcel, exportToPDF, printData } from "../../../../core/utils/exportUtils";
import { all_routes } from "../../../router/all_routes";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";

const ExamAttendance = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { user, loading: userLoading } = useCurrentUser();
  const roleTokens = [(user as any)?.role_name, (user as any)?.role, (user as any)?.display_role]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);
  const canonicalRoleId = Number((user as any)?.role_id ?? (user as any)?.user_role_id);
  const selfOnly =
    canonicalRoleId === 3 ||
    canonicalRoleId === 4 ||
    canonicalRoleId === 5 ||
    roleTokens.some(
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
        if (userLoading || !(user as any)?.id) return;
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

        const res = await apiService.listExams();
        if (cancelled) return;
        setExams((res as any)?.data || []);
      } catch {
        if (!cancelled) setExams([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYearId, selfOnly, userLoading, (user as any)?.id]);

  useEffect(() => {
    if (!selectedExamId || selfOnly) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getExamManageContext(Number(selectedExamId));
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

  const hasRealSections = useMemo(() => {
    return sectionOptions.length > 0 && !(sectionOptions.length === 1 && sectionOptions[0].section_id === "0");
  }, [sectionOptions]);

  useEffect(() => {
    if (sectionOptions.length === 1) {
      setSectionId(sectionOptions[0].section_id);
    } else if (sectionOptions.length === 0) {
      setSectionId("");
    }
  }, [sectionOptions]);

  const exportColumns = useMemo(
    () => [
      { title: "Subject", dataKey: "subject_name" },
      { title: "Code", dataKey: "subject_code" },
      { title: "Date", dataKey: "exam_date" },
      { title: "Start", dataKey: "start_time" },
      { title: "End", dataKey: "end_time" },
      { title: "Max", dataKey: "max_marks" },
      { title: "Pass", dataKey: "passing_marks" },
      { title: "Room", dataKey: "room" },
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

  const formatTime12h = (timeStr?: string | null) => {
    if (!timeStr) return "-";
    const [hStr, mStr] = timeStr.split(":");
    let h = parseInt(hStr, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${mStr} ${ampm}`;
  };

  const getExportData = () =>
    rows.map((r: any) => ({
      subject_name: r.subject_name || "-",
      subject_code: r.subject_code || "-",
      exam_date: r.exam_date ? String(r.exam_date).slice(0, 10) : "-",
      start_time: r.start_time ? String(r.start_time).slice(0, 5) : "-",
      end_time: r.end_time ? String(r.end_time).slice(0, 5) : "-",
      max_marks: r.max_marks ?? "-",
      passing_marks: r.passing_marks ?? "-",
      room: r.room_number ? `${r.room_number}${r.building_name ? ` (${r.building_name})` : ""}` : "-",
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
    if (!selfOnly && (!classId || (hasRealSections && sectionId === ""))) {
      setMessage(`Please select class and ${hasRealSections ? "section" : "details"}.`);
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
        {/* Header Section */}
        <div className="d-md-flex d-block align-items-center justify-content-between mb-4">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Exam Timetable</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                <li className="breadcrumb-item">Academic</li>
                <li className="breadcrumb-item active" aria-current="page">Exam Timetable</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
            {rows.length > 0 && (
              <div className="dropdown">
                <button
                  type="button"
                  className="btn btn-soft-secondary dropdown-toggle d-flex align-items-center shadow-sm"
                  data-bs-toggle="dropdown"
                  disabled={loading}
                >
                  <i className="ti ti-download me-2"></i> Export Records
                </button>
                <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0">
                  <li>
                    <button type="button" className="dropdown-item py-2" onClick={() => handleExport("pdf")}>
                      <i className="ti ti-file-type-pdf me-2 text-danger"></i> Export as PDF
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item py-2" onClick={() => handleExport("excel")}>
                      <i className="ti ti-file-type-xls me-2 text-success"></i> Export as Excel
                    </button>
                  </li>
                  <li className="border-top my-1"></li>
                  <li>
                    <button type="button" className="dropdown-item py-2" onClick={() => handleExport("print")}>
                      <i className="ti ti-printer me-2 text-primary"></i> Print Timetable
                    </button>
                  </li>
                </ul>
              </div>
            )}
            <Link to={routes.exam} className="btn btn-primary d-flex align-items-center shadow-sm">
              <i className="ti ti-checklist me-2"></i> Manage Exams
            </Link>
          </div>
        </div>

        {message && (
          <div className="alert alert-soft-info border-0 mb-4 d-flex align-items-center">
            <i className="ti ti-info-circle me-2 fs-18"></i>
            {message}
          </div>
        )}

        {/* Filters Card */}
        <div className="card border-0 shadow-sm mb-4 overflow-hidden">
          <div className="card-header bg-white py-3 border-bottom-0">
            <h5 className="fw-bold mb-3">{selfOnly ? "My Timetable" : "Search Parameters"}</h5>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label fw-semibold text-muted small text-uppercase">Examination</label>
                <select 
                  className="form-select shadow-none border-light" 
                  value={selectedExamId} 
                  onChange={(e) => {
                    setSelectedExamId(e.target.value);
                    if (selfOnly) loadSchedule();
                  }}
                >
                  <option value="">Select Exam</option>
                  {exams.map((ex: any) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.exam_name} ({ex.exam_type})
                    </option>
                  ))}
                </select>
              </div>
              {!selfOnly && (
                <>
                  <div className={hasRealSections ? "col-md-3" : "col-md-6"}>
                    <label className="form-label fw-semibold text-muted small text-uppercase">Class</label>
                    <select
                      className="form-select shadow-none border-light"
                      value={classId}
                      onChange={(e) => {
                        setClassId(e.target.value);
                        setSectionId("");
                      }}
                    >
                      <option value="">Select Class</option>
                      {classOptions.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {hasRealSections && (
                    <div className="col-md-3">
                      <label className="form-label fw-semibold text-muted small text-uppercase">Section</label>
                      <select 
                        className="form-select shadow-none border-light" 
                        value={sectionId} 
                        onChange={(e) => setSectionId(e.target.value)}
                        disabled={!classId}
                      >
                        <option value="">Select Section</option>
                        {sectionOptions.map((s) => (
                          <option key={s.section_id} value={s.section_id}>
                            {s.section_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              <div className="col-md-2">
                <button 
                  type="button" 
                  className="btn btn-soft-primary w-100 d-flex align-items-center justify-content-center" 
                  onClick={loadSchedule} 
                  disabled={loading}
                >
                  {loading ? (
                    <span className="spinner-border spinner-border-sm me-2"></span>
                  ) : (
                    <i className="ti ti-search me-2"></i>
                  )}
                  View Schedule
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Data Grid Card */}
        <div className="card border-0 shadow-sm overflow-hidden">
          <div className="card-body p-0">
            {loading ? (
              <div className="text-center py-5">
                <div className="spinner-border text-primary" role="status"></div>
                <p className="mt-2 text-muted">Synthesizing exam schedule...</p>
              </div>
            ) : rows.length === 0 ? (
              <div className="text-center py-5">
                <div className="mb-3 text-muted opacity-25">
                  <i className="ti ti-calendar-off fs-1"></i>
                </div>
                <h5 className="fw-bold">No Records Found</h5>
                <p className="text-muted small">Select an examination and group to view the timetable.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover table-nowrap align-middle mb-0">
                  <thead className="bg-light-50">
                    <tr>
                      <th className="py-3 px-4 fw-bold text-dark border-0">Subject Name</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0">Subject Code</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0">Exam Date</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0">Timing (Start - End)</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0 text-center">Max Marks</th>
                      <th className="py-3 px-3 fw-bold text-dark border-0 text-center">Passing Marks</th>
                      <th className="py-3 px-4 fw-bold text-dark border-0">Room</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r: any, idx: number) => (
                      <tr key={`${r.exam_id}-${r.subject_id}-${idx}`}>
                        <td className="px-4 border-light fw-bold text-dark">
                          {r.subject_name}
                        </td>
                        <td className="border-light">
                          <span className="badge badge-soft-secondary px-2">{r.subject_code || "-"}</span>
                        </td>
                        <td className="border-light fw-semibold">
                          <i className="ti ti-calendar-event text-primary me-1"></i>
                          {r.exam_date ? String(r.exam_date).slice(0, 10) : "-"}
                        </td>
                        <td className="border-light">
                          <span className="badge badge-soft-info px-2">
                            <i className="ti ti-clock me-1"></i>
                            {formatTime12h(r.start_time)} - {formatTime12h(r.end_time)}
                          </span>
                        </td>
                        <td className="border-light text-center fw-bold text-primary">{r.max_marks}</td>
                        <td className="px-4 border-light text-center fw-bold text-success">{r.passing_marks}</td>
                        <td className="px-4 border-light">
                          {r.room_number ? (
                            <span className="text-dark fw-semibold">
                              <i className="ti ti-door-enter text-secondary me-1"></i>
                              {r.room_number} {r.building_name && <small className="text-muted">({r.building_name})</small>}
                            </span>
                          ) : (
                            <span className="text-muted small">-</span>
                          )}
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
  );
};

export default ExamAttendance;





