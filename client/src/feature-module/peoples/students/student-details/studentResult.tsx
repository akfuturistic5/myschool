import { Link, useLocation } from "react-router-dom";
import { useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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
  const [exportingExcelExamId, setExportingExcelExamId] = useState<number | null>(null);

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

      doc.setFillColor(15, 41, 90);
      doc.rect(0, 0, pageWidth, 96, "F");
      if (logoDataUrl) {
        try {
          const format = /data:image\/png/i.test(logoDataUrl) ? "PNG" : "JPEG";
          doc.addImage(logoDataUrl, format, margin, 18, 56, 56);
        } catch {
          // If logo rendering fails, continue PDF export without logo.
        }
      }
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text(String(schoolName), margin + 70, 42);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      if (schoolAddress) doc.text(String(schoolAddress), margin + 70, 62);
      doc.text(`Generated: ${new Date().toLocaleString("en-GB")}`, margin + 70, 78);
      y = 118;

      const title = `${student?.first_name || ""} ${student?.last_name || ""}`.trim() || "Student";
      const classSection = `${student?.class_name || student?.className || student?.class_id || "-"} / ${
        student?.section_name || student?.sectionName || student?.section_id || "-"
      }`;
      doc.setTextColor(20, 20, 20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`Exam Result Report: ${title}`, margin, y);
      y += 22;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`Class / Section: ${classSection}`, margin, y);
      y += lineHeight;
      doc.text(`Total Exams: ${overallSummary.totalExams}`, margin, y);
      y += lineHeight;
      doc.text(`Passed Exams: ${overallSummary.passCount}`, margin, y);
      y += lineHeight;
      doc.text(
        `Average Percentage: ${overallSummary.averagePercentage != null ? `${overallSummary.averagePercentage}%` : "N/A"}`,
        margin,
        y
      );
      y += 22;

      [selectedExam].forEach((exam: any, examIdx: number) => {
        ensureSpace(48);
        doc.setFont("helvetica", "bold");
        doc.text(
          `${examIdx + 1}. ${exam.examLabel || exam.examName || "Exam"} (${exam.examDate ? new Date(exam.examDate).toLocaleDateString("en-GB") : "N/A"})`,
          margin,
          y
        );
        y += lineHeight;

        const summary = exam.summary || {};
        doc.setFont("helvetica", "normal");
        doc.text(
          `Exam Type: ${exam.examType || "-"}  Date: ${
            exam.examDate ? new Date(exam.examDate).toLocaleDateString("en-GB") : "N/A"
          }`,
          margin,
          y
        );
        y += lineHeight;

        const bodyRows = (exam.subjects || []).map((s: any) => [
          s.subjectName || "-",
          s.subjectCode || "-",
          s.subjectMode || "-",
          s.maxMarks ?? "N/A",
          s.minMarks ?? "N/A",
          s.isAbsent ? "ABSENT" : (s.marksObtained ?? "N/A"),
          s.result || "N/A",
        ]);
        autoTable(doc, {
          startY: y,
          theme: "grid",
          head: [["Subject", "Code", "Mode", "Max Marks", "Min Marks", "Marks Obtained", "Result"]],
          body: bodyRows,
          margin: { left: margin, right: margin },
          styles: { fontSize: 10, cellPadding: 5, lineColor: [220, 220, 220] },
          headStyles: { fillColor: [22, 63, 138], textColor: [255, 255, 255] },
          alternateRowStyles: { fillColor: [247, 249, 252] },
          columnStyles: {
            6: { halign: "center" },
          },
          didParseCell: (data: any) => {
            if (data.section === "body" && data.column.index === 6) {
              const val = String(data.cell.raw || "").toLowerCase();
              if (val === "pass") data.cell.styles.textColor = [0, 128, 0];
              if (val === "fail") data.cell.styles.textColor = [200, 0, 0];
            }
          },
        });
        y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 14 : y + 14;

        // Important summary band (below table): bold + colored + fixed sequence.
        ensureSpace(30);
        doc.setFillColor(16, 38, 84);
        doc.roundedRect(margin, y, pageWidth - margin * 2, 24, 4, 4, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        const summaryLine = [
          `Total: ${summary.totalMax ?? "N/A"}`,
          `Passing: ${summary.totalMin ?? "N/A"}`,
          `Obtained: ${summary.totalObtained ?? "N/A"}`,
          `Percentage: ${summary.percentage != null ? `${summary.percentage}%` : "N/A"}`,
          `Grade: ${summary.grade || "N/A"}`,
          `Result: ${summary.overallResult || "N/A"}`,
        ].join("    ");
        doc.text(summaryLine, margin + 10, y + 16);
        doc.setTextColor(20, 20, 20);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        y += 34;
      });

      const safeName = title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "student";
      const safeExamName = String(selectedExam?.examLabel || selectedExam?.examName || "exam")
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "_");
      doc.save(`${safeName}_${safeExamName}_result.pdf`);
    } finally {
      setExportingPdfExamId(null);
    }
  };
  const handleExportExcel = async (selectedExam: any) => {
    if (!selectedExam) return;
    try {
      setExportingExcelExamId(Number(selectedExam?.examId ?? -1));
      const studentName = `${student?.first_name || ""} ${student?.last_name || ""}`.trim() || "Student";
      const classSection = `${student?.class_name || student?.className || student?.class_id || "-"} / ${
        student?.section_name || student?.sectionName || student?.section_id || "-"
      }`;
      const rows: Record<string, string | number>[] = [];

      [selectedExam].forEach((exam: any, examIdx: number) => {
        const summary = exam.summary || {};
        const examLabel = exam.examLabel || exam.examName || `Exam ${examIdx + 1}`;
        const examDate = exam.examDate ? new Date(exam.examDate).toLocaleDateString("en-GB") : "N/A";
        const examTotal = summary.totalMax ?? "N/A";
        const examPassing = summary.totalMin ?? "N/A";
        const examObtained = summary.totalObtained ?? "N/A";
        const examPercentage = summary.percentage != null ? `${summary.percentage}%` : "N/A";
        const examGrade = summary.grade || "N/A";
        const overallResult = summary.overallResult || "N/A";

        (exam.subjects || []).forEach((subject: any) => {
          rows.push({
            Student: studentName,
            ClassSection: classSection,
            Exam: examLabel,
            ExamType: exam.examType || "-",
            ExamDate: examDate,
            Subject: subject.subjectName || "-",
            SubjectCode: subject.subjectCode || "-",
            Mode: subject.subjectMode || "-",
            MaxMarks: Number(subject.maxMarks ?? 0),
            MinMarks: Number(subject.minMarks ?? 0),
            MarksObtained: subject.isAbsent ? "ABSENT" : String(subject.marksObtained ?? "N/A"),
            SubjectResult: subject.result || "N/A",
            ExamTotal: "",
            ExamPassing: "",
            ExamObtained: "",
            ExamPercentage: "",
            ExamGrade: "",
            OverallResult: "",
          });
        });

        rows.push({
          Student: "",
          ClassSection: "",
          Exam: examLabel,
          ExamType: "",
          ExamDate: "",
          Subject: "EXAM SUMMARY",
          SubjectCode: "",
          Mode: "",
          MaxMarks: "",
          MinMarks: "",
          MarksObtained: "",
          SubjectResult: "",
          ExamTotal: String(examTotal),
          ExamPassing: String(examPassing),
          ExamObtained: String(examObtained),
          ExamPercentage: examPercentage,
          ExamGrade: examGrade,
          OverallResult: overallResult,
        });
      });

      if (rows.length === 0) return;
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, "Exam Results");
      const safeName = studentName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "student";
      const safeExamName = String(selectedExam?.examLabel || selectedExam?.examName || "exam")
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "_");
      XLSX.writeFile(workbook, `${safeName}_${safeExamName}_result.xlsx`);
    } finally {
      setExportingExcelExamId(null);
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
            <StudentBreadcrumb studentId={student?.id} />
          </div>
          <div className="row">
            <StudentSidebar student={student} />
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  {returnToExamResult ? (
                    <div className="mb-3">
                      <Link to={returnToExamResult} className="text-primary">
                        <i className="ti ti-arrow-left me-2" />
                        Back to Directory
                      </Link>
                    </div>
                  ) : null}
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={student?.id ? `${routes.studentDetail}/${student.id}` : routes.studentDetail}
                        className="nav-link"
                        state={forwardedState}
                      >
                            <i className="ti ti-school me-2" /> Student Details
                          </Link>
                        </li>
                        <li>
                          <Link to={effectiveStudentId ? `${routes.studentTimeTable}?studentId=${effectiveStudentId}` : routes.studentTimeTable} className="nav-link" state={forwardedState}>
                            <i className="ti ti-table-options me-2" /> Time Table
                          </Link>
                        </li>
                        <li>
                          <Link to={effectiveStudentId ? `${routes.studentLeaves}?studentId=${effectiveStudentId}` : routes.studentLeaves} className="nav-link" state={forwardedState}>
                            <i className="ti ti-calendar-due me-2" /> Leave &amp; Attendance
                          </Link>
                        </li>
                        {!isTeacher && (
                          <li>
                            <Link to={effectiveStudentId ? `${routes.studentFees}?studentId=${effectiveStudentId}` : routes.studentFees} className="nav-link" state={forwardedState}>
                              <i className="ti ti-report-money me-2" /> Fees
                            </Link>
                          </li>
                        )}
                        <li>
                          <Link to={effectiveStudentId ? `${routes.studentResult}?studentId=${effectiveStudentId}` : routes.studentResult} className="nav-link active" state={forwardedState}>
                            <i className="ti ti-bookmark-edit me-2" /> Exam &amp; Results
                          </Link>
                        </li>
                        <li>
                          <Link to={effectiveStudentId ? `${routes.studentLibrary}?studentId=${effectiveStudentId}` : routes.studentLibrary} className="nav-link" state={forwardedState}>
                            <i className="ti ti-books me-2" /> Library
                          </Link>
                        </li>
                  </ul>

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
                                      <button
                                        type="button"
                                        className="btn btn-soft-success btn-sm d-flex align-items-center"
                                        onClick={() => handleExportExcel(exam)}
                                        disabled={exportingExcelExamId === Number(exam.examId ?? -1)}
                                      >
                                        {exportingExcelExamId === Number(exam.examId ?? -1) ? (
                                          <span className="spinner-border spinner-border-sm me-1"></span>
                                        ) : (
                                          <i className="ti ti-file-type-xls me-1" />
                                        )}
                                        Export Excel
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

