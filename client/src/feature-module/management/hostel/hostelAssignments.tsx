import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { all_routes } from "../../router/all_routes";
import CommonSelect from "../../../core/common/commonSelect";
import Table from "../../../core/common/dataTable/index";
import TooltipOption from "../../../core/common/tooltipOption";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useHostels } from "../../../core/hooks/useHostels";
import { useHostelAssignments } from "../../../core/hooks/useHostelAssignments";
import { apiService } from "../../../core/services/apiService";
import Swal from "sweetalert2";
import { formatDateDMY, formatUsdDisplay, toYmdString } from "../../../core/utils/dateDisplay";
import { selectUser } from "../../../core/data/redux/authSlice";
import { HostelAssignmentStatusBadge, HostelRecordStatusToggle } from "./hostelUiUtils";
import { exportToExcel, exportToPDF, printData } from "../../../core/utils/exportUtils";

const STATUS_FILTER = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const USER_TYPE_OPTIONS = [
  { value: "student", label: "Student" },
  { value: "staff", label: "Staff" },
];

const listFromResponse = (res: unknown): any[] => {
  if (res == null || typeof res !== "object") return [];
  const r = res as Record<string, unknown>;
  if (r.status === "ERROR" || r.success === false) return [];
  const d = r.data;
  return Array.isArray(d) ? d : [];
};

const HostelAssignments = () => {
  const routes = all_routes;
  const dropdownMenuRef = useRef<HTMLDivElement | null>(null);
  const suppressModalLocationEffectsRef = useRef(false);
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const authUser = useSelector(selectUser);
  const { hostels } = useHostels();
  const [draftHostel, setDraftHostel] = useState<string | null>("all");
  const [draftStatus, setDraftStatus] = useState("all");
  const [filterHostel, setFilterHostel] = useState<string | null>("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const filters = useMemo(() => {
    const f: Record<string, string> = {};
    if (academicYearId != null) f.academic_year_id = String(academicYearId);
    if (filterHostel && filterHostel !== "all") f.hostel_id = filterHostel;
    if (filterStatus && filterStatus !== "all") f.status = filterStatus;
    return f;
  }, [academicYearId, filterHostel, filterStatus]);

  const { assignments, loading, error, refetch } = useHostelAssignments(filters);

  const hostelOptions = useMemo(
    () => hostels.map((h: any) => ({ value: String(h.dbId), label: h.hostelName })),
    [hostels]
  );
  const hostelFilterOpts = [{ value: "all", label: "All hostels" }, ...hostelOptions];

  const [modalHostel, setModalHostel] = useState<string | null>(null);
  const [modalFloor, setModalFloor] = useState<string | null>(null);
  const [modalRoom, setModalRoom] = useState<string | null>(null);
  const [modalBed, setModalBed] = useState<string | null>(null);
  const [modalUserType, setModalUserType] = useState<"student" | "staff">("student");
  const [modalPersonId, setModalPersonId] = useState<string | null>(null);
  const [studentSelectOptions, setStudentSelectOptions] = useState<{ value: string; label: string }[]>([]);
  const [staffSelectOptions, setStaffSelectOptions] = useState<{ value: string; label: string }[]>([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [floorOpts, setFloorOpts] = useState<{ value: string; label: string }[]>([]);
  const [roomOpts, setRoomOpts] = useState<{ value: string; label: string }[]>([]);
  const [bedOpts, setBedOpts] = useState<{ value: string; label: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [modalAssignedDate, setModalAssignedDate] = useState("");
  const [modalExpectedCheckout, setModalExpectedCheckout] = useState("");
  const [modalCheckoutDate, setModalCheckoutDate] = useState("");
  const [modalSecurityDeposit, setModalSecurityDeposit] = useState("");
  const [modalRemarks, setModalRemarks] = useState("");
  const [assignmentModalMode, setAssignmentModalMode] = useState<"create" | "edit">("create");
  const [editingAssignmentId, setEditingAssignmentId] = useState<number | null>(null);
  const [editOriginalRoomId, setEditOriginalRoomId] = useState<string | null>(null);
  const [editOriginalBedId, setEditOriginalBedId] = useState<string | null>(null);

  useEffect(() => {
    if (suppressModalLocationEffectsRef.current) return;
    if (!modalHostel) {
      setFloorOpts([]);
      setModalFloor(null);
      return;
    }
    (async () => {
      try {
        const res = await apiService.getHostelFloors(Number(modalHostel));
        const raw = res?.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        setFloorOpts(
          list.map((f: any) => ({
            value: String(f.id),
            label: `${f.floor_name} (#${f.floor_number})`,
          }))
        );
        setModalFloor(list[0]?.id != null ? String(list[0].id) : null);
      } catch {
        setFloorOpts([]);
        setModalFloor(null);
      }
    })();
  }, [modalHostel]);

  useEffect(() => {
    if (suppressModalLocationEffectsRef.current) return;
    if (!modalHostel || !modalFloor) {
      setRoomOpts([]);
      setModalRoom(null);
      return;
    }
    (async () => {
      try {
        const res = await apiService.getHostelRooms({ hostel_id: modalHostel });
        const raw = res?.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        const filtered = list.filter((r: any) => String(r.floor_id) === String(modalFloor));
        setRoomOpts(
          filtered.map((r: any) => ({
            value: String(r.id),
            label: String(r.room_number ?? r.id),
          }))
        );
        setModalRoom((prev) =>
          prev && filtered.some((r: any) => String(r.id) === prev)
            ? prev
            : filtered[0]?.id?.toString() ?? null
        );
      } catch {
        setRoomOpts([]);
        setModalRoom(null);
      }
    })();
  }, [modalHostel, modalFloor]);

  useEffect(() => {
    if (suppressModalLocationEffectsRef.current) return;
    if (!modalRoom) {
      setBedOpts([]);
      setModalBed(null);
      return;
    }
    (async () => {
      try {
        const res = await apiService.getHostelRoomBeds(Number(modalRoom));
        const raw = res?.data ?? [];
        const list = Array.isArray(raw) ? raw : [];
        const sameOriginalRoom =
          assignmentModalMode === "edit" &&
          editOriginalRoomId != null &&
          String(modalRoom) === String(editOriginalRoomId);
        const free = list.filter((b: any) => {
          if (String(b.bed_status) === "available") return true;
          if (
            sameOriginalRoom &&
            editOriginalBedId != null &&
            String(b.id) === String(editOriginalBedId)
          ) {
            return true;
          }
          return false;
        });
        setBedOpts(
          free.map((b: any) => ({
            value: String(b.id),
            label: `Bed ${b.bed_number}${String(b.bed_status) !== "available" ? " (current)" : ""}`,
          }))
        );
        setModalBed((prev) => {
          if (prev && free.some((b: any) => String(b.id) === prev)) return prev;
          return free[0]?.id?.toString() ?? null;
        });
      } catch {
        setBedOpts([]);
        setModalBed(null);
      }
    })();
  }, [modalRoom, assignmentModalMode, editOriginalRoomId, editOriginalBedId]);

  const loadPeopleOptions = useCallback(async (yearOverride?: number | null) => {
    setPeopleLoading(true);
    const effectiveYear = yearOverride !== undefined ? yearOverride : academicYearId;
    try {
      const [stOut, sfOut] = await Promise.allSettled([
        apiService.getStudents({
          ...(effectiveYear != null ? { academic_year_id: effectiveYear } : {}),
          limit: 8000,
          page: 1,
        }),
        apiService.getStaff(),
      ]);
      const stData = stOut.status === "fulfilled" ? listFromResponse(stOut.value) : [];
      const sfData = sfOut.status === "fulfilled" ? listFromResponse(sfOut.value) : [];
      setStudentSelectOptions(
        stData.map((s: any) => ({
          value: String(s.id),
          label:
            `${[s.first_name, s.last_name].filter(Boolean).join(" ") || `Student #${s.id}`}` +
            (s.class_name || s.section_name
              ? ` (${[s.class_name, s.section_name].filter(Boolean).join(" — ")})`
              : ""),
        }))
      );
      setStaffSelectOptions(
        sfData
          .filter((s: any) => String(s.status || "").toLowerCase() === "active" || s.is_active === true)
          .map((s: any) => ({
            value: String(s.id),
            label: [s.first_name, s.last_name].filter(Boolean).join(" ") || `Staff #${s.id}`,
          }))
      );
    } catch {
      setStudentSelectOptions([]);
      setStaffSelectOptions([]);
    } finally {
      setPeopleLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => {
    void loadPeopleOptions();
  }, [loadPeopleOptions]);

  const personLabelById = useMemo(() => {
    const m = new Map<string, string>();
    studentSelectOptions.forEach((o) => m.set(o.value, o.label));
    staffSelectOptions.forEach((o) => m.set(o.value, o.label));
    return m;
  }, [studentSelectOptions, staffSelectOptions]);

  const personSelectOptions = useMemo(
    () => (modalUserType === "student" ? studentSelectOptions : staffSelectOptions),
    [modalUserType, studentSelectOptions, staffSelectOptions]
  );

  const tableRows = useMemo(
    () =>
      assignments.map((a: any, i: number) => {
        const assignee =
          a.student_id != null
            ? personLabelById.get(String(a.student_id)) || `Student #${a.student_id}`
            : a.staff_id != null
              ? personLabelById.get(String(a.staff_id)) || `Staff #${a.staff_id}`
              : "—";
        return {
          key: String(a.id ?? i),
          dbId: a.id,
          student: assignee,
          hostel: a.hostel_name || "—",
          room: a.room_number || "—",
          bed: a.bed_number || "—",
          addedOn: formatDateDMY(a.created_at),
          from: formatDateDMY(a.assigned_date),
          expectedOut: formatDateDMY(a.expected_checkout_date),
          checkout: formatDateDMY(a.checkout_date),
          deposit: formatUsdDisplay(a.security_deposit),
          remarks: a.remarks ? String(a.remarks) : "—",
          status: a.assignment_status,
          originalData: a,
        };
      }),
    [assignments, personLabelById]
  );

  const applyFilters = (e?: React.MouseEvent) => {
    e?.preventDefault();
    setFilterHostel(draftHostel);
    setFilterStatus(draftStatus);
    if (dropdownMenuRef.current) dropdownMenuRef.current.classList.remove("show");
  };

  const resetFilters = () => {
    setDraftHostel("all");
    setDraftStatus("all");
    setFilterHostel("all");
    setFilterStatus("all");
  };

  const handleExportExcel = () => {
    exportToExcel(
      tableRows.map((r) => ({
        ID: r.dbId,
        "Student / Staff": r.student,
        Hostel: r.hostel,
        Room: r.room,
        Bed: r.bed,
        "Assigned Date": r.from,
        "Expected Checkout": r.expectedOut,
        Checkout: r.checkout,
        Deposit: r.deposit,
        Remarks: r.remarks,
        Status: r.status,
      })),
      `Hostel_Assignments_${new Date().toISOString().split("T")[0]}`
    );
  };

  const pdfCols = [
    { title: "ID", dataKey: "dbId" },
    { title: "Student / Staff", dataKey: "student" },
    { title: "Hostel", dataKey: "hostel" },
    { title: "Room", dataKey: "room" },
    { title: "Bed", dataKey: "bed" },
    { title: "Assigned Date", dataKey: "from" },
    { title: "Expected Checkout", dataKey: "expectedOut" },
    { title: "Checkout", dataKey: "checkout" },
    { title: "Deposit", dataKey: "deposit" },
    { title: "Status", dataKey: "status" },
  ];

  const handleExportPDF = () => {
    exportToPDF(tableRows, "Hostel Assignments", `Hostel_Assignments_${new Date().toISOString().split("T")[0]}`, pdfCols);
  };

  const handlePrint = () => {
    printData("Hostel Assignments", pdfCols, tableRows);
  };

  const openAssignModal = () => {
    suppressModalLocationEffectsRef.current = false;
    setAssignmentModalMode("create");
    setEditingAssignmentId(null);
    setEditOriginalRoomId(null);
    setEditOriginalBedId(null);
    const h0 = hostelOptions[0]?.value ?? null;
    setModalUserType("student");
    setModalPersonId(null);
    setModalHostel(h0);
    setModalFloor(null);
    setModalRoom(null);
    setModalBed(null);
    setModalAssignedDate(toYmdString(new Date()));
    setModalExpectedCheckout("");
    setModalCheckoutDate("");
    setModalSecurityDeposit("");
    setModalRemarks("");
    void loadPeopleOptions();
  };

  const toYmdField = (d: unknown) => {
    if (d == null || d === "") return "";
    const s = typeof d === "string" ? d : String(d);
    return s.length >= 10 ? s.slice(0, 10) : s;
  };

  const openEditModal = async (record: any) => {
    const a = record.originalData;
    if (String(a.assignment_status || "").toLowerCase() !== "active") {
      await Swal.fire({
        icon: "info",
        title: "Not editable",
        text: "Only active assignments can be edited.",
      });
      return;
    }
    await loadPeopleOptions(
      a.academic_year_id != null && a.academic_year_id !== "" ? Number(a.academic_year_id) : undefined
    );
    suppressModalLocationEffectsRef.current = true;
    setAssignmentModalMode("edit");
    setEditingAssignmentId(Number(a.id));
    setEditOriginalRoomId(String(a.room_id));
    setEditOriginalBedId(String(a.bed_id));

    const hid = Number(a.hostel_id);
    try {
      const floorRes = await apiService.getHostelFloors(hid);
      const floorsRaw = Array.isArray(floorRes?.data) ? floorRes.data : [];
      setFloorOpts(
        floorsRaw.map((f: any) => ({
          value: String(f.id),
          label: `${f.floor_name} (#${f.floor_number})`,
        }))
      );
      setModalFloor(String(a.floor_id));

      const roomsRes = await apiService.getHostelRooms({ hostel_id: String(hid) });
      const roomsList = Array.isArray(roomsRes?.data) ? roomsRes.data : [];
      const filteredRooms = roomsList.filter((r: any) => String(r.floor_id) === String(a.floor_id));
      setRoomOpts(
        filteredRooms.map((r: any) => ({
          value: String(r.id),
          label: String(r.room_number ?? r.id),
        }))
      );
      setModalRoom(String(a.room_id));

      const bedsRes = await apiService.getHostelRoomBeds(Number(a.room_id));
      const bedsList = Array.isArray(bedsRes?.data) ? bedsRes.data : [];
      const selBeds = bedsList.filter(
        (bd: any) =>
          String(bd.bed_status) === "available" ||
          (a.bed_id != null && String(bd.id) === String(a.bed_id))
      );
      setBedOpts(
        selBeds.map((b: any) => ({
          value: String(b.id),
          label: `Bed ${b.bed_number}${String(b.bed_status) !== "available" ? " (current)" : ""}`,
        }))
      );
      setModalBed(String(a.bed_id));

      setModalHostel(String(hid));
      setModalUserType(String(a.user_type).toLowerCase() === "staff" ? "staff" : "student");
      setModalPersonId(
        a.student_id != null ? String(a.student_id) : a.staff_id != null ? String(a.staff_id) : null
      );
      setModalAssignedDate(toYmdField(a.assigned_date) || toYmdString(new Date()));
      setModalExpectedCheckout(toYmdField(a.expected_checkout_date));
      setModalCheckoutDate("");
      setModalSecurityDeposit(a.security_deposit != null ? String(a.security_deposit) : "");
      setModalRemarks(a.remarks != null ? String(a.remarks) : "");
    } catch {
      suppressModalLocationEffectsRef.current = false;
      await Swal.fire({ icon: "error", title: "Could not load assignment details" });
      return;
    }

    window.setTimeout(() => {
      suppressModalLocationEffectsRef.current = false;
    }, 0);

    const el = document.getElementById("add_hostel_assignment");
    const bootstrap = (window as unknown as { bootstrap?: { Modal: { getOrCreateInstance: (n: HTMLElement) => { show: () => void } } } })
      .bootstrap;
    if (el && bootstrap?.Modal) {
      bootstrap.Modal.getOrCreateInstance(el).show();
    }
  };

  const submitAssign = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (assignmentModalMode === "create" && academicYearId == null) {
      Swal.fire({
        icon: "warning",
        title: "Select academic year",
        text: "Choose the academic year in the app header, then create an assignment.",
      });
      return;
    }
    const pid = modalPersonId != null && modalPersonId !== "" ? Number(modalPersonId) : NaN;
    if (assignmentModalMode === "create") {
      if (!modalHostel || !modalFloor || !modalRoom || !modalBed || Number.isNaN(pid)) {
        Swal.fire({
          icon: "warning",
          title: "Complete the form",
          text: "Select user type, a person, hostel, floor, room, and an available bed.",
        });
        return;
      }
    } else if (!modalHostel || !modalFloor || !modalRoom || !modalBed) {
      Swal.fire({
        icon: "warning",
        title: "Complete the form",
        text: "Select hostel, floor, room, and bed.",
      });
      return;
    }
    const ad = modalAssignedDate.trim() || toYmdString(new Date());
    const exp = modalExpectedCheckout.trim();
    const co = modalCheckoutDate.trim();
    if (exp && ad && exp < ad) {
      Swal.fire({
        icon: "warning",
        title: "Invalid dates",
        text: "Expected checkout must be on or after the assigned date.",
      });
      return;
    }
    if (assignmentModalMode === "create" && co && ad && co < ad) {
      Swal.fire({
        icon: "warning",
        title: "Invalid dates",
        text: "Checkout date must be on or after the assigned date.",
      });
      return;
    }
    setSaving(true);
    try {
      const depRaw = modalSecurityDeposit.trim();
      const depNum = depRaw === "" ? 0 : Number(depRaw);
      const el = document.getElementById("add_hostel_assignment");
      const bootstrap = (window as any).bootstrap;

      if (assignmentModalMode === "edit" && editingAssignmentId != null) {
        const body: Record<string, unknown> = {
          hostel_id: Number(modalHostel),
          floor_id: Number(modalFloor),
          room_id: Number(modalRoom),
          bed_id: Number(modalBed),
          assigned_date: ad,
          expected_checkout_date: exp || null,
          security_deposit: Number.isFinite(depNum) && depNum >= 0 ? depNum : 0,
          remarks: modalRemarks.trim() ? modalRemarks.trim() : null,
        };
        const res = await apiService.updateHostelAssignment(editingAssignmentId, body);
        if (res?.status === "SUCCESS" || res?.success) {
          if (el && bootstrap?.Modal) {
            bootstrap.Modal.getInstance(el)?.hide();
          }
          await refetch();
          Swal.fire({ icon: "success", title: "Saved", timer: 1400, showConfirmButton: false });
        } else {
          Swal.fire({ icon: "error", title: res?.message || "Update failed" });
        }
      } else {
        const base: Record<string, unknown> = {
          academic_year_id: academicYearId,
          user_type: modalUserType,
          hostel_id: Number(modalHostel),
          floor_id: Number(modalFloor),
          room_id: Number(modalRoom),
          bed_id: Number(modalBed),
          assigned_date: ad,
          expected_checkout_date: exp || undefined,
          checkout_date: co || undefined,
          security_deposit: Number.isFinite(depNum) && depNum >= 0 ? depNum : 0,
          remarks: modalRemarks.trim() || undefined,
        };
        if (authUser?.id != null) base.assigned_by = authUser.id;
        if (modalUserType === "student") {
          base.student_id = pid;
        } else {
          base.staff_id = pid;
        }
        const res = await apiService.createHostelAssignment(base);
        if (res?.status === "SUCCESS" || res?.success) {
          if (el && bootstrap?.Modal) {
            bootstrap.Modal.getInstance(el)?.hide();
          }
          await refetch();
          Swal.fire({ icon: "success", title: "Assigned", timer: 1400, showConfirmButton: false });
        } else {
          Swal.fire({ icon: "error", title: res?.message || "Assignment failed" });
        }
      }
    } catch (err: any) {
      Swal.fire({ icon: "error", title: err?.message || "Request failed" });
    } finally {
      setSaving(false);
    }
  };

  const doCheckout = async (id: number) => {
    const r = await Swal.fire({ title: "Check out?", showCancelButton: true, icon: "question" });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.checkoutHostelAssignment(id, {});
      if (res?.status === "SUCCESS" || res?.success) {
        await refetch();
        Swal.fire({ icon: "success", title: "Checked out", timer: 1200, showConfirmButton: false });
      } else Swal.fire({ icon: "error", title: res?.message || "Failed" });
    } catch (e: any) {
      Swal.fire({ icon: "error", title: e?.message || "Failed" });
    }
  };

  const doCancel = async (id: number) => {
    const r = await Swal.fire({ title: "Cancel assignment?", showCancelButton: true, icon: "warning" });
    if (!r.isConfirmed) return;
    try {
      const res = await apiService.cancelHostelAssignment(id);
      if (res?.status === "SUCCESS" || res?.success) {
        await refetch();
        Swal.fire({ icon: "success", title: "Cancelled", timer: 1200, showConfirmButton: false });
      } else Swal.fire({ icon: "error", title: res?.message || "Failed" });
    } catch (e: any) {
      Swal.fire({ icon: "error", title: e?.message || "Failed" });
    }
  };

  const columns = [
    { title: "Student / staff", dataIndex: "student" },
    { title: "Hostel", dataIndex: "hostel" },
    { title: "Room", dataIndex: "room" },
    { title: "Bed", dataIndex: "bed" },
    { title: "Add On", dataIndex: "addedOn" },
    { title: "Assigned", dataIndex: "from" },
    { title: "Expected checkout", dataIndex: "expectedOut" },
    { title: "Checkout", dataIndex: "checkout" },
    { title: "Deposit", dataIndex: "deposit" },
    {
      title: "Remarks",
      dataIndex: "remarks",
      render: (text: string) => (
        <span className="text-truncate d-inline-block" style={{ maxWidth: 200 }} title={text !== "—" ? text : undefined}>
          {text}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (_: unknown, record: any) => (
        <HostelAssignmentStatusBadge status={record.originalData?.assignment_status} />
      ),
    },
    {
      title: "Action",
      dataIndex: "action",
      render: (_: unknown, record: any) => {
        const st = String(record.originalData?.assignment_status || "").toLowerCase();
        if (st !== "active") {
          return <span className="text-muted">—</span>;
        }
        const id = record.dbId as number;
        return (
          <div className="dropdown">
            <Link
              to="#"
              className="btn btn-white btn-icon btn-sm d-flex align-items-center justify-content-center rounded-circle p-0"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <i className="ti ti-dots-vertical fs-14" />
            </Link>
            <ul className="dropdown-menu dropdown-menu-end p-2">
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  onClick={(e) => {
                    e.preventDefault();
                    void openEditModal(record);
                  }}
                >
                  <i className="ti ti-edit-circle me-2" />
                  Edit
                </Link>
              </li>
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  onClick={(e) => {
                    e.preventDefault();
                    void doCheckout(id);
                  }}
                >
                  <i className="ti ti-logout me-2" />
                  Checkout
                </Link>
              </li>
              <li>
                <Link
                  className="dropdown-item rounded-1"
                  to="#"
                  onClick={(e) => {
                    e.preventDefault();
                    void doCancel(id);
                  }}
                >
                  <i className="ti ti-ban me-2" />
                  Cancel
                </Link>
              </li>
            </ul>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Hostel assignments</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to="#">Management</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Hostel assignments
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap gap-2">
              <TooltipOption
                onRefresh={async () => {
                  await refetch();
                  Swal.fire({ icon: "success", title: "Refreshed", timer: 800, showConfirmButton: false });
                }}
                onPrint={handlePrint}
                onExportPdf={handleExportPDF}
                onExportExcel={handleExportExcel}
              />
              <div className="mb-2">
                <Link
                  to="#"
                  className="btn btn-primary"
                  data-bs-toggle="modal"
                  data-bs-target="#add_hostel_assignment"
                  onClick={openAssignModal}
                >
                  <i className="ti ti-square-rounded-plus me-2" />
                  New assignment
                </Link>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
              <h4 className="mb-3">Hostel Assignments</h4>
              <div className="d-flex align-items-center flex-wrap">
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
                  <div className="dropdown-menu drop-width" ref={dropdownMenuRef}>
                    <form onSubmit={(ev) => ev.preventDefault()}>
                      <div className="d-flex align-items-center border-bottom p-3">
                        <h4 className="mb-0">Filter</h4>
                      </div>
                      <div className="p-3 border-bottom">
                        <p className="text-muted small mb-3">
                          Assignments load for the academic year selected in the app header (when set).
                        </p>
                        <div className="row">
                          <div className="col-md-6">
                            <div className="mb-3">
                              <label className="form-label">Hostel</label>
                              <CommonSelect
                                className="select"
                                options={hostelFilterOpts}
                                value={draftHostel || "all"}
                                onChange={(v) => setDraftHostel(v || "all")}
                              />
                            </div>
                          </div>
                          <div className="col-md-6">
                            <div className="mb-0">
                              <label className="form-label">Status</label>
                              <CommonSelect
                                className="select"
                                options={STATUS_FILTER}
                                value={draftStatus}
                                onChange={(v) => setDraftStatus(v || "all")}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="p-3 d-flex align-items-center justify-content-end">
                        <button type="button" className="btn btn-light me-3" onClick={resetFilters}>
                          Reset
                        </button>
                        <button type="button" className="btn btn-primary" onClick={applyFilters}>
                          Apply
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>
            </div>
            <div className="card-body p-0 py-3">
              {loading && (
                <div className="text-center p-4">
                  <div className="spinner-border text-primary" role="status" />
                </div>
              )}
              {error && <div className="alert alert-danger m-3">{error}</div>}
              {!loading && !error && <Table dataSource={tableRows} columns={columns} Selection={true} />}
            </div>
          </div>
        </div>
      </div>

      <div className="modal fade" id="add_hostel_assignment">
        <div className="modal-dialog modal-dialog-centered modal-xl modal-dialog-scrollable">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">{assignmentModalMode === "edit" ? "Edit assignment" : "New assignment"}</h4>
              <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close" />
            </div>
            <div className="modal-body">
              <p className="text-muted small mb-0">
                {assignmentModalMode === "edit" ? (
                  <>
                    Update <strong>hostel, floor, room, bed</strong>, dates, deposit, or remarks for this active stay.
                    Occupant cannot be changed here. Use <strong>Checkout</strong> or <strong>Cancel</strong> from the row
                    menu when the stay ends.
                  </>
                ) : (
                  <>
                    Uses the academic year from the app header. Pick <strong>Student</strong> or <strong>Staff</strong>,
                    then choose a person. Hostel gender rules still apply (profile gender vs hostel).
                  </>
                )}
              </p>
              {peopleLoading && (
                <div className="text-muted small mt-2 mb-0">
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Loading people…
                </div>
              )}

              <h6 className="fw-semibold mt-3 mb-2">Occupant</h6>
              <div className="row g-3">
                <div className="col-md-5 col-lg-4">
                  <label className="form-label">User type</label>
                  <CommonSelect
                    className="select"
                    options={USER_TYPE_OPTIONS}
                    value={modalUserType}
                    isDisabled={assignmentModalMode === "edit"}
                    onChange={(v) => {
                      const t = (v || "student") as "student" | "staff";
                      setModalUserType(t);
                      setModalPersonId(null);
                    }}
                  />
                </div>
                <div className="col-md-7 col-lg-8">
                  <label className="form-label">{modalUserType === "student" ? "Student" : "Staff"}</label>
                  <CommonSelect
                    className="select"
                    options={personSelectOptions}
                    value={modalPersonId || undefined}
                    isDisabled={assignmentModalMode === "edit"}
                    onChange={(v) => setModalPersonId(v ?? null)}
                    placeholder={
                      personSelectOptions.length
                        ? modalUserType === "student"
                          ? "Select student"
                          : "Select staff"
                        : "No records loaded"
                    }
                  />
                </div>
              </div>

              <h6 className="fw-semibold mt-3 mb-2 pt-2 border-top">Hostel, room &amp; bed</h6>
              <div className="row g-3">
                <div className="col-lg-4 col-md-6">
                  <label className="form-label">Hostel</label>
                  <CommonSelect
                    className="select"
                    options={hostelOptions}
                    value={modalHostel || undefined}
                    onChange={(v) => setModalHostel(v ?? null)}
                    placeholder="Select hostel"
                  />
                </div>
                <div className="col-lg-4 col-md-6">
                  <label className="form-label">Floor</label>
                  <CommonSelect
                    className="select"
                    options={floorOpts}
                    value={modalFloor || undefined}
                    onChange={(v) => setModalFloor(v ?? null)}
                    placeholder="Select floor"
                  />
                </div>
                <div className="col-lg-4 col-md-6">
                  <label className="form-label">Room</label>
                  <CommonSelect
                    className="select"
                    options={roomOpts}
                    value={modalRoom || undefined}
                    onChange={(v) => setModalRoom(v ?? null)}
                    placeholder="Select room"
                  />
                </div>
                <div className="col-lg-6 col-md-12">
                  <label className="form-label">
                    {assignmentModalMode === "edit" ? "Bed (includes current)" : "Available bed"}
                  </label>
                  <CommonSelect
                    className="select"
                    options={bedOpts}
                    value={modalBed || undefined}
                    onChange={(v) => setModalBed(v ?? null)}
                    placeholder={bedOpts.length ? "Select bed" : "No free beds"}
                  />
                </div>
              </div>

              <h6 className="fw-semibold mt-3 mb-2 pt-2 border-top">Dates &amp; fees</h6>
              <div className="row g-3">
                <div className="col-lg-4 col-md-6">
                  <label className="form-label">Assigned date</label>
                  <DatePicker
                    className="form-control datetimepicker w-100"
                    format="DD/MM/YYYY"
                    allowClear={false}
                    getPopupContainer={(trigger) => trigger.closest(".modal") ?? document.body}
                    value={modalAssignedDate ? dayjs(modalAssignedDate) : null}
                    onChange={(d) => setModalAssignedDate(d && d.isValid() ? d.format("YYYY-MM-DD") : "")}
                  />
                </div>
                <div className="col-lg-4 col-md-6">
                  <label className="form-label">Expected checkout</label>
                  <DatePicker
                    className="form-control datetimepicker w-100"
                    format="DD/MM/YYYY"
                    allowClear
                    placeholder="Optional"
                    getPopupContainer={(trigger) => trigger.closest(".modal") ?? document.body}
                    value={modalExpectedCheckout ? dayjs(modalExpectedCheckout) : null}
                    onChange={(d) => setModalExpectedCheckout(d && d.isValid() ? d.format("YYYY-MM-DD") : "")}
                    disabledDate={(current) => {
                      if (!current || !modalAssignedDate) return false;
                      return current.isBefore(dayjs(modalAssignedDate), "day");
                    }}
                  />
                </div>
                {assignmentModalMode === "create" && (
                  <>
                    <div className="col-lg-4 col-md-6">
                      <label className="form-label">Checkout date</label>
                      <DatePicker
                        className="form-control datetimepicker w-100"
                        format="DD/MM/YYYY"
                        allowClear
                        placeholder="Optional"
                        getPopupContainer={(trigger) => trigger.closest(".modal") ?? document.body}
                        value={modalCheckoutDate ? dayjs(modalCheckoutDate) : null}
                        onChange={(d) => setModalCheckoutDate(d && d.isValid() ? d.format("YYYY-MM-DD") : "")}
                        disabledDate={(current) => {
                          if (!current) return false;
                          const from = modalAssignedDate ? dayjs(modalAssignedDate) : null;
                          return Boolean(from && current.isBefore(from, "day"));
                        }}
                      />
                    </div>
                    <div className="col-12">
                      <p className="text-muted small mb-0">
                        If <strong>checkout date</strong> is set, the assignment is saved as <strong>completed</strong> on
                        that date and the bed is not marked occupied (backdated or no-stay records).
                      </p>
                    </div>
                  </>
                )}
                <div className="col-md-6">
                  <label className="form-label">Security deposit</label>
                  <input
                    type="number"
                    className="form-control"
                    min={0}
                    step="0.01"
                    placeholder="0"
                    value={modalSecurityDeposit}
                    onChange={(e) => setModalSecurityDeposit(e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows={3}
                    value={modalRemarks}
                    onChange={(e) => setModalRemarks(e.target.value)}
                    placeholder="Optional — visible on the assignment record"
                  />
                </div>
              </div>

              <div className="border-top pt-3 mt-3">
                <HostelRecordStatusToggle
                  id="add_hostel_assignment_record_status"
                  heading="Assignment status"
                  checked
                  disabled
                  onChange={() => {}}
                />
                <p className="text-muted small mt-2 mb-0">
                  {assignmentModalMode === "edit" ? (
                    <>
                      This stay remains <strong>Active</strong> until you use <strong>Checkout</strong> or{" "}
                      <strong>Cancel</strong> from the row actions menu.
                    </>
                  ) : (
                    <>
                      New stays are <strong>Active</strong>. Use <strong>Checkout</strong> or <strong>Cancel</strong>{" "}
                      from the row menu to set completed or cancelled.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-light" data-bs-dismiss="modal">
                Close
              </button>
              <button type="button" className="btn btn-primary" disabled={saving} onClick={submitAssign}>
                {saving ? "Saving…" : assignmentModalMode === "edit" ? "Save changes" : "Assign"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HostelAssignments;
