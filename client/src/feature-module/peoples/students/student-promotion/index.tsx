import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import { all_routes } from "../../../router/all_routes";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import CommonSelect from "../../../../core/common/commonSelect";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useAcademicYears } from "../../../../core/hooks/useAcademicYears";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { useClasses } from "../../../../core/hooks/useClasses";
import { useSections } from "../../../../core/hooks/useSections";
import { useStudents } from "../../../../core/hooks/useStudents";
import { apiService } from "../../../../core/services/apiService.js";
import { isAdministrativeRole, isHeadmasterRole } from "../../../../core/utils/roleUtils";

type AcademicYearItem = { id: number | string; year_name?: string };
type ClassItem = { id: number | string; class_name?: string };
type SectionItem = { id: number | string; section_name?: string };
type StudentItem = {
  id: number;
  class_id?: number | string | null;
  section_id?: number | string | null;
  class_name?: string | null;
  section_name?: string | null;
  admission_number?: string | null;
  roll_number?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  photo_url?: string | null;
};

const StudentPromotion = () => {
  /** Show roster + checkboxes immediately (otherwise the list block stays hidden until "Manage Promotion"). */
  const [isPromotion, setIsPromotion] = useState<boolean>(true);
  const routes = all_routes;
  const promoteModalRef = useRef<HTMLDivElement>(null);

  const fromAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const useClassesTyped = useClasses as (
    academicYearId?: number | null
  ) => { classes: ClassItem[]; loading: boolean; error: string | null };
  const useSectionsTyped = useSections as (
    classId?: number | null
  ) => { sections: SectionItem[]; loading: boolean; error: string | null };
  const useStudentsTyped = useStudents as () => {
    students: StudentItem[];
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void> | void;
  };
  const useAcademicYearsTyped = useAcademicYears as () => {
    academicYears: AcademicYearItem[];
    loading: boolean;
    error: string | null;
  };

  const {
    students,
    loading: studentsLoading,
    error: studentsError,
    refetch: refetchStudents,
  } = useStudentsTyped();
  const {
    academicYears,
    loading: academicYearsLoading,
    error: academicYearsError,
  } = useAcademicYearsTyped();

  const { classes: classesFrom, loading: classesFromLoading, error: classesFromError } =
    useClassesTyped(
      fromAcademicYearId == null || Number.isNaN(Number(fromAcademicYearId))
        ? null
        : Number(fromAcademicYearId)
    );

  const [toAcademicYearId, setToAcademicYearId] = useState<string>("");
  const [fromClassId, setFromClassId] = useState<string>("");
  const [fromSectionId, setFromSectionId] = useState<string>("");
  const [toClassId, setToClassId] = useState<string>("");
  const [toSectionId, setToSectionId] = useState<string>("");

  const toYearNum = toAcademicYearId ? parseInt(toAcademicYearId, 10) : null;
  const { classes: classesTo, loading: classesToLoading, error: classesToError } =
    useClassesTyped(toYearNum);

  const fromClassNum = fromClassId ? parseInt(fromClassId, 10) : null;
  const toClassNum = toClassId ? parseInt(toClassId, 10) : null;
  const {
    sections: fromSections,
    loading: fromSectionsLoading,
    error: fromSectionsError,
  } = useSectionsTyped(fromClassNum);
  const {
    sections: toSections,
    loading: toSectionsLoading,
    error: toSectionsError,
  } = useSectionsTyped(toClassNum);

  const [selectedRowKeys, setSelectedRowKeys] = useState<(string | number)[]>([]);
  const [promoteSubmitting, setPromoteSubmitting] = useState(false);
  const [promoteError, setPromoteError] = useState<string | null>(null);
  const [promoteSuccess, setPromoteSuccess] = useState<string | null>(null);
  const [actionMode, setActionMode] = useState<"promote" | "leave">("promote");
  const [leavingDate, setLeavingDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [leaveReason, setLeaveReason] = useState<string>("");
  const [leaveRemarks, setLeaveRemarks] = useState<string>("");
  const [promotionHistory, setPromotionHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [leavingHistory, setLeavingHistory] = useState<any[]>([]);
  const [leavingLoading, setLeavingLoading] = useState(false);
  const [leavingError, setLeavingError] = useState<string | null>(null);
  const [leavingSearchTerm, setLeavingSearchTerm] = useState<string>("");
  const [leavingYearFilter, setLeavingYearFilter] = useState<string>("all");
  const [leavingResultFilter, setLeavingResultFilter] = useState<string>("all");
  const [leavingFromDate, setLeavingFromDate] = useState<string>("");
  const [leavingToDate, setLeavingToDate] = useState<string>("");

  const user = useSelector(selectUser);
  const canPromote = Boolean(
    user && (isHeadmasterRole(user) || isAdministrativeRole(user))
  );

  useEffect(() => {
    if (!academicYears?.length) return;
    setToAcademicYearId((prev) => {
      if (prev && academicYears.some((y) => String(y.id) === prev)) return prev;
      const other = academicYears.find(
        (y) => fromAcademicYearId == null || Number(y.id) !== Number(fromAcademicYearId)
      );
      return String((other ?? academicYears[0]).id);
    });
  }, [academicYears, fromAcademicYearId]);

  useEffect(() => {
    if (!classesFrom.length) return;
    setFromClassId((prev) => {
      if (prev && classesFrom.some((c) => String(c.id) === prev)) return prev;
      return String(classesFrom[0].id);
    });
  }, [classesFrom]);

  useEffect(() => {
    if (!fromSections.length || !fromClassId) return;
    setFromSectionId((prev) => {
      if (prev && fromSections.some((sec) => String(sec.id) === prev)) return prev;
      return String(fromSections[0].id);
    });
  }, [fromSections, fromClassId]);

  useEffect(() => {
    if (!classesTo.length || !toAcademicYearId) return;
    setToClassId((prev) => {
      if (prev && classesTo.some((c) => String(c.id) === prev)) return prev;
      return String(classesTo[0].id);
    });
  }, [classesTo, toAcademicYearId]);

  useEffect(() => {
    if (!toSections.length || !toClassId) return;
    setToSectionId((prev) => {
      if (prev && toSections.some((sec) => String(sec.id) === prev)) return prev;
      return String(toSections[0].id);
    });
  }, [toSections, toClassId]);

  const currentYearLabel = useMemo(() => {
    if (fromAcademicYearId == null) return "—";
    const y = academicYears?.find((a) => Number(a.id) === Number(fromAcademicYearId));
    return y?.year_name ?? `Year #${fromAcademicYearId}`;
  }, [academicYears, fromAcademicYearId]);

  const targetYearLabel = useMemo(() => {
    if (!toAcademicYearId) return "—";
    const y = academicYears?.find((a) => String(a.id) === toAcademicYearId);
    return y?.year_name ?? `Year #${toAcademicYearId}`;
  }, [academicYears, toAcademicYearId]);

  const normLabel = (v: string | null | undefined) =>
    String(v ?? "")
      .trim()
      .toLowerCase();

  /**
   * Match by class_id/section_id first (correct when student.class_id is the same row as the dropdown).
   * Fallback: match by class_name + section_name — needed when class rows are duplicated per academic year
   * but legacy student rows still point at another year's class id while academic_year_id is correct.
   */
  const filteredStudents = useMemo(() => {
    if (!fromClassId) return students;
    const cid = parseInt(fromClassId, 10);
    if (Number.isNaN(cid)) return students;

    const fromClass = classesFrom.find((c) => String(c.id) === fromClassId);
    const fromSec = fromSections.find((sec) => String(sec.id) === fromSectionId);
    const wantClassName = normLabel(fromClass?.class_name);
    const wantSectionName = fromSectionId ? normLabel(fromSec?.section_name) : "";

    return students.filter((s: any) => {
      const sid = fromSectionId ? parseInt(fromSectionId, 10) : NaN;
      const idMatch =
        Number(s.class_id) === cid &&
        (!fromSectionId || Number.isNaN(sid) || Number(s.section_id) === sid);

      const nameMatch =
        !!wantClassName &&
        normLabel(s.class_name) === wantClassName &&
        (!fromSectionId ||
          !wantSectionName ||
          normLabel(s.section_name) === wantSectionName);

      return idMatch || nameMatch;
    });
  }, [students, fromClassId, fromSectionId, classesFrom, fromSections]);

  const data = useMemo(
    () =>
      filteredStudents.map((student: any) => ({
        key: String(student.id),
        studentId: student.id,
        student,
        AdmissionNo: student.admission_number ?? "",
        RollNo: student.roll_number ?? "",
        name:
          [student.first_name, student.last_name].filter(Boolean).join(" ") || "N/A",
        class: student.class_name ?? "N/A",
        section: student.section_name ?? "N/A",
        result: "N/A",
        imgSrc: student.photo_url || "assets/img/students/student-01.jpg",
      })),
    [filteredStudents]
  );

  const fromClassName =
    classesFrom.find((c) => String(c.id) === fromClassId)?.class_name ?? "—";
  const fromSectionName =
    fromSections.find((s) => String(s.id) === fromSectionId)?.section_name ?? "—";
  const toClassName = classesTo.find((c) => String(c.id) === toClassId)?.class_name ?? "—";
  const toSectionName =
    toSections.find((s) => String(s.id) === toSectionId)?.section_name ?? "—";

  const classOptionsFrom = useMemo(
    () =>
      classesFrom.map((cls) => ({
        value: cls.id.toString(),
        label: cls.class_name ?? "Unnamed Class",
      })),
    [classesFrom]
  );
  const classOptionsTo = useMemo(
    () =>
      classesTo.map((cls) => ({
        value: cls.id.toString(),
        label: cls.class_name ?? "Unnamed Class",
      })),
    [classesTo]
  );
  const sectionOptionsFrom = useMemo(
    () =>
      fromSections.map((section) => ({
        value: section.id.toString(),
        label: section.section_name ?? "Unnamed Section",
      })),
    [fromSections]
  );
  const sectionOptionsTo = useMemo(
    () =>
      toSections.map((section) => ({
        value: section.id.toString(),
        label: section.section_name ?? "Unnamed Section",
      })),
    [toSections]
  );
  const yearOptions = useMemo(
    () =>
      (academicYears ?? []).map((year) => ({
        value: year.id.toString(),
        label: year.year_name ?? `Year #${year.id}`,
      })),
    [academicYears]
  );

  const onTableSelectionChange = useCallback((keys: (string | number)[]) => {
    setSelectedRowKeys(keys);
  }, []);

  const fetchPromotionHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const res = await apiService.getStudentPromotions(500);
      if (res?.status !== "SUCCESS") {
        throw new Error(res?.message || "Failed to load promotion history");
      }
      setPromotionHistory(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load promotion history";
      setHistoryError(msg);
      setPromotionHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadLeavingHistory = useCallback(async () => {
    try {
      setLeavingLoading(true);
      setLeavingError(null);
      const res = await apiService.getLeavingStudents(500);
      if (res?.status !== "SUCCESS") {
        throw new Error(res?.message || "Failed to load leaving students");
      }
      setLeavingHistory(Array.isArray(res?.data) ? res.data : []);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to load leaving students";
      setLeavingError(msg);
      setLeavingHistory([]);
    } finally {
      setLeavingLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelectedRowKeys((prev) => prev.filter((k) => data.some((row) => row.key === k)));
  }, [data]);

  useEffect(() => {
    void fetchPromotionHistory();
  }, [fetchPromotionHistory]);

  useEffect(() => {
    void loadLeavingHistory();
  }, [loadLeavingHistory]);

  const columns = useMemo(
    () => [
      {
        title: "Admission No",
        dataIndex: "AdmissionNo",
        render: (text: string, record: any) => (
          <Link
            to={routes.studentDetail}
            state={{ studentId: record.studentId, student: record.student }}
            className="link-primary"
          >
            {text}
          </Link>
        ),
        sorter: (a: TableData, b: TableData) =>
          String(a.AdmissionNo).length - String(b.AdmissionNo).length,
      },
      {
        title: "Roll No",
        dataIndex: "RollNo",
        sorter: (a: TableData, b: TableData) =>
          String(a.RollNo).length - String(b.RollNo).length,
      },
      {
        title: "Name",
        dataIndex: "name",
        render: (text: string, record: any) => (
          <div className="d-flex align-items-center">
            <Link
              to={routes.studentDetail}
              state={{ studentId: record.studentId, student: record.student }}
              className="avatar avatar-md"
            >
              <ImageWithBasePath
                src={record.imgSrc}
                className="img-fluid rounded-circle"
                alt="img"
              />
            </Link>
            <div className="ms-2">
              <p className="text-dark mb-0">
                <Link
                  to={routes.studentDetail}
                  state={{ studentId: record.studentId, student: record.student }}
                >
                  {text}
                </Link>
              </p>
            </div>
          </div>
        ),
        sorter: (a: TableData, b: TableData) => String(a.name).length - String(b.name).length,
      },
      {
        title: "Class",
        dataIndex: "class",
        sorter: (a: TableData, b: TableData) =>
          String(a.class).length - String(b.class).length,
      },
      {
        title: "Section",
        dataIndex: "section",
        sorter: (a: TableData, b: TableData) =>
          String(a.section).length - String(b.section).length,
      },
      {
        title: "Exam Result",
        dataIndex: "result",
        render: (text: string) => (
          <>
            {text === "Pass" ? (
              <span className="badge badge-soft-success d-inline-flex align-items-center">
                <i className="ti ti-circle-filled fs-5 me-1"></i>
                {text}
              </span>
            ) : (
              <span className="badge badge-soft-danger d-inline-flex align-items-center">
                <i className="ti ti-circle-filled fs-5 me-1"></i>
                {text}
              </span>
            )}
          </>
        ),
        sorter: (a: TableData, b: TableData) =>
          String(a.result).length - String(b.result).length,
      },
    ],
    [routes.studentDetail]
  );

  /** Same pattern as profile password modal — use getOrCreateInstance; ref alone can miss the node timing. */
  const hidePromoteModal = () => {
    const el =
      (document.getElementById("student_promote") as HTMLElement | null) ??
      promoteModalRef.current;
    if (!el) return;
    try {
      const Modal = (window as unknown as { bootstrap?: { Modal: any } }).bootstrap?.Modal;
      if (Modal?.getOrCreateInstance) {
        Modal.getOrCreateInstance(el).hide();
      }
    } catch {
      // fall through to DOM cleanup
    }
    // If Bootstrap API did not run or hide() no-opped, remove overlay (fixes stuck modal after success).
    window.setTimeout(() => {
      if (!el.classList.contains("show")) return;
      el.classList.remove("show");
      el.style.display = "none";
      el.setAttribute("aria-hidden", "true");
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("overflow");
      document.body.style.removeProperty("padding-right");
      document.querySelectorAll(".modal-backdrop").forEach((node) => {
        node.parentElement?.removeChild(node);
      });
    }, 400);
  };

  const handleConfirmAction = async () => {
    setPromoteError(null);
    setPromoteSuccess(null);
    if (!canPromote) {
      setPromoteError("You do not have permission to promote students.");
      return;
    }
    if (selectedRowKeys.length === 0) {
      setPromoteError("Select at least one student.");
      return;
    }
    const ids = selectedRowKeys
      .map((key) => data.find((row) => row.key === key)?.studentId)
      .filter((id): id is number => typeof id === "number" && !Number.isNaN(id));
    if (ids.length === 0) {
      setPromoteError("Could not resolve selected students.");
      return;
    }
    const isPromote = actionMode === "promote";
    const tc = parseInt(toClassId, 10);
    const ts = parseInt(toSectionId, 10);
    const ty = parseInt(toAcademicYearId, 10);
    if (isPromote && (Number.isNaN(tc) || Number.isNaN(ts) || Number.isNaN(ty))) {
      setPromoteError("Choose a valid target class, section, and academic year.");
      return;
    }

    setPromoteSubmitting(true);
    try {
      const body: Record<string, unknown> = { student_ids: ids };
      if (fromAcademicYearId != null && !Number.isNaN(Number(fromAcademicYearId))) {
        body.from_academic_year_id = Number(fromAcademicYearId);
      }
      let res: any;
      if (isPromote) {
        body.to_class_id = tc;
        body.to_section_id = ts;
        body.to_academic_year_id = ty;
        res = await apiService.promoteStudents(body);
      } else {
        body.leaving_date = leavingDate || undefined;
        body.reason = leaveReason || undefined;
        body.remarks = leaveRemarks || undefined;
        res = await apiService.leaveStudents(body);
      }
      if (res?.status !== "SUCCESS") {
        throw new Error(res?.message || (isPromote ? "Promotion failed" : "Leaving failed"));
      }
      hidePromoteModal();
      const affected = isPromote ? (res?.data?.promoted ?? ids.length) : (res?.data?.left ?? ids.length);
      setPromoteSuccess(
        `${affected} student(s) ${isPromote ? "promoted" : "marked as leaving"} successfully.`
      );
      setSelectedRowKeys([]);
      await refetchStudents();
      await fetchPromotionHistory();
      await loadLeavingHistory();
      if (!isPromote) {
        setLeaveReason("");
        setLeaveRemarks("");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : (isPromote ? "Promotion failed" : "Leaving failed");
      setPromoteError(msg);
    } finally {
      setPromoteSubmitting(false);
    }
  };

  const historyRows = useMemo(
    () =>
      promotionHistory.map((row: any) => ({
        key: String(row.id),
        promotionDate: row.promotion_date || "N/A",
        admissionNumber: row.admission_number || "N/A",
        rollNumber: row.roll_number || "N/A",
        studentName:
          [row.first_name, row.last_name].filter(Boolean).join(" ") || `Student #${row.student_id}`,
        fromAcademicYear:
          row.from_academic_year_name ||
          (row.from_academic_year_id != null ? `Year #${row.from_academic_year_id}` : "N/A"),
        toAcademicYear:
          row.to_academic_year_name ||
          (row.to_academic_year_id != null ? `Year #${row.to_academic_year_id}` : "N/A"),
        fromClass:
          row.from_class_name || (row.from_class_id != null ? `Class #${row.from_class_id}` : "N/A"),
        toClass: row.to_class_name || (row.to_class_id != null ? `Class #${row.to_class_id}` : "N/A"),
        fromSection:
          row.from_section_name ||
          (row.from_section_id != null ? `Section #${row.from_section_id}` : "N/A"),
        toSection:
          row.to_section_name || (row.to_section_id != null ? `Section #${row.to_section_id}` : "N/A"),
        status: row.status || "N/A",
        promotedBy:
          [row.promoted_by_first_name, row.promoted_by_last_name].filter(Boolean).join(" ") ||
          (row.promoted_by != null ? `Staff #${row.promoted_by}` : "System"),
      })),
    [promotionHistory]
  );

  const historyColumns = useMemo(
    () => [
      { title: "Date", dataIndex: "promotionDate" },
      { title: "Admission No", dataIndex: "admissionNumber" },
      { title: "Roll No", dataIndex: "rollNumber" },
      { title: "Student", dataIndex: "studentName" },
      { title: "From Session", dataIndex: "fromAcademicYear" },
      { title: "To Session", dataIndex: "toAcademicYear" },
      { title: "From Class", dataIndex: "fromClass" },
      { title: "To Class", dataIndex: "toClass" },
      { title: "From Section", dataIndex: "fromSection" },
      { title: "To Section", dataIndex: "toSection" },
      { title: "Status", dataIndex: "status" },
      { title: "Promoted By", dataIndex: "promotedBy" },
    ],
    []
  );

  const formatDate = (v: string | null | undefined) => {
    if (!v) return "—";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  };

  const leavingData = useMemo(
    () =>
      leavingHistory.map((row: any, idx: number) => ({
        key: String(row.id ?? idx),
        admissionNo: row.admission_number ?? "—",
        studentName:
          [row.student_first_name, row.student_last_name].filter(Boolean).join(" ") || "N/A",
        joining:
          `${row.joining_class_name ?? "—"} / ${row.joining_section_name ?? "—"} / ${row.joining_academic_year_name ?? "—"}`,
        joiningDate: formatDate(row.joining_date),
        last:
          `${row.last_class_name ?? "—"} / ${row.last_section_name ?? "—"} / ${row.last_academic_year_name ?? "—"}`,
        leavingDate: formatDate(row.leaving_date),
        leavingDateRaw: row.leaving_date ?? null,
        lastAcademicYearName: row.last_academic_year_name ?? "—",
        lastResult: row.last_class_result ?? "Not Available",
        reason: row.reason ?? "—",
        remarks: row.remarks ?? "—",
      })),
    [leavingHistory]
  );

  const leavingYearOptions = useMemo(() => {
    const seen = new Set<string>();
    const items: string[] = [];
    leavingData.forEach((row: any) => {
      const y = String(row.lastAcademicYearName || "").trim();
      if (!y || y === "—" || seen.has(y)) return;
      seen.add(y);
      items.push(y);
    });
    return items.sort((a, b) => a.localeCompare(b));
  }, [leavingData]);

  const filteredLeavingData = useMemo(() => {
    const q = leavingSearchTerm.trim().toLowerCase();
    return leavingData.filter((row: any) => {
      const matchesSearch =
        !q ||
        [
          row.admissionNo,
          row.studentName,
          row.joining,
          row.last,
          row.reason,
          row.remarks,
          row.lastResult,
        ]
          .map((v) => String(v || "").toLowerCase())
          .some((v) => v.includes(q));

      const matchesYear =
        leavingYearFilter === "all" || String(row.lastAcademicYearName || "") === leavingYearFilter;
      const matchesResult =
        leavingResultFilter === "all" || String(row.lastResult || "") === leavingResultFilter;
      const raw = row.leavingDateRaw ? String(row.leavingDateRaw).slice(0, 10) : "";
      const matchesFrom = !leavingFromDate || (raw && raw >= leavingFromDate);
      const matchesTo = !leavingToDate || (raw && raw <= leavingToDate);

      return matchesSearch && matchesYear && matchesResult && matchesFrom && matchesTo;
    });
  }, [leavingData, leavingSearchTerm, leavingYearFilter, leavingResultFilter, leavingFromDate, leavingToDate]);

  const leavingColumns = useMemo(
    () => [
      { title: "Admission No", dataIndex: "admissionNo" },
      { title: "Student", dataIndex: "studentName" },
      { title: "Joining Details", dataIndex: "joining" },
      { title: "Joining Date", dataIndex: "joiningDate" },
      { title: "Last Class/Section/Year", dataIndex: "last" },
      { title: "Leaving Date", dataIndex: "leavingDate" },
      {
        title: "Last Class Result",
        dataIndex: "lastResult",
        render: (text: string) =>
          text === "Pass" ? (
            <span className="badge badge-soft-success d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ) : text === "Fail" ? (
            <span className="badge badge-soft-danger d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ) : (
            <span className="badge badge-soft-secondary d-inline-flex align-items-center">
              <i className="ti ti-circle-filled fs-5 me-1"></i>
              {text}
            </span>
          ),
      },
      { title: "Reason", dataIndex: "reason" },
      { title: "Remarks", dataIndex: "remarks" },
    ],
    []
  );

  const exportHeaders = [
    "Admission No",
    "Student Name",
    "Joining Details",
    "Joining Date",
    "Last Class/Section/Year",
    "Leaving Date",
    "Last Class Result",
    "Reason",
    "Remarks",
  ];
  const exportRows = filteredLeavingData.map((row: any) => [
    row.admissionNo ?? "",
    row.studentName ?? "",
    row.joining ?? "",
    row.joiningDate ?? "",
    row.last ?? "",
    row.leavingDate ?? "",
    row.lastResult ?? "",
    row.reason ?? "",
    row.remarks ?? "",
  ]);
  const sanitizeCell = (value: unknown) => String(value ?? "").replace(/"/g, '""');
  const downloadTextFile = (content: string, fileName: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  const handleExportLeavingCsv = () => {
    const lines = [
      exportHeaders.map((h) => `"${sanitizeCell(h)}"`).join(","),
      ...exportRows.map((cells) => cells.map((c) => `"${sanitizeCell(c)}"`).join(",")),
    ];
    const csv = `\uFEFF${lines.join("\n")}`;
    const today = new Date().toISOString().slice(0, 10);
    downloadTextFile(csv, `leaving-students-${today}.csv`, "text/csv;charset=utf-8;");
  };
  const htmlEscape = (value: unknown) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const handleExportLeavingExcel = () => {
    const headerRow = exportHeaders.map((h) => `<th>${htmlEscape(h)}</th>`).join("");
    const bodyRows = exportRows
      .map((cells) => `<tr>${cells.map((c) => `<td>${htmlEscape(c)}</td>`).join("")}</tr>`)
      .join("");
    const tableHtml = `
      <html>
      <head><meta charset="utf-8" /></head>
      <body>
        <table border="1">
          <thead><tr>${headerRow}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </body>
      </html>`;
    const today = new Date().toISOString().slice(0, 10);
    downloadTextFile(tableHtml, `leaving-students-${today}.xls`, "application/vnd.ms-excel;charset=utf-8;");
  };

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <div className="col-md-12">
              <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
                <div className="my-auto mb-2">
                  <h3 className="page-title mb-1">Student Promotion</h3>
                  <nav>
                    <ol className="breadcrumb mb-0">
                      <li className="breadcrumb-item">
                        <Link to={routes.adminDashboard}>Dashboard</Link>
                      </li>
                      <li className="breadcrumb-item">
                        <Link to="#">Students</Link>
                      </li>
                      <li className="breadcrumb-item active" aria-current="page">
                        Student Promotion
                      </li>
                    </ol>
                  </nav>
                </div>
                <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
                  <TooltipOption />
                </div>
              </div>
              <div className="alert alert-outline-primary bg-primary-transparent p-2 d-flex align-items-center flex-wrap row-gap-2 mb-4">
                <i className="ti ti-info-circle me-1" />
                <strong>Note :</strong> Promoting students updates their class, section, and
                academic year for the target session. An audit row is stored in promotion
                history. The student list always follows the{" "}
                <strong>Academic Year chosen in the top header</strong> — it is not filtered by
                calendar dates.
              </div>
              <div className="card mb-4">
                <div className="card-body py-2">
                  <div className="d-flex align-items-center gap-3 flex-wrap">
                    <span className="fw-semibold">Action Mode:</span>
                    <label className="d-flex align-items-center mb-0">
                      <input
                        type="radio"
                        className="form-check-input me-2"
                        checked={actionMode === "promote"}
                        onChange={() => setActionMode("promote")}
                      />
                      Promote
                    </label>
                    <label className="d-flex align-items-center mb-0">
                      <input
                        type="radio"
                        className="form-check-input me-2"
                        checked={actionMode === "leave"}
                        onChange={() => setActionMode("leave")}
                      />
                      Leaving
                    </label>
                  </div>
                </div>
              </div>
              {fromAcademicYearId == null && (
                <div className="alert alert-warning mb-4" role="alert">
                  Select an <strong>Academic Year</strong> in the header dropdown so the correct
                  students load for promotion.
                </div>
              )}
              <div className="card">
                <div className="card-header border-0 pb-0">
                  <div className="bg-light-gray p-3 rounded">
                    <h4>{actionMode === "promote" ? "Promotion" : "Leaving"}</h4>
                    <p>
                      {actionMode === "promote"
                        ? "Select current class/section (to filter the list) and target session"
                        : "Select current class/section to choose students who are leaving school"}
                    </p>
                  </div>
                </div>
                <div className="card-body">
                  <form>
                    <div className="d-md-flex align-items-center justify-content-between">
                      <div className="card flex-fill w-100">
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">
                              Current Session <span className="text-danger">*</span>
                            </label>
                            <div className="form-control-plaintext p-0">{currentYearLabel}</div>
                          </div>
                          <div>
                            <label className="form-label mb-2">
                              {actionMode === "promote" ? "Promotion from Class" : "Leaving from Class"}
                              <span className="text-danger"> *</span>
                            </label>
                            <div className="d-block d-md-flex">
                              <div className=" flex-fill me-md-3 me-0 mb-0">
                                <label className="form-label">Class</label>
                                {classesFromLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2"></i>
                                    Loading classes...
                                  </div>
                                ) : classesFromError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2"></i>
                                    Error: {classesFromError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={classOptionsFrom}
                                    value={fromClassId || undefined}
                                    onChange={(v) => {
                                      setFromClassId(v || "");
                                      setFromSectionId("");
                                    }}
                                  />
                                )}
                              </div>
                              <div className=" flex-fill mb-0">
                                <label className="form-label">Section</label>
                                {fromSectionsLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2"></i>
                                    Loading sections...
                                  </div>
                                ) : fromSectionsError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2"></i>
                                    Error: {fromSectionsError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={sectionOptionsFrom}
                                    value={fromSectionId || undefined}
                                    onChange={(v) => setFromSectionId(v || "")}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      {actionMode === "promote" ? (
                      <>
                      <Link
                        to="#"
                        className="badge bg-primary badge-xl exchange-link text-white d-flex align-items-center justify-content-center mx-md-4 mx-auto my-md-0 my-4 flex-shrink-0"
                      >
                        <span>
                          <i className="ti ti-arrows-exchange fs-16" />
                        </span>
                      </Link>
                      <div className="card flex-fill w-100">
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">
                              Promote to Session <span className="text-danger"> *</span>
                            </label>
                            {academicYearsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2"></i>
                                Loading academic years...
                              </div>
                            ) : academicYearsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2"></i>
                                Error: {academicYearsError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={yearOptions}
                                value={toAcademicYearId || undefined}
                                onChange={(v) => {
                                  setToAcademicYearId(v || "");
                                  setToClassId("");
                                  setToSectionId("");
                                }}
                              />
                            )}
                          </div>
                          <div>
                            <label className="form-label mb-2">
                              Target class
                              <span className="text-danger"> *</span>
                            </label>
                            <div className="d-block d-md-flex">
                              <div className="flex-fill me-md-3 me-0 mb-0">
                                <label className="form-label">Class</label>
                                {classesToLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2"></i>
                                    Loading classes...
                                  </div>
                                ) : classesToError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2"></i>
                                    Error: {classesToError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={classOptionsTo}
                                    value={toClassId || undefined}
                                    onChange={(v) => {
                                      setToClassId(v || "");
                                      setToSectionId("");
                                    }}
                                  />
                                )}
                              </div>
                              <div className=" flex-fill ">
                                <label className="form-label">Section</label>
                                {toSectionsLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2"></i>
                                    Loading sections...
                                  </div>
                                ) : toSectionsError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2"></i>
                                    Error: {toSectionsError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={sectionOptionsTo}
                                    value={toSectionId || undefined}
                                    onChange={(v) => setToSectionId(v || "")}
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      </>
                      ) : (
                        <div className="card flex-fill w-100 ms-md-4">
                          <div className="card-body">
                            <div className="mb-2">
                              <label className="form-label">Leaving Action</label>
                              <div className="form-control-plaintext p-0 text-danger fw-semibold">
                                Selected students will be marked as school leaving.
                              </div>
                            </div>
                            <div className="mb-0">
                              <label className="form-label">Leaving Date</label>
                              <input
                                type="date"
                                className="form-control"
                                value={leavingDate}
                                onChange={(e) => setLeavingDate(e.target.value)}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="col-md-12">
                      <div className="manage-promote-btn d-flex justify-content-center flex-wrap row-gap-2">
                        <button
                          type="reset"
                          className="btn btn-light reset-promote me-3"
                          onClick={() => {
                            setIsPromotion(false);
                            setSelectedRowKeys([]);
                            setPromoteError(null);
                            setPromoteSuccess(null);
                          }}
                        >
                          Reset Promotion
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary promote-students-btn"
                          onClick={() => setIsPromotion(true)}
                        >
                          Manage Promotion
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              </div>
              <div
                className={`promote-card-main ${isPromotion && "promote-card-main-show"}`}
              >
                <div className="card">
                  <div className="card-header border-0 pb-0">
                    <div className="bg-light-gray p-3 rounded">
                      <h4>{actionMode === "promote" ? "Map Class Sections" : "Leaving Summary"}</h4>
                      <p>
                        {actionMode === "promote"
                          ? "Summary of source and target (adjust selections above if needed)"
                          : "Summary of selected source class/section for school leaving"}
                      </p>
                    </div>
                  </div>
                  <div className="card-body pb-2">
                    <div className="d-flex align-items-center justify-content-between">
                      <div className="card w-100">
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">
                              From Class<span className="text-danger">*</span>
                            </label>
                            <div className="form-control-plaintext p-0">{fromClassName}</div>
                          </div>
                          <div className="mb-0">
                            <label className="form-label d-block mb-2">
                              From Section
                              <span className="text-danger"> *</span>
                            </label>
                            <div className="form-control-plaintext p-0">{fromSectionName}</div>
                          </div>
                        </div>
                      </div>
                      {actionMode === "promote" ? (
                        <>
                      <Link
                        to="#"
                        className="badge bg-primary badge-xl exchange-link text-white d-flex align-items-center justify-content-center mx-md-4 mx-auto my-md-0 my-4 flex-shrink-0"
                      >
                        <span>
                          <i className="ti ti-arrows-exchange fs-16" />
                        </span>
                      </Link>
                      <div className="card w-100">
                        <div className="card-body">
                          <div className="mb-3">
                            <label className="form-label">
                              Promote to Session <span className="text-danger"> *</span>
                            </label>
                            <div className="form-control-plaintext p-0">{targetYearLabel}</div>
                          </div>
                          <div>
                            <label className="form-label mb-2">
                              Target class & section
                              <span className="text-danger"> *</span>
                            </label>
                            <div className="form-control-plaintext p-0">
                              {toClassName} — {toSectionName}
                            </div>
                          </div>
                        </div>
                      </div>
                        </>
                      ) : (
                        <div className="card w-100 ms-md-4">
                          <div className="card-body">
                            <div className="mb-3">
                              <label className="form-label">Action</label>
                              <div className="form-control-plaintext p-0 text-danger fw-semibold">
                                School Leaving
                              </div>
                            </div>
                            <div>
                              <label className="form-label mb-2">Leaving Date</label>
                              <div className="form-control-plaintext p-0">
                                {formatDate(leavingDate)}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                    <h4 className="mb-3">Students List</h4>
                    <div className="d-flex align-items-center flex-wrap">
                      <div className="mb-3 me-3 small text-muted">
                        <span className="d-block fw-semibold text-dark">Roster academic year</span>
                        <span>
                          {currentYearLabel}
                          {fromAcademicYearId != null ? (
                            <span className="text-muted"> (same as header dropdown)</span>
                          ) : (
                            <span className="text-warning"> — select a year in the header</span>
                          )}
                        </span>
                      </div>
                      <div className="dropdown mb-3">
                        <Link
                          to="#"
                          className="btn btn-outline-light bg-white dropdown-toggle"
                          data-bs-toggle="dropdown"
                        >
                          <i className="ti ti-sort-ascending-2 me-2" />
                          Sort by A-Z{" "}
                        </Link>
                        <ul className="dropdown-menu p-3">
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Ascending
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Descending
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Recently Viewed
                            </Link>
                          </li>
                          <li>
                            <Link to="#" className="dropdown-item rounded-1">
                              Recently Added
                            </Link>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                  <div className="card-body p-0 py-3">
                    {promoteSuccess && (
                      <div className="alert alert-success mx-3" role="alert">
                        {promoteSuccess}
                      </div>
                    )}
                    {studentsLoading && (
                      <div className="text-center p-4">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-2">Loading students...</p>
                      </div>
                    )}
                    {studentsError && (
                      <div className="text-center p-4">
                        <div className="alert alert-danger mb-0">{studentsError}</div>
                      </div>
                    )}
                    {!studentsLoading && !studentsError && students.length === 0 && (
                      <div className="alert alert-warning mx-3" role="alert">
                        <strong>No students loaded</strong> for the academic year selected in the header (
                        {currentYearLabel}). Add students for this session or switch the dashboard academic year.
                        Also ensure each student has <strong>Academic year</strong> set on their record.
                      </div>
                    )}
                    {!studentsLoading &&
                      !studentsError &&
                      students.length > 0 &&
                      data.length === 0 &&
                      (fromClassId || fromSectionId) && (
                        <div className="alert alert-info mx-3" role="alert">
                          <strong>No students in this class/section.</strong> Use{" "}
                          <strong>Promotion from Class</strong> and <strong>Section</strong> (left column above) to
                          match where students are enrolled for {currentYearLabel}. Names are matched as well as
                          IDs, so the list should still show if class/section labels match. The table checkboxes
                          appear on each row once students show here.
                        </div>
                      )}
                    {!studentsLoading && !studentsError && (
                      <Table
                        dataSource={data}
                        columns={columns}
                        Selection={true}
                        selectedRowKeys={selectedRowKeys}
                        onSelectionChange={(keys) => {
                          onTableSelectionChange(keys);
                        }}
                      />
                    )}
                    {!canPromote && (
                      <p className="text-muted small px-3 mb-0">
                        Only administrators can save promotions. Teachers can review this list
                        but cannot submit.
                      </p>
                    )}
                  </div>
                </div>
                <div className="promoted-year text-center">
                  <p>
                    {selectedRowKeys.length} student(s) selected — target:{" "}
                    <strong>{actionMode === "promote" ? targetYearLabel : "School Leaving"}</strong>
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    data-bs-toggle="modal"
                    data-bs-target="#student_promote"
                    disabled={selectedRowKeys.length === 0 || !canPromote}
                    onClick={() => setPromoteError(null)}
                  >
                    {actionMode === "promote" ? "Promote Students" : "Mark as Leaving"}
                  </button>
                </div>
                {actionMode === "promote" && (
                <div className="card mt-4">
                  <div className="card-header border-0 pb-0">
                    <div className="bg-light-gray p-3 rounded">
                      <h4>Promotion History</h4>
                      <p>
                        Shows already promoted students with from/to session, class, section, date,
                        and promoter details.
                      </p>
                    </div>
                  </div>
                  <div className="card-body p-0 py-3">
                    {historyLoading && (
                      <div className="text-center p-4">
                        <div className="spinner-border text-primary" role="status">
                          <span className="visually-hidden">Loading...</span>
                        </div>
                        <p className="mt-2">Loading promotion history...</p>
                      </div>
                    )}
                    {historyError && (
                      <div className="text-center p-4">
                        <div className="alert alert-danger mb-0">{historyError}</div>
                      </div>
                    )}
                    {!historyLoading && !historyError && historyRows.length === 0 && (
                      <div className="alert alert-info mx-3 mb-0" role="alert">
                        No promotion history records found yet.
                      </div>
                    )}
                    {!historyLoading && !historyError && historyRows.length > 0 && (
                      <Table dataSource={historyRows} columns={historyColumns} Selection={false} />
                    )}
                  </div>
                </div>
                )}
                {actionMode === "leave" && (
                <div className="card mt-3">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                    <h4 className="mb-3">Leaving Students</h4>
                    <div className="d-flex align-items-center gap-2 mb-3">
                      <button
                        type="button"
                        className="btn btn-outline-success btn-sm"
                        onClick={handleExportLeavingCsv}
                        disabled={filteredLeavingData.length === 0}
                      >
                        Export CSV
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-secondary btn-sm"
                        onClick={handleExportLeavingExcel}
                        disabled={filteredLeavingData.length === 0}
                      >
                        Export Excel
                      </button>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => void loadLeavingHistory()}
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                  <div className="card-body p-0 py-3">
                    <div className="px-3 pb-2">
                      <div className="row g-2">
                        <div className="col-md-4">
                          <label className="form-label mb-1">Search</label>
                          <input
                            type="text"
                            className="form-control"
                            placeholder="Search name, admission no, class, reason..."
                            value={leavingSearchTerm}
                            onChange={(e) => setLeavingSearchTerm(e.target.value)}
                          />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label mb-1">Academic Year</label>
                          <select
                            className="form-select"
                            value={leavingYearFilter}
                            onChange={(e) => setLeavingYearFilter(e.target.value)}
                          >
                            <option value="all">All</option>
                            {leavingYearOptions.map((y) => (
                              <option key={y} value={y}>
                                {y}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="col-md-2">
                          <label className="form-label mb-1">Result</label>
                          <select
                            className="form-select"
                            value={leavingResultFilter}
                            onChange={(e) => setLeavingResultFilter(e.target.value)}
                          >
                            <option value="all">All</option>
                            <option value="Pass">Pass</option>
                            <option value="Fail">Fail</option>
                            <option value="Not Available">Not Available</option>
                          </select>
                        </div>
                        <div className="col-md-2">
                          <label className="form-label mb-1">Leaving From</label>
                          <input
                            type="date"
                            className="form-control"
                            value={leavingFromDate}
                            onChange={(e) => setLeavingFromDate(e.target.value)}
                          />
                        </div>
                        <div className="col-md-2">
                          <label className="form-label mb-1">Leaving To</label>
                          <input
                            type="date"
                            className="form-control"
                            value={leavingToDate}
                            onChange={(e) => setLeavingToDate(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    {leavingLoading && (
                      <div className="text-center p-4 text-muted">Loading leaving students...</div>
                    )}
                    {leavingError && (
                      <div className="alert alert-danger mx-3" role="alert">
                        {leavingError}
                      </div>
                    )}
                    {!leavingLoading && !leavingError && filteredLeavingData.length === 0 && (
                      <div className="alert alert-info mx-3" role="alert">
                        No leaving students found for selected filters.
                      </div>
                    )}
                    {!leavingLoading && !leavingError && filteredLeavingData.length > 0 && (
                      <Table dataSource={filteredLeavingData} columns={leavingColumns} Selection={false} />
                    )}
                  </div>
                </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="modal fade"
        id="student_promote"
        ref={promoteModalRef}
        tabIndex={-1}
        aria-hidden="true"
      >
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-body text-center">
              <h4>{actionMode === "promote" ? "Confirm Promotion" : "Confirm Leaving"}</h4>
              <p>
                {actionMode === "promote" ? (
                  <>
                    Promote <strong>{selectedRowKeys.length}</strong> selected student(s) to{" "}
                    <strong>{toClassName}</strong> section <strong>{toSectionName}</strong> in{" "}
                    <strong>{targetYearLabel}</strong>?
                  </>
                ) : (
                  <>
                    Mark <strong>{selectedRowKeys.length}</strong> selected student(s) as leaving?
                  </>
                )}
              </p>
              {actionMode === "leave" && (
                <div className="text-start mb-3">
                  <div className="mb-2">
                    <label className="form-label">Leaving Date</label>
                    <input
                      type="date"
                      className="form-control"
                      value={leavingDate}
                      onChange={(e) => setLeavingDate(e.target.value)}
                    />
                  </div>
                  <div className="mb-2">
                    <label className="form-label">Reason</label>
                    <input
                      type="text"
                      className="form-control"
                      value={leaveReason}
                      onChange={(e) => setLeaveReason(e.target.value)}
                      placeholder="Optional reason"
                    />
                  </div>
                  <div>
                    <label className="form-label">Remarks</label>
                    <textarea
                      className="form-control"
                      rows={2}
                      value={leaveRemarks}
                      onChange={(e) => setLeaveRemarks(e.target.value)}
                      placeholder="Optional remarks"
                    />
                  </div>
                </div>
              )}
              {promoteError && (
                <div className="alert alert-danger text-start small" role="alert">
                  {promoteError}
                </div>
              )}
              <div className="d-flex justify-content-center">
                <button
                  type="button"
                  className="btn btn-light me-3"
                  data-bs-dismiss="modal"
                  disabled={promoteSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={promoteSubmitting}
                  onClick={() => void handleConfirmAction()}
                >
                  {promoteSubmitting ? (
                    <>
                      <span
                        className="spinner-border spinner-border-sm me-2"
                        role="status"
                        aria-hidden="true"
                      />
                      {actionMode === "promote" ? "Processing promotion..." : "Processing leaving..."}
                    </>
                  ) : (
                    actionMode === "promote" ? "Promote" : "Confirm Leaving"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default StudentPromotion;
