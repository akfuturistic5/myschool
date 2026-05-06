import { useMemo, useState, useCallback, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  Modal,
  OverlayTrigger,
  Tooltip,
  Spinner,
  Alert,
} from "react-bootstrap";
import { Link } from "react-router-dom";
import { DatePicker, TimePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { all_routes } from "../router/all_routes";
import { useEvents } from "../../core/hooks/useEvents";
import { useCurrentUser } from "../../core/hooks/useCurrentUser";
import { apiService } from "../../core/services/apiService";
import { canManageSchoolEvents } from "../../core/utils/roleUtils";

type SchoolEvent = {
  id: number;
  title: string;
  description?: string | null;
  start_date: string;
  end_date?: string | null;
  event_color?: string | null;
  is_all_day?: boolean;
  location?: string | null;
  event_category?: string | null;
  event_for?: string | null;
  target_class_ids?: number[] | null;
  target_section_ids?: number[] | null;
  target_department_ids?: number[] | null;
  target_designation_ids?: number[] | null;
  attachment_url?: string | null;
  created_at?: string | null;
};

type ClassItem = { id: number; class_name?: string; class_code?: string };
type SectionItem = { id: number; section_name?: string; class_name?: string };
type DepartmentItem = { id: number; department_name?: string };
type DesignationItem = { id: number; designation_name?: string };
type EventAttachment = {
  id: number;
  event_id: number;
  file_url: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  uploaded_by?: number | null;
  created_at?: string;
};

const categoryToColor: Record<string, string> = {
  Celebration: "bg-warning",
  Training: "bg-info",
  Meeting: "bg-primary",
  Holidays: "bg-danger",
};

const FILTER_OPTIONS = [
  { key: "all" as const, label: "All categories" },
  { key: "Celebration", label: "Celebration" },
  { key: "Training", label: "Training" },
  { key: "Meeting", label: "Meeting" },
  { key: "Holidays", label: "Holidays" },
];

const AUDIENCE_FILTER_OPTIONS = [
  { key: "all" as const, label: "All audiences" },
  { key: "students" as const, label: "Students" },
  { key: "staff" as const, label: "Staff" },
  { key: "parents" as const, label: "Parents" },
  { key: "guardians" as const, label: "Guardians" },
];

const EVENT_AUDIENCE_OPTIONS: Array<{
  key: "students" | "staff" | "parents" | "guardians";
  label: string;
}> = [
  { key: "students", label: "Students" },
  { key: "staff", label: "Staff" },
  { key: "parents", label: "Parents" },
  { key: "guardians", label: "Guardians" },
];

function parseEventForList(value?: string | null) {
  const tokens = String(value || "all")
    .split(",")
    .map((v) => String(v || "").trim().toLowerCase())
    .map((v) => (v === "staffs" || v === "teachers" ? "staff" : v))
    .filter(
      (v): v is "all" | "students" | "staff" | "parents" | "guardians" =>
        v === "all" || v === "students" || v === "staff" || v === "parents" || v === "guardians"
    );
  return Array.from(new Set(tokens));
}

function formatDateShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatTimeShort(iso?: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDateTimeShort(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function categoryBorderClass(cat?: string | null) {
  const c = (cat || "").toLowerCase();
  if (c === "celebration") return "border-warning";
  if (c === "training") return "border-success";
  if (c === "meeting") return "border-info";
  if (c === "holidays") return "border-danger";
  return "border-secondary";
}

function normalizeAttachmentInput(rawValue: string) {
  const value = rawValue.trim();
  if (!value) return { normalized: "", valid: true };
  if (value.startsWith("/")) return { normalized: value, valid: true };
  try {
    const direct = new URL(value);
    if (["http:", "https:"].includes(direct.protocol)) {
      return { normalized: direct.toString(), valid: true };
    }
    return { normalized: value, valid: false };
  } catch {
    try {
      // Accept plain domains like "www.example.com" by assuming https.
      const withHttps = new URL(`https://${value}`);
      return { normalized: withHttps.toString(), valid: true };
    } catch {
      return { normalized: value, valid: false };
    }
  }
}

function toLocalApiDateTime(value: Dayjs) {
  // Keep wall-clock time stable across client/server by sending local timestamp
  // without timezone conversion (DB column is timestamp without time zone).
  return value.format("YYYY-MM-DDTHH:mm:ss");
}

const Events = () => {
  const routes = all_routes;
  const { user } = useCurrentUser();
  const canManage = canManageSchoolEvents(user);
  const isAdmin = Number((user as { role_id?: number | string } | null)?.role_id) === 1;
  const [filterCategory, setFilterCategory] = useState<string | "all">("all");
  const [filterAudience, setFilterAudience] = useState<
    "all" | "students" | "staff" | "parents" | "guardians"
  >("all");
  const [filterStartDate, setFilterStartDate] = useState<Dayjs | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Dayjs | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const listParams = useMemo(() => {
    const p: Record<string, string | number> = {};
    if (filterCategory !== "all") p.event_category = filterCategory;
    if (filterAudience !== "all") p.event_for = filterAudience;
    if (filterStartDate && filterEndDate) {
      p.start_date = toLocalApiDateTime(filterStartDate.startOf("day"));
      p.end_date = toLocalApiDateTime(filterEndDate.endOf("day"));
    }
    if (searchTerm.trim()) p.q = searchTerm.trim();
    return p;
  }, [filterCategory, filterAudience, filterStartDate, filterEndDate, searchTerm]);

  const { events, loading, error, refetch } = useEvents({
    forDashboard: false,
    limit: 300,
    params: listParams,
  });

  const filteredEvents = useMemo(() => (events || []) as SchoolEvent[], [events]);

  const calendarFcEvents = useMemo(
    () =>
      filteredEvents.map((ev) => ({
        id: String(ev.id),
        title: ev.title,
        start: ev.start_date,
        end: ev.end_date || undefined,
        allDay: !!ev.is_all_day,
        classNames: [ev.event_color || "bg-primary"],
        extendedProps: { schoolEvent: ev },
      })),
    [filteredEvents]
  );

  const sidebarSorted = useMemo(() => {
    const now = Date.now();
    return [...filteredEvents].sort((a, b) => {
      const ta = new Date(a.start_date).getTime();
      const tb = new Date(b.start_date).getTime();
      const aFuture = ta >= now;
      const bFuture = tb >= now;
      if (aFuture !== bFuture) return aFuture ? -1 : 1;
      if (aFuture) return ta - tb;
      return tb - ta;
    });
  }, [filteredEvents]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailEvent, setDetailEvent] = useState<SchoolEvent | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryValue, setCategoryValue] = useState("");
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);
  const [startTime, setStartTime] = useState<Dayjs | null>(null);
  const [endTime, setEndTime] = useState<Dayjs | null>(null);
  const [location, setLocation] = useState("");
  const [eventForList, setEventForList] = useState<
    Array<"students" | "staff" | "parents" | "guardians">
  >([]);
  const [targetClassIds, setTargetClassIds] = useState<number[]>([]);
  const [targetSectionIds, setTargetSectionIds] = useState<number[]>([]);
  const [targetDepartmentIds, setTargetDepartmentIds] = useState<number[]>([]);
  const [targetDesignationIds, setTargetDesignationIds] = useState<number[]>([]);
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [classOptions, setClassOptions] = useState<ClassItem[]>([]);
  const [sectionOptions, setSectionOptions] = useState<SectionItem[]>([]);
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentItem[]>([]);
  const [designationOptions, setDesignationOptions] = useState<DesignationItem[]>(
    []
  );
  const [submitting, setSubmitting] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uiMessage, setUiMessage] = useState<{
    type: "success" | "danger" | "warning";
    text: string;
  } | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [detailAttachments, setDetailAttachments] = useState<EventAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [showTargetsModal, setShowTargetsModal] = useState(false);
  const [targetsModalTitle, setTargetsModalTitle] = useState("");
  const [targetsModalItems, setTargetsModalItems] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCategoryValue("");
    setStartDate(null);
    setEndDate(null);
    setStartTime(null);
    setEndTime(null);
    setLocation("");
    setEventForList([]);
    setTargetClassIds([]);
    setTargetSectionIds([]);
    setTargetDepartmentIds([]);
    setTargetDesignationIds([]);
    setAttachmentUrl("");
    setPendingFiles([]);
  }, []);

  const openCreateModal = useCallback(
    (prefillDay?: Dayjs) => {
      resetForm();
      const d = prefillDay || dayjs().startOf("day");
      setStartDate(d);
      setEndDate(d);
      setShowAddModal(true);
    },
    [resetForm]
  );

  const openEditModal = useCallback((ev: SchoolEvent) => {
    setEditingId(ev.id);
    setTitle(ev.title);
    setDescription(ev.description || "");
    setCategoryValue(ev.event_category || "");
    const sd = dayjs(ev.start_date);
    const ed = ev.end_date ? dayjs(ev.end_date) : sd;
    setStartDate(sd);
    setEndDate(ed);
    setLocation(ev.location || "");
    const audience = parseEventForList(ev.event_for).filter(
      (a): a is "students" | "staff" | "parents" | "guardians" => a !== "all"
    );
    setEventForList(audience);
    setTargetClassIds(Array.isArray(ev.target_class_ids) ? ev.target_class_ids : []);
    setTargetSectionIds(Array.isArray(ev.target_section_ids) ? ev.target_section_ids : []);
    setTargetDepartmentIds(
      Array.isArray(ev.target_department_ids) ? ev.target_department_ids : []
    );
    setTargetDesignationIds(
      Array.isArray(ev.target_designation_ids) ? ev.target_designation_ids : []
    );
    setAttachmentUrl(ev.attachment_url || "");
    if (ev.is_all_day) {
      setStartTime(null);
      setEndTime(null);
    } else {
      setStartTime(sd);
      setEndTime(ev.end_date ? dayjs(ev.end_date) : null);
    }
    setShowDetailModal(false);
    setDetailEvent(null);
    setShowAddModal(true);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [classesRes, sectionsRes, departmentsRes, designationsRes] =
          await Promise.all([
          apiService.getClasses(),
          apiService.getSections(),
          apiService.getDepartments(),
          apiService.getDesignations(),
        ]);
        if (!mounted) return;
        setClassOptions(Array.isArray(classesRes?.data) ? classesRes.data : []);
        setSectionOptions(Array.isArray(sectionsRes?.data) ? sectionsRes.data : []);
        setDepartmentOptions(
          Array.isArray(departmentsRes?.data) ? departmentsRes.data : []
        );
        setDesignationOptions(
          Array.isArray(designationsRes?.data) ? designationsRes.data : []
        );
      } catch {
        if (!mounted) return;
        setClassOptions([]);
        setSectionOptions([]);
        setDepartmentOptions([]);
        setDesignationOptions([]);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const buildPayload = useCallback(() => {
    if (!title.trim() || !startDate) return null;
    const isAllDay = !startTime && !endTime;
    let startIso: string;
    let endIso: string | null = null;
    if (isAllDay) {
      startIso = toLocalApiDateTime(startDate.startOf("day"));
      endIso = toLocalApiDateTime((endDate || startDate).endOf("day"));
    } else {
      const st = startTime || dayjs().hour(9).minute(0);
      const startDt = startDate
        .clone()
        .hour(st.hour())
        .minute(st.minute())
        .second(0)
        .millisecond(0);
      let endDt = (endDate || startDate)
        .clone()
        .hour((endTime || st.add(1, "hour")).hour())
        .minute((endTime || st.add(1, "hour")).minute())
        .second(0)
        .millisecond(0);
      // Safety: always keep timed end strictly after timed start.
      if (!endDt.isAfter(startDt)) {
        endDt = startDt.add(1, "hour");
      }
      startIso = toLocalApiDateTime(startDt);
      endIso = toLocalApiDateTime(endDt);
    }
    const catLabel = categoryValue.trim() || null;
    const eventColor = catLabel
      ? categoryToColor[catLabel] || "bg-primary"
      : "bg-primary";
    const attachmentCheck = normalizeAttachmentInput(attachmentUrl);
    const normalizedAttachment = attachmentCheck.normalized;
    if (!attachmentCheck.valid) return "INVALID_ATTACHMENT_URL";
    return {
      title: title.trim(),
      description: description.trim() || null,
      start_date: startIso,
      end_date: endIso,
      event_color: eventColor,
      is_all_day: isAllDay,
      location: location.trim() || null,
      event_category: catLabel,
      event_for: eventForList.length ? eventForList.join(",") : "all",
      target_class_ids:
        (eventForList.includes("students") ||
          eventForList.includes("parents") ||
          eventForList.includes("guardians")) &&
        targetClassIds.length
          ? targetClassIds
          : null,
      target_section_ids:
        (eventForList.includes("students") ||
          eventForList.includes("parents") ||
          eventForList.includes("guardians")) &&
        targetSectionIds.length
          ? targetSectionIds
          : null,
      target_department_ids:
        eventForList.includes("staff") && targetDepartmentIds.length
          ? targetDepartmentIds
          : null,
      target_designation_ids:
        eventForList.includes("staff") && targetDesignationIds.length
          ? targetDesignationIds
          : null,
      attachment_url: normalizedAttachment || null,
    };
  }, [
    title,
    description,
    startDate,
    endDate,
    startTime,
    endTime,
    categoryValue,
    location,
    eventForList,
    targetClassIds,
    targetSectionIds,
    targetDepartmentIds,
    targetDesignationIds,
    attachmentUrl,
  ]);

  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setUiMessage(null);
    const payload = buildPayload();
    if (!payload) {
      alert("Title and start date are required.");
      return;
    }
    if (payload === "INVALID_ATTACHMENT_URL") {
      alert("Attachment URL must be a valid http/https URL.");
      return;
    }
    setSubmitting(true);
    try {
      let activeEventId: number | null = null;
      const uploadFailures: string[] = [];
      if (editingId != null) {
        const res = await apiService.updateEvent(editingId, payload);
        if (res?.status !== "SUCCESS") {
          alert(res?.message || "Failed to update event");
          return;
        }
        activeEventId = editingId;
      } else {
        const res = await apiService.createEvent(payload);
        if (res?.status !== "SUCCESS") {
          alert(res?.message || "Failed to create event");
          return;
        }
        activeEventId = Number(res?.data?.id || 0) || null;
      }

      if (activeEventId && pendingFiles.length > 0) {
        for (const file of pendingFiles) {
          // Upload each file to event-attachment endpoint (metadata + storage)
          try {
            const upRes = await apiService.uploadEventAttachment(activeEventId, file);
            if (upRes?.status !== "SUCCESS") {
              uploadFailures.push(upRes?.message || `Failed to upload ${file.name}`);
            }
          } catch (uploadErr: unknown) {
            const msg =
              uploadErr instanceof Error
                ? uploadErr.message
                : `Failed to upload ${file.name}`;
            uploadFailures.push(msg);
          }
        }
      }
      await refetch();
      setShowAddModal(false);
      resetForm();
      if (uploadFailures.length > 0) {
        setUiMessage({
          type: "warning",
          text:
            (editingId != null
              ? "Event updated successfully, but some attachments failed to upload."
              : "Event created successfully, but some attachments failed to upload.") +
            " Please run attachment migration and try re-upload.",
        });
      } else {
        setUiMessage({
          type: "success",
          text:
            editingId != null
              ? "Event updated successfully."
              : "Event created successfully.",
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Save failed";
      setUiMessage({ type: "danger", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this school event?")) return;
    setUiMessage(null);
    setSubmitting(true);
    try {
      const res = await apiService.deleteEvent(id);
      if (res?.status !== "SUCCESS") {
        alert(res?.message || "Failed to delete");
        return;
      }
      await refetch();
      setShowDetailModal(false);
      setDetailEvent(null);
      setUiMessage({ type: "success", text: "Event deleted successfully." });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      setUiMessage({ type: "danger", text: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachmentUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUiMessage(null);
    const maxBytes = 10 * 1024 * 1024;
    if (file.size > maxBytes) {
      setUiMessage({ type: "danger", text: "Attachment must be 10MB or smaller." });
      e.target.value = "";
      return;
    }
    setUploadingAttachment(true);
    try {
      const res = await apiService.uploadSchoolStorageFile(file, "documents");
      const uploadedUrl = res?.data?.url;
      if (!res || res.status !== "SUCCESS" || !uploadedUrl) {
        throw new Error(res?.message || "Attachment upload failed");
      }
      setAttachmentUrl(uploadedUrl);
      setUiMessage({ type: "success", text: "Attachment uploaded." });
    } catch (err: unknown) {
      setUiMessage({
        type: "danger",
        text: err instanceof Error ? err.message : "Attachment upload failed",
      });
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  };

  const loadEventAttachments = useCallback(async (eventId: number) => {
    setAttachmentsLoading(true);
    try {
      const res = await apiService.getEventAttachments(eventId);
      if (res?.status === "SUCCESS" && Array.isArray(res.data)) {
        setDetailAttachments(res.data);
      } else {
        setDetailAttachments([]);
      }
    } catch {
      setDetailAttachments([]);
    } finally {
      setAttachmentsLoading(false);
    }
  }, []);

  const handlePendingFilesSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const maxBytes = 10 * 1024 * 1024;
    const valid = files.filter((f) => f.size <= maxBytes);
    if (valid.length !== files.length) {
      setUiMessage({
        type: "danger",
        text: "Some files were skipped because they exceed 10MB.",
      });
    }
    setPendingFiles((prev) => [...prev, ...valid]);
  };

  const removePendingFile = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const deleteAttachment = async (eventId: number, attachmentId: number) => {
    if (!window.confirm("Delete this attachment?")) return;
    try {
      const res = await apiService.deleteEventAttachment(eventId, attachmentId);
      if (res?.status !== "SUCCESS") {
        throw new Error(res?.message || "Failed to delete attachment");
      }
      await loadEventAttachments(eventId);
      setUiMessage({ type: "success", text: "Attachment deleted." });
    } catch (err: unknown) {
      setUiMessage({
        type: "danger",
        text: err instanceof Error ? err.message : "Failed to delete attachment",
      });
    }
  };

  const handleEventClick = useCallback((info: { event: { extendedProps: { schoolEvent?: SchoolEvent } } }) => {
    const ev = info?.event?.extendedProps?.schoolEvent;
    if (!ev) return;
    setDetailEvent(ev);
    setShowDetailModal(true);
    loadEventAttachments(ev.id);
  }, [loadEventAttachments]);

  const headerToolbar = useMemo(
    () => ({
      start: "title",
      center: "dayGridMonth,dayGridWeek,dayGridDay",
      end: canManage ? "custombtn" : undefined,
    }),
    [canManage]
  );

  const customButtons = useMemo<Record<string, { text: string; click: () => void }>>(() => {
    if (!canManage) return {} as Record<string, { text: string; click: () => void }>;
    return {
      custombtn: {
        text: "Add New Event",
        click: () => openCreateModal(),
      },
    };
  }, [canManage, openCreateModal]);

  const activeFilterLabel =
    FILTER_OPTIONS.find((f) => f.key === filterCategory)?.label ||
    "All categories";

  const targetSummary = (ev: SchoolEvent) => {
    const audienceTokens = parseEventForList(ev.event_for).filter(
      (t): t is "students" | "staff" | "parents" | "guardians" => t !== "all"
    );
    if (!audienceTokens.length) return "All users";
    if (audienceTokens.length > 1) {
      return audienceTokens
        .map((v) => v.charAt(0).toUpperCase() + v.slice(1))
        .join(", ");
    }
    const forValue = audienceTokens[0];
    if (forValue === "staff") {
      const depCount = Array.isArray(ev.target_department_ids)
        ? ev.target_department_ids.length
        : 0;
      const desCount = Array.isArray(ev.target_designation_ids)
        ? ev.target_designation_ids.length
        : 0;
      if (!depCount && !desCount) return "Staff";
      return `Staff (${depCount} department, ${desCount} designation)`;
    }
    if (forValue === "parents") return "Parents";
    if (forValue === "guardians") return "Guardians";
    if (
      forValue === "students" ||
      forValue === "parents" ||
      forValue === "guardians"
    ) {
      const classCount = Array.isArray(ev.target_class_ids)
        ? ev.target_class_ids.length
        : 0;
      const sectionCount = Array.isArray(ev.target_section_ids)
        ? ev.target_section_ids.length
        : 0;
      const label =
        forValue === "students"
          ? "Students"
          : forValue === "parents"
            ? "Parents"
            : "Guardians";
      if (!classCount && !sectionCount) return label;
      return `${label} (${classCount} class, ${sectionCount} section)`;
    }
    return "Custom";
  };

  const classNameById = useMemo(() => {
    const map = new Map<number, string>();
    classOptions.forEach((c) => {
      map.set(c.id, c.class_name || c.class_code || `Class ${c.id}`);
    });
    return map;
  }, [classOptions]);

  const sectionNameById = useMemo(() => {
    const map = new Map<number, string>();
    sectionOptions.forEach((s) => {
      map.set(
        s.id,
        s.class_name
          ? `${s.class_name} - ${s.section_name || s.id}`
          : s.section_name || `Section ${s.id}`
      );
    });
    return map;
  }, [sectionOptions]);

  const departmentNameById = useMemo(() => {
    const map = new Map<number, string>();
    departmentOptions.forEach((d) => {
      map.set(d.id, d.department_name || `Department ${d.id}`);
    });
    return map;
  }, [departmentOptions]);

  const designationNameById = useMemo(() => {
    const map = new Map<number, string>();
    designationOptions.forEach((d) => {
      map.set(d.id, d.designation_name || `Designation ${d.id}`);
    });
    return map;
  }, [designationOptions]);

  const renderTargetCell = (
    ids: number[] | null | undefined,
    type: "class" | "section" | "department" | "designation",
    rowKey: number,
    allowViewButton = false
  ) => {
    if (!Array.isArray(ids) || ids.length === 0) return "—";
    const nameMap =
      type === "class"
        ? classNameById
        : type === "section"
          ? sectionNameById
          : type === "department"
            ? departmentNameById
            : designationNameById;
    const labels = ids.map((id) => nameMap.get(id) || `#${id}`);
    const preview = labels.slice(0, 2).join(", ");
    const extraCount = Math.max(0, labels.length - 2);
    const titleText =
      type === "class"
        ? "Target Classes"
        : type === "section"
          ? "Target Sections"
          : type === "department"
            ? "Target Departments"
            : "Target Designations";
    const openTargetsModal = () => {
      setTargetsModalTitle(titleText);
      setTargetsModalItems(labels);
      setShowTargetsModal(true);
    };
    if (allowViewButton) {
      return (
        <div className="d-flex align-items-start gap-2">
          <div className="btn btn-sm btn-light text-start p-1 mb-0">
            {labels.length} selected
            <span className="d-block text-muted small">
              {preview}
              {extraCount > 0 ? `, +${extraCount} more` : ""}
            </span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={openTargetsModal}
          >
            View
          </button>
        </div>
      );
    }
    return (
      <OverlayTrigger
        placement="top"
        overlay={<Tooltip id={`tt-${type}-${rowKey}`}>{labels.join(", ")}</Tooltip>}
      >
        <button type="button" className="btn btn-sm btn-light text-start p-1">
          {labels.length} selected
          <span className="d-block text-muted small">
            {preview}
            {extraCount > 0 ? `, +${extraCount} more` : ""}
          </span>
        </button>
      </OverlayTrigger>
    );
  };

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="mb-1">Events</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">Announcement</li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Events
                  </li>
                </ol>
              </nav>
            </div>
            <div className="d-flex my-xl-auto right-content align-items-center flex-wrap">
              <div className="pe-1 mb-2">
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip id="tooltip-refresh">Reload from server</Tooltip>}
                >
                  <button
                    type="button"
                    className="btn btn-outline-light bg-white btn-icon me-1"
                    onClick={() => refetch()}
                    disabled={loading}
                  >
                    {loading ? (
                      <Spinner animation="border" size="sm" />
                    ) : (
                      <i className="ti ti-refresh" />
                    )}
                  </button>
                </OverlayTrigger>
              </div>
              <div className="pe-1 mb-2">
                <OverlayTrigger
                  placement="top"
                  overlay={<Tooltip id="tooltip-print">Print this page</Tooltip>}
                >
                  <button
                    type="button"
                    className="btn btn-outline-light bg-white btn-icon me-1"
                    onClick={() => window.print()}
                  >
                    <i className="ti ti-printer" />
                  </button>
                </OverlayTrigger>
              </div>
              <div className="mb-2">
                <span className="text-muted small">
                  External sync is not enabled in this deployment.
                </span>
              </div>
            </div>
          </div>

          {error ? (
            <Alert variant="warning" className="mb-3">
              {error}
            </Alert>
          ) : null}
          {uiMessage ? (
            <Alert
              variant={
                uiMessage.type === "success"
                  ? "success"
                  : uiMessage.type === "warning"
                    ? "warning"
                    : "danger"
              }
              className="mb-3"
              onClose={() => setUiMessage(null)}
              dismissible
            >
              {uiMessage.text}
            </Alert>
          ) : null}

          <div className="row">
            <div className="col-12 theiaStickySidebar">
              <div className="stickybar">
                <div className="card">
                  <div className="card-body position-relative">
                    {loading && !calendarFcEvents.length ? (
                      <div className="text-center py-5">
                        <Spinner animation="border" role="status" />
                        <p className="mt-2 mb-0 text-muted">Loading events…</p>
                      </div>
                    ) : null}
                    <FullCalendar
                      plugins={[
                        dayGridPlugin,
                        timeGridPlugin,
                        interactionPlugin,
                      ]}
                      initialView="dayGridMonth"
                      events={calendarFcEvents}
                      headerToolbar={headerToolbar}
                      customButtons={customButtons}
                      eventClick={handleEventClick}
                      dateClick={(arg) => {
                        if (!canManage) return;
                        openCreateModal(dayjs(arg.dateStr));
                      }}
                    />
                  </div>
                </div>
                <div className="card mt-3">
                  <div className="card-body">
                    <div className="row g-2">
                      <div className="col-md-4">
                        <label className="form-label mb-1">Search</label>
                        <input
                          className="form-control"
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          placeholder="Title or description"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label mb-1">Start</label>
                        <DatePicker
                          className="form-control w-100"
                          value={filterStartDate}
                          onChange={setFilterStartDate}
                          format="DD/MM/YYYY"
                        />
                      </div>
                      <div className="col-md-2">
                        <label className="form-label mb-1">End</label>
                        <DatePicker
                          className="form-control w-100"
                          value={filterEndDate}
                          onChange={setFilterEndDate}
                          format="DD/MM/YYYY"
                        />
                      </div>
                      {isAdmin && (
                        <div className="col-md-2">
                          <label className="form-label mb-1">Audience</label>
                          <select
                            className="form-select"
                            value={filterAudience}
                            onChange={(e) =>
                              setFilterAudience(
                                e.target.value as
                                  | "all"
                                  | "students"
                                  | "staff"
                                  | "parents"
                                  | "guardians"
                              )
                            }
                          >
                            {AUDIENCE_FILTER_OPTIONS.map((o) => (
                              <option key={o.key} value={o.key}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div className="col-md-2 d-flex align-items-end">
                        <button
                          type="button"
                          className="btn btn-outline-secondary w-100"
                          onClick={() => {
                            setSearchTerm("");
                            setFilterStartDate(null);
                            setFilterEndDate(null);
                            setFilterCategory("all");
                            setFilterAudience("all");
                          }}
                        >
                          Reset filters
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="card mt-3">
                  <div className="card-header d-flex align-items-center justify-content-between">
                    <h5 className="mb-0">Event History Table</h5>
                    <span className="badge bg-light text-dark">
                      {filteredEvents.length} records
                    </span>
                  </div>
                  <div className="card-body p-0">
                    {!filteredEvents.length ? (
                      <div className="alert alert-info m-3 mb-0" role="alert">
                        <i className="ti ti-info-circle me-2" />
                        No events found for current filters.
                      </div>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-striped table-hover align-middle mb-0">
                          <thead className="table-light">
                            <tr>
                              <th>ID</th>
                              <th>Title</th>
                              <th>Category</th>
                              <th>Audience</th>
                              <th>Start</th>
                              <th>End</th>
                              <th>All Day</th>
                              <th>Location</th>
                              <th>Target Classes</th>
                              <th>Target Sections</th>
                              <th>Target Departments</th>
                              <th>Target Designations</th>
                              <th>Attachment URL</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredEvents.map((ev) => (
                              <tr key={`history-${ev.id}`}>
                                <td className="text-nowrap">{ev.id}</td>
                                <td className="text-nowrap fw-medium">{ev.title}</td>
                                <td className="text-nowrap">{ev.event_category || "—"}</td>
                                <td className="text-nowrap">{targetSummary(ev)}</td>
                                <td className="text-nowrap">
                                  {formatDateTimeShort(ev.start_date)}
                                </td>
                                <td className="text-nowrap">
                                  {formatDateTimeShort(ev.end_date)}
                                </td>
                                <td className="text-nowrap">
                                  {ev.is_all_day ? "Yes" : "No"}
                                </td>
                                <td className="text-nowrap">{ev.location || "—"}</td>
                                <td className="text-nowrap">
                                  {renderTargetCell(
                                    ev.target_class_ids,
                                    "class",
                                    ev.id,
                                    true
                                  )}
                                </td>
                                <td className="text-nowrap">
                                  {renderTargetCell(
                                    ev.target_section_ids,
                                    "section",
                                    ev.id,
                                    true
                                  )}
                                </td>
                                <td className="text-nowrap">
                                  {renderTargetCell(
                                    ev.target_department_ids,
                                    "department",
                                    ev.id
                                  )}
                                </td>
                                <td className="text-nowrap">
                                  {renderTargetCell(
                                    ev.target_designation_ids,
                                    "designation",
                                    ev.id
                                  )}
                                </td>
                                <td className="text-nowrap">
                                  {ev.attachment_url ? (
                                    <a
                                      href={ev.attachment_url}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      Open
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </td>
                                <td className="text-nowrap">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-primary"
                                    onClick={() => {
                                      setDetailEvent(ev);
                                      setShowDetailModal(true);
                                      loadEventAttachments(ev.id);
                                    }}
                                  >
                                    View
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal
        show={showAddModal}
        onHide={() => {
          if (!submitting) {
            setShowAddModal(false);
            resetForm();
          }
        }}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editingId != null ? "Edit school event" : "New school event"}
          </Modal.Title>
        </Modal.Header>
        <form onSubmit={handleSaveEvent}>
          <Modal.Body>
            {!canManage ? (
              <Alert variant="warning">
                Only Headmaster and Administrative staff can create or edit school events.
              </Alert>
            ) : null}
            <div className="row">
              <div className="col-md-12 mb-3">
                <label className="form-label">Event title</label>
                <input
                  type="text"
                  className="form-control"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter title"
                  required
                  disabled={!canManage}
                />
              </div>
              <div className="col-md-12 mb-3">
                <label className="form-label">Category</label>
                <input
                  type="text"
                  className="form-control"
                  value={categoryValue}
                  onChange={(e) => setCategoryValue(e.target.value)}
                  placeholder="Type event category"
                  disabled={!canManage}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Event audience</label>
                <div className="border rounded p-2 bg-light">
                  <div className="form-check form-check-inline me-3">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      id="event-audience-all"
                      checked={eventForList.length === 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          // "All" is stored as event_for = "all" (empty list on UI)
                          // to avoid exceeding existing varchar(20) storage.
                          setEventForList([]);
                        }
                      }}
                      disabled={!canManage}
                    />
                    <label className="form-check-label" htmlFor="event-audience-all">
                      All
                    </label>
                  </div>
                  {EVENT_AUDIENCE_OPTIONS.map((aud) => {
                    const checked = eventForList.includes(aud.key);
                    return (
                      <div className="form-check form-check-inline me-3" key={aud.key}>
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`event-audience-${aud.key}`}
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEventForList((prev) =>
                                prev.includes(aud.key) ? prev : [...prev, aud.key]
                              );
                            } else {
                              setEventForList((prev) => prev.filter((x) => x !== aud.key));
                            }
                          }}
                          disabled={!canManage}
                        />
                        <label className="form-check-label" htmlFor={`event-audience-${aud.key}`}>
                          {aud.label}
                        </label>
                      </div>
                    );
                  })}
                </div>
                <p className="text-muted small mb-0 mt-1">
                  Select "All" to publish for everyone, or pick one/more audiences.
                </p>
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Location (optional)</label>
                <input
                  type="text"
                  className="form-control"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  disabled={!canManage}
                />
              </div>
              {eventForList.includes("students") ||
              eventForList.includes("parents") ||
              eventForList.includes("guardians") ? (
                <>
                  <div className="col-md-6 mb-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <label className="form-label">Target classes (optional)</label>
                      <div className="form-check mb-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="target-classes-all"
                          checked={
                            classOptions.length > 0 &&
                            targetClassIds.length === classOptions.length
                          }
                          onChange={(e) =>
                            setTargetClassIds(
                              e.target.checked ? classOptions.map((c) => c.id) : []
                            )
                          }
                          disabled={!canManage || !classOptions.length}
                        />
                        <label className="form-check-label" htmlFor="target-classes-all">
                          Select All
                        </label>
                      </div>
                    </div>
                    <div className="border rounded p-2 bg-light" style={{ maxHeight: 180, overflowY: "auto" }}>
                      {classOptions.map((c) => {
                        const checked = targetClassIds.includes(c.id);
                        const id = `target-class-${c.id}`;
                        return (
                          <div className="form-check" key={c.id}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={id}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTargetClassIds((prev) =>
                                    prev.includes(c.id) ? prev : [...prev, c.id]
                                  );
                                } else {
                                  setTargetClassIds((prev) => prev.filter((x) => x !== c.id));
                                }
                              }}
                              disabled={!canManage}
                            />
                            <label className="form-check-label" htmlFor={id}>
                              {c.class_name || c.class_code || `Class ${c.id}`}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-muted small mb-0 mt-1">
                      Tick checkboxes to target one or many classes.
                    </p>
                  </div>
                  <div className="col-md-6 mb-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <label className="form-label">Target sections (optional)</label>
                      <div className="form-check mb-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="target-sections-all"
                          checked={
                            sectionOptions.length > 0 &&
                            targetSectionIds.length === sectionOptions.length
                          }
                          onChange={(e) =>
                            setTargetSectionIds(
                              e.target.checked ? sectionOptions.map((s) => s.id) : []
                            )
                          }
                          disabled={!canManage || !sectionOptions.length}
                        />
                        <label className="form-check-label" htmlFor="target-sections-all">
                          Select All
                        </label>
                      </div>
                    </div>
                    <div className="border rounded p-2 bg-light" style={{ maxHeight: 180, overflowY: "auto" }}>
                      {sectionOptions.map((s) => {
                        const checked = targetSectionIds.includes(s.id);
                        const id = `target-section-${s.id}`;
                        return (
                          <div className="form-check" key={s.id}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={id}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTargetSectionIds((prev) =>
                                    prev.includes(s.id) ? prev : [...prev, s.id]
                                  );
                                } else {
                                  setTargetSectionIds((prev) => prev.filter((x) => x !== s.id));
                                }
                              }}
                              disabled={!canManage}
                            />
                            <label className="form-check-label" htmlFor={id}>
                              {s.class_name
                                ? `${s.class_name} - ${s.section_name || s.id}`
                                : s.section_name || `Section ${s.id}`}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-muted small mb-0 mt-1">
                      Tick checkboxes to target one or many sections.
                    </p>
                  </div>
                </>
              ) : null}
              {eventForList.includes("staff") ? (
                <>
                  <div className="col-md-6 mb-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <label className="form-label">
                        Target departments (optional)
                      </label>
                      <div className="form-check mb-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="target-departments-all"
                          checked={
                            departmentOptions.length > 0 &&
                            targetDepartmentIds.length === departmentOptions.length
                          }
                          onChange={(e) =>
                            setTargetDepartmentIds(
                              e.target.checked
                                ? departmentOptions.map((d) => d.id)
                                : []
                            )
                          }
                          disabled={!canManage || !departmentOptions.length}
                        />
                        <label className="form-check-label" htmlFor="target-departments-all">
                          Select All
                        </label>
                      </div>
                    </div>
                    <div className="border rounded p-2 bg-light" style={{ maxHeight: 180, overflowY: "auto" }}>
                      {departmentOptions.map((d) => {
                        const checked = targetDepartmentIds.includes(d.id);
                        const id = `target-department-${d.id}`;
                        return (
                          <div className="form-check" key={d.id}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={id}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTargetDepartmentIds((prev) =>
                                    prev.includes(d.id) ? prev : [...prev, d.id]
                                  );
                                } else {
                                  setTargetDepartmentIds((prev) =>
                                    prev.filter((x) => x !== d.id)
                                  );
                                }
                              }}
                              disabled={!canManage}
                            />
                            <label className="form-check-label" htmlFor={id}>
                              {d.department_name || `Department ${d.id}`}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="col-md-6 mb-3">
                    <div className="d-flex align-items-center justify-content-between">
                      <label className="form-label">
                        Target designations (optional)
                      </label>
                      <div className="form-check mb-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="target-designations-all"
                          checked={
                            designationOptions.length > 0 &&
                            targetDesignationIds.length === designationOptions.length
                          }
                          onChange={(e) =>
                            setTargetDesignationIds(
                              e.target.checked
                                ? designationOptions.map((d) => d.id)
                                : []
                            )
                          }
                          disabled={!canManage || !designationOptions.length}
                        />
                        <label className="form-check-label" htmlFor="target-designations-all">
                          Select All
                        </label>
                      </div>
                    </div>
                    <div className="border rounded p-2 bg-light" style={{ maxHeight: 180, overflowY: "auto" }}>
                      {designationOptions.map((d) => {
                        const checked = targetDesignationIds.includes(d.id);
                        const id = `target-designation-${d.id}`;
                        return (
                          <div className="form-check" key={d.id}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={id}
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setTargetDesignationIds((prev) =>
                                    prev.includes(d.id) ? prev : [...prev, d.id]
                                  );
                                } else {
                                  setTargetDesignationIds((prev) =>
                                    prev.filter((x) => x !== d.id)
                                  );
                                }
                              }}
                              disabled={!canManage}
                            />
                            <label className="form-check-label" htmlFor={id}>
                              {d.designation_name || `Designation ${d.id}`}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : null}
              <div className="col-md-6 mb-3">
                <label className="form-label">Start date</label>
                <DatePicker
                  className="form-control w-100"
                  value={startDate}
                  onChange={(d) => setStartDate(d)}
                  format="DD/MM/YYYY"
                  disabled={!canManage}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">End date</label>
                <DatePicker
                  className="form-control w-100"
                  value={endDate}
                  onChange={(d) => setEndDate(d)}
                  format="DD/MM/YYYY"
                  disabled={!canManage}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">Start time (optional)</label>
                <TimePicker
                  className="form-control w-100"
                  value={startTime}
                  onChange={(t) => setStartTime(t)}
                  use12Hours
                  format="h:mm A"
                  disabled={!canManage}
                />
              </div>
              <div className="col-md-6 mb-3">
                <label className="form-label">End time (optional)</label>
                <TimePicker
                  className="form-control w-100"
                  value={endTime}
                  onChange={(t) => setEndTime(t)}
                  use12Hours
                  format="h:mm A"
                  disabled={!canManage}
                />
              </div>
              <div className="col-md-12 mb-0">
                <label className="form-label">Attachment URL (optional)</label>
                <input
                  type="text"
                  className="form-control mb-3"
                  placeholder="https://example.com/file.pdf or www.example.com/file.pdf"
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  disabled={!canManage}
                />
                <div className="d-flex align-items-center gap-2 mb-3">
                  <input
                    type="file"
                    className="form-control"
                    onChange={handleAttachmentUpload}
                    disabled={!canManage || uploadingAttachment}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
                  />
                  {uploadingAttachment ? (
                    <span className="text-muted small">Uploading…</span>
                  ) : null}
                </div>
                <p className="text-muted small mb-2">
                  You can paste a URL or upload a file (stored under school documents).
                </p>
                <label className="form-label">Files to attach on save (optional)</label>
                <input
                  type="file"
                  className="form-control mb-2"
                  multiple
                  onChange={handlePendingFilesSelect}
                  disabled={!canManage || submitting}
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp,.txt,.csv"
                />
                {pendingFiles.length ? (
                  <ul className="list-group mb-3">
                    {pendingFiles.map((f, idx) => (
                      <li
                        key={`${f.name}-${idx}`}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <span className="small text-truncate me-2">{f.name}</span>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => removePendingFile(idx)}
                          disabled={submitting}
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={!canManage}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              className="btn btn-light"
              onClick={() => {
                if (!submitting) {
                  setShowAddModal(false);
                  resetForm();
                }
              }}
            >
              Cancel
            </button>
            {canManage ? (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Saving…
                  </>
                ) : editingId != null ? (
                  "Save changes"
                ) : (
                  "Create event"
                )}
              </button>
            ) : null}
          </Modal.Footer>
        </form>
      </Modal>

      <Modal
        show={showTargetsModal}
        onHide={() => setShowTargetsModal(false)}
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>{targetsModalTitle}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {!targetsModalItems.length ? (
            <p className="text-muted mb-0">No records selected.</p>
          ) : (
            <ul className="list-group">
              {targetsModalItems.map((item, idx) => (
                <li key={`${item}-${idx}`} className="list-group-item">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            className="btn btn-light"
            onClick={() => setShowTargetsModal(false)}
          >
            Close
          </button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showDetailModal}
        onHide={() => {
          setShowDetailModal(false);
          setDetailEvent(null);
        }}
        centered
        size="lg"
      >
        <Modal.Header closeButton className="justify-content-between">
          <Modal.Title className="d-flex align-items-center gap-2 text-truncate">
            <i className="ti ti-calendar-event text-primary" />
            <span className="text-truncate">{detailEvent?.title}</span>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {detailEvent ? (
            <>
              <p className="text-muted small mb-2">
                <i className="ti ti-calendar me-1" />
                {formatDateShort(detailEvent.start_date)}
                {detailEvent.end_date &&
                formatDateShort(detailEvent.end_date) !==
                  formatDateShort(detailEvent.start_date)
                  ? ` – ${formatDateShort(detailEvent.end_date)}`
                  : ""}
                <span className="ms-2">
                  <i className="ti ti-clock me-1" />
                  {detailEvent.is_all_day
                    ? "All day"
                    : `${formatTimeShort(detailEvent.start_date)}${
                        detailEvent.end_date
                          ? ` – ${formatTimeShort(detailEvent.end_date)}`
                          : ""
                      }`}
                </span>
              </p>
              {detailEvent.event_category ? (
                <p className="small mb-2">
                  <span className="badge bg-light text-dark">
                    {detailEvent.event_category}
                  </span>
                </p>
              ) : null}
              <p className="small mb-2">
                <i className="ti ti-users me-1" />
                {targetSummary(detailEvent)}
              </p>
              {detailEvent.location ? (
                <p className="small mb-2">
                  <i className="ti ti-map-pin me-1" />
                  {detailEvent.location}
                </p>
              ) : null}
              {detailEvent.attachment_url ? (
                <p className="small mb-2">
                  <i className="ti ti-link me-1" />
                  <a
                    href={detailEvent.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open attachment
                  </a>
                </p>
              ) : null}
              <div className="mb-3">
                <h6 className="mb-2">Attachments</h6>
                {attachmentsLoading ? (
                  <p className="small text-muted mb-0">Loading attachments…</p>
                ) : !detailAttachments.length ? (
                  <p className="small text-muted mb-0">No uploaded attachments.</p>
                ) : (
                  <ul className="list-group">
                    {detailAttachments.map((att) => (
                      <li
                        key={att.id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <a
                          href={att.file_url}
                          target="_blank"
                          rel="noreferrer"
                          className="small text-truncate me-2"
                        >
                          {att.file_name}
                        </a>
                        {canManage ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => deleteAttachment(detailEvent.id, att.id)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="bg-light p-3 rounded mb-3">
                <p className="mb-0 small">
                  {detailEvent.description?.trim()
                    ? detailEvent.description
                    : "No description provided."}
                </p>
              </div>
            </>
          ) : null}
        </Modal.Body>
        <Modal.Footer className="justify-content-between">
          <div>
            {canManage && detailEvent ? (
              <>
                <button
                  type="button"
                  className="btn btn-outline-primary me-2"
                  onClick={() => openEditModal(detailEvent)}
                >
                  <i className="ti ti-edit me-1" />
                  Edit
                </button>
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  disabled={submitting}
                  onClick={() => handleDelete(detailEvent.id)}
                >
                  <i className="ti ti-trash me-1" />
                  Delete
                </button>
              </>
            ) : null}
          </div>
          <button
            type="button"
            className="btn btn-light"
            onClick={() => {
              setShowDetailModal(false);
              setDetailEvent(null);
            }}
          >
            Close
          </button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Events;

