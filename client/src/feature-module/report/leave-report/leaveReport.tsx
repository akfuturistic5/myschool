import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import Table from "../../../core/common/dataTable/index";
import { useSelector } from "react-redux";
import type { TableData } from "../../../core/data/interface";
import {
  classes,
  sections,
} from "../../../core/common/selectoption/selectoption";
import CommonSelect from "../../../core/common/commonSelect";
import PredefinedDateRanges from "../../../core/common/datePicker";
import TooltipOption from "../../../core/common/tooltipOption";
import { all_routes } from "../../router/all_routes";
import { useStudents } from "../../../core/hooks/useStudents";
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";
import { apiService } from "../../../core/services/apiService";
import { selectUser } from "../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { isAdministrativeRole, isHeadmasterRole } from "../../../core/utils/roleUtils";

const compareText = (left: unknown, right: unknown) =>
  String(left ?? "").localeCompare(String(right ?? ""));

const compareNumber = (left: unknown, right: unknown) =>
  Number(left ?? 0) - Number(right ?? 0);

const LeaveReport = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const canUseAdminList = isHeadmasterRole(user);
  const isOwnLeavesOnly = isAdministrativeRole(user);
  const { students, loading: studentsLoading, error: studentsError } = useStudents();
  const {
    leaveApplications,
    loading: applicationsLoading,
    error: applicationsError,
  } = useLeaveApplications({
    limit: 500,
    canUseAdminList,
    studentOnly: isOwnLeavesOnly,
    academicYearId,
  });
  const [leaveTypes, setLeaveTypes] = useState<any[]>([]);
  const [leaveTypesLoading, setLeaveTypesLoading] = useState(true);
  const [leaveTypesError, setLeaveTypesError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchLeaveTypes = async () => {
      try {
        setLeaveTypesLoading(true);
        setLeaveTypesError(null);
        const res = await apiService.getLeaveTypes();
        const rows = Array.isArray(res?.data) ? res.data : [];
        if (!cancelled) {
          setLeaveTypes(rows);
        }
      } catch (err: any) {
        if (!cancelled) {
          setLeaveTypes([]);
          setLeaveTypesError(err?.message || "Failed to fetch leave types");
        }
      } finally {
        if (!cancelled) {
          setLeaveTypesLoading(false);
        }
      }
    };

    fetchLeaveTypes();

    return () => {
      cancelled = true;
    };
  }, []);

  const leaveTypeConfig = useMemo(() => {
    const defaults = {
      medical: { title: "Medical Leave", max: 10 },
      casual: { title: "Casual Leave", max: 12 },
      maternity: { title: "Maternity Leave", max: 90 },
      paternity: { title: "Paternity Leave", max: 15 },
      special: { title: "Special Leave", max: 5 },
    };

    const byName = new Map<string, number>();
    (Array.isArray(leaveTypes) ? leaveTypes : []).forEach((type: any) => {
      const key = String(type.leave_type || "").trim().toLowerCase();
      if (!key) return;
      const max = Number(type.max_days_per_year ?? 0);
      byName.set(key, Number.isFinite(max) && max > 0 ? max : 0);
    });

    return {
      medical: { ...defaults.medical, max: byName.get("medical leave") || defaults.medical.max },
      casual: { ...defaults.casual, max: byName.get("casual leave") || defaults.casual.max },
      maternity: { ...defaults.maternity, max: byName.get("maternity leave") || defaults.maternity.max },
      paternity: { ...defaults.paternity, max: byName.get("paternity leave") || defaults.paternity.max },
      special: { ...defaults.special, max: byName.get("special leave") || defaults.special.max },
    };
  }, [leaveTypes]);

  const data = useMemo(() => {
    const applicationRows = Array.isArray(leaveApplications) ? leaveApplications : [];

    const usageByStudent = new Map<
      number,
      { medical: number; casual: number; maternity: number; paternity: number; special: number }
    >();

    applicationRows.forEach((application: any) => {
      const studentId = Number(application.studentId);
      if (!Number.isFinite(studentId)) return;
      const leaveType = String(application.leaveType || application.leave_type_name || "").toLowerCase();
      const noOfDays = Number(application.noOfDays ?? application.no_of_days ?? 0);
      const days = Number.isFinite(noOfDays) && noOfDays > 0 ? noOfDays : 0;
      const usage = usageByStudent.get(studentId) || {
        medical: 0,
        casual: 0,
        maternity: 0,
        paternity: 0,
        special: 0,
      };

      if (leaveType.includes("medical")) usage.medical += days;
      if (leaveType.includes("casual")) usage.casual += days;
      if (leaveType.includes("maternity")) usage.maternity += days;
      if (leaveType.includes("paternity")) usage.paternity += days;
      if (leaveType.includes("special")) usage.special += days;

      usageByStudent.set(studentId, usage);
    });

    return (Array.isArray(students) ? students : []).map((student: any, index: number) => {
      const usage = usageByStudent.get(Number(student.id)) || {
        medical: 0,
        casual: 0,
        maternity: 0,
        paternity: 0,
        special: 0,
      };

      return {
        key: student.admission_number || student.id || `leave-report-${index}`,
        studentId: student.id,
        admissionNo: student.admission_number || "—",
        studentName: `${student.first_name || ""} ${student.last_name || ""}`.trim() || "—",
        rollNo: student.roll_number || "—",
        avatar: student.photo_url || "",
        gender: student.gender || "",
        medicalUsed: usage.medical,
        medicalAvailable: Math.max(leaveTypeConfig.medical.max - usage.medical, 0),
        casualUsed: usage.casual,
        casualAvailable: Math.max(leaveTypeConfig.casual.max - usage.casual, 0),
        maternityUsed: usage.maternity,
        maternityAvailable: Math.max(leaveTypeConfig.maternity.max - usage.maternity, 0),
        paternityUsed: usage.paternity,
        paternityAvailable: Math.max(leaveTypeConfig.paternity.max - usage.paternity, 0),
        specialUsed: usage.special,
        specialAvailable: Math.max(leaveTypeConfig.special.max - usage.special, 0),
      };
    });
  }, [leaveApplications, leaveTypeConfig, students]);
  const columns = [
    {
      title: "",
      children: [
        {
          title: "Admission No",
          dataIndex: "admissionNo",
          key: "admissionNo",
          sorter: (a: TableData, b: TableData) => compareText(a?.admissionNo, b?.admissionNo),
          render: (text: any) => (
            <Link to="#" className="link-primary">
              {text}
            </Link>
          ),
        },
      ],
    },
    {
      title: "",
      children: [
        {
          title: "Student Name",
          dataIndex: "studentName",
          key: "studentName",
          render: (text: any, record: any) => (
            <div className="d-flex align-items-center">
              <Link to={routes.studentDetail} className="avatar avatar-md">
                <ImageWithBasePath src={record.avatar} alt="avatar" className="img-fluid rounded-circle" gender={record.gender} />
              </Link>
              <div className="ms-2">
                <p className="text-dark mb-0">
                  <Link to={routes.studentDetail}>{text}</Link>
                </p>
                <span className="fs-12">Roll No : {record.rollNo}</span>
              </div>
            </div>
          ),
          sorter: (a: TableData, b: TableData) => compareText(a?.studentName, b?.studentName),
        },
      ],
    },
    {
      title: `Medical Leave(${leaveTypeConfig.medical.max})`,
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
      title: `Casual Leave(${leaveTypeConfig.casual.max})`,
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
      title: `Maternity Leave(${leaveTypeConfig.maternity.max})`,
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
      title: `Paternity Leave(${leaveTypeConfig.paternity.max})`,
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
      title: `Special Leave(${leaveTypeConfig.special.max})`,
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
  ];

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
              <TooltipOption />
            </div>
          </div>
          {/* /Page Header */}
          {/* Student List */}
          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Leave Report List</h4>
              <div className="d-flex align-items-center flex-wrap">
                <div className="input-icon-start mb-3 me-2 position-relative">
                  <PredefinedDateRanges />
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
                  <div className="dropdown-menu drop-width">
                    <form>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4>Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <div className="row">
                          <div className="col-md-12">
                            <div className="mb-3">
                              <label className="form-label">Class</label>
                              <CommonSelect
                                className="select"
                                options={classes}
                                defaultValue={classes[0]}
                              />
                            </div>
                          </div>
                          <div className="col-md-12">
                            <div className="mb-0">
                              <label className="form-label">Section</label>
                              <CommonSelect
                                className="select"
                                options={sections}
                                defaultValue={sections[0]}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <Link to="#" className="btn btn-light me-3">
                          Reset
                        </Link>
                        <button type="submit" className="btn btn-primary">
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
                <div className="dropdown mb-3">
                  <Link
                    to="#"
                    className="btn btn-outline-light bg-white dropdown-toggle"
                    data-bs-toggle="dropdown"
                  >
                    <i className="ti ti-sort-ascending-2 me-2" />
                    Sort by A-Z
                  </Link>
                  <ul className="dropdown-menu p-3">
                    <li>
                      <Link to="#" className="dropdown-item rounded-1 active">
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
              ) : (
                <>
                  {/* Student List */}
                  <Table dataSource={data} columns={columns} />
                  {/* /Student List */}
                </>
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
