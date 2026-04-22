import { Link } from "react-router-dom";
import { useMemo, useState } from "react";
import { all_routes } from "../../../router/all_routes";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import AdministrativeSidebar from "./administrativeSidebar";
import AdministrativeBreadcrumb from "./administrativeBreadcrumb";
import { useAdministrativeStaffProfile } from "../../../../core/hooks/useAdministrativeStaffProfile";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";
import { useMyAttendance } from "../../../../core/hooks/useMyAttendance";

const AdministrativeLeave = () => {
  const routes = all_routes;
  const { staff, loading: profileLoading, error: profileError } =
    useAdministrativeStaffProfile();
  const { leaveApplications, loading: leaveLoading } = useLeaveApplications({
    studentOnly: true,
    limit: 50,
  });

  const profileState = staff ? { staffId: staff.id, staff } : undefined;

  const data = useMemo(() => {
    return leaveApplications.map((l) => ({
      ...l,
      leaveDate: l.leaveRange,
    }));
  }, [leaveApplications]);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data: myAttendanceData, loading: attendanceLoading, error: attendanceError } = useMyAttendance({
    days: 365,
    enabled: !!staff,
  });

  const attendanceRows = useMemo(() => {
    const baseRows = Array.isArray(myAttendanceData?.staff?.rows) ? myAttendanceData.staff.rows : [];
    const monthRows = baseRows
      .filter((r: any) => String(r?.attendance_date || "").slice(0, 7) === attendanceMonth)
      .sort((a: any, b: any) => String(b?.attendance_date || "").localeCompare(String(a?.attendance_date || "")));
    const byDate = new Map<string, any>();
    monthRows.forEach((row: any, idx: number) => {
      const d = String(row?.attendance_date || "").slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;
      byDate.set(d, {
        key: row?.id ?? `attendance-${idx}-${d}`,
        ...row,
        attendance_date: d,
      });
    });

    const [year, month] = String(attendanceMonth || "").split("-").map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return Array.from(byDate.values());
    }
    const startDate = new Date(`${attendanceMonth}-01T00:00:00`);
    const monthEnd = new Date(year, month, 0);
    const today = new Date();
    const until = monthEnd < today ? monthEnd : today;
    const cursor = new Date(startDate);
    while (cursor <= until) {
      const d = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      if (cursor.getDay() === 0) {
        const existing = byDate.get(d);
        byDate.set(d, {
          key: existing?.key ?? `weekly-holiday-${d}`,
          ...(existing || {}),
          attendance_date: d,
          status: "holiday",
          check_in_time: null,
          check_out_time: null,
          remark: "Weekly Holiday",
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    return Array.from(byDate.values()).sort((a: any, b: any) =>
      String(b?.attendance_date || "").localeCompare(String(a?.attendance_date || ""))
    );
  }, [myAttendanceData, attendanceMonth]);

  const attendanceSummary = useMemo(() => {
    return attendanceRows.reduce(
      (acc: { present: number; absent: number; late: number; half_day: number; holiday: number }, row: any) => {
        const status = String(row?.status || "").toLowerCase();
        if (status === "present") acc.present += 1;
        else if (status === "absent") acc.absent += 1;
        else if (status === "late") acc.late += 1;
        else if (status === "half_day" || status === "halfday") acc.half_day += 1;
        else if (status === "holiday") acc.holiday += 1;
        return acc;
      },
      { present: 0, absent: 0, late: 0, half_day: 0, holiday: 0 }
    );
  }, [attendanceRows]);

  const columns = [
    {
      title: "Leave Type",
      dataIndex: "leaveType",
      sorter: (a: TableData, b: TableData) =>
        String(a.leaveType).localeCompare(String(b.leaveType)),
    },
    {
      title: "Leave Date",
      dataIndex: "leaveDate",
      sorter: (a: TableData, b: TableData) =>
        String(a.leaveDate).localeCompare(String(b.leaveDate)),
    },
    {
      title: "No of Days",
      dataIndex: "noOfDays",
      sorter: (a: TableData, b: TableData) =>
        parseFloat(String(a.noOfDays)) - parseFloat(String(b.noOfDays)),
    },
    {
      title: "Applied On",
      dataIndex: "applyOn",
      sorter: (a: TableData, b: TableData) =>
        String(a.applyOn).localeCompare(String(b.applyOn)),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => {
        const t = String(text || "").toLowerCase();
        const ok = t.includes("approv");
        return (
          <span
            className={`badge ${ok ? "badge-soft-success" : "badge-soft-warning"} d-inline-flex align-items-center`}
          >
            <i className="ti ti-circle-filled fs-5 me-1" />
            {text || "Pending"}
          </span>
        );
      },
      sorter: (a: TableData, b: TableData) =>
        String(a.status).localeCompare(String(b.status)),
    },
  ];

  if (profileLoading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  if (profileError || !staff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-warning m-3" role="alert">
            <i className="ti ti-alert-circle me-2" />
            {profileError ||
              "Your profile could not be loaded. Open this page from the administrative dashboard."}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row">
          <AdministrativeBreadcrumb
            title="Administrative details"
            activeCrumb="Leave"
          />
        </div>
        <div className="row">
          <AdministrativeSidebar staff={staff} />
          <div className="col-xxl-9 col-xl-8">
            <div className="row">
              <div className="col-md-12">
                <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                  <li>
                    <Link
                      to={routes.administrativeDetails}
                      state={profileState}
                      className="nav-link"
                    >
                      <i className="ti ti-user me-2" />
                      Administrative details
                    </Link>
                  </li>
                  <li>
                    <Link
                      to={routes.administrativeLeaves}
                      state={profileState}
                      className="nav-link active"
                    >
                      <i className="ti ti-calendar-due me-2" />
                      Leave
                    </Link>
                  </li>
                </ul>
                <div className="card">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                    <h4 className="mb-3">My leave applications</h4>
                    <Link
                      to={routes.listLeaves}
                      className="btn btn-primary d-inline-flex align-items-center mb-3"
                    >
                      <i className="ti ti-calendar-event me-2" />
                      Open leave list
                    </Link>
                  </div>
                  <div className="card-body p-0 py-3">
                    {leaveLoading && (
                      <div className="p-4 text-center text-muted">
                        Loading leave data...
                      </div>
                    )}
                    {!leaveLoading && (
                      <Table
                        dataSource={data}
                        columns={columns}
                        Selection={false}
                      />
                    )}
                  </div>
                </div>
                <div className="card">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap">
                    <h4 className="mb-0">My Attendance History</h4>
                    <input
                      type="month"
                      className="form-control form-control-sm"
                      style={{ maxWidth: 180 }}
                      value={attendanceMonth}
                      onChange={(e) => setAttendanceMonth(e.target.value)}
                    />
                  </div>
                  <div className="card-body p-0 py-3">
                    <div className="px-3 pb-2 d-flex gap-2 flex-wrap">
                      <span className="badge bg-success">Present: {attendanceSummary.present}</span>
                      <span className="badge bg-danger">Absent: {attendanceSummary.absent}</span>
                      <span className="badge bg-warning text-dark">Late: {attendanceSummary.late}</span>
                      <span className="badge bg-dark">Half Day: {attendanceSummary.half_day}</span>
                      <span className="badge bg-info">Holiday: {attendanceSummary.holiday}</span>
                    </div>
                    {attendanceError && (
                      <div className="px-3 pb-2">
                        <div className="alert alert-warning mb-0">{attendanceError}</div>
                      </div>
                    )}
                    {attendanceLoading ? (
                      <div className="px-3 text-muted">Loading attendance history...</div>
                    ) : attendanceRows.length === 0 ? (
                      <div className="px-3 text-muted">No attendance records found for selected month.</div>
                    ) : (
                      <Table
                        dataSource={attendanceRows}
                        columns={[
                          {
                            title: "Date",
                            dataIndex: "attendance_date",
                            render: (val: string) =>
                              val
                                ? new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                : "—",
                          },
                          {
                            title: "Status",
                            dataIndex: "status",
                            render: (text: string) => {
                              const t = String(text || "").toLowerCase();
                              const badgeClass =
                                t === "present"
                                  ? "badge-soft-success"
                                  : t === "absent"
                                    ? "badge-soft-danger"
                                    : t === "late"
                                      ? "badge-soft-warning"
                                      : t === "half_day" || t === "halfday"
                                        ? "badge-soft-info"
                                        : t === "holiday"
                                          ? "badge-soft-primary"
                                        : "badge-soft-secondary";
                              const label = t ? t.replace("_", " ") : "unknown";
                              return (
                                <span className={`badge ${badgeClass} d-inline-flex align-items-center`}>
                                  <i className="ti ti-circle-filled fs-5 me-1" />
                                  {label.charAt(0).toUpperCase() + label.slice(1)}
                                </span>
                              );
                            },
                          },
                          {
                            title: "Check In",
                            dataIndex: "check_in_time",
                            render: (val: string) => (val ? String(val).slice(0, 5) : "—"),
                          },
                          {
                            title: "Check Out",
                            dataIndex: "check_out_time",
                            render: (val: string) => (val ? String(val).slice(0, 5) : "—"),
                          },
                          {
                            title: "Remark",
                            dataIndex: "remark",
                            render: (val: string) => (val && String(val).trim() ? val : "—"),
                          },
                        ]}
                        Selection={false}
                      />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeLeave;

