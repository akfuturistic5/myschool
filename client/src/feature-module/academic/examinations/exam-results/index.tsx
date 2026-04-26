import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link, useLocation } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import Swal from "sweetalert2";
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
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [studentDetailsById, setStudentDetailsById] = useState<Record<number, any>>({});
  const [studentDetailLoadingById, setStudentDetailLoadingById] = useState<Record<number, boolean>>({});
  const [studentDetailAttemptedById, setStudentDetailAttemptedById] = useState<Record<number, boolean>>({});
  const [studentDetailsError, setStudentDetailsError] = useState<string | null>(null);
  const [actionLoadingKey, setActionLoadingKey] = useState<string | null>(null);
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
              class_code: c.class_code || "",
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

  const selectedClassSectionLabel = useMemo(() => {
    const match = contextRows.find(
      (r: any) => String(r.class_id) === String(classId) && String(r.section_id) === String(sectionId)
    );
    if (match) {
      return `${match.class_name || "-"} / ${match.section_name || "-"}`;
    }
    return `${classId || "-"} / ${sectionId || "-"}`;
  }, [contextRows, classId, sectionId]);

  const escapeHtml = (value: any) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const getSchoolHeaderInfo = async () => {
    const schoolProfileRes = await apiService.getSchoolProfile().catch(() => null);
    const schoolProfile = (schoolProfileRes as any)?.data || {};
    const schoolName = schoolProfile.school_name || (user as any)?.school_name || "School";
    const schoolAddress =
      schoolProfile.address ||
      [schoolProfile.city, schoolProfile.state, schoolProfile.country].filter(Boolean).join(", ") ||
      "Address not available";
    return { schoolName, schoolAddress };
  };

  const buildPdfStudentPage = (doc: any, row: any, detail: any, schoolName: string, schoolAddress: string) => {
    const examLabel = detail.examLabel || detail.examName || "Exam";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    let y = 34;

    doc.setFillColor(15, 41, 90);
    doc.rect(0, 0, pageWidth, 78, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(String(schoolName), margin, 28);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(String(schoolAddress), margin, 42);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Student Exam Result", margin, 60);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(`Student: ${row.student_name || "-"}`, margin, 74);
    doc.text(`Exam: ${examLabel}`, 260, 74);
    doc.text(`Class / Section: ${selectedClassSectionLabel}`, 460, 74);
    doc.text(`Date: ${formatDate(detail.examDate)}`, 690, 74);
    y = 96;

    const subjectRows = detail.subjects || [];
    const rowCount = Math.max(subjectRows.length, 1);
    const reservedBottom = 52; // summary + bottom breathing space
    const headerRowHeight = 24;
    const availableBodyHeight = Math.max(120, pageHeight - y - reservedBottom - headerRowHeight);
    // Keep rows compact enough so full result stays on a single page.
    // Earlier dynamic height could become too large and spill to page 2.
    const computedRowHeight = Math.floor(availableBodyHeight / rowCount);
    const dynamicRowHeight = Math.min(34, Math.max(22, computedRowHeight));

    autoTable(doc, {
      startY: y,
      theme: "grid",
      margin: { left: margin, right: margin },
      head: [["Subject", "Code", "Mode", "Max", "Pass", "Obtained", "Status"]],
      body: subjectRows.map((s: any) => [
        s.subjectName || "-",
        s.subjectCode || "-",
        s.subjectMode || "-",
        s.maxMarks ?? "-",
        s.minMarks ?? "-",
        s.isAbsent ? "ABSENT" : (s.marksObtained ?? "-"),
        s.result || "-",
      ]),
      headStyles: { fillColor: [22, 63, 138], textColor: [255, 255, 255] },
      styles: { fontSize: 10, cellPadding: 6, minCellHeight: dynamicRowHeight },
    });

    const summaryY = ((doc as any).lastAutoTable?.finalY || y) + 12;
    const summary = detail.summary || {};
    doc.setFillColor(16, 38, 84);
    doc.roundedRect(margin, summaryY, pageWidth - margin * 2, 26, 4, 4, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(
      [
        `Total: ${summary.totalMax ?? "N/A"}`,
        `Passing: ${summary.totalMin ?? "N/A"}`,
        `Obtained: ${summary.totalObtained ?? "N/A"}`,
        `Percentage: ${summary.percentage != null ? `${summary.percentage}%` : "N/A"}`,
        `Grade: ${summary.grade || "N/A"}`,
        `Result: ${summary.overallResult || "N/A"}`,
      ].join("    "),
      margin + 8,
      summaryY + 17
    );
  };

  const getDetailedRowsForBulk = async () => {
    const result: Array<{ row: any; detail: any }> = [];
    setDetailsLoading(true);
    setStudentDetailsError(null);
    try {
      const maxParallel = 3;
      for (let i = 0; i < rows.length; i += maxParallel) {
        const chunk = rows.slice(i, i + maxParallel);
        const chunkEntries = await Promise.all(
          chunk.map(async (r: any) => {
            const sid = Number(r.student_id);
            if (!Number.isFinite(sid) || sid <= 0) return null;
            const detail = await getStudentDetailForSelectedExam(sid);
            return detail ? { row: r, detail } : null;
          })
        );
        chunkEntries.forEach((entry) => {
          if (entry) result.push(entry);
        });
      }
    } catch (e: any) {
      setStudentDetailsError(e?.message || "Failed to load full student-wise details");
      return [];
    } finally {
      setDetailsLoading(false);
    }
    return result;
  };

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
    setDetailsLoading(false);
    setStudentDetailsById({});
    setStudentDetailLoadingById({});
    setStudentDetailAttemptedById({});
    setStudentDetailsError(null);
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

  const getStudentDetailForSelectedExam = async (studentId: number) => {
    const existing = studentDetailsById[studentId];
    if (existing) return existing;
    if (studentDetailLoadingById[studentId]) return null;
    const examIdNum = Number(normalizeExamId(selectedExamId));
    if (!Number.isFinite(examIdNum) || examIdNum <= 0) return null;
    setStudentDetailAttemptedById((prev) => ({ ...prev, [studentId]: true }));
    setStudentDetailLoadingById((prev) => ({ ...prev, [studentId]: true }));
    try {
      const res = await apiService.getStudentExamResults(studentId);
      const exams = (res as any)?.data?.exams || [];
      const examDetail =
        exams.find((ex: any) => Number(ex.examId) === examIdNum) ||
        exams.find((ex: any) => Number(ex.exam_id) === examIdNum) ||
        null;
      if (examDetail) {
        setStudentDetailsById((prev) => ({ ...prev, [studentId]: examDetail }));
      }
      return examDetail;
    } finally {
      setStudentDetailLoadingById((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
    }
  };

  const formatDate = (value: any) => {
    if (!value) return "N/A";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "N/A";
    return d.toLocaleDateString("en-GB");
  };

  useEffect(() => {
    if (selfOnly || rows.length === 0) return;
    const firstStudentId = Number(rows[0]?.student_id);
    if (!Number.isFinite(firstStudentId) || firstStudentId <= 0) return;
    if (studentDetailsById[firstStudentId] || studentDetailLoadingById[firstStudentId]) return;
    getStudentDetailForSelectedExam(firstStudentId).catch(() => {});
  }, [selfOnly, rows, selectedExamId]);

  const handleExportStudentPdf = async (row: any) => {
    const studentId = Number(row?.student_id);
    if (!Number.isFinite(studentId) || studentId <= 0) return;
    const loadingKey = `pdf-${studentId}`;
    setActionLoadingKey(loadingKey);
    try {
      const detail = await getStudentDetailForSelectedExam(studentId);
      if (!detail) {
        setMessage("Detailed result is not available for this student.");
        return;
      }

      const { schoolName, schoolAddress } = await getSchoolHeaderInfo();
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      buildPdfStudentPage(doc, row, detail, schoolName, schoolAddress);
      const examLabel = detail.examLabel || detail.examName || "Exam";
      const safeStudent = String(row.student_name || "student").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
      const safeExam = String(examLabel).replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_");
      doc.save(`${safeStudent || "student"}_${safeExam || "exam"}_result.pdf`);
    } catch (e: any) {
      setMessage(e?.message || "Failed to export student result PDF");
    } finally {
      setActionLoadingKey((prev) => (prev === loadingKey ? null : prev));
    }
  };

  const handlePrintStudentResult = async (row: any) => {
    const studentId = Number(row?.student_id);
    if (!Number.isFinite(studentId) || studentId <= 0) return;
    const loadingKey = `print-${studentId}`;
    setActionLoadingKey(loadingKey);
    try {
      const detail = await getStudentDetailForSelectedExam(studentId);
      if (!detail) {
        setMessage("Detailed result is not available for this student.");
        return;
      }

      const { schoolName, schoolAddress } = await getSchoolHeaderInfo();

      const examLabel = detail.examLabel || detail.examName || "Exam";
      const summary = detail.summary || {};
      const rowCount = Math.max((detail.subjects || []).length, 1);
      const dynamicRowHeightPx = Math.max(30, Math.floor(360 / rowCount));
      const subjectsHtml = (detail.subjects || [])
        .map(
          (s: any) => `
            <tr style="height:${dynamicRowHeightPx}px;">
              <td>${s.subjectName || "-"}</td>
              <td>${s.subjectCode || "-"}</td>
              <td>${s.subjectMode || "-"}</td>
              <td>${s.maxMarks ?? "-"}</td>
              <td>${s.minMarks ?? "-"}</td>
              <td>${s.isAbsent ? "ABSENT" : (s.marksObtained ?? "-")}</td>
              <td>${s.result || "-"}</td>
            </tr>
          `
        )
        .join("");

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Student Exam Result</title>
            <style>
              @page { size: A4 landscape; margin: 8mm; }
              html, body { width: 297mm; height: 210mm; margin: 0; padding: 0; overflow: hidden; font-family: Arial, sans-serif; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .sheet { box-sizing: border-box; width: 100%; height: 100%; padding: 8mm; }
              h1 { margin: 0 0 8px 0; font-size: 18px; }
              .school { margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #102654; }
              .school-address { margin: 0 0 10px 0; font-size: 11px; color: #444; }
              .meta { margin: 0 0 10px 0; font-size: 12px; display: flex; gap: 18px; flex-wrap: wrap; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th, td { border: 1px solid #7f8fb0; padding: 8px; text-align: left; }
              th { background-color: #163f8a !important; color: #ffffff !important; font-weight: 700; }
              .summary { margin-top: 8px; background-color: #102654 !important; color: #ffffff !important; border: 1px solid #102654; padding: 8px; font-size: 11px; font-weight: 700; }
              tr { page-break-inside: avoid; }
            </style>
          </head>
          <body>
            <div class="sheet">
              <p class="school">${escapeHtml(schoolName)}</p>
              <p class="school-address">${escapeHtml(schoolAddress)}</p>
              <h1>Student Exam Result</h1>
              <p class="meta">
                <span><strong>Student:</strong> ${escapeHtml(row.student_name || "-")}</span>
                <span><strong>Exam:</strong> ${escapeHtml(examLabel)}</span>
                <span><strong>Class / Section:</strong> ${escapeHtml(selectedClassSectionLabel)}</span>
                <span><strong>Date:</strong> ${formatDate(detail.examDate)}</span>
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Mode</th>
                    <th>Max</th>
                    <th>Pass</th>
                    <th>Obtained</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>${subjectsHtml}</tbody>
              </table>
              <div class="summary">
                Total: ${summary.totalMax ?? "N/A"} &nbsp;&nbsp;
                Passing: ${summary.totalMin ?? "N/A"} &nbsp;&nbsp;
                Obtained: ${summary.totalObtained ?? "N/A"} &nbsp;&nbsp;
                Percentage: ${summary.percentage != null ? `${summary.percentage}%` : "N/A"} &nbsp;&nbsp;
                Grade: ${summary.grade || "N/A"} &nbsp;&nbsp;
                Result: ${summary.overallResult || "N/A"}
              </div>
            </div>
            <script>
              window.onload = function () {
                window.print();
                setTimeout(function(){ window.close(); }, 200);
              };
            </script>
          </body>
        </html>
      `;

      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        setMessage("Popup blocked. Please allow popups to print.");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e: any) {
      setMessage(e?.message || "Failed to print student result");
    } finally {
      setActionLoadingKey((prev) => (prev === loadingKey ? null : prev));
    }
  };

  const handleExportAllStudentsPdf = async () => {
    if (rows.length === 0) return;
    const loadingKey = "pdf-all";
    setActionLoadingKey(loadingKey);
    try {
      const { schoolName, schoolAddress } = await getSchoolHeaderInfo();
      const items = await getDetailedRowsForBulk();
      if (!items.length) {
        setMessage("Detailed result is not available for selected students.");
        return;
      }
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      items.forEach((item, idx) => {
        if (idx > 0) doc.addPage();
        buildPdfStudentPage(doc, item.row, item.detail, schoolName, schoolAddress);
      });
      const examName = String(exams.find((e: any) => String(e.id) === String(selectedExamId))?.exam_name || "exam")
        .replace(/[^\w\- ]+/g, "")
        .trim()
        .replace(/\s+/g, "_");
      doc.save(`all_students_${examName || "exam"}_result.pdf`);
    } catch (e: any) {
      setMessage(e?.message || "Failed to export all student results");
    } finally {
      setActionLoadingKey((prev) => (prev === loadingKey ? null : prev));
    }
  };

  const handlePrintAllStudents = async () => {
    if (rows.length === 0) return;
    const loadingKey = "print-all";
    setActionLoadingKey(loadingKey);
    try {
      const { schoolName, schoolAddress } = await getSchoolHeaderInfo();
      const items = await getDetailedRowsForBulk();
      if (!items.length) {
        setMessage("Detailed result is not available for selected students.");
        return;
      }
      const sheetsHtml = items
        .map(({ row, detail }) => {
          const examLabel = detail.examLabel || detail.examName || "Exam";
          const summary = detail.summary || {};
          const rowCount = Math.max((detail.subjects || []).length, 1);
          const dynamicRowHeightPx = Math.max(30, Math.floor(360 / rowCount));
          const subjectsHtml = (detail.subjects || [])
            .map(
              (s: any) => `
                <tr style="height:${dynamicRowHeightPx}px;">
                  <td>${escapeHtml(s.subjectName || "-")}</td>
                  <td>${escapeHtml(s.subjectCode || "-")}</td>
                  <td>${escapeHtml(s.subjectMode || "-")}</td>
                  <td>${escapeHtml(s.maxMarks ?? "-")}</td>
                  <td>${escapeHtml(s.minMarks ?? "-")}</td>
                  <td>${escapeHtml(s.isAbsent ? "ABSENT" : (s.marksObtained ?? "-"))}</td>
                  <td>${escapeHtml(s.result || "-")}</td>
                </tr>
              `
            )
            .join("");
          return `
            <div class="sheet">
              <p class="school">${escapeHtml(schoolName)}</p>
              <p class="school-address">${escapeHtml(schoolAddress)}</p>
              <h1>Student Exam Result</h1>
              <p class="meta">
                <span><strong>Student:</strong> ${escapeHtml(row.student_name || "-")}</span>
                <span><strong>Exam:</strong> ${escapeHtml(examLabel)}</span>
                <span><strong>Class / Section:</strong> ${escapeHtml(selectedClassSectionLabel)}</span>
                <span><strong>Date:</strong> ${escapeHtml(formatDate(detail.examDate))}</span>
              </p>
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Code</th>
                    <th>Mode</th>
                    <th>Max</th>
                    <th>Pass</th>
                    <th>Obtained</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>${subjectsHtml}</tbody>
              </table>
              <div class="summary">
                Total: ${escapeHtml(summary.totalMax ?? "N/A")} &nbsp;&nbsp;
                Passing: ${escapeHtml(summary.totalMin ?? "N/A")} &nbsp;&nbsp;
                Obtained: ${escapeHtml(summary.totalObtained ?? "N/A")} &nbsp;&nbsp;
                Percentage: ${escapeHtml(summary.percentage != null ? `${summary.percentage}%` : "N/A")} &nbsp;&nbsp;
                Grade: ${escapeHtml(summary.grade || "N/A")} &nbsp;&nbsp;
                Result: ${escapeHtml(summary.overallResult || "N/A")}
              </div>
            </div>
          `;
        })
        .join("");

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>All Students Exam Result</title>
            <style>
              @page { size: A4 landscape; margin: 8mm; }
              html, body { margin: 0; padding: 0; font-family: Arial, sans-serif; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .sheet { box-sizing: border-box; width: 297mm; min-height: 210mm; padding: 8mm; page-break-after: always; }
              .sheet:last-child { page-break-after: auto; }
              h1 { margin: 0 0 8px 0; font-size: 18px; }
              .school { margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #102654; }
              .school-address { margin: 0 0 10px 0; font-size: 11px; color: #444; }
              .meta { margin: 0 0 10px 0; font-size: 12px; display: flex; gap: 18px; flex-wrap: wrap; }
              table { width: 100%; border-collapse: collapse; font-size: 11px; }
              th, td { border: 1px solid #7f8fb0; padding: 8px; text-align: left; }
              th { background-color: #163f8a !important; color: #ffffff !important; font-weight: 700; }
              .summary { margin-top: 8px; background-color: #102654 !important; color: #ffffff !important; border: 1px solid #102654; padding: 8px; font-size: 11px; font-weight: 700; }
              tr { page-break-inside: avoid; }
            </style>
          </head>
          <body>
            ${sheetsHtml}
            <script>
              window.onload = function () {
                window.print();
                setTimeout(function(){ window.close(); }, 300);
              };
            </script>
          </body>
        </html>
      `;

      const printWindow = window.open("", "_blank", "width=1200,height=800");
      if (!printWindow) {
        setMessage("Popup blocked. Please allow popups to print.");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (e: any) {
      setMessage(e?.message || "Failed to print all student results");
    } finally {
      setActionLoadingKey((prev) => (prev === loadingKey ? null : prev));
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

  const sanitizeMarkInput = (rawValue: any, maxMarks: any) => {
    const text = String(rawValue ?? "").trim();
    if (!text) return "";
    const parsed = Number(text);
    if (!Number.isFinite(parsed)) return "";
    const safeMax = Number(maxMarks);
    const upperBound = Number.isFinite(safeMax) && safeMax >= 0 ? safeMax : undefined;
    const bounded = upperBound == null ? Math.max(0, parsed) : Math.min(Math.max(0, parsed), upperBound);
    return String(bounded);
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
        const numericMarks = cell.is_absent ? null : Number(cell.marks_obtained);
        if (!cell.is_absent) {
          if (!Number.isFinite(numericMarks) || numericMarks < 0) {
            setMessage("Please enter valid non-negative marks.");
            return;
          }
          const maxMarks = Number(cell.max_marks);
          if (Number.isFinite(maxMarks) && numericMarks > maxMarks) {
            setMessage(
              `Marks cannot exceed max marks (${maxMarks}) for ${student.student_name || "student"}.`
            );
            return;
          }
        }
        payloadRows.push({
          student_id: Number(student.student_id),
          subject_id: Number(cell.subject_id),
          is_absent: !!cell.is_absent,
          marks_obtained: numericMarks,
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
      await Swal.fire({
        icon: "success",
        title: "Marks saved successfully",
        text: "Student marks have been updated.",
        confirmButtonText: "OK",
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
                              onChange={(e) =>
                                updateMarkCell(st.student_id, cell.subject_id, {
                                  marks_obtained: sanitizeMarkInput(e.target.value, cell.max_marks),
                                })
                              }
                              onBlur={(e) =>
                                updateMarkCell(st.student_id, cell.subject_id, {
                                  marks_obtained: sanitizeMarkInput(e.target.value, cell.max_marks),
                                })
                              }
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

        {!selfOnly && rows.length > 0 && (
          <div className="card mt-3">
            <div className="card-header d-flex justify-content-between align-items-center">
              <h5 className="mb-0">Detailed Result (All Students)</h5>
              <div className="d-flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-outline-primary"
                  onClick={handleExportAllStudentsPdf}
                  disabled={detailsLoading || actionLoadingKey === "pdf-all" || rows.length === 0}
                >
                  {actionLoadingKey === "pdf-all" ? "Exporting..." : "Export All PDF"}
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={handlePrintAllStudents}
                  disabled={detailsLoading || actionLoadingKey === "print-all" || rows.length === 0}
                >
                  {actionLoadingKey === "print-all" ? "Printing..." : "Print All"}
                </button>
              </div>
            </div>
            <div className="card-body">
              {detailsLoading && (
                <div className="alert alert-info mb-3">Loading full detailed result...</div>
              )}
              {studentDetailsError && (
                <div className="alert alert-warning mb-3">{studentDetailsError}</div>
              )}
              {!detailsLoading && !studentDetailsError && (
                <div className="accordion accordions-items-seperate" id="exam-result-all-student-details">
                  {rows.map((r: any, idx: number) => {
                    const studentId = Number(r.student_id);
                    const detail = studentDetailsById[studentId];
                    const collapseId = `exam-detail-student-${studentId || idx}`;
                    return (
                      <div className="accordion-item" key={collapseId}>
                        <h2 className="accordion-header">
                          <button
                            className={`accordion-button ${idx === 0 ? "" : "collapsed"}`}
                            type="button"
                            data-bs-toggle="collapse"
                            data-bs-target={`#${collapseId}`}
                            aria-expanded={idx === 0}
                            aria-controls={collapseId}
                            onClick={() => {
                              if (!studentDetailsById[studentId]) {
                                getStudentDetailForSelectedExam(studentId).catch(() => {});
                              }
                            }}
                          >
                            <span className="me-3">{r.student_name || "-"}</span>
                            <span className="text-muted small me-3">Obtained: {r.total_obtained ?? "-"}</span>
                            <span className="text-muted small me-3">Max: {r.total_max ?? "-"}</span>
                            <span className="text-muted small me-3">Percentage: {r.percentage == null ? "-" : r.percentage}</span>
                            <span className="text-muted small me-3">Grade: {r.grade || "-"}</span>
                            <span className="text-muted small">Status: {r.result_status || "-"}</span>
                          </button>
                        </h2>
                        <div
                          id={collapseId}
                          className={`accordion-collapse collapse ${idx === 0 ? "show" : ""}`}
                          data-bs-parent="#exam-result-all-student-details"
                        >
                          <div className="accordion-body">
                            <div className="d-flex justify-content-end gap-2 mb-3">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary"
                                onClick={() => handleExportStudentPdf(r)}
                                disabled={actionLoadingKey === `pdf-${Number(r.student_id)}` || detailsLoading}
                              >
                                {actionLoadingKey === `pdf-${Number(r.student_id)}` ? "Exporting..." : "Export PDF"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => handlePrintStudentResult(r)}
                                disabled={actionLoadingKey === `print-${Number(r.student_id)}` || detailsLoading}
                              >
                                {actionLoadingKey === `print-${Number(r.student_id)}` ? "Printing..." : "Print"}
                              </button>
                            </div>
                            {!detail && (
                              <div className="alert alert-warning mb-0">
                                {studentDetailLoadingById[studentId]
                                  ? "Loading selected exam detail..."
                                  : studentDetailAttemptedById[studentId]
                                    ? "Selected exam detail is not available for this student."
                                    : "Click to load selected exam detail."}
                              </div>
                            )}

                            {detail && (
                              <div className="table-responsive">
                                <table className="table align-middle">
                                  <thead>
                                    <tr>
                                      <th>Subject</th>
                                      <th>Code</th>
                                      <th>Mode</th>
                                      <th>Max Marks</th>
                                      <th>Min Marks</th>
                                      <th>Marks Obtained</th>
                                      <th>Status</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {(detail.subjects || []).map((subject: any, sidx: number) => (
                                      <tr key={`${subject.subjectId || subject.subject_id || sidx}`}>
                                        <td>{subject.subjectName || "-"}</td>
                                        <td>{subject.subjectCode || "-"}</td>
                                        <td>{subject.subjectMode || "-"}</td>
                                        <td>{subject.maxMarks ?? "-"}</td>
                                        <td>{subject.minMarks ?? "-"}</td>
                                        <td>{subject.isAbsent ? "ABSENT" : (subject.marksObtained ?? "-")}</td>
                                        <td>{subject.result || "-"}</td>
                                      </tr>
                                    ))}
                                    <tr>
                                      <td className="bg-dark text-white">Subjects: {(detail.subjects || []).length}</td>
                                      <td className="bg-dark text-white">-</td>
                                      <td className="bg-dark text-white">-</td>
                                      <td className="bg-dark text-white">Total: {detail.summary?.totalMax ?? "N/A"}</td>
                                      <td className="bg-dark text-white">Passing: {detail.summary?.totalMin ?? "N/A"}</td>
                                      <td className="bg-dark text-white">Obtained: {detail.summary?.totalObtained ?? "N/A"}</td>
                                      <td className="bg-dark text-white">
                                        {detail.summary?.percentage != null ? `${detail.summary.percentage}%` : "N/A"} |{" "}
                                        {detail.summary?.grade || "N/A"} | {detail.summary?.overallResult || "N/A"}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamResult;




