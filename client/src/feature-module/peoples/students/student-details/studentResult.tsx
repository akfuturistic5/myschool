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
      const schoolName = schoolProfile.school_name || user?.school_name || "PreSkool";
      const schoolAddress =
        schoolProfile.address ||
        [schoolProfile.city, schoolProfile.state, schoolProfile.country].filter(Boolean).join(", ") ||
        "";
      const logoSource = schoolProfile.logo_url || user?.school_logo || getSchoolLogoSrc(user as any);

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
            <StudentBreadcrumb />
          </div>
          <div className="row">
            <StudentSidebar student={student} />
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    {returnToExamResult && (
                      <li className="me-2">
                        <Link to={returnToExamResult} className="btn btn-outline-primary btn-sm">
                          <i className="ti ti-arrow-left me-1" />
                          Back to Exam Result
                        </Link>
                      </li>
                    )}
                    <li>
                      <Link
                        to={routes.studentDetail}
                        className="nav-link"
                        state={forwardedState}
                      >
                        <i className="ti ti-school me-2" />
                        Student Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentTimeTable}?studentId=${effectiveStudentId}` : routes.studentTimeTable}
                        className="nav-link"
                        state={forwardedState}
                      >
                        <i className="ti ti-table-options me-2" />
                        Time Table
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentLeaves}?studentId=${effectiveStudentId}` : routes.studentLeaves}
                        className="nav-link"
                        state={forwardedState}
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentFees}?studentId=${effectiveStudentId}` : routes.studentFees}
                        className="nav-link"
                        state={forwardedState}
                      >
                        <i className="ti ti-report-money me-2" />
                        Fees
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentResult}?studentId=${effectiveStudentId}` : routes.studentResult}
                        className="nav-link active"
                        state={forwardedState}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Exam &amp; Results
                      </Link>
                    </li>
                  </ul>

                  <div className="row g-3 mb-3">
                    <div className="col-md-4 d-flex">
                      <div className="card flex-fill mb-0">
                        <div className="card-body">
                          <p className="text-muted mb-1">Total Exams</p>
                          <h4 className="mb-0">{overallSummary.totalExams}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 d-flex">
                      <div className="card flex-fill mb-0">
                        <div className="card-body">
                          <p className="text-muted mb-1">Passed Exams</p>
                          <h4 className="mb-0">{overallSummary.passCount}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 d-flex">
                      <div className="card flex-fill mb-0">
                        <div className="card-body">
                          <p className="text-muted mb-1">Average Percentage</p>
                          <h4 className="mb-0">
                            {overallSummary.averagePercentage != null ? `${overallSummary.averagePercentage}%` : "N/A"}
                          </h4>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between">
                      <h4 className="mb-0">Exam &amp; Results</h4>
                    </div>
                    <div className="card-body">
                      {examError && (
                        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
                          <i className="ti ti-alert-circle me-2 fs-18" />
                          <span>{examError}</span>
                        </div>
                      )}

                      {examLoading && (
                        <div className="d-flex justify-content-center align-items-center p-4">
                          <div className="spinner-border text-primary" role="status" />
                          <span className="ms-2">Loading exam results...</span>
                        </div>
                      )}

                      {!examLoading && exams.length === 0 && (
                        <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>No exam results are available yet.</span>
                        </div>
                      )}

                      {!examLoading && exams.length > 0 && (
                        <div className="accordion accordions-items-seperate" id="student-exam-results">
                          {exams.map((exam: any, index: number) => {
                            const collapseId = `student-exam-${exam.examId ?? index}`;
                            const summary = exam.summary || {};
                            const isPass = String(summary.overallResult || "").toLowerCase() === "pass";
                            return (
                              <div className="accordion-item" key={collapseId}>
                                <h2 className="accordion-header">
                                  <button
                                    className={`accordion-button ${index === 0 ? "" : "collapsed"}`}
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target={`#${collapseId}`}
                                    aria-expanded={index === 0}
                                    aria-controls={collapseId}
                                  >
                                    <span className={`avatar avatar-sm ${isPass ? "bg-success" : "bg-danger"} me-2`}>
                                      <i className={`ti ${isPass ? "ti-checks" : "ti-x"}`} />
                                    </span>
                                    <span className="me-3">{exam.examLabel || exam.examName || `Exam ${index + 1}`}</span>
                                    <span className="text-muted small">
                                      {exam.examDate
                                        ? new Date(exam.examDate).toLocaleDateString("en-GB", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                          })
                                        : "Date not available"}
                                    </span>
                                    <span className="text-muted small ms-3">Class / Section: {displayClassSection}</span>
                                  </button>
                                </h2>
                                <div
                                  id={collapseId}
                                  className={`accordion-collapse collapse ${index === 0 ? "show" : ""}`}
                                  data-bs-parent="#student-exam-results"
                                >
                                  <div className="accordion-body">
                                    <div className="d-flex justify-content-end mb-3">
                                      <div className="dropdown">
                                        <button
                                          type="button"
                                          className="btn btn-primary btn-sm dropdown-toggle"
                                          data-bs-toggle="dropdown"
                                          disabled={
                                            examLoading ||
                                            exportingPdfExamId === Number(exam.examId ?? -1) ||
                                            exportingExcelExamId === Number(exam.examId ?? -1)
                                          }
                                        >
                                          {exportingPdfExamId === Number(exam.examId ?? -1) ||
                                          exportingExcelExamId === Number(exam.examId ?? -1)
                                            ? "Exporting..."
                                            : "Export"}
                                        </button>
                                        <ul className="dropdown-menu dropdown-menu-end">
                                          <li>
                                            <button
                                              type="button"
                                              className="dropdown-item"
                                              onClick={() => handleExportPdf(exam)}
                                            >
                                              <i className="ti ti-file-type-pdf me-2" />
                                              Export PDF
                                            </button>
                                          </li>
                                          <li>
                                            <button
                                              type="button"
                                              className="dropdown-item"
                                              onClick={() => handleExportExcel(exam)}
                                            >
                                              <i className="ti ti-file-type-xls me-2" />
                                              Export Excel
                                            </button>
                                          </li>
                                        </ul>
                                      </div>
                                    </div>
                                    <div className="table-responsive">
                                      <table className="table">
                                        <thead className="thead-light">
                                          <tr>
                                            <th>Subject</th>
                                            <th>Code</th>
                                            <th>Mode</th>
                                            <th>Max Marks</th>
                                            <th>Min Marks</th>
                                            <th>Marks Obtained</th>
                                            <th className="text-end">Result</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {exam.subjects.map((subject: any, subjectIndex: number) => {
                                            const subjectPass = String(subject.result || "").toLowerCase() === "pass";
                                            return (
                                              <tr key={`${collapseId}-subject-${subject.subjectId ?? subjectIndex}`}>
                                                <td>{subject.subjectName || "Subject"}</td>
                                                <td>{subject.subjectCode || "-"}</td>
                                                <td>{subject.subjectMode || "-"}</td>
                                                <td>{subject.maxMarks ?? "N/A"}</td>
                                                <td>{subject.minMarks ?? "N/A"}</td>
                                                <td>{subject.isAbsent ? "ABSENT" : (subject.marksObtained ?? "N/A")}</td>
                                                <td className="text-end">
                                                  <span
                                                    className={`badge ${subjectPass ? "badge-soft-success" : "badge-soft-danger"} d-inline-flex align-items-center`}
                                                  >
                                                    <i className="ti ti-circle-filled fs-5 me-1" />
                                                    {subject.result || "N/A"}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          <tr>
                                            <td className="bg-dark text-white">Subjects : {exam.subjects.length}</td>
                                            <td className="bg-dark text-white">-</td>
                                            <td className="bg-dark text-white">-</td>
                                            <td className="bg-dark text-white">Total : {summary.totalMax ?? "N/A"}</td>
                                            <td className="bg-dark text-white">Passing : {summary.totalMin ?? "N/A"}</td>
                                            <td className="bg-dark text-white">Obtained : {summary.totalObtained ?? "N/A"}</td>
                                            <td className="bg-dark text-white text-end">
                                              <div className="d-flex align-items-center justify-content-end gap-2">
                                                <span>{summary.percentage != null ? `${summary.percentage}%` : "N/A"}</span>
                                                <span className="text-warning">{summary.grade || "N/A"}</span>
                                                <span className={isPass ? "text-success" : "text-danger"}>
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

