import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import Table from "../../../core/common/dataTable/index";
import { useSelector } from "react-redux";
import type { TableData } from "../../../core/data/interface";
import CommonSelect from "../../../core/common/commonSelect";
import PredefinedDateRanges from "../../../core/common/datePicker";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";
import { useStudents } from "../../../core/hooks/useStudents";
import { useStaff } from "../../../core/hooks/useStaff";
import { useTeachers } from "../../../core/hooks/useTeachers";
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";
import { useLeaveTypes } from "../../../core/hooks/useLeaveTypes";
import { selectUser } from "../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { isAdministrativeRole, isHeadmasterRole, isTeacherRole } from "../../../core/utils/roleUtils";
import type { Dayjs } from "dayjs";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const normalizeLeaveTypeName = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

type StaffLeaveTypeDef = {
  /** Stable column key (leave_types.id as string). */
  key: string;
  id: number;
  label: string;
  max: number;
  normalizedName: string;
};

const isStaffOrBothLeaveType = (lt: { applicable_for?: string }) => {
  const v = String(lt?.applicable_for ?? "both")
    .trim()
    .toLowerCase();
  return v === "staff" || v === "both" || v === "";
};

/** Rejected/declined leaves must not reduce available balance or total days taken. */
const isRejectedLeave = (leave: any) => {
  const status = String(leave?.status || "")
    .trim()
    .toLowerCase();
  if (!status) return false;
  if (status === "rejected") return true;
  if (["decline", "declined", "deny", "denied"].includes(status)) return true;
  return status.includes("reject") && !status.includes("approv");
};

const sumCountableLeaveDays = (leaves: any[]) =>
  (Array.isArray(leaves) ? leaves : [])
    .filter((leave) => !isRejectedLeave(leave))
    .reduce((sum: number, leave: any) => {
      const days = Number(leave?.noOfDays || 0);
      return sum + (Number.isFinite(days) && days > 0 ? days : 0);
    }, 0);

const emptyLeaveFields = () => ({
  leaveType: "—",
  leaveDate: "—",
  noOfDays: 0,
  applyOn: "—",
  status: "—",
  description: "—",
  leaveStartRaw: "",
});

const groupLeavesById = (leaves: any[], idKey: string) => {
  const map = new Map<number, any[]>();
  (Array.isArray(leaves) ? leaves : []).forEach((leave) => {
    const id = Number(leave[idKey]);
    if (!Number.isFinite(id)) return;
    if (!map.has(id)) map.set(id, []);
    map.get(id)!.push(leave);
  });
  return map;
};

const LeaveReport = () => {
  const routes = all_routes;
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const isAdminViewer = isHeadmasterRole(user) || isAdministrativeRole(user);
  const canUseAdminList = isAdminViewer || isTeacherRole(user);
  const [activeTab, setActiveTab] = useState<"teacher" | "student">("teacher");
  const { students, loading: studentsLoading, error: studentsError } = useStudents();
  const { staffList, loading: staffListLoading, error: staffListError } = useStaff({
    enabled: isAdminViewer,
  });
  const { teachers, loading: teachersLoading, error: teachersError } = useTeachers({
    skip: isAdminViewer,
  });
  const leaveFetchOptions = {
    limit: 1000,
    canUseAdminList,
    studentOnly: false,
    academicYearId: null as number | null,
    sortBy: "created_at" as const,
    sortOrder: "desc" as const,
  };
  const {
    leaveApplications: staffLeaveApplications,
    loading: staffLeavesLoading,
    error: staffLeavesError,
    refetch: refetchStaffLeaves,
  } = useLeaveApplications({
    ...leaveFetchOptions,
    applicantType: "staff",
  });
  const {
    leaveApplications: studentLeaveApplications,
    loading: studentLeavesLoading,
    error: studentLeavesError,
    refetch: refetchStudentLeaves,
  } = useLeaveApplications({
    ...leaveFetchOptions,
    applicantType: "student",
  });
  const leaveApplications = useMemo(
    () => [...staffLeaveApplications, ...studentLeaveApplications],
    [staffLeaveApplications, studentLeaveApplications]
  );
  const applicationsLoading =
    staffLeavesLoading || studentLeavesLoading || staffListLoading || teachersLoading;
  const applicationsError =
    staffLeavesError || studentLeavesError || staffListError || teachersError;
  const refetchApplications = () => {
    refetchStaffLeaves();
    refetchStudentLeaves();
  };
  /** Staff report: only leave_types with applicable_for staff or both (see API + useLeaveTypes filter). */
  const {
    leaveTypes,
    loading: leaveTypesLoading,
    error: leaveTypesError,
  } = useLeaveTypes({ applicableFor: "staff" });
  const [selectedDateRange, setSelectedDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const [selectedTeacherRole, setSelectedTeacherRole] = useState<string>("All");
  const [selectedTeacherStatus, setSelectedTeacherStatus] = useState<string>("All");
  const [selectedTeacherLeaveType, setSelectedTeacherLeaveType] = useState<string>("All");
  const [appliedTeacherRole, setAppliedTeacherRole] = useState<string>("All");
  const [appliedTeacherStatus, setAppliedTeacherStatus] = useState<string>("All");
  const [appliedTeacherLeaveType, setAppliedTeacherLeaveType] = useState<string>("All");

  const [selectedStudentClass, setSelectedStudentClass] = useState<string>("All");
  const [selectedStudentSection, setSelectedStudentSection] = useState<string>("All");
  const [selectedStudentStatus, setSelectedStudentStatus] = useState<string>("All");
  const [selectedStudentLeaveType, setSelectedStudentLeaveType] = useState<string>("All");
  const [appliedStudentClass, setAppliedStudentClass] = useState<string>("All");
  const [appliedStudentSection, setAppliedStudentSection] = useState<string>("All");
  const [appliedStudentStatus, setAppliedStudentStatus] = useState<string>("All");
  const [appliedStudentLeaveType, setAppliedStudentLeaveType] = useState<string>("All");

  /** All staff + both leave types from master — columns show even if unused yet. */
  const staffLeaveTypeDefs: StaffLeaveTypeDef[] = useMemo(() => {
    const master = Array.isArray(leaveTypes) ? leaveTypes : [];
    const seenIds = new Set<number>();
    const defs: StaffLeaveTypeDef[] = [];

    master.forEach((lt: any) => {
      if (!isStaffOrBothLeaveType(lt)) return;
      const id = Number(lt.id ?? lt.value);
      if (!Number.isFinite(id) || id < 1 || seenIds.has(id)) return;
      seenIds.add(id);
      const rawName = lt.label || lt.leave_type_name || lt.leave_type || lt.name;
      const maxRaw = lt.max_days_per_year ?? lt.max_days ?? lt.max ?? 0;
      const max =
        Number.isFinite(Number(maxRaw)) && Number(maxRaw) > 0 ? Number(maxRaw) : 0;
      defs.push({
        key: String(id),
        id,
        label: String(rawName || "Leave"),
        max,
        normalizedName: normalizeLeaveTypeName(rawName),
      });
    });

    return defs.sort((a, b) => a.label.localeCompare(b.label));
  }, [leaveTypes]);

  const staffLeaveTypeKeyMaps = useMemo(() => {
    const byId = new Map<number, string>();
    const byName = new Map<string, string>();
    staffLeaveTypeDefs.forEach((def) => {
      byId.set(def.id, def.key);
      if (def.normalizedName) byName.set(def.normalizedName, def.key);
    });
    return { byId, byName };
  }, [staffLeaveTypeDefs]);

  const staffRoster = useMemo(() => {
    if (isAdminViewer && Array.isArray(staffList) && staffList.length > 0) {
      return staffList
        .map((s: any) => ({
          staffId: s.dbId,
          name: s.name || "—",
          role: s.designation || s.role || "Staff",
          avatar: s.img || "",
        }))
        .filter((s: any) => s.staffId != null);
    }
    return (Array.isArray(teachers) ? teachers : [])
      .map((t: any) => ({
        staffId: Number(t.staff_id ?? t.id),
        name: [t.first_name, t.last_name].filter(Boolean).join(" ").trim() || t.name || "—",
        role: t.designation_name || t.designation || "Teacher",
        avatar: t.photo_url || t.img || "",
      }))
      .filter((s: any) => Number.isFinite(s.staffId));
  }, [isAdminViewer, staffList, teachers]);

  const leavesByStaffId = useMemo(
    () => groupLeavesById(staffLeaveApplications, "staffId"),
    [staffLeaveApplications]
  );

  const teacherLeaveRows = useMemo(() => {
    const usageByStaff = new Map<string, Record<string, number>>();
    leavesByStaffId.forEach((leaves, staffId) => {
      const staffKey = String(staffId);
      leaves.forEach((row: any) => {
        if (isRejectedLeave(row)) return;
        const tid = Number(row.leaveTypeId ?? row.leave_type_id);
        let typeKey: string | undefined;
        if (Number.isFinite(tid) && tid > 0) {
          typeKey = staffLeaveTypeKeyMaps.byId.get(tid);
        }
        if (!typeKey) {
          const norm = normalizeLeaveTypeName(row.leaveType);
          typeKey = norm ? staffLeaveTypeKeyMaps.byName.get(norm) : undefined;
        }
        if (!typeKey) return;
        const days = Number(row.noOfDays || 0);
        if (!Number.isFinite(days) || days <= 0) return;
        const usage = usageByStaff.get(staffKey) || {};
        usage[typeKey] = (usage[typeKey] || 0) + days;
        usageByStaff.set(staffKey, usage);
      });
    });

    const mapStaffToRow = (staff: any, leaves: any[]) => {
      const staffKey = String(staff.staffId);
      const usage = usageByStaff.get(staffKey) || {};
      const totalLeaveDays = sumCountableLeaveDays(leaves);
      const base: any = {
        key: `staff-leave-report-${staff.staffId}`,
        staffId: staff.staffId,
        name: staff.name,
        role: staff.role,
        noOfDays: totalLeaveDays,
        avatar: staff.avatar || leaves[0]?.photoUrl || "",
        hasLeave: leaves.some((leave) => !isRejectedLeave(leave)),
      };

      staffLeaveTypeDefs.forEach((def) => {
        const used = Number(usage[def.key] ?? 0);
        base[`leaveUsed_${def.key}`] = used;
        base[`leaveAvailable_${def.key}`] =
          def.max > 0 ? Math.max(def.max - used, 0) : "—";
      });

      return base;
    };

    if (staffRoster.length > 0) {
      return staffRoster.map((staff: any) => {
        const leaves = leavesByStaffId.get(Number(staff.staffId)) || [];
        return mapStaffToRow(staff, leaves);
      });
    }

    const staffFromLeaves = new Map<number, any>();
    (Array.isArray(staffLeaveApplications) ? staffLeaveApplications : []).forEach((row: any) => {
      const id = Number(row.staffId);
      if (!Number.isFinite(id)) return;
      if (!staffFromLeaves.has(id)) {
        staffFromLeaves.set(id, {
          staffId: id,
          name: row.name || "—",
          role: row.role || "Staff",
          avatar: row.photoUrl || "",
        });
      }
    });
    return Array.from(staffFromLeaves.values()).map((staff) => {
      const leaves = leavesByStaffId.get(Number(staff.staffId)) || [];
      return mapStaffToRow(staff, leaves);
    });
  }, [staffRoster, leavesByStaffId, staffLeaveApplications, staffLeaveTypeDefs, staffLeaveTypeKeyMaps]);

  const teacherRoleOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        teacherLeaveRows
          .map((row: any) => String(row.role || "").trim())
          .filter((value: string) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Roles" }, ...unique.map((value) => ({ value, label: value }))];
  }, [teacherLeaveRows]);

  const teacherStatusOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        staffLeaveApplications
          .map((row: any) => String(row.status || "").trim().toLowerCase())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Status" }, ...unique.map((value) => ({ value, label: value }))];
  }, [staffLeaveApplications]);

  const teacherLeaveTypeOptions = useMemo(
    () => [
      { value: "All", label: "All Leave Types" },
      ...staffLeaveTypeDefs.map((def) => ({ value: def.label, label: def.label })),
    ],
    [staffLeaveTypeDefs]
  );

  const filteredTeacherRows = useMemo(() => {
    return teacherLeaveRows.filter((row: any) => {
      const roleOk = appliedTeacherRole === "All" || row.role === appliedTeacherRole;
      const leaves = leavesByStaffId.get(Number(row.staffId)) || [];
      if (leaves.length === 0) {
        return (
          roleOk &&
          appliedTeacherStatus === "All" &&
          appliedTeacherLeaveType === "All" &&
          !selectedDateRange
        );
      }
      const statusOk =
        appliedTeacherStatus === "All" ||
        leaves.some((leave: any) => String(leave.status || "").toLowerCase() === appliedTeacherStatus);
      const leaveTypeOk =
        appliedTeacherLeaveType === "All" ||
        leaves.some(
          (leave: any) =>
            String(leave.leaveType || "").trim() !== "—" &&
            String(leave.leaveType || "").trim() === appliedTeacherLeaveType
        );
      const dateOk =
        !selectedDateRange ||
        leaves.some((leave: any) => {
          const dateRaw = leave?.startDate || "";
          const leaveStartRaw = dateRaw ? new Date(dateRaw).toISOString().slice(0, 10) : "";
          return (
            leaveStartRaw &&
            leaveStartRaw >= selectedDateRange[0].format("YYYY-MM-DD") &&
            leaveStartRaw <= selectedDateRange[1].format("YYYY-MM-DD")
          );
        });
      return roleOk && statusOk && leaveTypeOk && dateOk;
    });
  }, [
    appliedTeacherRole,
    appliedTeacherStatus,
    appliedTeacherLeaveType,
    selectedDateRange,
    teacherLeaveRows,
    leavesByStaffId,
  ]);

  const leavesByStudentId = useMemo(
    () => groupLeavesById(studentLeaveApplications, "studentId"),
    [studentLeaveApplications]
  );

  const studentLeaveRows = useMemo(() => {
    const studentMap = new Map<number, any>();
    (Array.isArray(students) ? students : []).forEach((student: any) => {
      const id = Number(student.id);
      if (Number.isFinite(id)) studentMap.set(id, student);
    });

    const mapLeaveToRow = (student: any, leave: any, index: number) => {
      const className = student?.class_name || student?.class || "—";
      const sectionName = student?.section_name || student?.section || "—";
      const dateRaw = leave?.startDate || "";
      const empty = emptyLeaveFields();
      const studentName =
        [student?.first_name, student?.last_name].filter(Boolean).join(" ").trim() ||
        student?.name ||
        leave?.name ||
        "—";
      return {
        key: leave?.key || `student-leave-report-${student?.id ?? "x"}-${index}`,
        studentId: student?.id ?? leave?.studentId,
        admissionNo: student?.admission_number || "—",
        rollNo: student?.roll_number || "—",
        studentName,
        className,
        sectionName,
        leaveType: leave?.leaveType || empty.leaveType,
        noOfDays: Number(leave?.noOfDays || 0),
        leaveDate: leave?.leaveDate || empty.leaveDate,
        applyOn: leave?.appliedOn || leave?.applyOn || empty.applyOn,
        status: leave?.status || empty.status,
        description: leave?.description || empty.description,
        avatar: leave?.photoUrl || student?.photo_url || student?.avatar || "",
        gender: student?.gender || "",
        leaveStartRaw: dateRaw ? new Date(dateRaw).toISOString().slice(0, 10) : "",
        hasLeave: Boolean(leave),
      };
    };

    const rows: any[] = [];
    leavesByStudentId.forEach((leaves, studentId) => {
      const student = studentMap.get(studentId) || { id: studentId };
      leaves.forEach((leave: any, idx: number) => rows.push(mapLeaveToRow(student, leave, idx)));
    });
    return rows;
  }, [students, leavesByStudentId]);

  const studentClassOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        studentLeaveRows
          .map((row: any) => String(row.className || "").trim())
          .filter((value: string) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Classes" }, ...unique.map((value) => ({ value, label: value }))];
  }, [studentLeaveRows]);

  const studentSectionOptions = useMemo(() => {
    const pool =
      appliedStudentClass === "All"
        ? studentLeaveRows
        : studentLeaveRows.filter((row: any) => row.className === appliedStudentClass);
    const unique = Array.from(
      new Set(
        pool
          .map((row: any) => String(row.sectionName || "").trim())
          .filter((value: string) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Sections" }, ...unique.map((value) => ({ value, label: value }))];
  }, [appliedStudentClass, studentLeaveRows]);

  const studentStatusOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        studentLeaveRows
          .map((row: any) => String(row.status || "").trim().toLowerCase())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Status" }, ...unique.map((value) => ({ value, label: value }))];
  }, [studentLeaveRows]);

  const studentLeaveTypeOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        studentLeaveRows
          .map((row: any) => String(row.leaveType || "").trim())
          .filter((value: string) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Leave Types" }, ...unique.map((value) => ({ value, label: value }))];
  }, [studentLeaveRows]);

  const filteredStudentRows = useMemo(() => {
    return studentLeaveRows.filter((row: any) => {
      const classOk = appliedStudentClass === "All" || row.className === appliedStudentClass;
      const sectionOk = appliedStudentSection === "All" || row.sectionName === appliedStudentSection;
      const statusOk =
        appliedStudentStatus === "All" ||
        (row.status !== "—" && String(row.status).toLowerCase() === appliedStudentStatus);
      const leaveTypeOk =
        appliedStudentLeaveType === "All" ||
        (row.leaveType !== "—" && row.leaveType === appliedStudentLeaveType);
      const dateOk =
        !selectedDateRange ||
        (row.leaveStartRaw &&
          row.leaveStartRaw >= selectedDateRange[0].format("YYYY-MM-DD") &&
          row.leaveStartRaw <= selectedDateRange[1].format("YYYY-MM-DD"));
      return classOk && sectionOk && statusOk && leaveTypeOk && dateOk;
    });
  }, [
    appliedStudentClass,
    appliedStudentSection,
    appliedStudentStatus,
    appliedStudentLeaveType,
    selectedDateRange,
    studentLeaveRows,
  ]);

  const teacherLeaveTypeColumns = useMemo(
    () =>
      staffLeaveTypeDefs.map((def) => {
        const usedKey = `leaveUsed_${def.key}`;
        const availKey = `leaveAvailable_${def.key}`;
        const titleSuffix = def.max > 0 ? ` (${def.max})` : "";
        return {
          title: `${def.label}${titleSuffix}`,
          children: [
            {
              title: "Used",
              dataIndex: usedKey,
              key: usedKey,
              sorter: (a: any, b: any) => compareNumber(a?.[usedKey], b?.[usedKey]),
            },
            {
              title: "Available",
              dataIndex: availKey,
              key: availKey,
              sorter: (a: any, b: any) =>
                compareNumber(
                  typeof a?.[availKey] === "number" ? a[availKey] : 0,
                  typeof b?.[availKey] === "number" ? b[availKey] : 0
                ),
            },
          ],
        };
      }),
    [staffLeaveTypeDefs]
  );

  const teacherColumns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      sorter: (a: TableData, b: TableData) => compareText(a?.name, b?.name),
      render: (text: any, record: any) => (
        <div className="d-flex align-items-center">
          <Link to={routes.teacherList} className="avatar avatar-md">
            <ImageWithBasePath src={record.avatar} alt="avatar" className="img-fluid rounded-circle" />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to={routes.teacherList}>{text}</Link>
            </p>
            <span className="fs-12">{record.role}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Role",
      dataIndex: "role",
      key: "role",
      sorter: (a: TableData, b: TableData) => compareText(a?.role, b?.role),
    },
    ...teacherLeaveTypeColumns,
    {
      title: "Total Leave Days",
      dataIndex: "noOfDays",
      key: "noOfDays",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.noOfDays, b?.noOfDays),
    },
  ];

  const studentColumns = [
    {
      title: "Admission No",
      dataIndex: "admissionNo",
      key: "admissionNo",
      sorter: (a: TableData, b: TableData) => compareText(a?.admissionNo, b?.admissionNo),
      render: (text: any, record: any) => (
        <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList} className="link-primary">
          {text}
        </Link>
      ),
    },
    {
      title: "Student",
      dataIndex: "studentName",
      key: "studentName",
      sorter: (a: TableData, b: TableData) => compareText(a?.studentName, b?.studentName),
      render: (text: any, record: any) => (
        <div className="d-flex align-items-center">
          <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList} className="avatar avatar-md">
            <ImageWithBasePath src={record.avatar} alt="avatar" className="img-fluid rounded-circle" gender={record.gender} />
          </Link>
          <div className="ms-2">
            <p className="text-dark mb-0">
              <Link to={record.studentId ? `${routes.studentDetail}/${record.studentId}` : routes.studentList}>{text}</Link>
            </p>
            <span className="fs-12">Roll No : {record.rollNo}</span>
          </div>
        </div>
      ),
    },
    {
      title: "Class",
      dataIndex: "className",
      key: "className",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.className, (b as any)?.className),
    },
    {
      title: "Section",
      dataIndex: "sectionName",
      key: "sectionName",
      sorter: (a: TableData, b: TableData) => compareText(a?.sectionName, b?.sectionName),
    },
    {
      title: "Leave Date",
      dataIndex: "leaveDate",
      key: "leaveDate",
      sorter: (a: TableData, b: TableData) => compareText(a?.leaveDate, b?.leaveDate),
    },
    {
      title: "Days",
      dataIndex: "noOfDays",
      key: "noOfDays",
      sorter: (a: TableData, b: TableData) => compareNumber(a?.noOfDays, b?.noOfDays),
    },
    {
      title: "Applied On",
      dataIndex: "applyOn",
      key: "applyOn",
      sorter: (a: TableData, b: TableData) => compareText((a as any)?.applyOn, (b as any)?.applyOn),
      render: (text: string) => {
        const value = String(text || "").trim();
        return value && value !== "—" && value !== "N/A" ? value : "—";
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      sorter: (a: TableData, b: TableData) => compareText(a?.status, b?.status),
      render: (status: string) => {
        const value = String(status || "").toLowerCase();
        const className =
          value.includes("approv") ? "badge-soft-success" : value.includes("reject") ? "badge-soft-danger" : "badge-soft-warning";
        return (
          <span className={`badge d-inline-flex align-items-center ${className}`}>
            <i className="ti ti-circle-filled fs-5 me-1" />
            {status}
          </span>
        );
      },
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      sorter: (a: TableData, b: TableData) => compareText(a?.description, b?.description),
      render: (text: string) => (
        <span title={text || "—"}>{text || "—"}</span>
      ),
    },
  ];

  const handleApplyFilters = (e: React.MouseEvent | React.FormEvent) => {
    e.preventDefault();
    if (activeTab === "teacher") {
      setAppliedTeacherRole(selectedTeacherRole);
      setAppliedTeacherStatus(selectedTeacherStatus);
      setAppliedTeacherLeaveType(selectedTeacherLeaveType);
    } else {
      setAppliedStudentClass(selectedStudentClass);
      setAppliedStudentSection(selectedStudentSection);
      setAppliedStudentStatus(selectedStudentStatus);
      setAppliedStudentLeaveType(selectedStudentLeaveType);
    }
    if (filterMenuRef.current) {
      filterMenuRef.current.classList.remove("show");
    }
  };

  const handleResetFilters = () => {
    if (activeTab === "teacher") {
      setSelectedTeacherRole("All");
      setSelectedTeacherStatus("All");
      setSelectedTeacherLeaveType("All");
      setAppliedTeacherRole("All");
      setAppliedTeacherStatus("All");
      setAppliedTeacherLeaveType("All");
      setSelectedDateRange(null);
    } else {
      setSelectedStudentClass("All");
      setSelectedStudentSection("All");
      setSelectedStudentStatus("All");
      setSelectedStudentLeaveType("All");
      setAppliedStudentClass("All");
      setAppliedStudentSection("All");
      setAppliedStudentStatus("All");
      setAppliedStudentLeaveType("All");
      setSelectedDateRange(null);
    }
  };

  const teacherExportColumns = useMemo(() => {
    const base: { title: string; dataKey: string }[] = [
      { title: "Name", dataKey: "name" },
      { title: "Role", dataKey: "role" },
    ];
    const dynamic = staffLeaveTypeDefs.flatMap((def) => {
      const usedKey = `leaveUsed_${def.key}`;
      const availKey = `leaveAvailable_${def.key}`;
      const titleSuffix = def.max > 0 ? ` (${def.max})` : "";
      return [
        { title: `${def.label}${titleSuffix} Used`, dataKey: usedKey },
        { title: `${def.label}${titleSuffix} Available`, dataKey: availKey },
      ];
    });
    return [
      ...base,
      ...dynamic,
      { title: "Total Leave Days", dataKey: "noOfDays" },
    ];
  }, [staffLeaveTypeDefs]);

  const studentExportColumns = useMemo(
    () => [
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Student Name", dataKey: "studentName" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Class", dataKey: "className" },
      { title: "Section", dataKey: "sectionName" },
      { title: "Leave Date", dataKey: "leaveDate" },
      { title: "Days", dataKey: "noOfDays" },
      { title: "Applied On", dataKey: "applyOn" },
      { title: "Status", dataKey: "status" },
      { title: "Description", dataKey: "description" },
    ],
    []
  );

  const handleExportExcel = () => {
    const dateStamp = new Date().toISOString().split("T")[0];
    if (activeTab === "teacher") {
      const rows = filteredTeacherRows.map((row: any) => {
        const base: Record<string, string | number> = {
          Name: row.name,
          Role: row.role,
          "Total Leave Days": row.noOfDays,
        };
        staffLeaveTypeDefs.forEach((def) => {
          const usedKey = `leaveUsed_${def.key}`;
          const availKey = `leaveAvailable_${def.key}`;
          const titleSuffix = def.max > 0 ? ` (${def.max})` : "";
          base[`${def.label}${titleSuffix} Used`] = row[usedKey] ?? 0;
          base[`${def.label}${titleSuffix} Available`] = row[availKey] ?? "—";
        });
        return base;
      });
      exportToExcel(rows, `StaffLeaveReport_${dateStamp}`);
      return;
    }

    const rows = filteredStudentRows.map((row: any) => ({
      "Admission No": row.admissionNo,
      "Student Name": row.studentName,
      "Roll No": row.rollNo,
      Class: row.className,
      Section: row.sectionName,
      "Leave Date": row.leaveDate,
      Days: row.noOfDays,
      "Applied On": row.applyOn,
      Status: row.status,
      Description: row.description,
    }));
    exportToExcel(rows, `StudentLeaveReport_${dateStamp}`);
  };

  const handleExportPDF = () => {
    const dateStamp = new Date().toISOString().split("T")[0];
    if (activeTab === "teacher") {
      exportToPDF(filteredTeacherRows, "Staff Leave Report", `StaffLeaveReport_${dateStamp}`, teacherExportColumns);
      return;
    }
    exportToPDF(filteredStudentRows, "Student Leave Report", `StudentLeaveReport_${dateStamp}`, studentExportColumns);
  };

  const handlePrint = () => {
    if (activeTab === "teacher") {
      printData("Staff Leave Report", teacherExportColumns, filteredTeacherRows);
      return;
    }
    printData("Student Leave Report", studentExportColumns, filteredStudentRows);
  };

  const handleRefresh = () => {
    refetchApplications();
  };

  return (
    <div>
      {" "}
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Leave Report</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Report</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Leave Report
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <TooltipOption
                onRefresh={handleRefresh}
                onPrint={handlePrint}
                onExportExcel={handleExportExcel}
                onExportPdf={handleExportPDF}
              />
            </div>
          </div>
          {/* /Page Header */}
          {/* Student List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <div className="mb-3">
                <ul className="nav nav-pills">
                  <li className="nav-item me-2">
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTab === "student" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setActiveTab("student")}
                    >
                      Student Leave
                    </button>
                  </li>
                  <li className="nav-item">
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTab === "teacher" ? "btn-primary" : "btn-outline-primary"}`}
                      onClick={() => setActiveTab("teacher")}
                    >
                      Staff Report
                    </button>
                  </li>
                </ul>
              </div>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges
                    onChange={(range: [Dayjs, Dayjs]) => setSelectedDateRange(range)}
                  />
                </div>
                <div className="dropdown mb-3 me-2">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                    data-bs-auto-close="outside"
                  >
                    <i className="ti ti-filter me-2" />
                    Filter
                  </Link>
                  <div className="dropdown-menu drop-width" ref={filterMenuRef}>
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          {activeTab === "teacher" ? (
                            <>
                              <div className="col-md-12">
                                <div className="mb-3">
                                  <label className="form-label">Role</label>
                                  <CommonSelect
                                    className="select"
                                    options={teacherRoleOptions}
                                    value={selectedTeacherRole}
                                    onChange={(value) => setSelectedTeacherRole(String(value))}
                                  />
                                </div>
                              </div>
                              <div className="col-md-12">
                                <div className="mb-3">
                                  <label className="form-label">Status</label>
                                  <CommonSelect
                                    className="select"
                                    options={teacherStatusOptions}
                                    value={selectedTeacherStatus}
                                    onChange={(value) => setSelectedTeacherStatus(String(value))}
                                  />
                                </div>
                              </div>
                              <div className="col-md-12">
                                <div className="mb-0">
                                  <label className="form-label">Leave Type</label>
                                  <CommonSelect
                                    className="select"
                                    options={teacherLeaveTypeOptions}
                                    value={selectedTeacherLeaveType}
                                    onChange={(value) => setSelectedTeacherLeaveType(String(value))}
                                  />
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="col-md-12">
                                <div className="mb-3">
                                  <label className="form-label">Class</label>
                                  <CommonSelect
                                    className="select"
                                    options={studentClassOptions}
                                    value={selectedStudentClass}
                                    onChange={(value) => setSelectedStudentClass(String(value))}
                                  />
                                </div>
                              </div>
                              <div className="col-md-12">
                                <div className="mb-3">
                                  <label className="form-label">Section</label>
                                  <CommonSelect
                                    className="select"
                                    options={studentSectionOptions}
                                    value={selectedStudentSection}
                                    onChange={(value) => setSelectedStudentSection(String(value))}
                                  />
                                </div>
                              </div>
                              <div className="col-md-12">
                                <div className="mb-3">
                                  <label className="form-label">Status</label>
                                  <CommonSelect
                                    className="select"
                                    options={studentStatusOptions}
                                    value={selectedStudentStatus}
                                    onChange={(value) => setSelectedStudentStatus(String(value))}
                                  />
                                </div>
                              </div>
                              <div className="col-md-12">
                                <div className="mb-0">
                                  <label className="form-label">Leave Type</label>
                                  <CommonSelect
                                    className="select"
                                    options={studentLeaveTypeOptions}
                                    value={selectedStudentLeaveType}
                                    onChange={(value) => setSelectedStudentLeaveType(String(value))}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link
                          to="#"
                          className="btn btn-light me-3"
                          onClick={(e) => {
                            e.preventDefault();
                            handleResetFilters();
                          }}
                        >
                          Reset
                        </Link>
                        <button type="submit" className="btn btn-primary" onClick={handleApplyFilters}>
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {(studentsError || applicationsError || leaveTypesError) && (
                <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                  {studentsError || applicationsError || leaveTypesError}
                </div>
              )}
              {studentsLoading || applicationsLoading || leaveTypesLoading ? (
                <div className="text-center py-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <p className="mt-2 mb-0">Loading leave report...</p>
                </div>
              ) : activeTab === "teacher" ? (
                <Table dataSource={filteredTeacherRows} columns={teacherColumns} Selection={true} />
              ) : (
                <Table dataSource={filteredStudentRows} columns={studentColumns} Selection={true} />
              )}
            </div>
          </div>
          {/* /Student List */}
        </div>
      </div>
      {/* /Page Wrapper */}
    </div>
  );
};

export default LeaveReport;

