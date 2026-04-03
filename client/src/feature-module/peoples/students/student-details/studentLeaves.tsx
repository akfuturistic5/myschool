
import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { all_routes } from "../../../router/all_routes";
import StudentModals from "../studentModals";
import StudentSidebar from "./studentSidebar";
import StudentBreadcrumb from "./studentBreadcrumb";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";
import { useGuardianWardLeaves } from "../../../../core/hooks/useGuardianWardLeaves";
import { useStudentAttendance } from "../../../../core/hooks/useStudentAttendance";
import { useAcademicYears } from "../../../../core/hooks/useAcademicYears";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";

interface StudentDetailsLocationState {
  studentId?: number;
  student?: any;
}

// Custom styles for table
const tableStyles = `
  .ant-table-wrapper .ant-table-thead > tr > th {
    background: #f2f4f8 !important;
    color: #262A2A !important;
    font-weight: 500 !important;
    border-bottom: 1px solid #E8E8E8 !important;
    padding: 12px 20px !important;
  }
  
  .ant-table-wrapper .ant-table-tbody > tr > td {
    color: #6F6F6F !important;
    border-bottom: 1px solid #E8E8E8 !important;
    padding: 12px 20px !important;
  }
  
  .ant-table-wrapper .ant-table-tbody > tr:hover > td {
    background: #f8f9fa !important;
  }
  
  .ant-table-wrapper .ant-table {
    border: 1px solid #E8E8E8 !important;
    border-radius: 6px !important;
  }
  
  .badge-soft-success {
    background-color: rgba(40, 167, 69, 0.1) !important;
    color: #28a745 !important;
  }
  
  .badge-soft-danger {
    background-color: rgba(220, 53, 69, 0.1) !important;
    color: #dc3545 !important;
  }
  
  .badge-soft-warning {
    background-color: rgba(255, 193, 7, 0.1) !important;
    color: #ffc107 !important;
  }
`;

const StudentLeaves = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as StudentDetailsLocationState | null;
  const { studentId, student, loading, role } = useLinkedStudentContext({
    locationState: state,
  });
  const { academicYears } = useAcademicYears();
  const currentAcademicYear =
    (academicYears || []).find((year: { is_current?: boolean }) => year?.is_current) ??
    (academicYears || [])[0] ??
    null;

  // studentOnly = student; parentChildren = parent; studentId+canUseAdminList = admin/teacher
  // canUseAdminList: avoid 403 when role loading - never call admin endpoint until role is confirmed
  const canUseAdminList = role === "admin" || role === "teacher";
  const { leaveApplications: leaveList, loading: leaveLoading, refetch: refetchLeaves } = useLeaveApplications({
    limit: 50,
    parentChildren: role === "parent",
    studentOnly: role === "student",
    studentId: (role === "parent" || canUseAdminList) && studentId != null ? studentId : null,
    canUseAdminList,
  });

  const { leaveApplications: guardianLeaves, loading: guardianLoading, refetch: refetchGuardianLeaves } = useGuardianWardLeaves({
    limit: 50,
    studentId: studentId && role === "guardian" ? studentId : null,
  });

  const data = useMemo(() => {
    if (role === "guardian") return guardianLeaves;
    return leaveList;
  }, [role, leaveList, guardianLeaves]);

  const leaveDataLoading = role === "guardian" ? guardianLoading : leaveLoading;
  const refetchLeaveData = role === "guardian" ? refetchGuardianLeaves : refetchLeaves;

  const { data: attendanceData, loading: attendanceLoading, error: attendanceError, refetch: refetchAttendance } = useStudentAttendance(studentId ?? null);

  const leaveCounts = useMemo(() => {
    const medical = data.filter((l: { leaveType?: string }) => String(l.leaveType || "").toLowerCase().includes("medical"));
    const casual = data.filter((l: { leaveType?: string }) => String(l.leaveType || "").toLowerCase().includes("casual"));
    const maternity = data.filter((l: { leaveType?: string }) => String(l.leaveType || "").toLowerCase().includes("maternity"));
    const paternity = data.filter((l: { leaveType?: string }) => String(l.leaveType || "").toLowerCase().includes("paternity"));
    return { medical: medical.length, casual: casual.length, maternity: maternity.length, paternity: paternity.length };
  }, [data]);

  const attendanceRecords = attendanceData?.records ?? [];
  const attendanceSummary = attendanceData?.summary ?? { present: 0, absent: 0, halfDay: 0, late: 0 };
  const hasAttendance = attendanceRecords.length > 0;

  const showLoading = loading;
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
  
  const columns = [
    {
      title: "Leave Type",
      dataIndex: "leaveType",
      sorter: (a: TableData, b: TableData) =>
        a.leaveType.length - b.leaveType.length,
    },
    {
      title: "Leave Date",
      dataIndex: "leaveDate",
      sorter: (a: TableData, b: TableData) =>
        a.leaveDate.length - b.leaveDate.length,
    },
    {
      title: "No of Days",
      dataIndex: "noOfDays",
      sorter: (a: TableData, b: TableData) =>
        parseFloat(a.noOfDays) - parseFloat(b.noOfDays),
    },
    {
      title: "Applied On",
      dataIndex: "appliedOn",
      sorter: (a: TableData, b: TableData) =>
        a.appliedOn.length - b.appliedOn.length,
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => (
        <>
          {text === "Approved" ? (
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
      sorter: (a: TableData, b: TableData) => a.status.length - b.status.length,
    },
  ];
  const attendanceTableColumns = [
    {
      title: "Date",
      dataIndex: "attendanceDate",
      render: (val: string) => (val ? new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—"),
      sorter: (a: TableData & { attendanceDate?: string }, b: TableData & { attendanceDate?: string }) =>
        (a.attendanceDate || "").localeCompare(b.attendanceDate || ""),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => {
        const s = (text || "").toLowerCase();
        const badgeClass =
          s === "present" ? "badge-soft-success" :
          s === "absent" ? "badge-soft-danger" :
          s === "late" ? "badge-soft-warning" :
          s === "half_day" || s === "halfday" ? "badge-soft-info" : "badge-soft-secondary";
        const label = s ? s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ") : "—";
        return (
          <span className={`badge ${badgeClass} d-inline-flex align-items-center`}>
            <i className="ti ti-circle-filled fs-5 me-1" />
            {label}
          </span>
        );
      },
      sorter: (a: TableData, b: TableData) => (a.status || "").length - (b.status || "").length,
    },
    {
      title: "Check In",
      dataIndex: "checkInTime",
      render: (val: string) => (val ? String(val).slice(0, 5) : "—"),
    },
    {
      title: "Check Out",
      dataIndex: "checkOutTime",
      render: (val: string) => (val ? String(val).slice(0, 5) : "—"),
    },
  ];

  const attendanceTableData = attendanceRecords.map((r: { id?: number; attendanceDate?: string; status?: string; checkInTime?: string; checkOutTime?: string }, idx: number) => ({
    key: r.id ?? idx,
    ...r,
  }));
  return (
    <>
      <style>{tableStyles}</style>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            {/* Page Header */}
            <StudentBreadcrumb />
            {/* /Page Header */}
          </div>
          <div className="row">
            {/* Student Information */}
            <StudentSidebar student={student} />
            {/* /Student Information */}
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  {/* List */}
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={routes.studentDetail}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-school me-2" />
                        Student Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentTimeTable}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-table-options me-2" />
                        Time Table
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentLeaves}
                        className="nav-link active"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentFees}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-report-money me-2" />
                        Fees
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentResult}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Exam &amp; Results
                      </Link>
                    </li>
                  </ul>
                  {/* /List */}
                  {/* Leave Nav*/}
                  <div className="card">
                    <div className="card-body pb-1">
                      <ul className="nav nav-tabs nav-tabs-solid nav-tabs-rounded-fill">
                        <li className="me-3 mb-3">
                          <Link
                            to="#"
                            className="nav-link active rounded fs-12 fw-semibold"
                            data-bs-toggle="tab"
                            data-bs-target="#leave"
                          >
                            Leaves
                          </Link>
                        </li>
                        <li className="mb-3">
                          <Link
                            to="#"
                            className="nav-link rounded fs-12 fw-semibold"
                            data-bs-toggle="tab"
                            data-bs-target="#attendance"
                          >
                            Attendance
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                  {/* /Leave Nav*/}
                  <div className="tab-content">
                    {/* Leave */}
                    <div className="tab-pane fade show active" id="leave">
                      <div className="row gx-3">
                        <div className="col-lg-6 col-xxl-3 d-flex">
                          <div className="card flex-fill">
                            <div className="card-body">
                              <h5 className="mb-2">Medical Leave</h5>
                              <div className="d-flex align-items-center flex-wrap">
                                <p className="border-end pe-2 me-2 mb-0">Used : {leaveCounts.medical}</p>
                                <p className="mb-0">Total : {leaveCounts.medical}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-6 col-xxl-3 d-flex">
                          <div className="card flex-fill">
                            <div className="card-body">
                              <h5 className="mb-2">Casual Leave</h5>
                              <div className="d-flex align-items-center flex-wrap">
                                <p className="border-end pe-2 me-2 mb-0">Used : {leaveCounts.casual}</p>
                                <p className="mb-0">Total : {leaveCounts.casual}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-6 col-xxl-3 d-flex">
                          <div className="card flex-fill">
                            <div className="card-body">
                              <h5 className="mb-2">Maternity Leave</h5>
                              <div className="d-flex align-items-center flex-wrap">
                                <p className="border-end pe-2 me-2 mb-0">Used : {leaveCounts.maternity}</p>
                                <p className="mb-0">Total : {leaveCounts.maternity}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-6 col-xxl-3 d-flex">
                          <div className="card flex-fill">
                            <div className="card-body">
                              <h5 className="mb-2">Paternity Leave</h5>
                              <div className="d-flex align-items-center flex-wrap">
                                <p className="border-end pe-2 me-2 mb-0">Used : {leaveCounts.paternity}</p>
                                <p className="mb-0">Total : {leaveCounts.paternity}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                          <h4 className="mb-3">Leaves</h4>
                          <Link
                            to="#"
                            data-bs-target="#apply_leave"
                            data-bs-toggle="modal"
                            className="btn btn-primary d-inline-flex align-items-center mb-3"
                          >
                            <i className="ti ti-calendar-event me-2" />
                            Apply Leave
                          </Link>
                        </div>
                        {/* Leaves List */}
                        <div className="card-body p-0 py-3">
                          {leaveDataLoading && (
                          <div className="p-4 text-center text-muted">Loading leave data...</div>
                        )}
                        {!leaveDataLoading && (
                          <Table
                            dataSource={data}
                            columns={columns}
                            Selection={false}
                          />
                        )}
                        </div>
                        {/* /Leaves List */}
                      </div>
                    </div>
                    {/* /Leave */}
                    {/* Attendance */}
                    <div className="tab-pane fade" id="attendance">
                      <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-1">
                          <h4 className="mb-3">Attendance</h4>
                          <div className="d-flex align-items-center flex-wrap">
                            <div className="d-flex align-items-center flex-wrap me-3">
                              <p className="text-dark mb-3 me-2">
                                {hasAttendance && attendanceRecords[0]?.attendanceDate
                                  ? `Last Updated on : ${new Date(attendanceRecords[0].attendanceDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
                                  : "Last Updated : —"}
                              </p>
                              <Link
                                to="#"
                                className="btn btn-primary btn-icon btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 mb-3"
                                onClick={(e) => {
                                  e.preventDefault();
                                  refetchAttendance();
                                }}
                              >
                                <i className="ti ti-refresh-dot" />
                              </Link>
                            </div>
                            <span className="badge badge-soft-primary mb-3">
                              {currentAcademicYear?.year_name ? `Academic Year: ${currentAcademicYear.year_name}` : "Academic Year not available"}
                            </span>
                          </div>
                        </div>
                        <div className="card-body pb-1">
                          {attendanceError && (
                            <div className="alert alert-warning mb-3 d-flex align-items-center" role="alert">
                              <i className="ti ti-alert-circle me-2 fs-18" />
                              <span>{attendanceError}</span>
                            </div>
                          )}
                          {attendanceLoading && (
                            <div className="text-center py-3">
                              <div className="spinner-border spinner-border-sm text-primary" role="status" />
                              <span className="ms-2">Loading attendance...</span>
                            </div>
                          )}
                          {!attendanceLoading && !hasAttendance && (
                            <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                              <i className="ti ti-info-circle me-2 fs-18" />
                              <span>No attendance data available. Attendance records will appear here once available.</span>
                            </div>
                          )}
                          {!attendanceLoading && hasAttendance && (
                          <div className="row">
                            {/* Total Present */}
                            <div className="col-md-6 col-xxl-3 d-flex">
                              <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                                <span className="avatar avatar-lg bg-primary-transparent rounded me-2 flex-shrink-0 text-primary">
                                  <i className="ti ti-user-check fs-24" />
                                </span>
                                <div className="ms-2">
                                  <p className="mb-1">Present</p>
                                  <h5>{attendanceSummary.present}</h5>
                                </div>
                              </div>
                            </div>
                            {/* /Total Present */}
                            {/* Total Absent */}
                            <div className="col-md-6 col-xxl-3 d-flex">
                              <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                                <span className="avatar avatar-lg bg-danger-transparent rounded me-2 flex-shrink-0 text-danger">
                                  <i className="ti ti-user-check fs-24" />
                                </span>
                                <div className="ms-2">
                                  <p className="mb-1">Absent</p>
                                  <h5>{attendanceSummary.absent}</h5>
                                </div>
                              </div>
                            </div>
                            {/* /Total Absent */}
                            {/* Half Day */}
                            <div className="col-md-6 col-xxl-3 d-flex">
                              <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                                <span className="avatar avatar-lg bg-info-transparent rounded me-2 flex-shrink-0 text-info">
                                  <i className="ti ti-user-check fs-24" />
                                </span>
                                <div className="ms-2">
                                  <p className="mb-1">Half Day</p>
                                  <h5>{attendanceSummary.halfDay}</h5>
                                </div>
                              </div>
                            </div>
                            {/* /Half Day */}
                            {/* Late to School*/}
                            <div className="col-md-6 col-xxl-3 d-flex">
                              <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                                <span className="avatar avatar-lg bg-warning-transparent rounded me-2 flex-shrink-0 text-warning">
                                  <i className="ti ti-user-check fs-24" />
                                </span>
                                <div className="ms-2">
                                  <p className="mb-1">Late</p>
                                  <h5>{attendanceSummary.late}</h5>
                                </div>
                              </div>
                            </div>
                            {/* /Late to School*/}
                          </div>
                          )}
                        </div>
                      </div>
                      <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-1">
                          <h4 className="mb-3">Leave &amp; Attendance</h4>
                          <p className="text-muted mb-3">
                            Showing real attendance records for the selected student.
                          </p>
                        </div>
                        <div className="card-body p-0 py-3">
                          <div className="px-3">
                            <div className="d-flex align-items-center flex-wrap">
                              <div className="d-flex align-items-center bg-white border rounded p-2 me-3 mb-3">
                                <span className="avatar avatar-sm bg-success rounded me-2 flex-shrink-0 ">
                                  <i className="ti ti-checks" />
                                </span>
                                <p className="text-dark">Present</p>
                              </div>
                              <div className="d-flex align-items-center bg-white border rounded p-2 me-3 mb-3">
                                <span className="avatar avatar-sm bg-danger rounded me-2 flex-shrink-0 ">
                                  <i className="ti ti-x" />
                                </span>
                                <p className="text-dark">Absent</p>
                              </div>
                              <div className="d-flex align-items-center bg-white border rounded p-2 me-3 mb-3">
                                <span className="avatar avatar-sm bg-pending rounded me-2 flex-shrink-0 ">
                                  <i className="ti ti-clock-x" />
                                </span>
                                <p className="text-dark">Late</p>
                              </div>
                              <div className="d-flex align-items-center bg-white border rounded p-2 me-3 mb-3">
                                <span className="avatar avatar-sm bg-dark rounded me-2 flex-shrink-0 ">
                                  <i className="ti ti-calendar-event" />
                                </span>
                                <p className="text-dark">Halfday</p>
                              </div>
                              <div className="d-flex align-items-center bg-white border rounded p-2 me-3 mb-3">
                                <span className="avatar avatar-sm bg-info rounded me-2 flex-shrink-0 ">
                                  <i className="ti ti-calendar-event" />
                                </span>
                                <p className="text-dark">Holiday</p>
                              </div>
                            </div>
                          </div>
                          {/* Attendance List */}
                          {attendanceLoading && (
                            <div className="p-4 text-center text-muted">Loading attendance records...</div>
                          )}
                          {!attendanceLoading && !hasAttendance && (
                            <div className="alert alert-info m-3 mb-0 d-flex align-items-center" role="alert">
                              <i className="ti ti-info-circle me-2 fs-18" />
                              <span>No attendance records available for this student.</span>
                            </div>
                          )}
                          {!attendanceLoading && hasAttendance && (
                            <Table
                              dataSource={attendanceTableData}
                              columns={attendanceTableColumns}
                              Selection={false}
                            />
                          )}
                          {/* /Attendance List */}
                        </div>
                      </div>
                    </div>
                    {/* /Attendance */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
      <StudentModals studentId={student?.id} onLeaveApplied={refetchLeaveData} />
    </>
  );
};

export default StudentLeaves;
