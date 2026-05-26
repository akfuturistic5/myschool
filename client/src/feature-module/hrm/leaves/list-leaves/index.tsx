import { useRef, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import type { TableData } from "../../../../core/data/interface";
import Table from "../../../../core/common/dataTable/index";
import LeaveListDateRangeFilter from "./LeaveListDateRangeFilter";
import {
  getLeaveListDateBounds,
  defaultCustomDateRange,
  type LeaveListDatePreset,
} from "./leaveListDateRangeUtils";
import CommonSelect from "../../../../core/common/commonSelect";
import { leaveType } from "../../../../core/common/selectoption/selectoption";
import { Link } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import TooltipOption from "../../../../core/common/tooltipOption";
import { useCurrentUser } from "../../../../core/hooks/useCurrentUser";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";
import { useLeaveTypes } from "../../../../core/hooks/useLeaveTypes";
import { useClasses } from "../../../../core/hooks/useClasses";
import { useSections } from "../../../../core/hooks/useSections";
import { useDepartments } from "../../../../core/hooks/useDepartments";
import { useDesignations } from "../../../../core/hooks/useDesignations";
import { isHeadmasterRole, isTeacherRole } from "../../../../core/utils/roleUtils";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useCurrentTeacher } from "../../../../core/hooks/useCurrentTeacher";
import TeacherModal from "../../../peoples/teacher/teacherModal";
import { apiService } from "../../../../core/services/apiService";

/** Default: show all leaves including pending. Must match server status tokens. */
const DEFAULT_LIST_LEAVE_STATUSES = "pending,approved,rejected";

const LEAVE_STATUS_OPTIONS = [
  { value: "pending", label: "Pending only" },
  { value: "approved", label: "Approved only" },
  { value: "rejected", label: "Rejected only" },
];

const APPLICANT_TYPE_OPTIONS = [
  { value: "both", label: "Both" },
  { value: "staff", label: "Staff" },
  { value: "student", label: "Student" },
];

const ListLeaves = () => {
  const routes = all_routes;
  const { user: currentUser } = useCurrentUser() as any;
  const roleName = String(currentUser?.role_name || currentUser?.role || "").toLowerCase();
  const roleId = Number(currentUser?.user_role_id);
  const isTeacher = isTeacherRole(currentUser);
  const isAdmin = isHeadmasterRole(currentUser);
  const canUseAdminList = isAdmin || isTeacher;
  const isOwnLeavesOnly = isTeacher && !isAdmin;
  const { teacher: currentTeacher } = useCurrentTeacher() as any;
  const [filterStatus, setFilterStatus] = useState<string | null>(DEFAULT_LIST_LEAVE_STATUSES);
  const [datePreset, setDatePreset] = useState<LeaveListDatePreset>("all");
  const [customDateRange, setCustomDateRange] = useState(() => defaultCustomDateRange());
  const { leaveFrom, leaveTo } = useMemo(
    () => getLeaveListDateBounds(datePreset, customDateRange),
    [datePreset, customDateRange]
  );
  const [filterLeaveTypeId, setFilterLeaveTypeId] = useState<string | null>(null);
  const [filterApplicantType, setFilterApplicantType] = useState<string>("both");
  const [filterDepartmentId, setFilterDepartmentId] = useState<string | null>(null);
  const [filterDesignationId, setFilterDesignationId] = useState<string | null>(null);
  const [filterClassId, setFilterClassId] = useState<string | null>(null);
  const [filterSectionId, setFilterSectionId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { leaveTypes } = useLeaveTypes();
  const { departments } = useDepartments();
  const { designations } = useDesignations();
  const selectedClassId = Number(filterClassId);
  const selectedSectionId = Number(filterSectionId);
  const selectedLeaveTypeId = Number(filterLeaveTypeId);
  const selectedDepartmentId = Number(filterDepartmentId);
  const selectedDesignationId = Number(filterDesignationId);
  const { classes } = useClasses(academicYearId ?? null);
  const { sections } = useSections(
    Number.isFinite(selectedClassId) && selectedClassId > 0 ? selectedClassId : null,
    { fetchAllWhenNoClass: false, academicYearId: academicYearId ?? null }
  );
  const classOptions = useMemo(
    () =>
      (Array.isArray(classes) ? classes : []).map((c: any) => ({
        value: String(c.id),
        label: c.class_code ? `${c.class_name || `Class ${c.id}`} (${c.class_code})` : (c.class_name || `Class ${c.id}`),
      })),
    [classes]
  );
  const sectionOptions = useMemo(
    () =>
      (Array.isArray(sections) ? sections : []).map((s: any) => ({
        value: String(s.id),
        label: s.section_name || `Section ${s.id}`,
      })),
    [sections]
  );
  const leaveTypeOptions = useMemo(() => {
    const source = leaveTypes.length > 0 ? leaveTypes : leaveType;
    const mapped = (Array.isArray(source) ? source : []).map((item: any) => ({
      value: String(item.value ?? item.id ?? ""),
      label: String(item.label ?? item.leave_type ?? item.name ?? "Leave Type"),
    }));
    return [{ value: "all", label: "All" }, ...mapped];
  }, [leaveTypes]);
  const departmentOptions = useMemo(
    () =>
      (Array.isArray(departments) ? departments : []).map((item: any) => ({
        value: String(item.originalData?.id ?? item.id ?? ""),
        label: String(item.department ?? item.originalData?.department_name ?? item.originalData?.name ?? "Department"),
      })),
    [departments]
  );
  const designationOptions = useMemo(
    () =>
      (Array.isArray(designations) ? designations : []).map((item: any) => ({
        value: String(item.originalData?.id ?? item.id ?? ""),
        label: String(item.designation ?? item.originalData?.designation_name ?? item.originalData?.name ?? "Designation"),
      })),
    [designations]
  );
  const { leaveApplications, loading: leaveLoading, error: leaveError, refetch: refetchLeaves } = useLeaveApplications({
    limit: 200,
    page: 1,
    pageSize: 200,
    canUseAdminList,
    studentOnly: isOwnLeavesOnly,
    status: filterStatus != null && String(filterStatus).trim() !== "" ? String(filterStatus).toLowerCase() : null,
    leaveTypeId: Number.isFinite(selectedLeaveTypeId) && selectedLeaveTypeId > 0 ? selectedLeaveTypeId : null,
    applicantType: filterApplicantType === "both" ? null : filterApplicantType,
    departmentId: Number.isFinite(selectedDepartmentId) && selectedDepartmentId > 0 ? selectedDepartmentId : null,
    designationId: Number.isFinite(selectedDesignationId) && selectedDesignationId > 0 ? selectedDesignationId : null,
    classId: Number.isFinite(selectedClassId) && selectedClassId > 0 ? selectedClassId : null,
    sectionId: Number.isFinite(selectedSectionId) && selectedSectionId > 0 ? selectedSectionId : null,
    academicYearId: academicYearId ?? null,
    leaveFrom,
    leaveTo,
    // Most-recently submitted first; avoids hiding older decided leaves when LIMIT is applied
    // (sorting only by start_date desc surfaces far-future dates first and drops past rows).
    sortBy: "created_at",
    sortOrder,
  }) as any;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const handleApplyClick = () => {
    if (dropdownMenuRef.current) {
      dropdownMenuRef.current.classList.remove("show");
    }
  };

  const handleCancelLeave = async (id: number) => {
    if (!window.confirm("Are you sure you want to cancel this leave application?")) return;
    try {
      const res = await apiService.cancelLeaveApplication(id);
      if (res?.status === "SUCCESS") {
        refetchLeaves();
      } else {
        alert(res?.message || "Failed to cancel leave application.");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to cancel leave application.");
    }
  };

  const data = useMemo(() => {
    if (!Array.isArray(leaveApplications)) return [];
    return leaveApplications.map((row) => ({
      key: row.key ?? String(row.id),
      id: row.id,
      submittedBy: row.name ?? "—",
      leaveType: row.leaveType ?? "—",
      role: row.role ?? "—",
      leaveDate: row.leaveRange ?? row.leaveDate ?? "—",
      noofDays: row.noOfDays ?? "—",
      appliedOn: row.appliedOn ?? "—",
      status: row.status ?? "Pending",
    }));
  }, [leaveApplications]);

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (id: number) => (
        <Link to="#" className="link-primary">{id ?? "—"}</Link>
      ),
    },
    {
      title: "Submitted By",
      dataIndex: "submittedBy",
      sorter: (a: TableData, b: TableData) => String(a?.submittedBy ?? "").localeCompare(String(b?.submittedBy ?? "")),
    },
    {
      title: "Leave Type",
      dataIndex: "leaveType",
      sorter: (a: TableData, b: TableData) => String(a?.leaveType ?? "").length - String(b?.leaveType ?? "").length,
    },
    {
      title: "Role",
      dataIndex: "role",
    },
    {
      title: "Leave Date",
      dataIndex: "leaveDate",
    },
    {
      title: "No of Days",
      dataIndex: "noofDays",
    },
    {
      title: "Applied On",
      dataIndex: "appliedOn",
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => {
        const t = (text ?? "").toString();
        const lo = t.toLowerCase();
        const isApproved = lo.includes("approv") || lo === "accept" || lo === "accepted";
        const isRejected =
          lo.includes("reject") || lo.includes("declin") || lo.includes("denied") || lo.includes("deny");
        const badgeClass = isApproved ? "badge-soft-success" : isRejected ? "badge-soft-danger" : "badge-soft-pending";
        const label = t ? t.charAt(0).toUpperCase() + t.slice(1) : "Pending";
        return (
          <span className={`badge ${badgeClass} d-inline-flex align-items-center`}>
            <i className="ti ti-circle-filled fs-5 me-1" />
            {label}
          </span>
        );
      },
      sorter: (a: any, b: any) => String(a?.status ?? "").length - String(b?.status ?? "").length,
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: any, record: any) => (
        <div className="d-flex align-items-center">
          {record.status === "pending" && 
           isTeacher && 
           Number(record.staffId) === Number(currentTeacher?.id || currentUser?.staff_id) && (
            <Link
              to="#"
              className="btn btn-icon btn-sm btn-soft-danger"
              onClick={(e) => {
                e.preventDefault();
                handleCancelLeave(record.id);
              }}
              title="Cancel Leave"
            >
              <i className="ti ti-trash" />
            </Link>
          )}
        </div>
      ),
    },
  ];

  const exportHeaders = ["ID", "Submitted By", "Leave Type", "Role", "Leave Date", "No of Days", "Applied On", "Status"];
  const exportRows = useMemo(
    () =>
      data.map((row: any) => [
        row.id ?? "—",
        row.submittedBy ?? "—",
        row.leaveType ?? "—",
        row.role ?? "—",
        row.leaveDate ?? "—",
        row.noofDays ?? "—",
        row.appliedOn ?? "—",
        row.status ?? "—",
      ]),
    [data]
  );

  const downloadCsv = (filename: string) => {
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [exportHeaders, ...exportRows].map((r) => r.map(escape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printTable = () => {
    const htmlRows = exportRows
      .map((r) => `<tr>${r.map((c) => `<td>${String(c ?? "")}</td>`).join("")}</tr>`)
      .join("");
    const printWindow = window.open("", "_blank", "width=1200,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>List of Leaves</title>
      <style>
        body{font-family:Arial,sans-serif;padding:16px}
        table{border-collapse:collapse;width:100%}
        th,td{border:1px solid #ddd;padding:8px;font-size:12px;text-align:left}
        th{background:#f5f5f5}
      </style></head><body>
      <h3>List of Leaves</h3>
      <table><thead><tr>${exportHeaders.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${htmlRows}</tbody></table>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };
  return (
    <div>
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            {/* Page Header */}
            <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
              <div className="my-auto mb-2">
                <h3 className="page-title mb-1">List of Leaves</h3>
                <nav>
                  <ol className="breadcrumb mb-0">
                    <li className="breadcrumb-item">
                      <Link to={routes.adminDashboard}>Dashboard</Link>
                    </li>
                    <li className="breadcrumb-item">
                      <Link to="#">HRM</Link>
                    </li>
                    <li className="breadcrumb-item active" aria-current="page">
                      List of Leaves
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
                <TooltipOption
                  onRefresh={() => refetchLeaves()}
                  onPrint={printTable}
                  onExportPdf={printTable}
                  onExportExcel={() => downloadCsv("list-of-leaves.csv")}
                />
                {isTeacher && (
                  <Link
                    to="#"
                    className="btn btn-primary d-flex align-items-center ms-2"
                    data-bs-toggle="modal"
                    data-bs-target="#apply_leave_teacher"
                  >
                    <i className="ti ti-square-rounded-plus me-2" />
                    Apply Leave
                  </Link>
                )}
              </div>
            </div>
            {/* /Page Header */}
            {/* Filter Section */}
            <div className="card">
              <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                <h4 className="mb-3">Leave List</h4>
                <div className="d-flex align-items-center flex-wrap">
                  <div className="input-icon-start mb-3 me-2 position-relative">
                    <LeaveListDateRangeFilter
                      preset={datePreset}
                      onPresetChange={setDatePreset}
                      customRange={customDateRange}
                      onCustomRangeChange={setCustomDateRange}
                    />
                  </div>
                  <div className="dropdown mb-3 me-2">
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                      data-bs-auto-close="outside"
                    >
                      <i className="ti ti-filter me-2" />
                      Filter
                    </Link>
                    <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                      <form>
                        <div className="d-flex align-items-center border-bottom p-3">
                          <h4>Filter</h4>
                        </div>
                        <div className="p-3 border-bottom">
                          <div className="row">
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Leave Type</label>
                                <CommonSelect
                                  className="select"
                                  options={leaveTypeOptions}
                                  value={filterLeaveTypeId ?? "all"}
                                  onChange={(value) => setFilterLeaveTypeId(value === "all" ? null : value)}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Applicant</label>
                                <CommonSelect
                                  className="select"
                                  options={APPLICANT_TYPE_OPTIONS}
                                  value={filterApplicantType}
                                  onChange={(value) => setFilterApplicantType(value || "both")}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-0">
                                <label className="form-label">Status</label>
                                <CommonSelect
                                  className="select"
                                  options={LEAVE_STATUS_OPTIONS}
                                  value={filterStatus ?? DEFAULT_LIST_LEAVE_STATUSES}
                                  onChange={(value) => setFilterStatus(value || DEFAULT_LIST_LEAVE_STATUSES)}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3 mt-3">
                                <label className="form-label">Department</label>
                                <CommonSelect
                                  className="select"
                                  options={departmentOptions}
                                  value={filterDepartmentId}
                                  onChange={(value) => setFilterDepartmentId(value)}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Designation</label>
                                <CommonSelect
                                  className="select"
                                  options={designationOptions}
                                  value={filterDesignationId}
                                  onChange={(value) => setFilterDesignationId(value)}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-3">
                                <label className="form-label">Class</label>
                                <CommonSelect
                                  className="select"
                                  options={classOptions}
                                  value={filterClassId}
                                  onChange={(value) => {
                                    setFilterClassId(value);
                                    setFilterSectionId(null);
                                  }}
                                />
                              </div>
                            </div>
                            <div className="col-md-12">
                              <div className="mb-0">
                                <label className="form-label">Section</label>
                                <CommonSelect
                                  className="select"
                                  options={sectionOptions}
                                  value={filterSectionId}
                                  isDisabled={!filterClassId}
                                  placeholder={filterClassId ? "Select section" : "Select class first"}
                                  onChange={(value) => setFilterSectionId(value)}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="p-3 d-flex align-items-center justify-content-end">
                          <Link
                            to="#"
                            className="btn btn-light me-3"
                            onClick={() => {
                              setFilterLeaveTypeId(null);
                              setFilterApplicantType("both");
                              setFilterStatus(DEFAULT_LIST_LEAVE_STATUSES);
                              setFilterDepartmentId(null);
                              setFilterDesignationId(null);
                              setFilterClassId(null);
                              setFilterSectionId(null);
                              setDatePreset("all");
                              setCustomDateRange(defaultCustomDateRange());
                            }}
                          >
                            Reset
                          </Link>
                          <Link to="#" className="btn btn-primary" onClick={handleApplyClick}>
                            Apply
                          </Link>
                        </div>
                      </form>
                    </div>
                  </div>
                  <div className="dropdown mb-3">
                    <Link
                      to="#"
                      className="btn btn-outline-light bg-white dropdown-toggle"
                      data-bs-toggle="dropdown" data-bs-boundary="viewport" data-bs-popper-config='{"strategy":"fixed"}'
                    >
                      <i className="ti ti-sort-ascending-2 me-2" />
                      Sort by A-Z
                    </Link>
                    <ul className="dropdown-menu p-3">
                      <li>
                        <Link
                          to="#"
                          className={`dropdown-item rounded-1 ${sortOrder === "asc" ? "active" : ""}`}
                          onClick={() => setSortOrder("asc")}
                        >
                          Ascending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className={`dropdown-item rounded-1 ${sortOrder === "desc" ? "active" : ""}`}
                          onClick={() => setSortOrder("desc")}
                        >
                          Descending
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Viewed
                        </Link>
                      </li>
                      <li>
                        <Link
                          to="#"
                          className="dropdown-item rounded-1"
                        >
                          Recently Added
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
              <div className="card-body p-0 py-3">
                {leaveError && (
                  <div className="alert alert-danger mx-3 mt-3 mb-0" role="alert">
                    {leaveError}
                  </div>
                )}
                {leaveLoading ? (
                  <div className="text-center py-5">
                    <div className="spinner-border text-primary" role="status">
                      <span className="visually-hidden">Loading...</span>
                    </div>
                    <p className="mt-2 mb-0">Loading leave applications...</p>
                  </div>
                ) : (
                  <>
                    {/* List Leaves List */}
                    <Table columns={columns} dataSource={data} Selection={true} />
                    {/* / List Leaves List */}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* /Page Wrapper */}
        <TeacherModal
          staffId={currentTeacher?.id || currentUser?.staff_id}
          onLeaveApplied={() => refetchLeaves()}
        />
      </>
    </div>
  );
};

export default ListLeaves;





