
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useMemo } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import TeacherSidebar from "./teacherSidebar";
import TeacherBreadcrumb from "./teacherBreadcrumb";
import TeacherModal from "../teacherModal";
import { apiService } from "../../../../core/services/apiService";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";
import { useLeaveTypes } from "../../../../core/hooks/useLeaveTypes";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useCurrentTeacher } from "../../../../core/hooks/useCurrentTeacher";
import { useMyAttendance } from "../../../../core/hooks/useMyAttendance";
import { useAcademicYears } from "../../../../core/hooks/useAcademicYears";

interface TeacherDetailsLocationState {
  teacherId?: number;
  teacher?: any;
}

const TeacherLeave = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as TeacherDetailsLocationState | null;
  const user = useSelector(selectUser);
  const selectedAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const { academicYears } = useAcademicYears();
  const isTeacherRole = String(user?.role || "").toLowerCase() === "teacher";
  const currentAcademicYear =
    (academicYears || []).find((year: { is_current?: boolean }) => year?.is_current) ??
    (academicYears || [])[0] ??
    null;
  const effectiveAcademicYearId = selectedAcademicYearId ?? currentAcademicYear?.id ?? null;
  const { teacher: currentTeacher } = useCurrentTeacher();
  const teacherIdFromState = state?.teacherId ?? state?.teacher?.id;
  const teacherId = teacherIdFromState ?? currentTeacher?.id;
  const [teacher, setTeacher] = useState<any>(state?.teacher ?? null);
  const [loading, setLoading] = useState(!!teacherId);
  const [attendanceMonth, setAttendanceMonth] = useState(new Date().toISOString().slice(0, 7));
  const [attendanceRows, setAttendanceRows] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [monthHolidayDates, setMonthHolidayDates] = useState<string[]>([]);
  const [monthHolidayTitles, setMonthHolidayTitles] = useState<Record<string, string>>({});
  const [holidayRefreshTick, setHolidayRefreshTick] = useState(0);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "visible") setHolidayRefreshTick((t) => t + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Always fetch full teacher by ID when teacherId is available to ensure we have complete data
  useEffect(() => {
    if (teacherId) {
      setLoading(true);
      apiService
        .getTeacherById(teacherId)
        .then((res: any) => {
          if (res?.data) setTeacher(res.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [teacherId]);
  const selfScopeEnabled = isTeacherRole && !teacherIdFromState;
  const effectiveTeacher = teacher ?? currentTeacher ?? null;
  const staffId = effectiveTeacher?.staff_id ?? effectiveTeacher?.staffId ?? null;
  const { data: myAttendanceData, loading: myAttendanceLoading, error: myAttendanceError } = useMyAttendance({
    days: 365,
    enabled: selfScopeEnabled,
  });

  const normalizeStatus = (value: string) => {
    const s = String(value || "").trim().toLowerCase();
    if (s === "halfday") return "half_day";
    return s;
  };

  useEffect(() => {
    let cancelled = false;

    const loadAttendance = async () => {
      if (!teacherId) {
        setAttendanceRows([]);
        setAttendanceLoading(false);
        setAttendanceError(null);
        return;
      }

      try {
        if (!cancelled) {
          setAttendanceLoading(true);
          setAttendanceError(null);
        }
        const staffIdNum = Number(staffId);
        if (!Number.isFinite(staffIdNum) || staffIdNum <= 0) {
          if (!cancelled) {
            setAttendanceRows([]);
            setAttendanceError("Staff profile is not linked for this teacher.");
            setAttendanceLoading(false);
          }
          return;
        }
        const response = await apiService.getEntityAttendanceReport("staff", {
          month: attendanceMonth,
          academicYearId: effectiveAcademicYearId,
        });
        const rows = Array.isArray(response?.data?.rows) ? response.data.rows : [];
        const filtered = rows
          .filter((r: any) => Number(r?.entity_id) === staffIdNum)
          .sort((a: any, b: any) => String(b?.attendance_date || "").localeCompare(String(a?.attendance_date || "")));
          if (!cancelled) setAttendanceRows(filtered);
      } catch (err: any) {
        if (selfScopeEnabled) {
          const scopedRows = Array.isArray(myAttendanceData?.staff?.rows) ? myAttendanceData.staff.rows : [];
          const filtered = scopedRows
            .filter((r: any) => String(r?.attendance_date || "").slice(0, 7) === attendanceMonth)
            .sort((a: any, b: any) => String(b?.attendance_date || "").localeCompare(String(a?.attendance_date || "")));
          if (!cancelled) {
            setAttendanceRows(filtered);
            setAttendanceError(myAttendanceError || null);
          }
        } else if (!cancelled) {
          setAttendanceRows([]);
          setAttendanceError(err?.message || "Failed to load attendance history");
        }
      } finally {
        if (!cancelled) setAttendanceLoading(false);
      }
    };

    loadAttendance();
    return () => {
      cancelled = true;
    };
  }, [attendanceMonth, teacherId, selfScopeEnabled, staffId, myAttendanceData, myAttendanceLoading, myAttendanceError, effectiveAcademicYearId]);

  useEffect(() => {
    let cancelled = false;
    const loadHolidayDates = async () => {
      try {
        const [year, month] = String(attendanceMonth || "").split("-").map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
          if (!cancelled) setMonthHolidayDates([]);
          return;
        }
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
        const res = await apiService.getHolidays({ startDate, endDate, academicYearId: effectiveAcademicYearId });
        const rows = Array.isArray(res?.data) ? res.data : [];
        const dates = new Set<string>();
        const titleByDate: Record<string, string> = {};
        rows.forEach((h: any) => {
          const hs = String(h?.start_date || "").slice(0, 10);
          const he = String(h?.end_date || "").slice(0, 10);
          const title = String(h?.title || "").trim() || "Holiday";
          if (!hs || !he) return;
          const cursor = new Date(`${hs}T00:00:00`);
          const until = new Date(`${he}T00:00:00`);
          if (Number.isNaN(cursor.getTime()) || Number.isNaN(until.getTime()) || cursor > until) return;
          while (cursor <= until) {
            const d = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
            if (d >= startDate && d <= endDate) {
              dates.add(d);
              if (!titleByDate[d]) titleByDate[d] = title;
            }
            cursor.setDate(cursor.getDate() + 1);
          }
        });

        // Weekly holiday: every Sunday in the selected calendar month (including future dates in that month).
        const sundayCursor = new Date(`${startDate}T00:00:00`);
        const monthEnd = new Date(`${endDate}T00:00:00`);
        while (sundayCursor <= monthEnd) {
          if (sundayCursor.getDay() === 0) {
            const d = `${sundayCursor.getFullYear()}-${String(sundayCursor.getMonth() + 1).padStart(2, "0")}-${String(sundayCursor.getDate()).padStart(2, "0")}`;
            dates.add(d);
            if (!titleByDate[d]) titleByDate[d] = "Weekly Holiday";
          }
          sundayCursor.setDate(sundayCursor.getDate() + 1);
        }
        if (!cancelled) {
          setMonthHolidayDates(Array.from(dates));
          setMonthHolidayTitles(titleByDate);
        }
      } catch {
        if (!cancelled) {
          setMonthHolidayDates([]);
          setMonthHolidayTitles({});
        }
      }
    };
    loadHolidayDates();
    return () => {
      cancelled = true;
    };
  }, [attendanceMonth, effectiveAcademicYearId, holidayRefreshTick]);

  const attendanceRowsWithHoliday = useMemo(() => {
    const existing = Array.isArray(attendanceRows) ? [...attendanceRows] : [];
    const isSunday = (value: string) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
      const d = new Date(`${value}T00:00:00`);
      return !Number.isNaN(d.getTime()) && d.getDay() === 0;
    };
    const normalizedExisting = existing.map((row: any) => {
      const d = String(row?.attendance_date || "").slice(0, 10);
      if (isSunday(d)) {
        return {
          ...row,
          attendance_date: d,
          status: "holiday",
          remark: "Weekly Holiday",
          check_in_time: null,
          check_out_time: null,
        };
      }
      return row;
    });
    const holidayRowDates = new Set(
      normalizedExisting
        .filter((row: any) => normalizeStatus(String(row?.status || "")) === "holiday")
        .map((row: any) => String(row?.attendance_date || "").slice(0, 10))
        .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    );
    const generated: any[] = [];
    for (const d of monthHolidayDates) {
      if (!holidayRowDates.has(d)) {
        generated.push({
          attendance_date: d,
          status: "holiday",
            remark: monthHolidayTitles[d] === "Weekly Holiday" ? "Weekly Holiday" : `Holiday: ${monthHolidayTitles[d] || "Holiday"}`,
          check_in_time: null,
          check_out_time: null,
        });
      }
    }
    return [...normalizedExisting, ...generated].sort((a: any, b: any) =>
      String(b?.attendance_date || "").localeCompare(String(a?.attendance_date || ""))
    );
  }, [attendanceRows, monthHolidayDates, monthHolidayTitles]);
  const attendanceSummary = useMemo(() => {
    return attendanceRowsWithHoliday.reduce(
      (acc, row) => {
        const status = normalizeStatus(String(row?.status || ""));
        if (status === "present") acc.present += 1;
        else if (status === "absent") acc.absent += 1;
        else if (status === "late") acc.late += 1;
        else if (status === "half_day") acc.half_day += 1;
        else if (status === "holiday") acc.holiday += 1;
        return acc;
      },
      { present: 0, absent: 0, late: 0, half_day: 0, holiday: 0 }
    );
  }, [attendanceRowsWithHoliday]);
  const leaveUseMeEndpoint = isTeacherRole;
  const { leaveApplications, loading: leaveDataLoading, refetch: refetchLeaves } = useLeaveApplications({
    limit: 50,
    studentOnly: leaveUseMeEndpoint,
    staffId: leaveUseMeEndpoint ? undefined : (staffId ?? undefined),
    canUseAdminList: !leaveUseMeEndpoint, // teacher self should not hit admin-only leave list endpoint
  });
  const { leaveTypes } = useLeaveTypes();
  const data = useMemo(() => {
    return leaveApplications.map((l) => ({
      ...l,
      leaveDate: l.leaveRange,
    }));
  }, [leaveApplications]);
  const leaveSummary = useMemo(() => {
    const source = Array.isArray(leaveTypes) ? leaveTypes : [];
    const unique = new Map<string, any>();
    source.forEach((t: any) => {
      const rawName = String(
        t?.label ?? t?.leave_type ?? t?.leave_type_name ?? ""
      ).trim();
      const normalizedName = rawName.toLowerCase();
      const typeId = Number(t?.id ?? t?.value);
      const key =
        Number.isFinite(typeId) && typeId > 0
          ? `id:${typeId}`
          : `name:${normalizedName || "unknown"}`;
      if (!unique.has(key)) unique.set(key, t);
    });

    return Array.from(unique.values()).map((t: any, idx: number) => {
      const typeId = Number(t?.id ?? t?.value);
      const typeName =
        String(
          t?.label ?? t?.leave_type ?? t?.leave_type_name ?? ""
        ).trim() || "Leave";
      const yearlyLimit = Number(t?.max_days_per_year ?? t?.max_days ?? 0);
      const used = leaveApplications
        .filter((l: any) => {
          const status = String(l?.status || "").toLowerCase();
          const includeByStatus = status === "approved";
          const byId = Number.isFinite(typeId) && typeId > 0 && Number(l?.leaveTypeId) === typeId;
          const byName =
            !byId &&
            String(l?.leaveType || "")
              .trim()
              .toLowerCase() === typeName.toLowerCase();
          return includeByStatus && (byId || byName);
        })
        .reduce((sum: number, l: any) => sum + Number(l?.noOfDays || 0), 0);

      return {
        key: `leave-type-${Number.isFinite(typeId) ? typeId : "na"}-${typeName.toLowerCase().replace(/\s+/g, "-")}-${idx}`,
        leaveType: typeName,
        yearlyLimit: Number.isFinite(yearlyLimit) ? yearlyLimit : 0,
        used,
        available: Number.isFinite(yearlyLimit) ? Math.max(yearlyLimit - used, 0) : 0,
      };
    });
  }, [leaveApplications, leaveTypes]);
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
      render: (text: string) => {
        const status = String(text || "").toLowerCase();
        const badgeClass = status === "approved" ? "badge-soft-success" : status === "rejected" ? "badge-soft-danger" : status === "cancelled" ? "badge-soft-secondary" : "badge-soft-pending";
        const label = status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending";
        return (
          <span className={`badge ${badgeClass} d-inline-flex align-items-center`}>
            <i className="ti ti-circle-filled fs-5 me-1"></i>
            {label}
          </span>
        );
      },
      sorter: (a: TableData, b: TableData) => a.status.length - b.status.length,
    },
  ];
  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            {/* Page Header */}
            <TeacherBreadcrumb />
            {/* /Page Header */}
          </div>
          <div className="row">
            {/* Teacher Information */}
            {loading ? (
              <div className="col-xxl-3 col-xl-4">
                <div className="d-flex justify-content-center align-items-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              </div>
            ) : (
              <TeacherSidebar teacher={effectiveTeacher} />
            )}
            {/* /Teacher Information */}
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  {/* List */}
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link to={routes.teacherDetails} className="nav-link ">
                        <i className="ti ti-school me-2" />
                        Teacher Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.teachersRoutine}
                        className="nav-link "
                      >
                        <i className="ti ti-table-options me-2" />
                        Routine
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.teacherLeaves} className="nav-link active">
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.teacherSalary} className="nav-link">
                        <i className="ti ti-report-money me-2" />
                        Salary
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.teacherLibrary} className="nav-link">
                        <i className="ti ti-bookmark-edit me-2" />
                        Library
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
                        {leaveSummary.map((s) => (
                          <div className="col-lg-6 col-xxl-3 d-flex" key={s.key}>
                            <div className="card flex-fill">
                              <div className="card-body">
                                <h5 className="mb-2">{`${s.leaveType} (${s.yearlyLimit})`}</h5>
                                <div className="d-flex align-items-center flex-wrap">
                                  <p className="border-end pe-2 me-2 mb-0">{`Used : ${s.used}`}</p>
                                  <p className="mb-0">{`Available : ${s.available}`}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                          <h4 className="mb-3">Leaves</h4>
                          <Link
                            to="#"
                            data-bs-target="#apply_leave_teacher"
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
                                Last Updated on : {new Date().toLocaleDateString("en-GB")}
                              </p>
                              <input
                                type="month"
                                className="form-control form-control-sm me-2 mb-3"
                                style={{ minWidth: 170 }}
                                value={attendanceMonth}
                                onChange={(e) => setAttendanceMonth(e.target.value)}
                              />
                              <Link
                                to="#"
                                className="btn btn-primary btn-icon btn-sm rounded-circle d-inline-flex align-items-center justify-content-center p-0 mb-3"
                              >
                                <i className="ti ti-refresh-dot" />
                              </Link>
                            </div>
                            <div className="dropdown mb-3">
                              <Link
                                to="#"
                                className="btn btn-outline-light bg-white dropdown-toggle"
                                data-bs-toggle="dropdown"
                                data-bs-auto-close="outside"
                              >
                                <i className="ti ti-calendar-due me-2" />
                                Month : {attendanceMonth}
                              </Link>
                              <ul className="dropdown-menu p-3">
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                  >
                                    Year : 2024 / 2025
                                  </Link>
                                </li>
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                  >
                                    Year : 2023 / 2024
                                  </Link>
                                </li>
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                  >
                                    Year : 2022 / 2023
                                  </Link>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </div>
                        <div className="card-body pb-1">
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
                                  <h5>{attendanceSummary.half_day}</h5>
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
                            <div className="col-md-6 col-xxl-3 d-flex">
                              <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                                <span className="avatar avatar-lg bg-info-transparent rounded me-2 flex-shrink-0 text-info">
                                  <i className="ti ti-calendar-event fs-24" />
                                </span>
                                <div className="ms-2">
                                  <p className="mb-1">Holiday</p>
                                  <h5>{attendanceSummary.holiday}</h5>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="card">
                        <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-1">
                          <h4 className="mb-3">Leave &amp; Attendance</h4>
                          <div className="d-flex align-items-center flex-wrap">
                            <div className="dropdown mb-3 me-3">
                              <Link
                                to="#"
                                className="btn btn-outline-light border-white bg-white dropdown-toggle shadow-md"
                                data-bs-toggle="dropdown"
                              >
                                <i className="ti ti-calendar-due me-2" />
                                This Year
                              </Link>
                              <ul className="dropdown-menu p-3">
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                  >
                                    This Year
                                  </Link>
                                </li>
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                  >
                                    This Month
                                  </Link>
                                </li>
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                  >
                                    This Week
                                  </Link>
                                </li>
                              </ul>
                            </div>
                            <div className="dropdown mb-3">
                              <Link
                                to="#"
                                className="dropdown-toggle btn btn-light fw-medium d-inline-flex align-items-center"
                                data-bs-toggle="dropdown"
                              >
                                <i className="ti ti-file-export me-2" />
                                Export
                              </Link>
                              <ul className="dropdown-menu  dropdown-menu-end p-2">
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                  >
                                    <i className="ti ti-file-type-pdf me-2" />
                                    Export as PDF
                                  </Link>
                                </li>
                                <li>
                                  <Link
                                    to="#"
                                    className="dropdown-item rounded-1"
                                  >
                                    <i className="ti ti-file-type-xls me-2" />
                                    Export as Excel{" "}
                                  </Link>
                                </li>
                              </ul>
                            </div>
                          </div>
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
                         
                          {attendanceError && (
                            <div className="px-3 pb-2">
                              <div className="alert alert-warning mb-0">{attendanceError}</div>
                            </div>
                          )}
                          {!attendanceLoading && monthHolidayDates.length > 0 && (
                            <div className="px-3 pb-2">
                              <div className="alert alert-info mb-0">
                                Holiday days are auto-shown in attendance history.
                              </div>
                            </div>
                          )}
                          {attendanceLoading ? (
                            <div className="px-3 pb-2 text-muted">Loading attendance history...</div>
                          ) : (
                            <Table
                              dataSource={attendanceRowsWithHoliday}
                              columns={[
                                {
                                  title: "Date",
                                  dataIndex: "attendance_date",
                                  render: (val: string) =>
                                    val
                                      ? new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                                      : "—",
                                  sorter: (a: any, b: any) => String(a.attendance_date || "").localeCompare(String(b.attendance_date || "")),
                                },
                                {
                                  title: "Status",
                                  dataIndex: "status",
                                  render: (_text: string, record: any) => {
                                    const status = normalizeStatus(String(record?.status || ""));
                                    const badgeClass =
                                      status === "present"
                                        ? "badge-soft-success"
                                        : status === "absent"
                                          ? "badge-soft-danger"
                                          : status === "late"
                                            ? "badge-soft-warning"
                                            : status === "half_day"
                                              ? "badge-soft-info"
                                              : status === "holiday"
                                                ? "badge-soft-primary"
                                              : "badge-soft-secondary";
                                    const label = status ? status.replace("_", " ") : "unknown";
                                    return (
                                      <span className={`badge ${badgeClass} d-inline-flex align-items-center`}>
                                        <i className="ti ti-circle-filled fs-5 me-1" />
                                        {label.charAt(0).toUpperCase() + label.slice(1)}
                                      </span>
                                    );
                                  },
                                  sorter: (a: any, b: any) => String(a.status || "").localeCompare(String(b.status || "")),
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
      <TeacherModal staffId={staffId} onLeaveApplied={refetchLeaves} />
    </>
  );
};

export default TeacherLeave;

