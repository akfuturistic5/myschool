import { Link, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { all_routes } from "../../../router/all_routes";
import StudentModals from "../studentModals";
import StudentSidebar from "./studentSidebar";
import StudentBreadcrumb from "./studentBreadcrumb";
import { useStudentExamResults } from "../../../../core/hooks/useStudentExamResults";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import { getSchoolLogoSrc } from "../../../../core/utils/schoolLogo";
import { apiService } from "../../../../core/services/apiService";
import { isTeacherRole } from "../../../../core/utils/roleUtils";

interface StudentDetailsLocationState {
  studentId?: number;
  student?: any;
  fromExamResult?: boolean;
  returnTo?: string;
}

const StudentResult = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as StudentDetailsLocationState | null;
  const { studentId, student, loading } = useLinkedStudentContext({
    locationState: state,
  });
  const { user } = useCurrentUser();
  const currentUser = user as any;
  const isTeacher = isTeacherRole(currentUser);
  const returnToExamResult = typeof state?.returnTo === "string" ? state.returnTo : "";
  const forwardedState = student
    ? {
        studentId: student.id,
        student,
        ...(returnToExamResult ? { fromExamResult: true, returnTo: returnToExamResult } : {}),
      }
    : undefined;

  const { data: examResultsData, loading: examLoading, error: examError } = useStudentExamResults(studentId ?? null);
  const effectiveStudentId =
    (typeof studentId === "number" && Number.isFinite(studentId) && studentId > 0
      ? studentId
      : Number(student?.id) > 0
        ? Number(student.id)
        : null);
  const [exportingPdfExamId, setExportingPdfExamId] = useState<number | null>(null);

  const exams = useMemo(() => {
    const list = Array.isArray(examResultsData?.exams) ? examResultsData.exams : [];
    return list.filter((exam: any) => Array.isArray(exam.subjects) && exam.subjects.length > 0);
  }, [examResultsData]);
  const displayClassSection = useMemo(() => {
    const cls = student?.class_name || student?.className || student?.class_id || "-";
    const sec = student?.section_name || student?.sectionName || student?.section_id || "-";
    return `${cls} / ${sec}`;
  }, [student]);

  const overallSummary = useMemo(() => {
    if (exams.length === 0) {
      return { totalExams: 0, passCount: 0, averagePercentage: null as number | null };
    }
    const passCount = exams.filter((exam: any) => String(exam.summary?.overallResult || "").toLowerCase() === "pass").length;
    const percentages = exams
      .map((exam: any) => Number(exam.summary?.percentage))
      .filter((value: number) => Number.isFinite(value));
    const averagePercentage = percentages.length
      ? Number((percentages.reduce((sum, value) => sum + value, 0) / percentages.length).toFixed(2))
      : null;
    return { totalExams: exams.length, passCount, averagePercentage };
  }, [exams]);

  const showLoading = loading;

  const handleExportPdf = async (selectedExam: any) => {
    if (!selectedExam) return;
    try {
      setExportingPdfExamId(Number(selectedExam?.examId ?? -1));
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 36;
      const lineHeight = 18;
      let y = margin;

      const ensureSpace = (required = lineHeight) => {
        if (y + required > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const schoolProfileRes = await apiService.getSchoolProfile().catch(() => null);
      const schoolProfile = (schoolProfileRes as any)?.data || {};
      const schoolName = schoolProfile.school_name || currentUser?.school_name || "PreSkool";
      const schoolAddress =
        schoolProfile.address ||
        [schoolProfile.city, schoolProfile.state, schoolProfile.country].filter(Boolean).join(", ") ||
        "";
      const logoSource = schoolProfile.logo_url || currentUser?.school_logo || getSchoolLogoSrc(currentUser);

      const toAbsoluteUrl = (raw: string) => {
        if (!raw) return "";
        if (/^https?:\/\//i.test(raw) || raw.startsWith("data:")) return raw;
        if (raw.startsWith("/")) return `${window.location.origin}${raw}`;
        return `${window.location.origin}/${raw.replace(/^\/+/, "")}`;
      };
      const logoUrl = toAbsoluteUrl(String(logoSource || ""));

      const logoToDataUrl = async () => {
        if (!logoUrl) return "";
        if (logoUrl.startsWith("data:")) {
          const isSupported = /^data:image\/(png|jpeg|jpg);/i.test(logoUrl);
          return isSupported ? logoUrl : "";
        }
        try {
          const res = await fetch(logoUrl, { credentials: "include", cache: "no-store" });
          if (!res.ok) return "";
          const blob = await res.blob();
          const mime = String(blob.type || "").toLowerCase();
          if (!(mime === "image/png" || mime === "image/jpeg" || mime === "image/jpg")) {
            // Skip unsupported formats like SVG/BMP/WEBP for jsPDF image embedding.
            return "";
          }
          return await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(String(reader.result || ""));
            reader.onerror = () => resolve("");
            reader.readAsDataURL(blob);
          });
        } catch {
          return "";
        }
      };
      const logoDataUrl = await logoToDataUrl();

      // Header Styling
      doc.setFillColor(15, 41, 90);
      doc.rect(0, 0, pageWidth, 100, "F");

      if (logoDataUrl) {
        try {
          const format = /data:image\/png/i.test(logoDataUrl) ? "PNG" : "JPEG";
          doc.addImage(logoDataUrl, format, margin, 22, 56, 56);
        } catch (e) {
          console.error("PDF Logo render error:", e);
        }
      }

      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      const sName = String(schoolName);
      doc.text(sName, margin + 70, 45);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      if (schoolAddress) {
        doc.text(String(schoolAddress), margin + 70, 65);
      }
      doc.setFontSize(9);
      doc.text(`Academic Report Generated: ${new Date().toLocaleString("en-GB")}`, margin + 70, 82);

      y = 130;

      // Student Identity Bar
      const studentName = `${student?.first_name || ""} ${student?.last_name || ""}`.trim() || "Student";
      const classSection = `${student?.class_name || student?.className || student?.class_id || "-"} / ${
        student?.section_name || student?.sectionName || student?.section_id || "-"
      }`;

      doc.setFillColor(245, 247, 250);
      doc.roundedRect(margin, y - 15, pageWidth - margin * 2, 45, 4, 4, "F");
      
      doc.setTextColor(15, 41, 90);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(studentName, margin + 15, y + 12);

      doc.setTextColor(100, 100, 100);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Class/Section: ${classSection}`, pageWidth - margin - 15, y + 12, { align: "right" });
      
      y += 60;

      y += 20;

      // Exam Details
      [selectedExam].forEach((exam: any, examIdx: number) => {
        ensureSpace(60);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.setTextColor(15, 41, 90);
        doc.text(
          `${exam.examLabel || exam.examName || "Exam"} - ${exam.examType || "General"}`,
          margin,
          y
        );
        y += 18;

        const summary = exam.summary || {};
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.setTextColor(100, 100, 100);
        doc.text(
          `Examination Date: ${exam.examDate ? new Date(exam.examDate).toLocaleDateString("en-GB") : "N/A"}`,
          margin,
          y
        );
        y += 15;

        const bodyRows = (exam.subjects || []).map((s: any) => [
          s.subjectName || "-",
          s.subjectCode || "-",
          s.subjectMode || "-",
          s.maxMarks ?? "N/A",
          s.minMarks ?? "N/A",
          s.isAbsent ? "ABSENT" : (s.marksObtained ?? "N/A"),
          String(s.result || "N/A").toUpperCase(),
        ]);

        autoTable(doc, {
          startY: y,
          theme: "grid",
          head: [["Subject", "Code", "Mode", "Max", "Pass", "Obtained", "Result"]],
          body: bodyRows,
          margin: { left: margin, right: margin },
          styles: { fontSize: 9, cellPadding: 6, lineColor: [230, 230, 230] },
          headStyles: { fillColor: [15, 41, 90], textColor: [255, 255, 255], fontStyle: "bold" },
          alternateRowStyles: { fillColor: [250, 251, 253] },
          columnStyles: {
            3: { halign: "center" },
            4: { halign: "center" },
            5: { halign: "center" },
            6: { halign: "center", fontStyle: "bold" },
          },
          didParseCell: (data: any) => {
            if (data.section === "body" && data.column.index === 6) {
              const val = String(data.cell.raw || "").toLowerCase();
              if (val === "pass") data.cell.styles.textColor = [0, 120, 0];
              if (val === "fail") data.cell.styles.textColor = [200, 0, 0];
            }
          },
        });
        
        y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : y + 10;

        // Result Summary Band
        ensureSpace(40);
        doc.setFillColor(15, 41, 90);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 30, 4, 4, "F");
        
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        const summaryParts = [
          `TOTAL: ${summary.totalObtained ?? 0}/${summary.totalMax ?? 0}`,
          `PERCENTAGE: ${summary.percentage != null ? `${summary.percentage}%` : "N/A"}`,
          `GRADE: ${summary.grade || "N/A"}`,
          `RESULT: ${String(summary.overallResult || "N/A").toUpperCase()}`
        ];
        doc.text(summaryParts.join("    |    "), margin + 15, y + 19);
        
        y += 50;
      });

      // Disclaimer Footer on all pages
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, pageHeight - 35, pageWidth - margin, pageHeight - 35);
        
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.setTextColor(120, 120, 120);
        const disclaimer = "Note: This is a computer-generated academic report for informational purposes only and is not the original result mark sheet issued by the school.";
        doc.text(disclaimer, pageWidth / 2, pageHeight - 20, { align: "center" });
      }

      const safeName = studentName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "student";
      const safeExamName = String(selectedExam?.examLabel || selectedExam?.examName || "exam")
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "_");
      doc.save(`${safeName}_${safeExamName}_result.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
    } finally {
      setExportingPdfExamId(null);
    }
  };

  if (showLoading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading student...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <StudentBreadcrumb />
          </div>
          <div className="row">
            <StudentSidebar student={student} />
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  <div className="card border-0 shadow-sm mb-4">
                    <div className="card-body p-0">
                      <ul className="nav nav-tabs nav-tabs-bottom mb-0">
                        {returnToExamResult && (
                          <li className="nav-item">
                            <Link to={returnToExamResult} className="nav-link py-3 px-4 border-0 text-primary fw-bold">
                              <i className="ti ti-arrow-left me-2" />
                              Back to Directory
                            </Link>
                          </li>
                        )}
                        <li className="nav-item">
                          <Link to={routes.studentDetail} className="nav-link py-3 px-4 border-0 fw-bold" state={forwardedState}>
                            <i className="ti ti-school me-2" /> Details
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link to={effectiveStudentId ? `${routes.studentTimeTable}?studentId=${effectiveStudentId}` : routes.studentTimeTable} className="nav-link py-3 px-4 border-0 fw-bold" state={forwardedState}>
                            <i className="ti ti-table-options me-2" /> Timetable
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link to={effectiveStudentId ? `${routes.studentLeaves}?studentId=${effectiveStudentId}` : routes.studentLeaves} className="nav-link py-3 px-4 border-0 fw-bold" state={forwardedState}>
                            <i className="ti ti-calendar-due me-2" /> Attendance
                          </Link>
                        </li>
                        {!isTeacher && (
                          <li className="nav-item">
                            <Link to={effectiveStudentId ? `${routes.studentFees}?studentId=${effectiveStudentId}` : routes.studentFees} className="nav-link py-3 px-4 border-0 fw-bold" state={forwardedState}>
                              <i className="ti ti-report-money me-2" /> Fees
                            </Link>
                          </li>
                        )}
                        <li className="nav-item">
                          <Link to={effectiveStudentId ? `${routes.studentResult}?studentId=${effectiveStudentId}` : routes.studentResult} className="nav-link active py-3 px-4 border-0 fw-bold" state={forwardedState}>
                            <i className="ti ti-bookmark-edit me-2" /> Performance
                          </Link>
                        </li>
                        <li className="nav-item">
                          <Link to={effectiveStudentId ? `${routes.studentLibrary}?studentId=${effectiveStudentId}` : routes.studentLibrary} className="nav-link py-3 px-4 border-0 fw-bold" state={forwardedState}>
                            <i className="ti ti-books me-2" /> Library
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>

                  {/* Achievement Summary Cards */}
                  <div className="row g-3 mb-4">
                    <div className="col-md-4">
                      <div className="card border-0 shadow-sm bg-soft-primary h-100">
                        <div className="card-body p-3">
                          <div className="small text-muted mb-1 text-uppercase fw-bold">Total Exams</div>
                          <h4 className="fw-bold mb-0 text-primary">{overallSummary.totalExams}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-0 shadow-sm bg-soft-success h-100">
                        <div className="card-body p-3">
                          <div className="small text-muted mb-1 text-uppercase fw-bold">Passed Exams</div>
                          <h4 className="fw-bold mb-0 text-success">{overallSummary.passCount}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4">
                      <div className="card border-0 shadow-sm bg-soft-info h-100">
                        <div className="card-body p-3">
                          <div className="small text-muted mb-1 text-uppercase fw-bold">Avg. Percentage</div>
                          <h4 className="fw-bold mb-0 text-info">
                            {overallSummary.averagePercentage != null ? `${overallSummary.averagePercentage}%` : "N/A"}
                          </h4>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card border-0 shadow-sm overflow-hidden">
                    <div className="card-header bg-white py-3 border-bottom-0">
                      <h4 className="fw-bold mb-0 text-dark">Examination History</h4>
                    </div>
                    <div className="card-body p-0">
                      {examError && (
                        <div className="p-4">
                          <div className="alert alert-soft-danger border-0 d-flex align-items-center mb-0" role="alert">
                            <i className="ti ti-alert-circle me-2 fs-18" />
                            <span>{examError}</span>
                          </div>
                        </div>
                      )}

                      {examLoading && (
                        <div className="text-center py-5">
                          <div className="spinner-border text-primary" role="status" />
                          <p className="mt-2 text-muted">Analyzing performance data...</p>
                        </div>
                      )}

                      {!examLoading && exams.length === 0 && (
                        <div className="text-center py-5">
                          <div className="mb-3 text-muted opacity-25">
                            <i className="ti ti-notes-off fs-1"></i>
                          </div>
                          <h5 className="fw-bold">No Records Found</h5>
                          <p className="text-muted small">Academic performance metrics will appear here once examinations are concluded.</p>
                        </div>
                      )}

                      {!examLoading && exams.length > 0 && (
                        <div className="accordion accordions-items-seperate p-4 pt-0" id="student-exam-results">
                          {exams.map((exam: any, index: number) => {
                            const collapseId = `student-exam-${exam.examId ?? index}`;
                            const summary = exam.summary || {};
                            const isPass = String(summary.overallResult || "").toLowerCase() === "pass";
                            return (
                              <div className="accordion-item border-0 shadow-sm mb-3 rounded overflow-hidden" key={collapseId}>
                                <h2 className="accordion-header">
                                  <button
                                    className={`accordion-button ${index === 0 ? "" : "collapsed"} py-3 px-4`}
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target={`#${collapseId}`}
                                    aria-expanded={index === 0}
                                    aria-controls={collapseId}
                                  >
                                    <div className="d-flex flex-wrap align-items-center gap-3 w-100 pe-4">
                                      <span className={`badge badge-soft-${isPass ? "success" : "danger"} rounded-circle p-2 d-flex align-items-center justify-content-center`} style={{ width: 32, height: 32 }}>
                                        <i className={`ti ${isPass ? "ti-checks" : "ti-x"} fs-14`} />
                                      </span>
                                      <span className="fw-bold text-dark me-auto">{exam.examLabel || exam.examName || `Exam ${index + 1}`}</span>
                                      <span className="badge badge-soft-secondary small px-3 py-2">
                                        <i className="ti ti-calendar me-1"></i>
                                        {exam.examDate
                                          ? new Date(exam.examDate).toLocaleDateString("en-GB", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                            })
                                          : "N/A"}
                                      </span>
                                      <span className="badge badge-soft-primary small px-3 py-2">
                                        <i className="ti ti-users me-1"></i> {displayClassSection}
                                      </span>
                                    </div>
                                  </button>
                                </h2>
                                <div
                                  id={collapseId}
                                  className={`accordion-collapse collapse ${index === 0 ? "show" : ""}`}
                                  data-bs-parent="#student-exam-results"
                                >
                                  <div className="accordion-body p-0 border-top border-light">
                                    <div className="p-3 bg-light-50 d-flex justify-content-end gap-2">
                                      <button
                                        type="button"
                                        className="btn btn-soft-primary btn-sm d-flex align-items-center"
                                        onClick={() => handleExportPdf(exam)}
                                        disabled={exportingPdfExamId === Number(exam.examId ?? -1)}
                                      >
                                        {exportingPdfExamId === Number(exam.examId ?? -1) ? (
                                          <span className="spinner-border spinner-border-sm me-1"></span>
                                        ) : (
                                          <i className="ti ti-file-type-pdf me-1" />
                                        )}
                                        Export PDF
                                      </button>
                                    </div>
                                    <div className="table-responsive">
                                      <table className="table table-hover align-middle mb-0">
                                        <thead className="bg-light-50">
                                          <tr>
                                            <th className="ps-4 py-3 fw-bold text-dark border-0">Subject</th>
                                            <th className="py-3 fw-bold text-dark border-0 text-center">Code</th>
                                            <th className="py-3 fw-bold text-dark border-0 text-center">Mode</th>
                                            <th className="py-3 fw-bold text-dark border-0 text-center">Marks Obtained</th>
                                            <th className="py-3 fw-bold text-dark border-0 text-center">Max / Pass</th>
                                            <th className="pe-4 py-3 fw-bold text-dark border-0 text-end">Result</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {exam.subjects.map((subject: any, subjectIndex: number) => {
                                            const subjectPass = String(subject.result || "").toLowerCase() === "pass";
                                            return (
                                              <tr key={`${collapseId}-subject-${subject.subjectId ?? subjectIndex}`}>
                                                <td className="ps-4 border-light fw-bold text-dark">{subject.subjectName || "Subject"}</td>
                                                <td className="border-light text-center small text-muted">{subject.subjectCode || "-"}</td>
                                                <td className="border-light text-center">
                                                  <span className="badge badge-soft-secondary px-2">{subject.subjectMode || "-"}</span>
                                                </td>
                                                <td className="border-light text-center fw-bold text-dark">
                                                  {subject.isAbsent ? <span className="text-danger">ABSENT</span> : (subject.marksObtained ?? "N/A")}
                                                </td>
                                                <td className="border-light text-center small text-muted">
                                                  {subject.maxMarks ?? "N/A"} / {subject.minMarks ?? "N/A"}
                                                </td>
                                                <td className="pe-4 border-light text-end">
                                                  <span className={`badge badge-soft-${subjectPass ? "success" : "danger"} rounded-pill px-3`}>
                                                    {subject.result || "N/A"}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          <tr className="bg-dark">
                                            <td className="ps-4 text-white border-0 py-3">Summary Metrics</td>
                                            <td className="text-center text-white-50 border-0">-</td>
                                            <td className="text-center text-white-50 border-0">-</td>
                                            <td className="text-center text-white border-0 fw-bold">Obtained: {summary.totalObtained ?? "N/A"}</td>
                                            <td className="text-center text-white border-0 small">Total Max: {summary.totalMax ?? "N/A"}</td>
                                            <td className="pe-4 text-end text-white border-0">
                                              <div className="d-flex align-items-center justify-content-end gap-2">
                                                <span className="badge bg-white text-dark fw-bold">{summary.percentage != null ? `${summary.percentage}%` : "N/A"}</span>
                                                <span className="badge bg-warning text-dark fw-bold">{summary.grade || "N/A"}</span>
                                                <span className={`badge bg-${isPass ? "success" : "danger"} fw-bold`}>
                                                  {summary.overallResult || "N/A"}
                                                </span>
                                              </div>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <StudentModals />
    </>
  );
};

export default StudentResult;

