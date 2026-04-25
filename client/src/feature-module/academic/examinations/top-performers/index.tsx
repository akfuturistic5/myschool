import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";

const TopPerformers = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { user, loading: userLoading } = useCurrentUser();

  const roleTokens = [user?.role_name, user?.role, (user as any)?.display_role]
    .map((v) => String(v || "").trim().toLowerCase())
    .filter(Boolean);
  const teacherOnly = roleTokens.some((r) => r === "teacher" || r.includes("teacher"));

  const [exams, setExams] = useState<any[]>([]);
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [contextRows, setContextRows] = useState<any[]>([]);
  const [classId, setClassId] = useState<string>("all");
  const [sectionId, setSectionId] = useState<string>("all");
  const [topFilter, setTopFilter] = useState<string>("all");
  const [rows, setRows] = useState<any[]>([]);
  const [examMeta, setExamMeta] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"" | "pdf" | "print" | "excel">("");

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    contextRows.forEach((r) => {
      const id = String(r.class_id || "");
      if (id && !map.has(id)) {
        map.set(id, r.class_name || `Class ${id}`);
      }
    });
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [contextRows]);

  const sectionOptions = useMemo(() => {
    if (!classId || classId === "all") return [];
    return contextRows
      .filter((r) => String(r.class_id) === String(classId))
      .map((r) => ({ id: String(r.section_id), name: r.section_name || `Section ${r.section_id}` }));
  }, [contextRows, classId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setMessage(null);
        const res = await apiService.listExams({ academic_year_id: academicYearId || undefined });
        if (cancelled) return;
        const nextExams = (res as any)?.data || [];
        setExams(nextExams);
        if (nextExams.length) {
          setSelectedExamId(String(nextExams[0].id));
        } else {
          setSelectedExamId("");
          setRows([]);
          setExamMeta(null);
          setMessage("No exams found.");
        }
      } catch (e: any) {
        if (cancelled) return;
        setExams([]);
        setSelectedExamId("");
        setRows([]);
        setExamMeta(null);
        setMessage(e?.message || "Failed to load exams");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYearId]);

  useEffect(() => {
    if (!selectedExamId || userLoading) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getExamManageContext(Number(selectedExamId));
        if (cancelled) return;
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
        setContextRows(flat);
        if (flat.length === 0) {
          setClassId("all");
          setSectionId("all");
          return;
        }
        if (teacherOnly) {
          const first = flat[0];
          setClassId(String(first.class_id));
          setSectionId(String(first.section_id));
        } else {
          setClassId("all");
          setSectionId("all");
        }
      } catch {
        if (cancelled) return;
        setContextRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedExamId, userLoading, teacherOnly]);

  const loadTopPerformers = async () => {
    if (!selectedExamId) {
      setMessage("Please select exam.");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const params: any = { exam_id: selectedExamId };
      if (classId && classId !== "all") params.class_id = classId;
      if (sectionId && sectionId !== "all") params.section_id = sectionId;
      if (topFilter) params.top = topFilter;
      const res = await apiService.getExamTopPerformers(params);
      const payload = (res as any)?.data || {};
      const resultRows = payload.rows || [];
      setRows(resultRows);
      setExamMeta(payload.exam || null);
      if (!resultRows.length) {
        setMessage("No performers found for selected filters.");
      }
    } catch (e: any) {
      setRows([]);
      setExamMeta(null);
      setMessage(e?.message || "Failed to load top performers");
    } finally {
      setLoading(false);
    }
  };

  const getExportRows = () =>
    rows.map((row: any) => ({
      Rank: row.rank,
      Student: row.student_name || "N/A",
      Class: row.class_name || "-",
      Section: row.section_name || "-",
      Obtained: row.total_obtained ?? 0,
      Total: row.total_max ?? 0,
      Percentage: row.percentage == null ? "-" : `${row.percentage}%`,
      Grade: row.grade || "-",
      Status: row.result_status || "-",
    }));

  const exportExcel = () => {
    if (!rows.length) {
      setMessage("No data available to export.");
      return;
    }
    setExporting("excel");
    try {
      const worksheet = XLSX.utils.json_to_sheet(getExportRows());
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Top Performers");
      const safeExam = String(examMeta?.exam_name || "exam")
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "_");
      XLSX.writeFile(workbook, `top_performers_${safeExam || "exam"}.xlsx`);
    } finally {
      setExporting("");
    }
  };

  const exportPdf = () => {
    if (!rows.length) {
      setMessage("No data available to export.");
      return;
    }
    setExporting("pdf");
    try {
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      doc.setFontSize(14);
      doc.text(
        `${examMeta?.exam_name ? `${examMeta.exam_name} - ` : ""}Top Performers`,
        40,
        40
      );
      autoTable(doc, {
        startY: 60,
        head: [["Rank", "Student", "Class", "Section", "Obtained", "Total", "Percentage", "Grade", "Status"]],
        body: rows.map((row: any) => [
          row.rank,
          row.student_name || "N/A",
          row.class_name || "-",
          row.section_name || "-",
          row.total_obtained ?? 0,
          row.total_max ?? 0,
          row.percentage == null ? "-" : `${row.percentage}%`,
          row.grade || "-",
          row.result_status || "-",
        ]),
        styles: { fontSize: 9, cellPadding: 5 },
        headStyles: { fillColor: [22, 63, 138], textColor: 255 },
      });
      const safeExam = String(examMeta?.exam_name || "exam")
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "_");
      doc.save(`top_performers_${safeExam || "exam"}.pdf`);
    } finally {
      setExporting("");
    }
  };

  const printTable = () => {
    if (!rows.length) {
      setMessage("No data available to print.");
      return;
    }
    setExporting("print");
    try {
      const htmlRows = rows
        .map(
          (row: any) => `
            <tr>
              <td>${row.rank}</td>
              <td>${row.student_name || "N/A"}</td>
              <td>${row.class_name || "-"}</td>
              <td>${row.section_name || "-"}</td>
              <td>${row.total_obtained ?? 0}</td>
              <td>${row.total_max ?? 0}</td>
              <td>${row.percentage == null ? "-" : `${row.percentage}%`}</td>
              <td>${row.grade || "-"}</td>
              <td>${row.result_status || "-"}</td>
            </tr>
          `
        )
        .join("");
      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        setMessage("Popup blocked. Please allow popups to print.");
        return;
      }
      const title = `${examMeta?.exam_name ? `${examMeta.exam_name} - ` : ""}Top Performers`;
      printWindow.document.write(`
        <html>
          <head>
            <title>${title}</title>
            <style>
              body { font-family: Arial, sans-serif; padding: 24px; }
              h2 { margin-bottom: 12px; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #ccc; padding: 8px; font-size: 12px; text-align: left; }
              th { background: #163f8a; color: #fff; }
            </style>
          </head>
          <body>
            <h2>${title}</h2>
            <table>
              <thead>
                <tr>
                  <th>Rank</th><th>Student</th><th>Class</th><th>Section</th><th>Obtained</th><th>Total</th><th>Percentage</th><th>Grade</th><th>Status</th>
                </tr>
              </thead>
              <tbody>${htmlRows}</tbody>
            </table>
            <script>
              window.onload = function () {
                window.print();
                setTimeout(function(){ window.close(); }, 200);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    } finally {
      setExporting("");
    }
  };

  useEffect(() => {
    if (!selectedExamId || userLoading) return;
    if (teacherOnly && (!classId || classId === "all" || !sectionId || sectionId === "all")) return;
    if (!teacherOnly && classId !== "all" && (!sectionId || sectionId === "all")) {
      // For non-teacher class-specific "all sections" is valid.
    }
    loadTopPerformers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedExamId, classId, sectionId, topFilter, teacherOnly, userLoading]);

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="page-header d-flex justify-content-between align-items-center">
          <h3 className="page-title mb-0">Top Performers</h3>
          <Link to={routes.examResult} className="btn btn-light">
            Back to Exam Result
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
                      {ex.exam_name} ({ex.exam_type || "Exam"})
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Class</label>
                <select
                  className="form-select"
                  value={classId}
                  onChange={(e) => {
                    const nextClass = e.target.value;
                    setClassId(nextClass);
                    if (teacherOnly) {
                      const match = contextRows.find((r) => String(r.class_id) === String(nextClass));
                      setSectionId(match ? String(match.section_id) : "");
                    } else {
                      setSectionId("all");
                    }
                  }}
                >
                  {!teacherOnly && <option value="all">All Classes</option>}
                  {classOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-3">
                <label className="form-label">Section</label>
                <select
                  className="form-select"
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  disabled={!teacherOnly && classId === "all"}
                >
                  {!teacherOnly && <option value="all">All Sections</option>}
                  {sectionOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-md-2">
                <label className="form-label">Top</label>
                <select className="form-select" value={topFilter} onChange={(e) => setTopFilter(e.target.value)}>
                  <option value="3">Top 3</option>
                  <option value="5">Top 5</option>
                  <option value="10">Top 10</option>
                  <option value="15">Top 15</option>
                  <option value="20">Top 20</option>
                  <option value="all">All</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header d-flex justify-content-between align-items-center">
            <h5 className="mb-0">
              {examMeta?.exam_name ? `${examMeta.exam_name} Top Performers` : "Top Performers List"}
            </h5>
            <div className="d-flex align-items-center gap-2">
              <div className="dropdown">
                <button
                  className="btn btn-outline-primary btn-sm dropdown-toggle"
                  type="button"
                  data-bs-toggle="dropdown"
                  aria-expanded="false"
                  disabled={!rows.length || !!exporting}
                >
                  {exporting ? "Processing..." : "Export"}
                </button>
                <ul className="dropdown-menu dropdown-menu-end">
                  <li>
                    <button type="button" className="dropdown-item" onClick={exportPdf}>
                      PDF
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={printTable}>
                      Print
                    </button>
                  </li>
                  <li>
                    <button type="button" className="dropdown-item" onClick={exportExcel}>
                      Excel
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="table-responsive">
              <table className="table align-middle">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Obtained</th>
                    <th>Total</th>
                    <th>Percentage</th>
                    <th>Grade</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr key={row.student_id}>
                      <td>
                        <span className="badge bg-primary">#{row.rank}</span>
                      </td>
                      <td>
                        <div className="d-flex align-items-center">
                          <div className="avatar avatar-sm rounded-circle flex-shrink-0 me-2">
                            {row.photo_url ? (
                              <img
                                src={row.photo_url}
                                alt={row.student_name || "Student"}
                                className="img-fluid rounded-circle"
                                style={{ objectFit: "cover", width: "100%", height: "100%" }}
                              />
                            ) : (
                              <ImageWithBasePath src="assets/img/students/student-01.jpg" alt="Student" />
                            )}
                          </div>
                          <span>{row.student_name || "N/A"}</span>
                        </div>
                      </td>
                      <td>{row.class_name || "-"}</td>
                      <td>{row.section_name || "-"}</td>
                      <td>{row.total_obtained ?? 0}</td>
                      <td>{row.total_max ?? 0}</td>
                      <td>{row.percentage == null ? "-" : `${row.percentage}%`}</td>
                      <td>{row.grade || "-"}</td>
                      <td>{row.result_status || "-"}</td>
                    </tr>
                  ))}
                  {!rows.length && !loading && (
                    <tr>
                      <td colSpan={9} className="text-center text-muted">
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

export default TopPerformers;
