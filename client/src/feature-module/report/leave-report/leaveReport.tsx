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
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";
import { useLeaveTypes } from "../../../core/hooks/useLeaveTypes";
import { selectUser } from "../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";
import type { Dayjs } from "dayjs";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const leaveBucketFromName = (name: unknown) => {
  const value = String(name || "").trim().toLowerCase();
  if (value.includes("medical")) return "medical";
  if (value.includes("casual")) return "casual";
  if (value.includes("maternity")) return "maternity";
  if (value.includes("paternity")) return "paternity";
  if (value.includes("special")) return "special";
  return null;
};

const LeaveReport = () => {
  const routes = all_routes;
  const filterMenuRef = useRef<HTMLDivElement | null>(null);
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const canUseAdminList = isHeadmasterRole(user);
  const isOwnLeavesOnly = isAdministrativeRole(user);
  const [activeTab, setActiveTab] = useState<"teacher" | "student">("teacher");
  const { students, loading: studentsLoading, error: studentsError } = useStudents();
  const {
    leaveApplications,
    loading: applicationsLoading,
    error: applicationsError,
    refetch: refetchApplications,
  } = useLeaveApplications({
    limit: 1000,
    canUseAdminList,
    studentOnly: isOwnLeavesOnly,
    academicYearId,
  });
  const {
    leaveTypes,
    loading: leaveTypesLoading,
    error: leaveTypesError,
  } = useLeaveTypes();
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

  const teacherLeaveTypeMax = useMemo(() => {
    const fallback = {
      medical: 10,
      casual: 12,
      maternity: 90,
      paternity: 15,
      special: 5,
    };
    const next = { ...fallback };
    (Array.isArray(leaveTypes) ? leaveTypes : []).forEach((lt: any) => {
      const bucket = leaveBucketFromName(lt?.label || lt?.leave_type || lt?.leave_type_name);
      if (!bucket) return;
      const max = Number(lt?.max_days_per_year ?? lt?.max_days ?? 0);
      if (Number.isFinite(max) && max > 0) {
        (next as any)[bucket] = max;
      }
    });
    return next;
  }, [leaveTypes]);

  const teacherLeaveRows = useMemo(() => {
    const rows = Array.isArray(leaveApplications) ? leaveApplications : [];
    const teacherRows = rows.filter(
      (row: any) => row.staffId != null || String(row.applicantType || "").toLowerCase() === "staff"
    );
    const usageByStaff = new Map<
      string,
      { medical: number; casual: number; maternity: number; paternity: number; special: number }
    >();
    teacherRows.forEach((row: any) => {
      const staffKey = String(row.staffId ?? row.name ?? "");
      if (!staffKey) return;
      const bucket = leaveBucketFromName(row.leaveType);
      if (!bucket) return;
      const days = Number(row.noOfDays || 0);
      const usage = usageByStaff.get(staffKey) || {
        medical: 0,
        casual: 0,
        maternity: 0,
        paternity: 0,
        special: 0,
      };
      usage[bucket] += Number.isFinite(days) && days > 0 ? days : 0;
      usageByStaff.set(staffKey, usage);
    });
    return teacherRows
      .map((row: any, index: number) => {
        const dateRaw = row.startDate || "";
        const staffKey = String(row.staffId ?? row.name ?? "");
        const usage = usageByStaff.get(staffKey) || {
          medical: 0,
          casual: 0,
          maternity: 0,
          paternity: 0,
          special: 0,
        };
        return {
          key: row.key || `teacher-leave-report-${index}`,
          staffId: row.staffId,
          name: row.name || "—",
          role: row.role || "Teacher",
          leaveType: row.leaveType || "—",
          leaveDate: row.leaveDate || "—",
          noOfDays: Number(row.noOfDays || 0),
          applyOn: row.applyOn || "—",
          status: row.status || "pending",
          description: row.description || "—",
          avatar: row.photoUrl || "",
          leaveStartRaw: dateRaw ? new Date(dateRaw).toISOString().slice(0, 10) : "",
          medicalUsed: usage.medical,
          medicalAvailable: Math.max(teacherLeaveTypeMax.medical - usage.medical, 0),
          casualUsed: usage.casual,
          casualAvailable: Math.max(teacherLeaveTypeMax.casual - usage.casual, 0),
          maternityUsed: usage.maternity,
          maternityAvailable: Math.max(teacherLeaveTypeMax.maternity - usage.maternity, 0),
          paternityUsed: usage.paternity,
          paternityAvailable: Math.max(teacherLeaveTypeMax.paternity - usage.paternity, 0),
          specialUsed: usage.special,
          specialAvailable: Math.max(teacherLeaveTypeMax.special - usage.special, 0),
        };
      });
  }, [leaveApplications, teacherLeaveTypeMax]);

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
        teacherLeaveRows
          .map((row: any) => String(row.status || "").trim().toLowerCase())
          .filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Status" }, ...unique.map((value) => ({ value, label: value }))];
  }, [teacherLeaveRows]);

  const teacherLeaveTypeOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        teacherLeaveRows
          .map((row: any) => String(row.leaveType || "").trim())
          .filter((value: string) => value && value !== "—")
      )
    ).sort((a, b) => a.localeCompare(b));
    return [{ value: "All", label: "All Leave Types" }, ...unique.map((value) => ({ value, label: value }))];
  }, [teacherLeaveRows]);

  const filteredTeacherRows = useMemo(() => {
    return teacherLeaveRows.filter((row: any) => {
      const roleOk = appliedTeacherRole === "All" || row.role === appliedTeacherRole;
      const statusOk = appliedTeacherStatus === "All" || String(row.status).toLowerCase() === appliedTeacherStatus;
      const leaveTypeOk = appliedTeacherLeaveType === "All" || row.leaveType === appliedTeacherLeaveType;
      const dateOk =
        !selectedDateRange ||
        (row.leaveStartRaw &&
          row.leaveStartRaw >= selectedDateRange[0].format("YYYY-MM-DD") &&
          row.leaveStartRaw <= selectedDateRange[1].format("YYYY-MM-DD"));
      return roleOk && statusOk && leaveTypeOk && dateOk;
    });
  }, [appliedTeacherRole, appliedTeacherStatus, appliedTeacherLeaveType, selectedDateRange, teacherLeaveRows]);

  const studentLeaveRows = useMemo(() => {
    const rows = Array.isArray(leaveApplications) ? leaveApplications : [];
    const studentMap = new Map<number, any>();
    (Array.isArray(students) ? students : []).forEach((student: any) => {
      const id = Number(student.id);
      if (Number.isFinite(id)) studentMap.set(id, student);
    });

    return rows
      .filter((row: any) => row.studentId != null || String(row.applicantType || "").toLowerCase() === "student")
      .map((row: any, index: number) => {
        const student = studentMap.get(Number(row.studentId));
        const className = student?.class_name || student?.class || "—";
        const sectionName = student?.section_name || student?.section || "—";
        const dateRaw = row.startDate || "";
        return {
          key: row.key || `student-leave-report-${index}`,
          studentId: row.studentId,
          admissionNo: student?.admission_number || "—",
          rollNo: student?.roll_number || "—",
          studentName: row.name || "—",
          className,
          sectionName,
          leaveType: row.leaveType || "—",
          noOfDays: Number(row.noOfDays || 0),
          leaveDate: row.leaveDate || "—",
          applyOn: row.applyOn || "—",
          status: row.status || "pending",
          description: row.description || "—",
          avatar: row.photoUrl || student?.photo_url || "",
          gender: student?.gender || "",
          leaveStartRaw: dateRaw ? new Date(dateRaw).toISOString().slice(0, 10) : "",
        };
      });
  }, [leaveApplications, students]);

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
      const statusOk = appliedStudentStatus === "All" || String(row.status).toLowerCase() === appliedStudentStatus;
      const leaveTypeOk = appliedStudentLeaveType === "All" || row.leaveType === appliedStudentLeaveType;
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
    {
      title: `Medical Leave (${teacherLeaveTypeMax.medical})`,
      children: [
        {
          title: "Used",
          dataIndex: "medicalUsed",
          key: "medicalUsed",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.medicalUsed, b?.medicalUsed),
        },
        {
          title: "Available",
          dataIndex: "medicalAvailable",
          key: "medicalAvailable",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.medicalAvailable, b?.medicalAvailable),
        },
      ],
    },
    {
      title: `Casual Leave (${teacherLeaveTypeMax.casual})`,
      children: [
        {
          title: "Used",
          dataIndex: "casualUsed",
          key: "casualUsed",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.casualUsed, b?.casualUsed),
        },
        {
          title: "Available",
          dataIndex: "casualAvailable",
          key: "casualAvailable",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.casualAvailable, b?.casualAvailable),
        },
      ],
    },
    {
      title: `Maternity Leave (${teacherLeaveTypeMax.maternity})`,
      children: [
        {
          title: "Used",
          dataIndex: "maternityUsed",
          key: "maternityUsed",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.maternityUsed, b?.maternityUsed),
        },
        {
          title: "Available",
          dataIndex: "maternityAvailable",
          key: "maternityAvailable",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.maternityAvailable, b?.maternityAvailable),
        },
      ],
    },
    {
      title: `Paternity Leave (${teacherLeaveTypeMax.paternity})`,
      children: [
        {
          title: "Used",
          dataIndex: "paternityUsed",
          key: "paternityUsed",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.paternityUsed, b?.paternityUsed),
        },
        {
          title: "Available",
          dataIndex: "paternityAvailable",
          key: "paternityAvailable",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.paternityAvailable, b?.paternityAvailable),
        },
      ],
    },
    {
      title: `Special Leave (${teacherLeaveTypeMax.special})`,
      children: [
        {
          title: "Used",
          dataIndex: "specialUsed",
          key: "specialUsed",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.specialUsed, b?.specialUsed),
        },
        {
          title: "Available",
          dataIndex: "specialAvailable",
          key: "specialAvailable",
          sorter: (a: TableData, b: TableData) => compareNumber(a?.specialAvailable, b?.specialAvailable),
        },
      ],
    },
    {
      title: "Leave Type",
      dataIndex: "leaveType",
      key: "leaveType",
      sorter: (a: TableData, b: TableData) => compareText(a?.leaveType, b?.leaveType),
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
      render: (text: string) => <span title={text || "—"}>{text || "—"}</span>,
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
      title: "Leave Type",
      dataIndex: "leaveType",
      key: "leaveType",
      sorter: (a: TableData, b: TableData) => compareText(a?.leaveType, b?.leaveType),
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

  const teacherExportColumns = useMemo(
    () => [
      { title: "Name", dataKey: "name" },
      { title: "Role", dataKey: "role" },
      { title: "Medical Used", dataKey: "medicalUsed" },
      { title: "Medical Available", dataKey: "medicalAvailable" },
      { title: "Casual Used", dataKey: "casualUsed" },
      { title: "Casual Available", dataKey: "casualAvailable" },
      { title: "Maternity Used", dataKey: "maternityUsed" },
      { title: "Maternity Available", dataKey: "maternityAvailable" },
      { title: "Paternity Used", dataKey: "paternityUsed" },
      { title: "Paternity Available", dataKey: "paternityAvailable" },
      { title: "Special Used", dataKey: "specialUsed" },
      { title: "Special Available", dataKey: "specialAvailable" },
      { title: "Leave Type", dataKey: "leaveType" },
      { title: "Leave Date", dataKey: "leaveDate" },
      { title: "Days", dataKey: "noOfDays" },
      { title: "Applied On", dataKey: "applyOn" },
      { title: "Status", dataKey: "status" },
      { title: "Description", dataKey: "description" },
    ],
    []
  );

  const studentExportColumns = useMemo(
    () => [
      { title: "Admission No", dataKey: "admissionNo" },
      { title: "Student Name", dataKey: "studentName" },
      { title: "Roll No", dataKey: "rollNo" },
      { title: "Class", dataKey: "className" },
      { title: "Section", dataKey: "sectionName" },
      { title: "Leave Type", dataKey: "leaveType" },
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
      const rows = filteredTeacherRows.map((row: any) => ({
        Name: row.name,
        Role: row.role,
        "Medical Used": row.medicalUsed,
        "Medical Available": row.medicalAvailable,
        "Casual Used": row.casualUsed,
        "Casual Available": row.casualAvailable,
        "Maternity Used": row.maternityUsed,
        "Maternity Available": row.maternityAvailable,
        "Paternity Used": row.paternityUsed,
        "Paternity Available": row.paternityAvailable,
        "Special Used": row.specialUsed,
        "Special Available": row.specialAvailable,
        "Leave Type": row.leaveType,
        "Leave Date": row.leaveDate,
        Days: row.noOfDays,
        "Applied On": row.applyOn,
        Status: row.status,
        Description: row.description,
      }));
      exportToExcel(rows, `TeacherLeaveReport_${dateStamp}`);
      return;
    }

    const rows = filteredStudentRows.map((row: any) => ({
      "Admission No": row.admissionNo,
      "Student Name": row.studentName,
      "Roll No": row.rollNo,
      Class: row.className,
      Section: row.sectionName,
      "Leave Type": row.leaveType,
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
      exportToPDF(filteredTeacherRows, "Teacher Leave Report", `TeacherLeaveReport_${dateStamp}`, teacherExportColumns);
      return;
    }
    exportToPDF(filteredStudentRows, "Student Leave Report", `StudentLeaveReport_${dateStamp}`, studentExportColumns);
  };

  const handlePrint = () => {
    if (activeTab === "teacher") {
      printData("Teacher Leave Report", teacherExportColumns, filteredTeacherRows);
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
                      Teacher Leave
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

