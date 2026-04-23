import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import type { TableData } from "../../../../core/data/interface";
import Table from "../../../../core/common/dataTable/index";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";
import { useStaffProfileLoader } from "../useStaffProfileLoader";
import { StaffProfileSidebar } from "../StaffProfileSidebar";
import { StaffProfilePageHeader } from "../StaffProfilePageHeader";
import { useAcademicYears } from "../../../../core/hooks/useAcademicYears";

function normalizeStatus(s: string) {
  const v = String(s || "")
    .trim()
    .toLowerCase();
  if (v === "halfday") return "half_day";
  return v;
}

const StaffsAttendance = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const selectedAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const { academicYears } = useAcademicYears();
  const academicYearsList = (academicYears || []) as Array<{ id?: number; is_current?: boolean }>;
  const currentAcademicYear =
    academicYearsList.find((year) => year?.is_current) ??
    academicYearsList[0] ??
    null;
  const academicYearId = selectedAcademicYearId ?? currentAcademicYear?.id ?? null;
  const canManageDirectory = canManageStaffDirectory(user);
  const { staffId, staff, loading, error, detailSearch, navState, pk } =
    useStaffProfileLoader();

  const [selectedMonth, setSelectedMonth] = useState(() =>
    new Date().toISOString().slice(0, 7)
  );
  const [rows, setRows] = useState<any[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [attError, setAttError] = useState<string | null>(null);
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

  const loadAttendance = useCallback(async () => {
    if (!Number.isFinite(pk) || pk <= 0) return;
    setAttLoading(true);
    setAttError(null);
    try {
      const res = await apiService.getEntityAttendanceReport("staff", {
        month: selectedMonth,
        academicYearId,
      });
      const all = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      const mine = all.filter((r: any) => Number(r?.entity_id) === Number(pk));
      mine.sort((a: any, b: any) =>
        String(a?.attendance_date || "").localeCompare(
          String(b?.attendance_date || "")
        )
      );
      setRows(mine);
    } catch (e: any) {
      setAttError(e?.message || "Failed to load attendance");
      setRows([]);
    } finally {
      setAttLoading(false);
    }
  }, [pk, selectedMonth, academicYearId]);

  useEffect(() => {
    if (Number.isFinite(pk) && pk > 0) loadAttendance();
  }, [pk, loadAttendance]);

  useEffect(() => {
    let disposed = false;
    const loadHolidayDates = async () => {
      try {
        const [year, month] = String(selectedMonth || "").split("-").map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
          if (!disposed) setMonthHolidayDates([]);
          return;
        }
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
        const res = await apiService.getHolidays({ startDate, endDate, academicYearId });
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
        if (!disposed) {
          setMonthHolidayDates(Array.from(dates));
          setMonthHolidayTitles(titleByDate);
        }
      } catch {
        if (!disposed) {
          setMonthHolidayDates([]);
          setMonthHolidayTitles({});
        }
      }
    };
    loadHolidayDates();
    return () => {
      disposed = true;
    };
  }, [selectedMonth, academicYearId, holidayRefreshTick]);

  const rowsWithHolidays = useMemo(() => {
    const existing = Array.isArray(rows) ? [...rows] : [];
    const holidayRowDates = new Set(
      existing
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
          remark:
            monthHolidayTitles[d] === "Weekly Holiday"
              ? "Weekly Holiday"
              : `Holiday: ${monthHolidayTitles[d] || "Holiday"}`,
        });
      }
    }
    return [...existing, ...generated].sort((a: any, b: any) =>
      String(a?.attendance_date || "").localeCompare(String(b?.attendance_date || ""))
    );
  }, [rows, monthHolidayDates, monthHolidayTitles]);

  const summary = useMemo(() => {
    return rowsWithHolidays.reduce(
      (acc, row) => {
        const st = normalizeStatus(String(row?.status || ""));
        if (st === "present") acc.present += 1;
        else if (st === "absent") acc.absent += 1;
        else if (st === "late") acc.late += 1;
        else if (st === "half_day") acc.half += 1;
        else if (st === "holiday") acc.holiday += 1;
        return acc;
      },
      { present: 0, absent: 0, late: 0, half: 0, holiday: 0 }
    );
  }, [rowsWithHolidays]);

  const lastUpdated =
    rowsWithHolidays.length > 0
      ? String(rowsWithHolidays[rowsWithHolidays.length - 1]?.attendance_date || "").slice(0, 10)
      : null;

  const tableData = useMemo(
    () =>
      rowsWithHolidays.map((r, i) => ({
        ...r,
        key: `att-${String(r.attendance_date ?? i)}-${i}`,
      })),
    [rowsWithHolidays]
  );

  const tableColumns = [
    {
      title: "Date",
      dataIndex: "attendance_date",
      render: (_: unknown, record: any) =>
        String(record?.attendance_date || "").slice(0, 10) || "—",
      sorter: (a: TableData, b: TableData) =>
        String((a as any).attendance_date || "").localeCompare(
          String((b as any).attendance_date || "")
        ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_: unknown, record: any) => {
        const st = normalizeStatus(String(record?.status || ""));
        const badgeClass =
          st === "present"
            ? "badge-soft-success"
            : st === "absent"
              ? "badge-soft-danger"
              : st === "late"
                ? "badge-soft-warning"
                : st === "half_day"
                  ? "badge-soft-info"
                  : st === "holiday"
                    ? "badge-soft-primary"
                    : "badge-soft-secondary";
        const label = String(record?.status || "—")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        return (
          <span className={`badge ${badgeClass} d-inline-flex align-items-center`}>
            <i className="ti ti-circle-filled fs-5 me-1" />
            {label}
          </span>
        );
      },
      sorter: (a: TableData, b: TableData) =>
        String((a as any).status || "").localeCompare(
          String((b as any).status || "")
        ),
    },
    {
      title: "Remark",
      dataIndex: "remark",
      render: (_: unknown, record: any) =>
        record?.remark != null && String(record.remark).trim() !== ""
          ? String(record.remark)
          : "—",
    },
  ];

  if (staffId == null) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="p-5 text-muted text-center">Redirecting…</div>
        </div>
      </div>
    );
  }

  if (loading || (!staff && !error)) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading staff…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger">{error || "Staff not found."}</div>
          <Link to={routes.staff} className="btn btn-primary">
            Back to staff list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <StaffProfilePageHeader
              routes={routes}
              canShowEdit={canManageDirectory}
              editTo={{ pathname: routes.editStaff, search: detailSearch }}
              editState={navState}
            />
            <div className="col-xxl-3 col-lg-4 theiaStickySidebar">
              <div className="stickybar">
                <StaffProfileSidebar staff={staff} />
              </div>
            </div>
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffDetails,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-info-square-rounded me-2" />
                        Basic Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffPayroll,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-file-dollar me-2" />
                        Payroll
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffLeave,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leaves
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffsAttendance,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link active"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Attendance
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="card">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-1">
                  <h4 className="mb-3">Attendance</h4>
                  <div className="d-flex align-items-center flex-wrap gap-2">
                    <label className="mb-0 small text-muted me-1">Month</label>
                    <input
                      type="month"
                      className="form-control form-control-sm"
                      style={{ width: "auto" }}
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => loadAttendance()}
                      disabled={attLoading}
                    >
                      {attLoading ? "Loading…" : "Refresh"}
                    </button>
                  </div>
                </div>
                <div className="card-body pb-1">
                  {attError && (
                    <div className="alert alert-warning py-2">{attError}</div>
                  )}
                  <p className="text-muted small mb-3">
                    Last marked date in this list:{" "}
                    <span className="text-dark">
                      {lastUpdated || "—"}
                    </span>
                  </p>
                  {monthHolidayDates.length > 0 && (
                    <div className="alert alert-info py-2">
                      Holiday dates are auto-included in attendance history.
                    </div>
                  )}
                  <div className="row">
                    <div className="col-md-6 col-xxl-3 d-flex">
                      <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                        <span className="avatar avatar-lg bg-primary-transparent rounded me-2 flex-shrink-0 text-primary">
                          <i className="ti ti-user-check fs-24" />
                        </span>
                        <div className="ms-2">
                          <p className="mb-1">Present</p>
                          <h5>{summary.present}</h5>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 col-xxl-3 d-flex">
                      <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                        <span className="avatar avatar-lg bg-danger-transparent rounded me-2 flex-shrink-0 text-danger">
                          <i className="ti ti-user-check fs-24" />
                        </span>
                        <div className="ms-2">
                          <p className="mb-1">Absent</p>
                          <h5>{summary.absent}</h5>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 col-xxl-3 d-flex">
                      <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                        <span className="avatar avatar-lg bg-info-transparent rounded me-2 flex-shrink-0 text-info">
                          <i className="ti ti-user-check fs-24" />
                        </span>
                        <div className="ms-2">
                          <p className="mb-1">Half day</p>
                          <h5>{summary.half}</h5>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-6 col-xxl-3 d-flex">
                      <div className="d-flex align-items-center rounded border p-3 mb-3 flex-fill">
                        <span className="avatar avatar-lg bg-warning-transparent rounded me-2 flex-shrink-0 text-warning">
                          <i className="ti ti-user-check fs-24" />
                        </span>
                        <div className="ms-2">
                          <p className="mb-1">Late</p>
                          <h5>{summary.late}</h5>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="card">
                <div className="card-header">
                  <h4 className="mb-0">Daily marks ({selectedMonth})</h4>
                </div>
                <div className="card-body p-0 py-3">
                  <div className="px-3 mb-3 d-flex flex-wrap gap-2 align-items-center">
                    <span className="avatar avatar-sm bg-success rounded">
                      <i className="ti ti-checks" />
                    </span>
                    <span className="small me-3">Present</span>
                    <span className="avatar avatar-sm bg-danger rounded">
                      <i className="ti ti-x" />
                    </span>
                    <span className="small me-3">Absent</span>
                    <span className="avatar avatar-sm bg-pending rounded">
                      <i className="ti ti-clock-x" />
                    </span>
                    <span className="small me-3">Late</span>
                    <span className="avatar avatar-sm bg-dark rounded">
                      <i className="ti ti-calendar-event" />
                    </span>
                    <span className="small me-3">Half day</span>
                    <span className="avatar avatar-sm bg-info rounded">
                      <i className="ti ti-calendar-event" />
                    </span>
                    <span className="small">Holiday</span>
                  </div>
                  {attLoading ? (
                    <div className="p-4 text-center text-muted">Loading…</div>
                  ) : (
                    <Table
                      columns={tableColumns}
                      dataSource={tableData}
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
  );
};

export default StaffsAttendance;





