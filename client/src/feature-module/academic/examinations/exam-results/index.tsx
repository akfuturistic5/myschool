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
  const roleTokens = [(user as any)?.role_name, (user as any)?.role, (user as any)?.display_role]
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
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [hasPendingElectives, setHasPendingElectives] = useState(false);
  const [hasHiddenMarksElectives, setHasHiddenMarksElectives] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("results_view");
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
        if (userLoading || !(user as any)?.id) return;
        if (selfOnly) {
          const res = await apiService.listSelfExams({ academic_year_id: academicYearId || undefined });
          if (cancelled) return;
          const raw = (res as any)?.data;
          const nextExams = Array.isArray(raw) ? raw : Array.isArray(raw?.exams) ? raw.exams : [];
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
      } catch (e: any) {
        if (!cancelled) {
          setExams([]);
          setMessage(e?.message || "Could not load exams. Please try again.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [academicYearId, selfOnly, userLoading, (user as any)?.id, selectedExamId, queryExamId]);

  useEffect(() => {
    if (!selectedExamId || selfOnly) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiService.getExamManageContext(Number(selectedExamId));
        const classes = (res as any)?.data?.classes || [];
        const flat: any[] = [];
        for (const c of classes) {
          const sections = c.sections || [];
          for (const s of sections) {
            flat.push({
              class_id: String(c.class_id),
              class_name: c.class_name,
              class_code: c.class_code || "",
              section_id: String(s.section_id),
              section_name: s.section_name,
            });
          }
          // If no sections, we still want the class to show in dropdown
          if (sections.length === 0) {
            flat.push({
              class_id: String(c.class_id),
              class_name: c.class_name,
              class_code: c.class_code || "",
              section_id: "",
              section_name: "",
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

  const toggleSelectAll = () => {
    if (selectedIds.length === rows.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(rows.map((r) => Number(r.student_id)).filter(id => Number.isFinite(id)));
    }
  };

  const toggleSelectStudent = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  };

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
    const logoUrl = schoolProfile.logo_url || (user as any)?.school_logo || "";
    const phone = schoolProfile.phone || (user as any)?.school_phone || "";
    const email = schoolProfile.email || (user as any)?.school_email || "";
    const schoolAddress =
      schoolProfile.address ||
      [schoolProfile.city, schoolProfile.state, schoolProfile.country].filter(Boolean).join(", ") ||
      "Address Details Not Configured";
    return { schoolName, schoolAddress, logoUrl, phone, email };
  };

  const buildPdfStudentPage = (doc: any, row: any, detail: any, schoolInfo: any) => {
    const { schoolName, schoolAddress, logoUrl, phone, email } = schoolInfo;
    const examLabel = detail.examLabel || detail.examName || "Exam";
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 28;
    const innerWidth = pageWidth - margin * 2;
    let y = 34;

    // Header Background - Full Bleed with Top Margin
    const headerHeight = 110;
    const headerTop = 15;
    doc.setFillColor(26, 51, 126);
    doc.rect(0, headerTop, pageWidth, headerHeight, "F");

    // School Logo or Placeholder
    if (logoUrl) {
      try {
        doc.addImage(logoUrl, "PNG", margin, headerTop + 18, 55, 55);
      } catch (e) {
        doc.setFillColor(255, 255, 255, 0.1);
        doc.roundedRect(margin, headerTop + 18, 55, 55, 5, 5, "F");
        doc.setDrawColor(255, 255, 255, 0.2);
        doc.roundedRect(margin, headerTop + 18, 55, 55, 5, 5, "S");
      }
    }

    const textStartX = logoUrl ? margin + 80 : margin;
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text(String(schoolName || "EDUCATIONAL INSTITUTION").toUpperCase(), textStartX, headerTop + 42);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(200, 210, 255);
    const displayAddr = schoolAddress === "Address Details Not Configured"
      ? "Institutional Address Details | Contact Information Not Configured"
      : schoolAddress;
    doc.text(String(displayAddr), textStartX, headerTop + 56);

    if (phone || email) {
      doc.text(`${phone ? `Phone: ${phone}` : ""} ${email ? ` | Email: ${email}` : ""}`, textStartX, headerTop + 68);
    }

    doc.setFillColor(248, 193, 46); // Gold accent for subtitle
    doc.roundedRect(textStartX, headerTop + 80, 220, 18, 4, 4, "F");
    doc.setTextColor(26, 51, 126);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("OFFICIAL STUDENT PROGRESS REPORT", textStartX + 12, headerTop + 92);

    y = headerTop + headerHeight + 35;

    // Student Meta Data Box
    doc.setFillColor(248, 250, 255);
    doc.setDrawColor(225, 232, 245);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 70, 12, 12, "FD");

    doc.setTextColor(136, 152, 170);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");

    const metaColWidth = innerWidth / 3;
    const meta1 = margin + 15;
    const meta2 = margin + metaColWidth + 15;
    const meta3 = margin + metaColWidth * 2 + 15;

    doc.text("STUDENT NAME", meta1, y + 18);
    doc.text("ADMISSION NO", meta2, y + 18);
    doc.text("ROLL NUMBER", meta3, y + 18);

    doc.text("EXAMINATION", meta1, y + 48);
    doc.text("CLASS / SECTION", meta2, y + 48);
    doc.text("REPORT DATE", meta3, y + 48);

    doc.setTextColor(26, 51, 126);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(String(row.student_name || "-"), meta1, y + 33);
    doc.text(String(row.admission_no || row.admission_number || "-"), meta2, y + 33);
    doc.text(String(row.roll_number || "-"), meta3, y + 33);

    doc.text(String(examLabel), meta1, y + 63);
    doc.text(String(selectedClassSectionLabel), meta2, y + 63);
    doc.text(formatDate(new Date()), meta3, y + 63);

    y += 90;

    const subjectRows = detail.subjects || [];
    autoTable(doc, {
      startY: y,
      theme: "grid",
      margin: { left: margin, right: margin },
      head: [["Subject", "Code", "Mode", "Max", "Pass", "Obtained", "Status"]],
      body: subjectRows.map((s: any) => [
        s.subjectName || "-",
        s.subjectCode || "-",
        s.subjectMode || "Theory",
        s.maxMarks ?? "-",
        s.minMarks ?? "-",
        s.isAbsent ? "ABSENT" : (s.marksObtained ?? "-"),
        s.result || "-",
      ]),
      headStyles: { fillColor: [26, 51, 126], textColor: [255, 255, 255], fontStyle: 'bold' },
      styles: { fontSize: 8, cellPadding: 6 },
      columnStyles: {
        3: { halign: 'center' },
        4: { halign: 'center' },
        5: { halign: 'center', fontStyle: 'bold' },
        6: { halign: 'center', fontStyle: 'bold' }
      }
    });

    const summaryY = ((doc as any).lastAutoTable?.finalY || y) + 25;
    const summary = detail.summary || {};

    doc.setFillColor(26, 51, 126);
    doc.roundedRect(margin, summaryY, innerWidth, 50, 10, 10, "F");

    const colWidth = innerWidth / 4;
    const center1 = margin + colWidth * 0.5;
    const center2 = margin + colWidth * 1.5;
    const center3 = margin + colWidth * 2.5;
    const center4 = margin + colWidth * 3.5;

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text("GRAND TOTAL", center1, summaryY + 18, { align: 'center' });
    doc.text("PERCENTAGE", center2, summaryY + 18, { align: 'center' });
    doc.text("GRADE", center3, summaryY + 18, { align: 'center' });
    doc.text("RESULT", center4, summaryY + 18, { align: 'center' });

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${summary.totalObtained ?? 0} / ${summary.totalMax ?? 0}`, center1, summaryY + 38, { align: 'center' });
    doc.text(`${summary.percentage != null ? `${summary.percentage}%` : "N/A"}`, center2, summaryY + 38, { align: 'center' });

    doc.setTextColor(248, 193, 46);
    doc.text(`${summary.grade || "N/A"}`, center3, summaryY + 38, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.text(`${summary.overallResult || "N/A"}`, center4, summaryY + 38, { align: 'center' });

    // Signatures - Precision alignment
    const sigY = pageHeight - 110;
    doc.setDrawColor(51, 51, 51);
    doc.setLineWidth(1.5);
    doc.setTextColor(26, 51, 126);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");

    const sigWidth = 150;
    // Left
    doc.line(margin + 5, sigY, margin + sigWidth + 5, sigY);
    doc.text("Class Teacher", margin + (sigWidth / 2) + 5, sigY + 15, { align: 'center' });

    // Center
    doc.line(pageWidth / 2 - (sigWidth / 2), sigY, pageWidth / 2 + (sigWidth / 2), sigY);
    doc.text("Exam Controller", pageWidth / 2, sigY + 15, { align: 'center' });

    // Right
    doc.line(pageWidth - margin - sigWidth - 5, sigY, pageWidth - margin - 5, sigY);
    doc.text("Principal Signature", pageWidth - margin - (sigWidth / 2) - 5, sigY + 15, { align: 'center' });

    doc.setFontSize(7.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text("This is a computer generated document. School seal required for official validity.", pageWidth / 2, pageHeight - 35, { align: 'center' });
  };

  const getDetailedRowsForBulk = async () => {
    const result: Array<{ row: any; detail: any }> = [];
    setDetailsLoading(true);
    setStudentDetailsError(null);
    try {
      const targetRows = selectedIds.length > 0
        ? rows.filter(r => selectedIds.includes(Number(r.student_id)))
        : rows;

      const maxParallel = 3;
      for (let i = 0; i < targetRows.length; i += maxParallel) {
        const chunk = targetRows.slice(i, i + maxParallel);
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
    if (!selfOnly) {
      if (!classId) {
        setMessage("Please select class.");
        return;
      }
      if (sectionOptions.length > 0 && sectionOptions[0].section_id && !sectionId) {
        setMessage("Please select section.");
        return;
      }
    }
    setLoading(true);
    setMessage(null);
    setRows([]);
    setMarksStudents([]);
    setMarksSubjects([]);
    setDetailsLoading(false);
    setStudentDetailsById({});
    setStudentDetailLoadingById({});
    setStudentDetailAttemptedById({});
    setStudentDetailsError(null);
    try {
      if (!selfOnly && activeTab === "marks_entry") {
        await loadMarksContext();
      }
      const res = await apiService.viewExamResults({
        exam_id: examIdToUse,
        class_id: selfOnly ? undefined : classId,
        section_id: selfOnly ? undefined : (sectionId || undefined),
      });
      const data = (res as any)?.data;
      if (data && typeof data === "object" && "results" in data) {
        setRows(data.results || []);
        setHasPendingElectives(!!data.has_pending_electives);
      } else {
        setRows(data || []);
        setHasPendingElectives(false);
      }
      if (!data || (Array.isArray(data) && !data.length) || (data.results && !data.results.length)) {
        if (!data?.has_pending_electives) {
          setMessage("No result found for selected filters.");
        }
      }
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

  const generateResultHtml = (row: any, detail: any, schoolInfo: any) => {
    const examLabel = detail.examLabel || detail.examName || "Examination";
    const summary = detail.summary || {};
    const subjects = detail.subjects || [];
    const studentName = row.student_name || "-";
    const rollNo = row.roll_number || "-";
    const admissionNo = row.admission_no || row.admission_number || "-";
    const { schoolName, schoolAddress, logoUrl, phone, email } = schoolInfo;

    const subjectsHtml = subjects.map((s: any) => `
      <tr>
        <td>${escapeHtml(s.subjectName)}</td>
        <td class="text-center">${escapeHtml(s.subjectCode || "-")}</td>
        <td class="text-center">${escapeHtml(s.subjectMode || "Theory")}</td>
        <td class="text-center">${escapeHtml(s.maxMarks)}</td>
        <td class="text-center">${escapeHtml(s.minMarks)}</td>
        <td class="text-center fw-bold">${s.isAbsent ? '<span class="text-danger">ABSENT</span>' : escapeHtml(s.marksObtained ?? "-")}</td>
        <td class="text-right fw-bold ${String(s.result).toLowerCase() === 'pass' ? 'text-success' : 'text-danger'}">${escapeHtml(s.result || "N/A")}</td>
      </tr>
    `).join("");

    return `
      <div class="sheet">
        <div class="header">
          <div class="header-inner">
            ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : '<div class="logo-placeholder"></div>'}
            <div class="school-info">
              <h1 class="school-name">${escapeHtml(schoolName || "EDUCATIONAL INSTITUTION")}</h1>
              <p class="school-contact">${schoolAddress === "Address Details Not Configured" ? "Institutional Address Details | Contact Information Not Configured" : escapeHtml(schoolAddress)}</p>
              ${(phone || email) ? `<p class="school-contact">${phone ? `Phone: ${escapeHtml(phone)}` : ""} ${email ? ` | Email: ${escapeHtml(email)}` : ""}</p>` : ""}
              <div class="subtitle-badge">OFFICIAL STUDENT PROGRESS REPORT</div>
            </div>
          </div>
        </div>
        
        <div class="report-content">
          <div class="student-meta">
          <div class="meta-item">
            <span class="label">STUDENT NAME</span>
            <span class="value">${escapeHtml(studentName)}</span>
          </div>
          <div class="meta-item">
            <span class="label">ADMISSION NO</span>
            <span class="value">${escapeHtml(admissionNo)}</span>
          </div>
          <div class="meta-item">
            <span class="label">ROLL NUMBER</span>
            <span class="value">${escapeHtml(rollNo)}</span>
          </div>
          <div class="meta-item">
            <span class="label">EXAMINATION</span>
            <span class="value">${escapeHtml(examLabel)}</span>
          </div>
          <div class="meta-item">
            <span class="label">CLASS / SECTION</span>
            <span class="value">${escapeHtml(selectedClassSectionLabel)}</span>
          </div>
          <div class="meta-item">
            <span class="label">REPORT DATE</span>
            <span class="value">${formatDate(new Date())}</span>
          </div>
        </div>

        <table class="results-table">
          <thead>
            <tr>
              <th style="width: 30%">SUBJECT</th>
              <th class="text-center">CODE</th>
              <th class="text-center">MODE</th>
              <th class="text-center">MAX</th>
              <th class="text-center">PASS</th>
              <th class="text-center">OBTAINED</th>
              <th class="text-right">STATUS</th>
            </tr>
          </thead>
          <tbody>
            ${subjectsHtml}
          </tbody>
        </table>

        <div class="summary-band">
          <div class="summary-item">
            <span class="s-label">GRAND TOTAL</span>
            <span class="s-value">${summary.totalObtained ?? 0} / ${summary.totalMax ?? 0}</span>
          </div>
          <div class="summary-item">
            <span class="s-label">PERCENTAGE</span>
            <span class="s-value">${summary.percentage != null ? `${summary.percentage}%` : "N/A"}</span>
          </div>
          <div class="summary-item">
            <span class="s-label">GRADE</span>
            <span class="s-value highlight">${summary.grade || "N/A"}</span>
          </div>
          <div class="summary-item">
            <span class="s-label">RESULT</span>
            <span class="s-value ${String(summary.overallResult).toLowerCase() === 'pass' ? 'text-success' : 'text-danger'}">${summary.overallResult || "N/A"}</span>
          </div>
        </div>

        <div class="footer-signatures">
          <div class="sig-box">
            <div class="sig-line"></div>
            <span>Class Teacher</span>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <span>Exam Controller</span>
          </div>
          <div class="sig-box">
            <div class="sig-line"></div>
            <span>Principal Signature</span>
          </div>
        </div>
        
        </div>
        
        <div class="print-footer">
          Computer generated report. Official signature and school seal required for validity.
        </div>
      </div>
    `;
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
    getStudentDetailForSelectedExam(firstStudentId).catch(() => { });
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

      const schoolInfo = await getSchoolHeaderInfo();
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      buildPdfStudentPage(doc, row, detail, schoolInfo);
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

      const schoolInfo = await getSchoolHeaderInfo();
      const bodyHtml = generateResultHtml(row, detail, schoolInfo);

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Student Exam Result - ${escapeHtml(row.student_name)}</title>
            <style>
              @page { size: A4 portrait; margin: 0; }
              html, body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fb; color: #333; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
              
              .sheet { 
                background: white; 
                width: 210mm; 
                min-height: 297mm; 
                margin: 0 auto; 
                position: relative;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
              }

              .header {
                background: #1a337e;
                padding: 6mm 15mm 15mm 15mm;
                color: white;
                margin-bottom: 0;
              }

              .header-inner {
                display: flex;
                align-items: center;
                gap: 25px;
              }

              .report-content {
                padding: 15mm;
              }

              .logo { height: 80px; width: auto; object-fit: contain; }
              .logo-placeholder { height: 80px; width: 80px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; }

              .school-info { flex: 1; }
              .school-name { margin: 0; font-size: 28px; color: white; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; }
              .school-contact { margin: 3px 0 0 0; font-size: 13px; color: #cbd5e0; }

              .subtitle-badge {
                display: inline-block;
                background: #f8c12e;
                color: #1a337e;
                padding: 4px 15px;
                border-radius: 4px;
                font-weight: 800;
                font-size: 11px;
                margin-top: 15px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }

              .report-title { display: none; } /* Replaced by subtitle-badge */

              .student-meta {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 20px;
                background: #f8faff;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 30px;
                border: 1px solid #e1e8f5;
              }

              .meta-item { display: flex; flex-direction: column; }
              .meta-item .label { font-size: 10px; font-weight: 800; color: #8898aa; text-transform: uppercase; margin-bottom: 4px; }
              .meta-item .value { font-size: 14px; font-weight: 600; color: #1a337e; }

              .results-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              .results-table th { 
                background: #1a337e; 
                color: white; 
                padding: 12px 15px; 
                font-size: 11px; 
                text-transform: uppercase; 
                letter-spacing: 1px;
                text-align: left;
              }
              .results-table td { 
                padding: 12px 15px; 
                border-bottom: 1px solid #edf2f9; 
                font-size: 13px; 
                color: #2d3748;
              }
              .results-table tr:nth-child(even) { background: #fcfdfe; }

              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .fw-bold { font-weight: 700; }
              .text-success { color: #2dce89; }
              .text-danger { color: #f5365c; }

              .summary-band {
                display: flex;
                justify-content: space-between;
                background: #1a337e;
                padding: 20px;
                border-radius: 12px;
                color: white;
                margin-bottom: 40px;
              }

              .summary-item { text-align: center; flex: 1; }
              .summary-item .s-label { display: block; font-size: 10px; font-weight: 700; opacity: 0.8; text-transform: uppercase; margin-bottom: 5px; }
              .summary-item .s-value { font-size: 18px; font-weight: 800; }
              .summary-item .s-value.highlight { color: #f8c12e; }

              .footer-signatures {
                display: flex;
                justify-content: space-between;
                margin-top: 60px;
                padding: 0 20px;
              }

              .sig-box { text-align: center; width: 150px; }
              .sig-line { border-top: 2px solid #333; margin-bottom: 8px; }
              .sig-box span { font-size: 12px; font-weight: 700; color: #1a337e; }

              .print-footer {
                position: absolute;
                bottom: 15mm;
                left: 15mm;
                right: 15mm;
                text-align: center;
                font-size: 10px;
                color: #999;
                border-top: 1px solid #eee;
                padding-top: 10px;
              }

              @media print {
                body { background: white; }
                .sheet { box-shadow: none; margin: 0; padding: 10mm; }
              }
            </style>
          </head>
          <body>
            ${bodyHtml}
            <script>
              window.onload = function () {
                window.print();
                setTimeout(function(){ window.close(); }, 500);
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
      const schoolInfo = await getSchoolHeaderInfo();
      const items = await getDetailedRowsForBulk();
      if (!items.length) {
        setMessage("Detailed result is not available for selected students.");
        return;
      }
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      items.forEach((item, idx) => {
        if (idx > 0) doc.addPage();
        buildPdfStudentPage(doc, item.row, item.detail, schoolInfo);
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
      const schoolInfo = await getSchoolHeaderInfo();
      const items = await getDetailedRowsForBulk();
      if (!items.length) {
        setMessage("Detailed result is not available for selected students.");
        return;
      }

      const sheetsHtml = items
        .map(({ row, detail }) => generateResultHtml(row, detail, schoolInfo))
        .join("");

      const html = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>All Students Exam Results</title>
            <style>
              @page { size: A4 portrait; margin: 0; }
              html, body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f5f7fb; }
              * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; box-sizing: border-box; }
              
              .sheet { 
                background: white; 
                width: 210mm; 
                min-height: 297mm; 
                margin: 0 auto; 
                position: relative;
                page-break-after: always;
              }
              .sheet:last-child { page-break-after: avoid; }

              .header {
                background: #1a337e;
                padding: 15mm;
                color: white;
                margin-bottom: 0;
              }

              .header-inner {
                display: flex;
                align-items: center;
                gap: 25px;
              }

              .report-content {
                padding: 15mm;
              }

              .logo { height: 80px; width: auto; object-fit: contain; }
              .logo-placeholder { height: 80px; width: 80px; background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); border-radius: 8px; }

              .school-info { flex: 1; }
              .school-name { margin: 0; font-size: 28px; color: white; text-transform: uppercase; letter-spacing: 1px; font-weight: 800; }
              .school-contact { margin: 3px 0 0 0; font-size: 13px; color: #cbd5e0; }

              .subtitle-badge {
                display: inline-block;
                background: #f8c12e;
                color: #1a337e;
                padding: 4px 15px;
                border-radius: 4px;
                font-weight: 800;
                font-size: 11px;
                margin-top: 15px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
              }

              .report-title { display: none; }

              .student-meta {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr;
                gap: 20px;
                background: #f8faff;
                padding: 20px;
                border-radius: 12px;
                margin-bottom: 30px;
                border: 1px solid #e1e8f5;
              }

              .meta-item { display: flex; flex-direction: column; }
              .meta-item .label { font-size: 10px; font-weight: 800; color: #8898aa; text-transform: uppercase; margin-bottom: 4px; }
              .meta-item .value { font-size: 14px; font-weight: 600; color: #1a337e; }

              .results-table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
              .results-table th { 
                background: #1a337e; 
                color: white; 
                padding: 12px 15px; 
                font-size: 11px; 
                text-transform: uppercase; 
                letter-spacing: 1px;
                text-align: left;
              }
              .results-table td { 
                padding: 12px 15px; 
                border-bottom: 1px solid #edf2f9; 
                font-size: 13px; 
                color: #2d3748;
              }
              .results-table tr:nth-child(even) { background: #fcfdfe; }

              .text-center { text-align: center; }
              .text-right { text-align: right; }
              .fw-bold { font-weight: 700; }
              .text-success { color: #2dce89; }
              .text-danger { color: #f5365c; }

              .summary-band {
                display: flex;
                justify-content: space-between;
                background: #1a337e;
                padding: 20px;
                border-radius: 12px;
                color: white;
                margin-bottom: 40px;
              }

              .summary-item { text-align: center; flex: 1; }
              .summary-item .s-label { display: block; font-size: 10px; font-weight: 700; opacity: 0.8; text-transform: uppercase; margin-bottom: 5px; }
              .summary-item .s-value { font-size: 18px; font-weight: 800; }
              .summary-item .s-value.highlight { color: #f8c12e; }

              .footer-signatures {
                display: flex;
                justify-content: space-between;
                margin-top: 60px;
                padding: 0 20px;
              }

              .sig-box { text-align: center; width: 150px; }
              .sig-line { border-top: 2px solid #333; margin-bottom: 8px; }
              .sig-box span { font-size: 12px; font-weight: 700; color: #1a337e; }

              .print-footer {
                position: absolute;
                bottom: 15mm;
                left: 15mm;
                right: 15mm;
                text-align: center;
                font-size: 10px;
                color: #999;
                border-top: 1px solid #eee;
                padding-top: 10px;
              }

              @media print {
                body { background: white; }
                .sheet { box-shadow: none; margin: 0; }
              }
            </style>
          </head>
          <body>
            ${sheetsHtml}
            <script>
              window.onload = function () {
                window.print();
                setTimeout(function(){ window.close(); }, 500);
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
    if (!selectedExamId || !classId) {
      setMessage("Please select exam and class.");
      return;
    }
    if (sectionOptions.length > 0 && sectionOptions[0].section_id && !sectionId) {
      setMessage("Please select section.");
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
      setHasHiddenMarksElectives(!!data.has_hidden_electives);
      if (!(data.students || []).length) setMessage("No students found for selected class and section.");
    } catch (e: any) {
      setMarksSubjects([]);
      setMarksStudents([]);
      setHasHiddenMarksElectives(false);
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
        if (!cell.is_absent && numericMarks !== null) {
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
        {/* Header Section */}
        <div className="d-md-flex d-block align-items-center justify-content-between mb-4">
          <div className="my-auto mb-2">
            <h3 className="page-title mb-1">Academic Performance</h3>
            <nav>
              <ol className="breadcrumb mb-0">
                <li className="breadcrumb-item"><Link to={routes.adminDashboard}>Dashboard</Link></li>
                <li className="breadcrumb-item">Academic</li>
                <li className="breadcrumb-item active" aria-current="page">Exam Results</li>
              </ol>
            </nav>
          </div>
          <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
            {!selfOnly && rows.length > 0 && (
              <>
                {selectedIds.length > 0 && (
                  <span className="badge badge-soft-info me-2 p-2 border border-info-subtle">
                    {selectedIds.length} Selected
                  </span>
                )}
                <button
                  type="button"
                  className="btn btn-soft-secondary d-flex align-items-center"
                  onClick={handlePrintAllStudents}
                  disabled={!!actionLoadingKey || detailsLoading || (selectedIds.length === 0 && rows.length > 0)}
                >
                  {actionLoadingKey === "print-all" ? (
                    <span className="spinner-border spinner-border-sm me-2"></span>
                  ) : (
                    <i className="ti ti-printer me-2"></i>
                  )}
                  {selectedIds.length > 0 ? "Print Selected" : "Print All"}
                </button>
                <button
                  type="button"
                  className="btn btn-soft-primary d-flex align-items-center"
                  onClick={handleExportAllStudentsPdf}
                  disabled={!!actionLoadingKey || detailsLoading || (selectedIds.length === 0 && rows.length > 0)}
                >
                  {actionLoadingKey === "pdf-all" ? (
                    <span className="spinner-border spinner-border-sm me-2"></span>
                  ) : (
                    <i className="ti ti-file-type-pdf me-2"></i>
                  )}
                  {selectedIds.length > 0 ? "Export Selected" : "Export All"}
                </button>
              </>
            )}
            <Link to={routes.exam} className="btn btn-primary d-flex align-items-center shadow-sm">
              <i className="ti ti-checklist me-2"></i> Back to Exams
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
            <h5 className="fw-bold mb-3">{selfOnly ? "My Examinations" : "Selection Parameters"}</h5>
            <div className="row g-3 align-items-end">
              <div className="col-md-4">
                <label className="form-label fw-semibold text-muted small text-uppercase">Examination</label>
                <select
                  className="form-select shadow-none border-light"
                  value={normalizeExamId(selectedExamId)}
                  onChange={(e) => {
                    setSelectedExamId(e.target.value);
                    if (selfOnly) loadResults(e.target.value);
                    else setMessage(null);
                  }}
                >
                  <option value="">Select Exam</option>
                  {exams.map((ex: any) => (
                    <option key={ex.id} value={ex.id}>{ex.exam_name} ({ex.exam_type})</option>
                  ))}
                </select>
              </div>
              {!selfOnly && (
                <>
                  <div className="col-md-3">
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
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  {sectionOptions.length > 0 && sectionOptions[0].section_id && (
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
                          <option key={s.section_id} value={s.section_id}>{s.section_name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="col-md-2">
                    <button
                      type="button"
                      className="btn btn-soft-primary w-100 d-flex align-items-center justify-content-center"
                      onClick={() => loadResults(normalizeExamId(selectedExamId))}
                      disabled={loading}
                    >
                      {loading ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="ti ti-search me-2"></i>}
                      View Records
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Performance Statistics (Self Only) */}
        {selfOnly && selfSummary && (
          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <div className="card border-0 shadow-sm bg-soft-primary h-100">
                <div className="card-body p-3">
                  <div className="small text-muted mb-1 text-uppercase fw-bold">Marks Obtained</div>
                  <h4 className="fw-bold mb-0 text-primary">{selfSummary.totalObtained} / {selfSummary.totalMax}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm bg-soft-info h-100">
                <div className="card-body p-3">
                  <div className="small text-muted mb-1 text-uppercase fw-bold">Percentage</div>
                  <h4 className="fw-bold mb-0 text-info">{selfSummary.percentage}%</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm bg-soft-success h-100">
                <div className="card-body p-3">
                  <div className="small text-muted mb-1 text-uppercase fw-bold">Final Grade</div>
                  <h4 className="fw-bold mb-0 text-success">{selfSummary.grade}</h4>
                </div>
              </div>
            </div>
            <div className="col-md-3">
              <div className="card border-0 shadow-sm bg-soft-secondary h-100">
                <div className="card-body p-3">
                  <div className="small text-muted mb-1 text-uppercase fw-bold">Result Status</div>
                  <span className={`badge badge-soft-${selfSummary.status === "PASS" ? "success" : "danger"} rounded-pill px-3`}>
                    {selfSummary.status}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <div className="card border-0 shadow-sm overflow-hidden">
          {!selfOnly && (
            <div className="card-header bg-white py-0 border-bottom-0">
              <ul className="nav nav-tabs nav-tabs-bottom mb-0">
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${activeTab === "results_view" ? "active" : ""} fw-bold py-3 px-4 border-0 bg-transparent`}
                    data-bs-toggle="tab"
                    data-bs-target="#results_view"
                    onClick={() => setActiveTab("results_view")}
                  >
                    <i className="ti ti-table me-1"></i> Results Catalog
                  </button>
                </li>
                {teacherOnly && (
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`nav-link ${activeTab === "marks_entry" ? "active" : ""} fw-bold py-3 px-4 border-0 bg-transparent`}
                      data-bs-toggle="tab"
                      data-bs-target="#marks_entry"
                      onClick={() => {
                        setActiveTab("marks_entry");
                        loadMarksContext();
                      }}
                    >
                      <i className="ti ti-edit me-1"></i> Marks Inward
                    </button>
                  </li>
                )}
                <li className="nav-item">
                  <button
                    type="button"
                    className={`nav-link ${activeTab === "detailed_results" ? "active" : ""} fw-bold py-3 px-4 border-0 bg-transparent`}
                    data-bs-toggle="tab"
                    data-bs-target="#detailed_results"
                    onClick={() => setActiveTab("detailed_results")}
                  >
                    <i className="ti ti-report me-1"></i> Student Analytics
                  </button>
                </li>
              </ul>
            </div>
          )}
          <div className="card-body p-0">
            <div className="tab-content">
              {/* Results View / Self View */}
              <div className="tab-pane show active" id="results_view">
                {loading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status"></div>
                    <p className="mt-2 text-muted">Retrieving examination metrics...</p>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="text-center py-5">
                    <div className="mb-3 text-muted opacity-25">
                      <i className="ti ti-notes-off fs-1"></i>
                    </div>
                    <h5 className="fw-bold">No Data Available</h5>
                    <p className="text-muted small">Perform a search to view recorded performance metrics.</p>
                  </div>
                ) : (
                  <>
                    {selfOnly && hasPendingElectives && (
                      <div className="alert alert-soft-warning border-warning d-flex align-items-center mb-4 mx-4 mt-4 shadow-sm">
                        <div className="avatar avatar-md bg-warning-transparent text-warning rounded-circle me-3 d-flex align-items-center justify-content-center">
                          <i className="ti ti-alert-triangle fs-4"></i>
                        </div>
                        <div className="flex-fill">
                          <h6 className="mb-1 text-warning fw-bold">Action Required: Subject Selection Pending</h6>
                          <p className="mb-0 small text-muted">You have one or more elective subject groups with no selection. Please finalize your subject choices in the <strong>Curriculum Mapping</strong> section to ensure all your results are correctly displayed.</p>
                        </div>
                      </div>
                    )}
                    <div className="table-responsive">
                      <table className="table table-hover table-nowrap align-middle mb-0">
                        <thead className="bg-light-50 border-bottom">
                          <tr>
                            {selfOnly ? (
                              <>
                                <th className="py-3 px-4 fw-bold text-dark border-0">Subject Name</th>
                                <th className="py-3 px-3 fw-bold text-dark border-0">Subject Code</th>
                                <th className="py-3 px-3 fw-bold text-dark border-0">Obtained / Max</th>
                                <th className="py-3 px-3 fw-bold text-dark border-0">Passing Marks</th>
                                <th className="py-3 px-4 fw-bold text-dark border-0 text-center">Status</th>
                              </>
                            ) : (
                              <>
                                <th className="py-3 px-4 border-0" style={{ width: "50px" }}>
                                  <div className="form-check m-0">
                                    <input
                                      className="form-check-input"
                                      type="checkbox"
                                      checked={rows.length > 0 && selectedIds.length === rows.length}
                                      onChange={toggleSelectAll}
                                    />
                                  </div>
                                </th>
                                <th className="py-3 px-4 fw-bold text-dark border-0">Student Name</th>
                                <th className="py-3 px-3 fw-bold text-dark border-0">Reg No.</th>
                                <th className="py-3 px-3 fw-bold text-dark border-0 text-center">Obtained / Max</th>
                                <th className="py-3 px-3 fw-bold text-dark border-0 text-center">Percentage</th>
                                <th className="py-3 px-3 fw-bold text-dark border-0 text-center">Grade</th>
                                <th className="py-3 px-4 fw-bold text-dark border-0 text-center">Outcome</th>
                              </>
                            )}
                          </tr>
                        </thead>
                        <tbody>
                          {selfOnly
                            ? rows.map((r: any, idx: number) => {
                              const isPending = !r.is_absent && (r.marks_obtained == null || r.marks_obtained === "");
                              const failed = !!r.is_absent || (!isPending && Number(r.marks_obtained ?? 0) < Number(r.passing_marks ?? 0));
                              return (
                                <tr key={`${r.subject_id}-${idx}`}>
                                  <td className="px-4 border-light fw-bold text-dark">{r.subject_name || "-"}</td>
                                  <td className="border-light text-muted small">{r.subject_code || "-"}</td>
                                  <td className="border-light fw-bold">
                                    {r.is_absent ? <span className="text-danger">ABSENT</span> : <>{r.marks_obtained ?? "-"} / {r.max_marks ?? "-"}</>}
                                  </td>
                                  <td className="border-light text-muted">{r.passing_marks ?? "-"}</td>
                                  <td className="px-4 border-light text-center">
                                    <span className={`badge badge-soft-${isPending ? "warning" : failed ? "danger" : "success"} rounded-pill px-3`}>
                                      {isPending ? "PENDING" : failed ? "FAIL" : "PASS"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                            : rows.map((r: any) => {
                              const sid = Number(r.student_id);
                              const isSelected = selectedIds.includes(sid);
                              return (
                                <tr key={r.student_id} className={isSelected ? "table-light" : ""}>
                                  <td className="px-4 border-light">
                                    <div className="form-check m-0">
                                      <input className="form-check-input" type="checkbox" checked={isSelected} onChange={() => toggleSelectStudent(sid)} />
                                    </div>
                                  </td>
                                  <td className="px-4 border-light">
                                    <Link
                                      className="fw-bold text-primary hover-underline"
                                      to={routes.studentResult}
                                      state={{ studentId: Number(r.student_id), fromExamResult: true, returnTo: returnToExamResult }}
                                    >
                                      {r.student_name || "-"}
                                    </Link>
                                  </td>
                                  <td className="px-3 border-light text-muted small">{r.admission_no || "-"}</td>
                                  <td className="border-light text-center fw-bold text-dark">
                                    {r.total_obtained ?? "0"} / {r.total_max ?? "0"}
                                  </td>
                                  <td className="border-light text-center">
                                    <span className="text-primary fw-bold">{r.percentage == null ? "-" : `${r.percentage}%`}</span>
                                  </td>
                                  <td className="border-light text-center">
                                    <span className="badge bg-dark-subtle text-dark border fw-bold">{r.grade || "-"}</span>
                                  </td>
                                  <td className="px-4 border-light text-center">
                                    <span className={`badge badge-soft-${r.result_status === "PASS" ? "success" : "danger"} rounded-pill px-3 py-1`}>
                                      <i className={`ti ti-${r.result_status === "PASS" ? "circle-check" : "circle-x"} me-1`}></i>
                                      {r.result_status || "FAIL"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Marks Entry Tab */}
              {!selfOnly && teacherOnly && (
                <div className="tab-pane fade" id="marks_entry">
                  <div className="p-4 bg-light-25 border-bottom border-light">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="small text-muted">
                        <i className="ti ti-info-circle me-1"></i>
                        Input marks based on subject max/pass thresholds. Toggle <strong>Absent</strong> status where necessary.
                      </div>
                      <button type="button" className="btn btn-primary px-4 d-flex align-items-center" onClick={saveMarks} disabled={saving}>
                        {saving ? <span className="spinner-border spinner-border-sm me-2"></span> : <i className="ti ti-device-floppy me-2"></i>}
                        Save All Marks
                      </button>
                    </div>
                    {(marksSubjects.some((s: any) => s.is_elective) || hasHiddenMarksElectives) && (
                      <div className="alert alert-soft-info border-info d-flex align-items-center mt-3 mb-0 py-2 px-3 shadow-sm" style={{ fontSize: "12px" }}>
                        <i className="ti ti-info-circle fs-5 me-2 text-info"></i>
                        <div className="text-dark">
                          <strong>Action Required:</strong> Elective subjects (like Music) are scheduled for this exam but have not been selected by students.
                          Please ensure students finalize their subject choices in <strong>Curriculum Mapping</strong> so their marks can be entered here.
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="table-responsive">
                    <table className="table table-nowrap align-middle mb-0">
                      <thead className="bg-light-50 border-bottom">
                        <tr>
                          <th className="py-3 px-4 fw-bold text-dark border-0" style={{ minWidth: 240 }}>Student Profile</th>
                          {marksSubjects.map((s: any) => (
                            <th key={s.exam_schedule_id} className="py-3 px-3 text-center border-start border-light" style={{ minWidth: 160 }}>
                              <div className="d-flex flex-column align-items-center gap-1">
                                <span className="text-dark fw-bold small text-uppercase" style={{ letterSpacing: "0.5px" }}>{s.subject_name}</span>
                                <span className={`badge rounded-pill bg-soft-${s.subject_type === "Practical" ? "info" : "secondary"} text-uppercase`} style={{ fontSize: "10px" }}>
                                  {s.subject_type || "Theory"} {s.is_elective ? "(Opt)" : ""}
                                </span>
                                <div className="text-muted" style={{ fontSize: "10px" }}>
                                  <span className="fw-semibold">Max: {s.max_marks}</span> | <span className="fw-semibold">Pass: {s.passing_marks}</span>
                                </div>
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {marksStudents.map((st: any) => (
                          <tr key={st.student_id} className="border-bottom border-light hover-bg-light-25">
                            <td className="px-4 py-3 border-0">
                              <div className="d-flex align-items-center">
                                <div className="avatar avatar-sm rounded-circle bg-soft-primary text-primary fw-bold me-3 d-flex align-items-center justify-content-center" style={{ width: "32px", height: "32px", fontSize: "12px" }}>
                                  {st.student_name ? st.student_name.split(" ").map((n: any) => n[0]).join("").slice(0, 2).toUpperCase() : "?"}
                                </div>
                                <div className="d-flex flex-column">
                                  <span className="fw-bold text-dark small">{st.student_name}</span>
                                  <span className="text-muted" style={{ fontSize: "10px" }}>Roll: {st.roll_number || "N/A"}</span>
                                </div>
                              </div>
                            </td>
                            {(st.cells || []).map((cell: any) => {
                              const val = cell.marks_obtained;
                              const isOver = val != null && Number(val) > Number(cell.max_marks);
                              const isFail = val != null && val !== "" && Number(val) < Number(cell.passing_marks);
                              const isUnavailable = cell.is_available === false;
                              const inputBorderClass = isUnavailable ? "border-light bg-light-25" : cell.is_absent ? "border-light bg-light-50" : isOver ? "border-danger" : isFail ? "border-warning" : "border-light";

                              return (
                                <td key={`${st.student_id}-${cell.exam_schedule_id}`} className={`px-3 py-3 border-start border-light text-center ${isUnavailable ? "bg-light-10" : ""}`}>
                                  {isUnavailable ? null : (
                                    <div className="d-flex flex-column align-items-center gap-2">
                                      <div className="input-group input-group-sm" style={{ width: "90px" }}>
                                        <input
                                          type="number"
                                          className={`form-control text-center shadow-none ${inputBorderClass}`}
                                          min={0}
                                          max={cell.max_marks}
                                          disabled={!!cell.is_absent}
                                          value={cell.marks_obtained ?? ""}
                                          placeholder="0"
                                          onChange={(e) => updateMarkCell(st.student_id, cell.subject_id, { marks_obtained: sanitizeMarkInput(e.target.value, cell.max_marks) })}
                                        />
                                      </div>
                                      <div className="form-check form-switch m-0">
                                        <input
                                          className="form-check-input cursor-pointer"
                                          type="checkbox"
                                          role="switch"
                                          id={`abs-${st.student_id}-${cell.exam_schedule_id}`}
                                          checked={!!cell.is_absent}
                                          onChange={(e) => updateMarkCell(st.student_id, cell.subject_id, { is_absent: e.target.checked })}
                                        />
                                        <label className="form-check-label small text-muted cursor-pointer" htmlFor={`abs-${st.student_id}-${cell.exam_schedule_id}`}>Absent</label>
                                      </div>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Detailed Analytics Tab */}
              {!selfOnly && (
                <div className="tab-pane fade" id="detailed_results">
                  <div className="p-4 bg-light-25">
                    {detailsLoading && <div className="alert alert-soft-info py-2 d-flex align-items-center mb-3"><i className="ti ti-hourglass-empty me-2"></i> Loading full student matrices...</div>}
                    {studentDetailsError && <div className="alert alert-soft-danger py-2 mb-3"><i className="ti ti-alert-circle me-2"></i> {studentDetailsError}</div>}

                    <div className="accordion accordions-items-seperate" id="student_analytics_accordion">
                      {rows.map((r: any, idx: number) => {
                        const studentId = Number(r.student_id);
                        const detail = studentDetailsById[studentId];
                        const collapseId = `exam-detail-student-${studentId || idx}`;
                        return (
                          <div className="accordion-item border-0 shadow-sm mb-3 rounded overflow-hidden" key={collapseId}>
                            <h2 className="accordion-header">
                              <button
                                className={`accordion-button ${idx === 0 ? "" : "collapsed"} py-3 px-4`}
                                type="button"
                                data-bs-toggle="collapse"
                                data-bs-target={`#${collapseId}`}
                                onClick={() => !studentDetailsById[studentId] && getStudentDetailForSelectedExam(studentId)}
                              >
                                <div className="d-flex flex-wrap align-items-center gap-3 w-100 pe-4">
                                  <span className="fw-bold text-dark me-auto">{r.student_name || "-"}</span>
                                  <span className="badge badge-soft-secondary">Obtained: {r.total_obtained ?? "0"}</span>
                                  <span className="badge badge-soft-primary">Grade: {r.grade || "-"}</span>
                                  <span className={`badge badge-soft-${r.result_status === "PASS" ? "success" : "danger"}`}>{r.result_status || "FAIL"}</span>
                                </div>
                              </button>
                            </h2>
                            <div id={collapseId} className={`accordion-collapse collapse ${idx === 0 ? "show" : ""}`} data-bs-parent="#student_analytics_accordion">
                              <div className="accordion-body p-0 border-top border-light">
                                <div className="p-3 bg-light-50 d-flex justify-content-end gap-2">
                                  <button
                                    className="btn btn-soft-secondary btn-sm d-flex align-items-center"
                                    onClick={() => handlePrintStudentResult(r)}
                                    disabled={actionLoadingKey === `print-${studentId}`}
                                  >
                                    <i className="ti ti-printer me-1"></i> Print
                                  </button>
                                  <button
                                    className="btn btn-soft-primary btn-sm d-flex align-items-center"
                                    onClick={() => handleExportStudentPdf(r)}
                                    disabled={actionLoadingKey === `pdf-${studentId}`}
                                  >
                                    <i className="ti ti-file-type-pdf me-1"></i> Export PDF
                                  </button>
                                </div>
                                {detail ? (
                                  <div className="table-responsive">
                                    <table className="table table-sm align-middle mb-0">
                                      <thead className="bg-light">
                                        <tr>
                                          <th className="ps-4">Subject</th>
                                          <th>Mode</th>
                                          <th>Max</th>
                                          <th>Pass</th>
                                          <th>Obtained</th>
                                          <th className="text-center pe-4">Status</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(detail.subjects || []).map((subject: any, sidx: number) => (
                                          <tr key={sidx}>
                                            <td className="ps-4 fw-bold text-dark">{subject.subjectName || "-"}</td>
                                            <td><span className="small text-muted">{subject.subjectMode || "-"}</span></td>
                                            <td>{subject.maxMarks ?? "-"}</td>
                                            <td>{subject.minMarks ?? "-"}</td>
                                            <td className="fw-bold text-dark">{subject.isAbsent ? <span className="text-danger">ABSENT</span> : (subject.marksObtained ?? "-")}</td>
                                            <td className="text-center pe-4">
                                              <span className={`badge badge-soft-${subject.result === "PASS" || subject.result === "Pass" ? "success" : "danger"} rounded-pill px-2`}>
                                                {subject.result || "-"}
                                              </span>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : (
                                  <div className="p-4 text-center text-muted small">
                                    <div className="spinner-border spinner-border-sm text-primary me-2"></div>
                                    Synthesizing subject matrix...
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default ExamResult;




