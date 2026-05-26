import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import Select from "react-select";
import { all_routes } from "../../../router/all_routes";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import AdministrativeSidebar from "./administrativeSidebar";
import AdministrativeBreadcrumb from "./administrativeBreadcrumb";
import { useAdministrativeStaffProfile } from "../../../../core/hooks/useAdministrativeStaffProfile";
import { useLeaveApplications } from "../../../../core/hooks/useLeaveApplications";
import { useLeaveTypes } from "../../../../core/hooks/useLeaveTypes";
import { apiService } from "../../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import {
  flattenEntityAttendanceReportRows,
  normalizeAttendanceStatusKey,
} from "../../../../core/utils/attendanceReportUtils";

const AdministrativeLeave = () => {
  const routes = all_routes;
  const { staff, staffId, loading: profileLoading, error: profileError } =
    useAdministrativeStaffProfile();
  const selectedAcademicYearId = useSelector(selectSelectedAcademicYearId);
  const {
    leaveApplications,
    loading: leaveLoading,
    error: leaveError,
    refetch: refetchLeaves,
  } = useLeaveApplications({
    studentOnly: true,
    limit: 50,
  });
  const { leaveTypes } = useLeaveTypes({ applicableFor: "staff" });

  const [applyType, setApplyType] = useState<any>(null);
  const [applyFrom, setApplyFrom] = useState<Dayjs | null>(null);
  const [applyTo, setApplyTo] = useState<Dayjs | null>(null);
  const [applyReason, setApplyReason] = useState("");
  const [applyDocument, setApplyDocument] = useState<File | null>(null);
  const [applySubmitting, setApplySubmitting] = useState(false);
  const [cancelingLeaveId, setCancelingLeaveId] = useState<number | null>(null);

  const profileState = staff ? { staffId: staff.id, staff } : undefined;

  const data = useMemo(() => {
    return leaveApplications.map((l: any) => ({
      ...l,
      leaveDate: l.leaveRange ?? l.leaveDate,
      appliedOn: l.appliedOn ?? l.applyOn,
    }));
  }, [leaveApplications]);

  const leaveSummary = useMemo(() => {
    const leaves = Array.isArray(leaveApplications) ? leaveApplications : [];
    const source: any[] = Array.isArray(leaveTypes) ? [...leaveTypes] : [];
    const seen = new Set<string>();
    source.forEach((t: any) => {
      const tid = Number(t?.id ?? t?.value);
      const tname = String(t?.label ?? t?.leave_type ?? "").trim().toLowerCase();
      seen.add(Number.isFinite(tid) && tid > 0 ? `id:${tid}` : `name:${tname || "unknown"}`);
    });
    return source.map((t: any) => {
      const typeId = Number(t?.id ?? t?.value);
      const typeLabel = String(t?.label ?? t?.leave_type ?? "Leave");
      const yearlyLimit = Number(t?.max_days_per_year ?? t?.max_days ?? 0);
      const used = leaves
        .filter((l: any) => {
          const status = String(l?.status || "").toLowerCase();
          const byId =
            Number.isFinite(typeId) && typeId > 0 && Number(l?.leaveTypeId) === typeId;
          const byName =
            !byId &&
            String(l?.leaveType || "")
              .trim()
              .toLowerCase() === typeLabel.toLowerCase();
          return status === "approved" && (byId || byName);
        })
        .reduce((sum: number, l: any) => sum + Number(l?.noOfDays || 0), 0);
      const available = Number.isFinite(yearlyLimit)
        ? Math.max(yearlyLimit - used, 0)
        : 0;
      return {
        key: String(typeId || typeLabel),
        leaveType: typeLabel,
        yearlyLimit: Number.isFinite(yearlyLimit) ? yearlyLimit : 0,
        used,
        available,
      };
    });
  }, [leaveApplications, leaveTypes]);

  const [attendanceMonth, setAttendanceMonth] = useState(
    new Date().toISOString().slice(0, 7)
  );
  const [attendanceBaseRows, setAttendanceBaseRows] = useState<any[]>([]);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  const [monthHolidayDates, setMonthHolidayDates] = useState<string[]>([]);
  const [monthHolidayTitles, setMonthHolidayTitles] = useState<
    Record<string, string>
  >({});

  const loadAdministrativeAttendance = useCallback(async () => {
    const pk = staffId != null ? Number(staffId) : NaN;
    if (!Number.isFinite(pk) || pk <= 0) {
      setAttendanceBaseRows([]);
      setAttendanceError(null);
      return;
    }
    setAttendanceLoading(true);
    setAttendanceError(null);
    try {
      const res = await apiService.getEntityAttendanceReport("staff", {
        month: attendanceMonth,
        academicYearId: selectedAcademicYearId,
        staffId: pk,
      });
      const all = Array.isArray(res?.data?.rows) ? res.data.rows : [];
      const mine = flattenEntityAttendanceReportRows(all, pk).sort((a: any, b: any) =>
        String(b?.attendance_date || "").localeCompare(
          String(a?.attendance_date || "")
        )
      );
      setAttendanceBaseRows(mine);
    } catch (err: any) {
      setAttendanceBaseRows([]);
      setAttendanceError(err?.message || "Failed to load attendance history");
    } finally {
      setAttendanceLoading(false);
    }
  }, [staffId, attendanceMonth, selectedAcademicYearId]);

  useEffect(() => {
    if (staffId != null) loadAdministrativeAttendance();
  }, [staffId, loadAdministrativeAttendance]);

  useEffect(() => {
    let disposed = false;
    const loadHolidayDates = async () => {
      try {
        const [year, month] = String(attendanceMonth || "").split("-").map(Number);
        if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
          if (!disposed) setMonthHolidayDates([]);
          return;
        }
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = `${year}-${String(month).padStart(2, "0")}-${String(new Date(year, month, 0).getDate()).padStart(2, "0")}`;
        const res = await apiService.getHolidays({
          startDate,
          endDate,
          academicYearId: selectedAcademicYearId,
        });
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
  }, [attendanceMonth, selectedAcademicYearId]);

  const attendanceRows = useMemo(() => {
    const existing = Array.isArray(attendanceBaseRows) ? [...attendanceBaseRows] : [];
    const holidayRowDates = new Set(
      existing
        .filter(
          (row: any) =>
            normalizeAttendanceStatusKey(row?.status) === "holiday"
        )
        .map((row: any) => String(row?.attendance_date || "").slice(0, 10))
        .filter((d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d))
    );
    const generated: any[] = [];
    for (const d of monthHolidayDates) {
      if (!holidayRowDates.has(d)) {
        generated.push({
          key: `holiday-${d}`,
          attendance_date: d,
          status: "holiday",
          remark:
            monthHolidayTitles[d] === "Weekly Holiday"
              ? "Weekly Holiday"
              : `Holiday: ${monthHolidayTitles[d] || "Holiday"}`,
          check_in_time: null,
          check_out_time: null,
        });
      }
    }
    return [...existing, ...generated]
      .map((row: any, idx: number) => ({
        ...row,
        key: row?.key ?? `attendance-${idx}-${String(row?.attendance_date || "").slice(0, 10)}`,
        status: normalizeAttendanceStatusKey(row?.status) || row?.status,
      }))
      .sort((a: any, b: any) =>
        String(b?.attendance_date || "").localeCompare(
          String(a?.attendance_date || "")
        )
      );
  }, [attendanceBaseRows, monthHolidayDates, monthHolidayTitles]);

  const attendanceSummary = useMemo(() => {
    return attendanceRows.reduce(
      (
        acc: {
          present: number;
          absent: number;
          late: number;
          half_day: number;
          holiday: number;
        },
        row: any
      ) => {
        const status = normalizeAttendanceStatusKey(row?.status);
        if (status === "present") acc.present += 1;
        else if (status === "absent") acc.absent += 1;
        else if (status === "late") acc.late += 1;
        else if (status === "half_day") acc.half_day += 1;
        else if (status === "holiday") acc.holiday += 1;
        return acc;
      },
      { present: 0, absent: 0, late: 0, half_day: 0, holiday: 0 }
    );
  }, [attendanceRows]);

  const getModalContainer = () => document.body;

  const hideApplyModal = () => {
    const el = document.getElementById("apply_leave_administrative");
    if (el) (window as any).bootstrap?.Modal?.getInstance(el)?.hide();
  };

  const handleApplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const typeId = applyType?.value;
    if (!typeId) {
      window.alert("Select leave type.");
      return;
    }
    if ((applyType as any)?.requires_medical_certificate && !applyDocument) {
      window.alert("An attachment is required for this leave type.");
      return;
    }
    if (!applyFrom || !applyTo) {
      window.alert("Select from and to dates.");
      return;
    }
    if (!applyReason.trim()) {
      window.alert("Reason is required.");
      return;
    }
    const fromStr = applyFrom.format("YYYY-MM-DD");
    const toStr = applyTo.format("YYYY-MM-DD");
    if (toStr < fromStr) {
      window.alert("To date must be on or after from date.");
      return;
    }

    setApplySubmitting(true);
    try {
      let document_url: string | null = null;
      if (applyDocument) {
        const uploadRes = await apiService.uploadSchoolStorageFile(
          applyDocument,
          "documents"
        );
        if (uploadRes?.status === "SUCCESS" && uploadRes?.data?.url) {
          document_url = uploadRes.data.url;
        } else {
          window.alert("Failed to upload document.");
          setApplySubmitting(false);
          return;
        }
      }

      const res = await apiService.createLeaveApplication({
        leave_type_id: Number(typeId),
        start_date: fromStr,
        end_date: toStr,
        reason: applyReason.trim(),
        document_url,
      });
      if (res?.status === "SUCCESS") {
        refetchLeaves();
        hideApplyModal();
        setApplyType(null);
        setApplyFrom(null);
        setApplyTo(null);
        setApplyReason("");
        setApplyDocument(null);
      } else {
        window.alert(res?.message || "Failed to apply leave.");
      }
    } catch (err: any) {
      window.alert(err?.message || "Failed to apply leave.");
    } finally {
      setApplySubmitting(false);
    }
  };

  const handleCancelLeave = async (id?: number) => {
    if (!id || cancelingLeaveId != null) return;
    const ok = window.confirm("Cancel this pending leave request?");
    if (!ok) return;
    setCancelingLeaveId(id);
    try {
      const res = await apiService.cancelLeaveApplication(id);
      if (res?.status === "SUCCESS") refetchLeaves();
      else window.alert(res?.message || "Failed to cancel leave.");
    } catch (err: any) {
      window.alert(err?.message || "Failed to cancel leave.");
    } finally {
      setCancelingLeaveId(null);
    }
  };

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
      dataIndex: "appliedOn",
      sorter: (a: TableData, b: TableData) =>
        String(a.appliedOn).localeCompare(String(b.appliedOn)),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (text: string) => {
        const status = String(text || "").toLowerCase();
        const badgeClass =
          status === "approved"
            ? "badge-soft-success"
            : status === "rejected"
              ? "badge-soft-danger"
              : status === "cancelled"
                ? "badge-soft-secondary"
                : "badge-soft-warning";
        const label = status
          ? status.charAt(0).toUpperCase() + status.slice(1)
          : "Pending";
        return (
          <span
            className={`badge ${badgeClass} d-inline-flex align-items-center`}
          >
            <i className="ti ti-circle-filled fs-5 me-1" />
            {label}
          </span>
        );
      },
      sorter: (a: TableData, b: TableData) =>
        String(a.status).localeCompare(String(b.status)),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: any) =>
        String(record?.status || "").toLowerCase() === "pending" ? (
          <button
            type="button"
            className="btn btn-sm btn-outline-danger"
            onClick={() => handleCancelLeave(record?.id)}
            disabled={cancelingLeaveId != null}
          >
            {cancelingLeaveId === record?.id ? "Cancelling..." : "Cancel"}
          </button>
        ) : (
          <span className="text-muted">—</span>
        ),
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

                {leaveSummary.length > 0 && (
                  <div className="row gx-3 mb-3">
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
                )}

                <div className="card">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                    <h4 className="mb-3">My leave applications</h4>
                    <Link
                      to="#"
                      data-bs-target="#apply_leave_administrative"
                      data-bs-toggle="modal"
                      className="btn btn-primary d-inline-flex align-items-center mb-3"
                    >
                      <i className="ti ti-calendar-plus me-2" />
                      Apply Leave
                    </Link>
                  </div>
                  <div className="card-body p-0 py-3">
                    {leaveError && (
                      <div className="px-3 pb-2">
                        <div className="alert alert-warning mb-0">{leaveError}</div>
                      </div>
                    )}
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
                      <span className="badge bg-success">
                        Present: {attendanceSummary.present}
                      </span>
                      <span className="badge bg-danger">
                        Absent: {attendanceSummary.absent}
                      </span>
                      <span className="badge bg-warning text-dark">
                        Late: {attendanceSummary.late}
                      </span>
                      <span className="badge bg-dark">
                        Half Day: {attendanceSummary.half_day}
                      </span>
                      <span className="badge bg-info">
                        Holiday: {attendanceSummary.holiday}
                      </span>
                    </div>
                    {attendanceError && (
                      <div className="px-3 pb-2">
                        <div className="alert alert-warning mb-0">
                          {attendanceError}
                        </div>
                      </div>
                    )}
                    {attendanceLoading ? (
                      <div className="px-3 text-muted">
                        Loading attendance history...
                      </div>
                    ) : attendanceRows.length === 0 ? (
                      <div className="px-3 text-muted">
                        No attendance records found for selected month.
                      </div>
                    ) : (
                      <Table
                        dataSource={attendanceRows}
                        columns={[
                          {
                            title: "Date",
                            dataIndex: "attendance_date",
                            render: (val: string) =>
                              val
                                ? new Date(val).toLocaleDateString("en-GB", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "—",
                          },
                          {
                            title: "Status",
                            dataIndex: "status",
                            render: (text: string) => {
                              const t = normalizeAttendanceStatusKey(text);
                              const badgeClass =
                                t === "present"
                                  ? "badge-soft-success"
                                  : t === "absent"
                                    ? "badge-soft-danger"
                                    : t === "late"
                                      ? "badge-soft-warning"
                                      : t === "half_day"
                                        ? "badge-soft-info"
                                        : t === "holiday"
                                          ? "badge-soft-primary"
                                          : "badge-soft-secondary";
                              const label = t
                                ? t.replace(/_/g, " ")
                                : "unknown";
                              return (
                                <span
                                  className={`badge ${badgeClass} d-inline-flex align-items-center`}
                                >
                                  <i className="ti ti-circle-filled fs-5 me-1" />
                                  {label.charAt(0).toUpperCase() + label.slice(1)}
                                </span>
                              );
                            },
                          },
                          {
                            title: "Check In",
                            dataIndex: "check_in_time",
                            render: (val: string) =>
                              val ? String(val).slice(0, 5) : "—",
                          },
                          {
                            title: "Check Out",
                            dataIndex: "check_out_time",
                            render: (val: string) =>
                              val ? String(val).slice(0, 5) : "—",
                          },
                          {
                            title: "Remark",
                            dataIndex: "remark",
                            render: (val: string) =>
                              val && String(val).trim() ? val : "—",
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

      <div className="modal fade" id="apply_leave_administrative">
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Apply Leave</h4>
              <button
                type="button"
                className="btn-close custom-btn-close"
                data-bs-dismiss="modal"
                aria-label="Close"
              >
                <i className="ti ti-x" />
              </button>
            </div>
            <form onSubmit={handleApplySubmit}>
              <div id="modal-datepicker-administrative" className="modal-body">
                <div className="row">
                  <div className="col-md-12">
                    <div className="mb-4">
                      <label className="form-label">Leave Type</label>
                      <Select
                        classNamePrefix="react-select"
                        className="select"
                        options={leaveTypes}
                        value={applyType}
                        onChange={setApplyType}
                        placeholder="Select leave type"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="form-label">Leave From Date</label>
                      <div className="date-pic">
                        <DatePicker
                          className="form-control datetimepicker"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          value={applyFrom}
                          onChange={(d) => setApplyFrom(d)}
                          placeholder="Select date"
                        />
                        <span className="cal-icon">
                          <i className="ti ti-calendar" />
                        </span>
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="form-label">Leave To Date</label>
                      <div className="date-pic">
                        <DatePicker
                          className="form-control datetimepicker"
                          format="DD-MM-YYYY"
                          getPopupContainer={getModalContainer}
                          value={applyTo}
                          onChange={(d) => setApplyTo(d)}
                          placeholder="Select date"
                        />
                        <span className="cal-icon">
                          <i className="ti ti-calendar" />
                        </span>
                      </div>
                    </div>
                    <div className="mb-0">
                      <label className="form-label">Reason</label>
                      <input
                        type="text"
                        className="form-control"
                        placeholder="Required"
                        value={applyReason}
                        onChange={(e) => setApplyReason(e.target.value)}
                      />
                    </div>
                    <div className="mb-0 mt-3">
                      <label className="form-label">
                        Attachment{" "}
                        {(applyType as any)?.requires_medical_certificate ? (
                          <span className="text-danger">(Required) *</span>
                        ) : (
                          "(Optional)"
                        )}
                      </label>
                      <input
                        type="file"
                        className="form-control"
                        onChange={(e) => {
                          if (e.target.files && e.target.files.length > 0) {
                            setApplyDocument(e.target.files[0]);
                          } else {
                            setApplyDocument(null);
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-light me-2"
                  data-bs-dismiss="modal"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={applySubmitting}
                >
                  {applySubmitting ? "Submitting..." : "Apply Leave"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeLeave;
