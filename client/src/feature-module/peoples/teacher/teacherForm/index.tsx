import { useEffect, useState, useRef, useMemo, useCallback, type ChangeEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
// import { feeGroup, feesTypes, paymentType } from '../../../core/common/selectoption/selectoption'
import { DatePicker } from "antd";
import dayjs from "dayjs";
import { all_routes } from "../../../router/all_routes";
import { apiService } from "../../../../core/services/apiService";
import {
  Contract,
  Hostel,
  Marital,
  PickupPoint,
  Shift,
  VehicleNumber,
  allClass,
  allSubject,
  bloodGroup,
  gender,
  roomNO,
  route,
  status,
} from "../../../../core/common/selectoption/selectoption";

import CommonSelect from "../../../../core/common/commonSelect";
import TagInput from "../../../../core/common/Taginput";
import { useSelector } from "react-redux";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { useClasses } from "../../../../core/hooks/useClasses";
import { useSubjects } from "../../../../core/hooks/useSubjects";
import { useBloodGroups } from "../../../../core/hooks/useBloodGroups";
import { useHostels } from "../../../../core/hooks/useHostels";
import { useHostelRooms } from "../../../../core/hooks/useHostelRooms";
import { useTransportRoutes } from "../../../../core/hooks/useTransportRoutes";
import { useTransportPickupPoints } from "../../../../core/hooks/useTransportPickupPoints";
import { useTransportAssignments } from "../../../../core/hooks/useTransportAssignments";
import { useDepartments } from "../../../../core/hooks/useDepartments";
import { useDesignations } from "../../../../core/hooks/useDesignations";
import {
  validateField,
  validateTeacherFormSync,
  firstErrorFieldKey,
  type TeacherFormField,
  type TeacherFormValues,
} from "./teacherFormValidation";
import "./teacherForm.css";

interface TeacherLocationState {
  teacherId?: number;
  teacher?: any;
  returnTo?: string;
}

/** Extract server `message` from apiService HTTP error string when body is JSON */
function parseTeacherApiErrorMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const msg = err.message;
  const marker = "message: ";
  const idx = msg.indexOf(marker);
  if (idx === -1) return msg || fallback;
  const jsonPart = msg.slice(idx + marker.length).trim();
  try {
    const j = JSON.parse(jsonPart) as { message?: string };
    if (typeof j.message === "string" && j.message.trim()) return j.message;
  } catch {
    /* ignore */
  }
  return msg || fallback;
}

function teacherStoredDocBasename(stored: string | null | undefined): string {
  if (!stored) return "";
  const idx = stored.lastIndexOf("/");
  return idx >= 0 ? stored.slice(idx + 1) : stored;
}

function normalizeCompareValue(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function resolveSelectValue(
  options: Array<{ value: string; label: string }>,
  candidates: Array<unknown>
): string | null {
  const normalized = candidates
    .map(normalizeCompareValue)
    .filter((v) => v.length > 0);
  if (!normalized.length) return null;
  const hit = options.find((opt) => {
    const ov = normalizeCompareValue(opt.value);
    const ol = normalizeCompareValue(opt.label);
    return normalized.includes(ov) || normalized.includes(ol);
  });
  return hit?.value ?? null;
}

/** Create-teacher API returns the new row in `data`; tolerate string ids from drivers. */
function extractCreatedTeacherId(res: unknown): number | undefined {
  if (!res || typeof res !== "object") return undefined;
  const o = res as Record<string, unknown>;
  const d = o.data;
  let raw: unknown;
  if (d != null && typeof d === "object" && !Array.isArray(d)) {
    const inner = d as Record<string, unknown>;
    raw = inner.id ?? inner.ID ?? inner.teacher_id;
  }
  if (raw === undefined || raw === null || raw === "") {
    raw = o.id ?? o.ID;
  }
  if (raw === undefined || raw === null || raw === "") return undefined;
  const n = typeof raw === "number" ? raw : parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function FormErrorBanner({
  title,
  message,
  onDismiss,
}: {
  title: string;
  message: string;
  onDismiss: () => void;
}) {
  return (
    <div className="form-banner-error" role="alert">
      <div>
        <p className="form-banner-title">{title}</p>
        <p className="form-banner-text">{message}</p>
      </div>
      <button type="button" className="btn-close-banner" onClick={onDismiss} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}

const TeacherForm = () => {
  const routes = all_routes;
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as TeacherLocationState | null;
  const teacherId = state?.teacherId ?? state?.teacher?.id;
  const formRef = useRef<HTMLFormElement>(null);
  const currentUser = useSelector(selectUser);
  const currentUserRole = String(currentUser?.role ?? "").trim().toLowerCase();
  const canRunUniqueCheck =
    currentUserRole === "admin" ||
    currentUserRole === "administrative" ||
    currentUserRole === "administrator" ||
    currentUserRole === "headmaster";

  const [isEdit, setIsEdit] = useState<boolean>(false);
  const [teacherData, setTeacherData] = useState<any>(null);
  const [loadingTeacher, setLoadingTeacher] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [owner, setOwner] = useState<string[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<string | null>(null);
  const [selectedMaritalStatus, setSelectedMaritalStatus] = useState<string | null>(null);
  const [selectedBloodGroupId, setSelectedBloodGroupId] = useState<string | null>(null);
  const [selectedDesignationId, setSelectedDesignationId] = useState<string | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedContractType, setSelectedContractType] = useState<string | null>(null);
  const [selectedShift, setSelectedShift] = useState<string | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedPickupPointId, setSelectedPickupPointId] = useState<string | null>(null);
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [idNumber, setIdNumber] = useState("");
  const [prevSchoolPhone, setPrevSchoolPhone] = useState("");
  const [epfNo, setEpfNo] = useState("");
  const handleTagsChange = (newTags: string[]) => {
    setOwner(newTags);
  };

  const [dobDate, setDobDate] = useState<dayjs.Dayjs | null>(null);
  const [joiningDate, setJoiningDate] = useState<dayjs.Dayjs | null>(() => dayjs());
  const [leavingDate, setLeavingDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('Active');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [joiningLetterFile, setJoiningLetterFile] = useState<File | null>(null);
  /** Same files as state; refs avoid rare stale values on save click after long forms. */
  const resumeFileRef = useRef<File | null>(null);
  const joiningLetterFileRef = useRef<File | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [qualification, setQualification] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [asyncErrors, setAsyncErrors] = useState<Partial<Record<"phone" | "email", string>>>({});
  const [checkingUnique, setCheckingUnique] = useState(false);
  const [formBanner, setFormBanner] = useState<{ title: string; message: string } | null>(null);
  const [resumeFileError, setResumeFileError] = useState<string | null>(null);
  const [joiningLetterFileError, setJoiningLetterFileError] = useState<string | null>(null);

  /** Class/subject are optional at hire; use Teacher assignments (or edit) later. */
  const requireClassSubject = false;

  const teacherFormValues = useMemo<TeacherFormValues>(
    () => ({
      first_name: firstName,
      last_name: lastName,
      phone,
      email,
      qualification,
      joiningDate,
      class_id: selectedClassId,
      subject_id: selectedSubjectId,
      new_password: newPassword,
      confirm_password: confirmPassword,
      epf_no: epfNo,
      father_name: fatherName,
      mother_name: motherName,
      pan_number: panNumber,
      id_number: idNumber,
      previous_school_phone: prevSchoolPhone,
      marital_status: selectedMaritalStatus || "",
    }),
    [
      firstName,
      lastName,
      phone,
      email,
      qualification,
      joiningDate,
      selectedClassId,
      selectedSubjectId,
      newPassword,
      confirmPassword,
      epfNo,
      selectedPickupPointId,
      fatherName,
      motherName,
      panNumber,
      idNumber,
      prevSchoolPhone,
      selectedMaritalStatus,
    ]
  );

  const syncErrors = useMemo(
    () => validateTeacherFormSync(teacherFormValues, { requireClassSubject, isEdit }),
    [teacherFormValues, requireClassSubject, isEdit]
  );

  const mergedErrors = useMemo(() => {
    const m: Partial<Record<TeacherFormField, string>> = { ...syncErrors };
    if (asyncErrors.phone) m.phone = asyncErrors.phone;
    if (asyncErrors.email) m.email = asyncErrors.email;
    if (resumeFileError) m.resume = resumeFileError;
    if (joiningLetterFileError) m.joining_letter = joiningLetterFileError;
    return m;
  }, [syncErrors, asyncErrors, resumeFileError, joiningLetterFileError]);

  const hasBlockingErrors = useMemo(() => Object.keys(mergedErrors).length > 0, [mergedErrors]);

  const touchField = useCallback((name: string) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
  }, []);

  const showFieldError = useCallback(
    (field: string) => (touched[field] || submitAttempted) && !!mergedErrors[field as TeacherFormField],
    [touched, submitAttempted, mergedErrors]
  );

  const inputClass = useCallback(
    (field: string, value: string) => {
      const err = showFieldError(field);
      const msg = mergedErrors[field as TeacherFormField];
      const ok =
        (touched[field] || submitAttempted) && !msg && String(value ?? "").trim().length > 0;
      return ["form-control", err ? "input-error" : "", ok ? "input-valid" : ""].filter(Boolean).join(" ");
    },
    [showFieldError, mergedErrors, touched, submitAttempted]
  );

  const scrollToFirstError = useCallback(
    (errMap?: Partial<Record<TeacherFormField, string>>) => {
      const key = firstErrorFieldKey(errMap ?? mergedErrors);
      if (!key) return;
      window.requestAnimationFrame(() => {
        const el = document.querySelector(`[data-validation-field="${key}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    },
    [mergedErrors]
  );

  const collectSubmitErrors = useCallback((): Partial<Record<TeacherFormField, string>> => {
    const base = validateTeacherFormSync(teacherFormValues, {
      requireClassSubject,
      isEdit,
    });
    const m: Partial<Record<TeacherFormField, string>> = { ...base };
    if (asyncErrors.phone) m.phone = asyncErrors.phone;
    if (asyncErrors.email) m.email = asyncErrors.email;
    if (resumeFileError) m.resume = resumeFileError;
    if (joiningLetterFileError) m.joining_letter = joiningLetterFileError;
    return m;
  }, [
    teacherFormValues,
    requireClassSubject,
    isEdit,
    asyncErrors,
    resumeFileError,
    joiningLetterFileError,
  ]);

  // Debounced uniqueness (mobile / email) — optional enhancement
  useEffect(() => {
    if (!canRunUniqueCheck) {
      setCheckingUnique(false);
      setAsyncErrors({});
      return;
    }
    const pErr = validateField("phone", phone);
    const eErr = validateField("email", email);
    if (pErr || eErr) {
      setAsyncErrors({});
      return;
    }
    const excludeId =
      isEdit && teacherData?.user_id != null ? Number(teacherData.user_id) : undefined;
    const t = window.setTimeout(() => {
      setCheckingUnique(true);
      apiService
        .checkUserUnique({
          mobile: phone.replace(/\D/g, ""),
          email: email.trim(),
          excludeId: Number.isFinite(excludeId as number) ? excludeId : undefined,
        })
        .then((res: { mobileExists?: boolean; emailExists?: boolean }) => {
          setAsyncErrors({
            phone: res?.mobileExists ? "Already registered" : undefined,
            email: res?.emailExists ? "Already registered" : undefined,
          });
        })
        .catch(() => {
          /* ignore — network; user can still submit */
        })
        .finally(() => setCheckingUnique(false));
    }, 450);
    return () => window.clearTimeout(t);
  }, [phone, email, isEdit, teacherData?.user_id, canRunUniqueCheck]);

  // Lookup data from API (real data for dropdowns)
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes, loading: classesLoading, error: classesError } = useClasses(academicYearId);
  const { subjects, loading: subjectsLoading, error: subjectsError } = useSubjects();
  const { bloodGroups, loading: bloodGroupsLoading, error: bloodGroupsError } = useBloodGroups();
  const { hostels } = useHostels();
  const { hostelRooms } = useHostelRooms();
  const { data: transportRoutes, loading: routesLoading, error: routesError } = useTransportRoutes();
  const { data: pickupPoints, loading: pickupLoading, error: pickupError } = useTransportPickupPoints();
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError } = useTransportAssignments({ status: 'active', limit: 1000 });
  const { departments, loading: departmentsLoading, error: departmentsError } = useDepartments();
  const { designations, loading: designationsLoading, error: designationsError } = useDesignations();

  useEffect(() => {
    if (location.pathname === routes.editTeacher) {
      setIsEdit(true);
      if (teacherId) {
        setLoadingTeacher(true);
        apiService
          .getTeacherById(teacherId)
          .then((res: any) => {
            if (res?.data) setTeacherData(res.data);
          })
          .catch(() => {})
          .finally(() => setLoadingTeacher(false));
      } else {
        setTeacherData(state?.teacher ?? null);
      }
    } else {
      setIsEdit(false);
      setTeacherData(null);
    }
  }, [location.pathname, teacherId]);

  useEffect(() => {
    if (location.pathname === "/teacher/add-teacher") {
      setSelectedClassId(null);
      setSelectedSubjectId(null);
      setSelectedGender(null);
      setSelectedMaritalStatus(null);
      setSelectedBloodGroupId(null);
      setSelectedDesignationId(null);
      setSelectedDepartmentId(null);
      setSelectedContractType(null);
      setSelectedShift(null);
      setSelectedRouteId(null);
      setSelectedVehicleId(null);
      setSelectedPickupPointId(null);
      setSelectedStatus("Active");
      setOwner(["English"]);
      setDobDate(null);
      setJoiningDate(dayjs());
      setLeavingDate(null);
      setResumeFile(null);
      setJoiningLetterFile(null);
      resumeFileRef.current = null;
      joiningLetterFileRef.current = null;
      setFirstName("");
      setLastName("");
      setPhone("");
      setEmail("");
      setQualification("");
      setNewPassword("");
      setConfirmPassword("");
      setTouched({});
      setSubmitAttempted(false);
      setAsyncErrors({});
      setFormBanner(null);
      setResumeFileError(null);
      setJoiningLetterFileError(null);
      setFatherName("");
      setMotherName("");
      setPanNumber("");
      setIdNumber("");
      setPrevSchoolPhone("");
      setEpfNo("");
    }
  }, [location.pathname]);

  useEffect(() => {
    setResumeFile(null);
    setJoiningLetterFile(null);
    resumeFileRef.current = null;
    joiningLetterFileRef.current = null;
  }, [teacherId]);

  useEffect(() => {
    if (teacherData && isEdit) {
      const jd = teacherData.joining_date ? dayjs(teacherData.joining_date) : null;
      const dob = teacherData.date_of_birth ? dayjs(teacherData.date_of_birth) : null;
      setDobDate(dob);
      setJoiningDate(jd);
      setLeavingDate(null);
      if (teacherData.languages_known) {
        let tags: string[] = [];
        if (Array.isArray(teacherData.languages_known)) {
          tags = teacherData.languages_known.map(String);
        } else if (typeof teacherData.languages_known === "string") {
          tags = teacherData.languages_known
            .split(",")
            .map((s: string) => s.trim())
            .filter(Boolean);
        }
        setOwner(tags.length ? tags : ["English"]);
      } else {
        setOwner(["English"]);
      }
      const currentStatus = teacherData.status === 'Active' || teacherData.is_active === true || teacherData.is_active === 1 
        ? 'Active' 
        : 'Inactive';
      setSelectedStatus(currentStatus);
      const classOptions = (classes || []).map((cls: any) => ({
        value: String(cls.id ?? ""),
        label: String(cls.class_name ?? ""),
      }));
      const subjectOptions = (subjects || []).map((sub: any) => ({
        value: String(sub.id ?? ""),
        label: String(sub.subject_name ?? ""),
      }));
      const bloodGroupOptions = (bloodGroups || []).map((bg: any) => ({
        value: String(bg.id ?? ""),
        label: String(bg.blood_group ?? ""),
      }));
      const designationOptions = (designations || []).map((d: any) => ({
        value: String(d?.originalData?.id ?? d?.key ?? ""),
        label: String(d?.designation ?? d?.originalData?.designation_name ?? ""),
      }));
      const departmentOptions = (departments || []).map((d: any) => ({
        value: String(d?.originalData?.id ?? d?.key ?? ""),
        label: String(d?.department ?? d?.originalData?.department_name ?? ""),
      }));

      setSelectedClassId(
        resolveSelectValue(classOptions, [teacherData.class_id, teacherData.class_name]) ??
          (teacherData.class_id != null ? String(teacherData.class_id) : null)
      );
      setSelectedSubjectId(
        resolveSelectValue(subjectOptions, [teacherData.subject_id, teacherData.subject_name]) ??
          (teacherData.subject_id != null ? String(teacherData.subject_id) : null)
      );
      setSelectedGender(
        resolveSelectValue(gender as Array<{ value: string; label: string }>, [teacherData.gender])
      );
      setSelectedMaritalStatus(
        resolveSelectValue(Marital as Array<{ value: string; label: string }>, [
          teacherData.marital_status,
        ])
      );
      setSelectedBloodGroupId(
        resolveSelectValue(bloodGroupOptions, [teacherData.blood_group_id, teacherData.blood_group]) ??
          (teacherData.blood_group_id != null ? String(teacherData.blood_group_id) : null)
      );
      setSelectedDesignationId(
        resolveSelectValue(designationOptions, [
          teacherData.designation_id,
          teacherData.designation_name,
          teacherData.designation,
        ]) ?? (teacherData.designation_id != null ? String(teacherData.designation_id) : null)
      );
      setSelectedDepartmentId(
        resolveSelectValue(departmentOptions, [
          teacherData.department_id,
          teacherData.department_name,
          teacherData.department,
        ]) ?? (teacherData.department_id != null ? String(teacherData.department_id) : null)
      );
      setSelectedContractType(
        resolveSelectValue(Contract as Array<{ value: string; label: string }>, [
          teacherData.contract_type,
        ])
      );
      setSelectedShift(
        resolveSelectValue(Shift as Array<{ value: string; label: string }>, [teacherData.shift])
      );
      setSelectedRouteId(teacherData.route_id ? String(teacherData.route_id) : null);
      setSelectedVehicleId(teacherData.vehicle_id ? String(teacherData.vehicle_id) : null);
      setSelectedPickupPointId(teacherData.pickup_point_id ? String(teacherData.pickup_point_id) : null);
      setFirstName(teacherData.first_name ?? "");
      setLastName(teacherData.last_name ?? "");
      setPhone(teacherData.phone ?? "");
      setEmail(teacherData.email ?? "");
      setQualification(teacherData.qualification ?? "");
      setFatherName(teacherData.father_name ?? "");
      setMotherName(teacherData.mother_name ?? "");
      setPanNumber(teacherData.pan_number ?? "");
      setIdNumber(teacherData.id_number ?? "");
      setPrevSchoolPhone(teacherData.previous_school_phone ?? "");
      setEpfNo(teacherData.epf_no ?? "");
      setTouched({});
      setSubmitAttempted(false);
      setFormBanner(null);
    }
  }, [teacherData, isEdit, classes, subjects, bloodGroups, designations, departments]);

  if (isEdit && teacherId && loadingTeacher) {
    return (
      <div className="page-wrapper">
        <div className="content content-two">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading teacher...</span>
          </div>
        </div>
      </div>
    );
  }

  const t = teacherData || state?.teacher;

  const openTeacherPdf = async (docType: "resume" | "joining_letter") => {
    if (!teacherId) return;
    try {
      const blob = await apiService.fetchTeacherDocumentBlob(teacherId, docType);
      const u = URL.createObjectURL(blob);
      window.open(u, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(u), 120_000);
    } catch (e) {
      setFormBanner({
        title: "Could not open document",
        message: parseTeacherApiErrorMessage(e, "Could not open document."),
      });
    }
  };

  const onPickResume = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setResumeFileError(null);
    setFormBanner(null);
    if (f.size > 4 * 1024 * 1024) {
      setResumeFileError("File must be 4MB or smaller.");
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && f.type !== "application/pdf") {
      setResumeFileError("Only PDF files are allowed.");
      return;
    }
    setResumeFile(f);
    resumeFileRef.current = f;
  };

  const onPickJoiningLetter = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setJoiningLetterFileError(null);
    setFormBanner(null);
    if (f.size > 4 * 1024 * 1024) {
      setJoiningLetterFileError("File must be 4MB or smaller.");
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && f.type !== "application/pdf") {
      setJoiningLetterFileError("Only PDF files are allowed.");
      return;
    }
    setJoiningLetterFile(f);
    joiningLetterFileRef.current = f;
  };

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content content-two">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <Link
                to={state?.returnTo ?? routes.teacherList}
                className="btn btn-outline-secondary mb-2 d-inline-flex align-items-center"
              >
                <i className="ti ti-arrow-left me-1" />
                Back
              </Link>
              <h3 className="mb-1">{isEdit ? "Edit" : "Add"} Teacher</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.adminDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item">
                    <Link to={routes.teacherList}>Teacher</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    {isEdit ? "Edit" : "Add"} Teacher
                  </li>
                </ol>
              </nav>
            </div>
          </div>
          {/* /Page Header */}
          <div className="row">
            <div className="col-md-12">
              <form ref={formRef} key={isEdit && t ? `edit-${t.id}` : "add"}>
                <>
                  {formBanner && (
                    <FormErrorBanner
                      title={formBanner.title}
                      message={formBanner.message}
                      onDismiss={() => setFormBanner(null)}
                    />
                  )}
                  {/* Personal Information */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-info-square-rounded fs-16" />
                        </span>
                        <h4 className="text-dark">Personal Information</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-md-12">
                          <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                            <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                              <i className="ti ti-photo-plus fs-16" />
                            </div>
                            <div className="profile-upload">
                              <div className="profile-uploader d-flex align-items-center flex-wrap gap-2 mb-2">
                                <button type="button" className="btn btn-light mb-3" disabled title="Not available yet">
                                  Upload photo
                                </button>
                              </div>
                              <p className="text-muted small mb-0">
                                Photo upload is not available in this version. Profile image can be set later from staff settings.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="row row-cols-xxl-5 row-cols-md-6">
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Teacher ID</label>
                            <input
                              name="employee_code"
                              type="text"
                              className="form-control"
                              placeholder={isEdit ? undefined : "Optional — auto-generated if empty"}
                              defaultValue={isEdit && t ? (t.employee_code ?? "") : undefined}
                              readOnly={isEdit}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="first_name">
                          <div className="mb-3">
                            <label className="form-label">
                              First Name <span className="text-danger">*</span>
                            </label>
                            <input
                              name="first_name"
                              type="text"
                              className={inputClass("first_name", firstName)}
                              value={firstName}
                              onChange={(e) => {
                                setFirstName(e.target.value);
                                setFormBanner(null);
                              }}
                              onBlur={() => touchField("first_name")}
                              autoComplete="given-name"
                            />
                            {showFieldError("first_name") && mergedErrors.first_name && (
                              <div className="field-hint-error">{mergedErrors.first_name}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="last_name">
                          <div className="mb-3">
                            <label className="form-label">
                              Last Name <span className="text-danger">*</span>
                            </label>
                            <input
                              name="last_name"
                              type="text"
                              className={inputClass("last_name", lastName)}
                              value={lastName}
                              onChange={(e) => {
                                setLastName(e.target.value);
                                setFormBanner(null);
                              }}
                              onBlur={() => touchField("last_name")}
                              autoComplete="family-name"
                            />
                            {showFieldError("last_name") && mergedErrors.last_name && (
                              <div className="field-hint-error">{mergedErrors.last_name}</div>
                            )}
                          </div>
                        </div>
                        {isEdit && (
                          <>
                            <div className="col-xxl col-xl-3 col-md-6" data-validation-field="class_id">
                              <div
                                className={`mb-3 teacher-form-select-wrap ${
                                  showFieldError("class_id") ? "is-invalid" : ""
                                } ${touched.class_id && !mergedErrors.class_id && selectedClassId ? "is-valid" : ""}`}
                              >
                                <label className="form-label">Class</label>
                                {classesLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2" />
                                    Loading classes...
                                  </div>
                                ) : classesError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2" />
                                    Error: {classesError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={(classes || []).map((cls: any) => ({
                                      value: String(cls.id),
                                      label: cls.class_name ?? ''
                                    }))}
                                    value={selectedClassId}
                                    onChange={(value) => {
                                      setSelectedClassId(value);
                                      setSelectedSubjectId(null);
                                      setFormBanner(null);
                                    }}
                                    onBlur={() => touchField("class_id")}
                                  />
                                )}
                                {showFieldError("class_id") && mergedErrors.class_id && (
                                  <div className="field-hint-error">{mergedErrors.class_id}</div>
                                )}
                              </div>
                            </div>
                            <div className="col-xxl col-xl-3 col-md-6" data-validation-field="subject_id">
                              <div
                                className={`mb-3 teacher-form-select-wrap ${
                                  showFieldError("subject_id") ? "is-invalid" : ""
                                } ${touched.subject_id && !mergedErrors.subject_id && selectedSubjectId ? "is-valid" : ""}`}
                              >
                                <label className="form-label">Subject</label>
                                {subjectsLoading ? (
                                  <div className="form-control">
                                    <i className="ti ti-loader ti-spin me-2" />
                                    Loading subjects...
                                  </div>
                                ) : subjectsError ? (
                                  <div className="form-control text-danger">
                                    <i className="ti ti-alert-circle me-2" />
                                    Error: {subjectsError}
                                  </div>
                                ) : (
                                  <CommonSelect
                                    className="select"
                                    options={(subjects || [])
                                      .filter((sub: any) =>
                                        selectedClassId ? String(sub.class_id) === selectedClassId : true
                                      )
                                      .map((sub: any) => ({
                                        value: String(sub.id),
                                        label: sub.subject_name ?? ''
                                      }))}
                                    value={selectedSubjectId}
                                    onChange={(value) => {
                                      setSelectedSubjectId(value);
                                      setFormBanner(null);
                                    }}
                                    onBlur={() => touchField("subject_id")}
                                  />
                                )}
                                {showFieldError("subject_id") && mergedErrors.subject_id && (
                                  <div className="field-hint-error">{mergedErrors.subject_id}</div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Gender</label>
                            <CommonSelect
                              className="select"
                              options={gender}
                              defaultValue={
                                isEdit && t
                                  ? (gender as any).find(
                                      (g: any) => g.value === String(t.gender || '').toLowerCase()
                                    ) || gender[0]
                                  : undefined
                              }
                              value={selectedGender}
                              onChange={(value: string | null) => {
                                setSelectedGender(value);
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="phone">
                          <div className="mb-3">
                            <label className="form-label">
                              Primary Contact Number <span className="text-danger">*</span>
                            </label>
                            <input
                              name="phone"
                              type="text"
                              inputMode="numeric"
                              autoComplete="tel"
                              className={inputClass("phone", phone)}
                              value={phone}
                              onChange={(e) => {
                                setPhone(e.target.value);
                                setFormBanner(null);
                              }}
                              onBlur={() => touchField("phone")}
                            />
                            {checkingUnique && !mergedErrors.phone && validateField("phone", phone) === null && (
                              <div className="small text-muted mt-1">Checking availability…</div>
                            )}
                            {showFieldError("phone") && mergedErrors.phone && (
                              <div className="field-hint-error">{mergedErrors.phone}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="email">
                          <div className="mb-3">
                            <label className="form-label">
                              Email Address <span className="text-danger">*</span>
                            </label>
                            <input
                              name="email"
                              type="email"
                              className={inputClass("email", email)}
                              value={email}
                              onChange={(e) => {
                                setEmail(e.target.value);
                                setFormBanner(null);
                              }}
                              onBlur={() => touchField("email")}
                              autoComplete="email"
                            />
                            {showFieldError("email") && mergedErrors.email && (
                              <div className="field-hint-error">{mergedErrors.email}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Blood Group</label>
                            {bloodGroupsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2" />
                                Loading blood groups...
                              </div>
                            ) : bloodGroupsError ? (
                              <div className="form-control text-danger">
                                <i className="ti ti-alert-circle me-2" />
                                Error: {bloodGroupsError}
                              </div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={(bloodGroups || []).map((bg: any) => ({
                                  value: String(bg.id ?? ''),
                                  label: bg.blood_group ?? ''
                                }))}
                                value={selectedBloodGroupId}
                                onChange={(value: string | null) => {
                                  setSelectedBloodGroupId(value);
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="joiningDate">
                          <div className="mb-3">
                            <label className="form-label">
                              Date of Joining <span className="text-danger">*</span>
                            </label>
                            <div className="input-icon position-relative">
                              <DatePicker
                                className={`form-control datetimepicker ${
                                  showFieldError("joiningDate") ? "input-error" : ""
                                } ${
                                  (touched.joiningDate || submitAttempted) &&
                                  !mergedErrors.joiningDate &&
                                  joiningDate
                                    ? "input-valid"
                                    : ""
                                }`}
                                format={{ format: "DD-MM-YYYY", type: "mask" }}
                                value={joiningDate}
                                onChange={(d) => {
                                  setJoiningDate(d);
                                  setFormBanner(null);
                                }}
                                onBlur={() => touchField("joiningDate")}
                                placeholder="Select date"
                              />
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                            {showFieldError("joiningDate") && mergedErrors.joiningDate && (
                              <div className="field-hint-error">{mergedErrors.joiningDate}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="father_name">
                          <div className="mb-3">
                            <label className="form-label">Father’s Name</label>
                            <input
                              name="father_name"
                              type="text"
                              className={`form-control ${showFieldError("father_name") && mergedErrors.father_name ? "is-invalid" : ""}`}
                              value={fatherName}
                              onChange={(e) => setFatherName(e.target.value)}
                              onBlur={() => touchField("father_name")}
                            />
                            {showFieldError("father_name") && mergedErrors.father_name && (
                              <div className="field-hint-error">{mergedErrors.father_name}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="mother_name">
                          <div className="mb-3">
                            <label className="form-label">Mother’s Name</label>
                            <input
                              name="mother_name"
                              type="text"
                              className={`form-control ${showFieldError("mother_name") && mergedErrors.mother_name ? "is-invalid" : ""}`}
                              value={motherName}
                              onChange={(e) => setMotherName(e.target.value)}
                              onBlur={() => touchField("mother_name")}
                            />
                            {showFieldError("mother_name") && mergedErrors.mother_name && (
                              <div className="field-hint-error">{mergedErrors.mother_name}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Date of Birth</label>
                            <div className="input-icon position-relative">
                              <DatePicker
                                className="form-control datetimepicker"
                                format={{ format: "DD-MM-YYYY", type: "mask" }}
                                value={dobDate}
                                onChange={(d) => setDobDate(d)}
                                placeholder="Select date"
                              />
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="marital_status">
                          <div className="mb-3">
                            <label className="form-label">Marital Status</label>
                            <CommonSelect
                              className="select"
                              options={Marital}
                              defaultValue={
                                isEdit && t
                                  ? (Marital as any).find(
                                      (m: any) => m.value === (teacherData?.marital_status || t.marital_status || '')
                                    ) || Marital[0]
                                  : undefined
                              }
                              value={selectedMaritalStatus}
                              onChange={(value: string | null) => {
                                setSelectedMaritalStatus(value);
                                touchField("marital_status");
                              }}
                            />
                            {showFieldError("marital_status") && mergedErrors.marital_status && (
                              <div className="field-hint-error">{mergedErrors.marital_status}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Language Known</label>
                            <TagInput
                              // className="input-tags form-control"
                           initialTags ={owner}
                            onTagsChange={handleTagsChange}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="qualification">
                          <div className="mb-3">
                            <label className="form-label">
                              Qualification <span className="text-danger">*</span>
                            </label>
                            <input
                              name="qualification"
                              type="text"
                              className={inputClass("qualification", qualification)}
                              value={qualification}
                              onChange={(e) => {
                                setQualification(e.target.value);
                                setFormBanner(null);
                              }}
                              onBlur={() => touchField("qualification")}
                            />
                            {showFieldError("qualification") && mergedErrors.qualification && (
                              <div className="field-hint-error">{mergedErrors.qualification}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Work Experience
                            </label>
                            <input
                              name="experience_years"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.experience_years != null ? String(t.experience_years) : "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Previous School if Any
                            </label>
                            <input
                              name="previous_school_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.previous_school_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Previous School Address
                            </label>
                            <input
                              name="previous_school_address"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.previous_school_address ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6" data-validation-field="previous_school_phone">
                          <div className="mb-3">
                            <label className="form-label">Previous School Phone No</label>
                            <input
                              name="previous_school_phone"
                              type="text"
                              className={`form-control ${showFieldError("previous_school_phone") && mergedErrors.previous_school_phone ? "is-invalid" : ""}`}
                              value={prevSchoolPhone}
                              onChange={(e) => setPrevSchoolPhone(e.target.value)}
                              onBlur={() => touchField("previous_school_phone")}
                            />
                            {showFieldError("previous_school_phone") && mergedErrors.previous_school_phone && (
                              <div className="field-hint-error">{mergedErrors.previous_school_phone}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Address</label>
                            <input
                              name="address"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.current_address ?? t.address ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Permanent Address
                            </label>
                            <input
                              name="permanent_address"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.permanent_address ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6" data-validation-field="pan_number">
                          <div className="mb-3">
                            <label className="form-label">PAN Number</label>
                            <input
                              name="pan_number"
                              type="text"
                              className={`form-control ${showFieldError("pan_number") && mergedErrors.pan_number ? "is-invalid" : ""}`}
                              value={panNumber}
                              onChange={(e) => setPanNumber(e.target.value)}
                              onBlur={() => touchField("pan_number")}
                            />
                            {showFieldError("pan_number") && mergedErrors.pan_number && (
                              <div className="field-hint-error">{mergedErrors.pan_number}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6" data-validation-field="id_number">
                          <div className="mb-3">
                            <label className="form-label">ID Number</label>
                            <input
                              name="id_number"
                              type="text"
                              className={`form-control ${showFieldError("id_number") && mergedErrors.id_number ? "is-invalid" : ""}`}
                              value={idNumber}
                              onChange={(e) => setIdNumber(e.target.value)}
                              onBlur={() => touchField("id_number")}
                            />
                            {showFieldError("id_number") && mergedErrors.id_number && (
                              <div className="field-hint-error">{mergedErrors.id_number}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Status</label>
                            <CommonSelect
                              className="select"
                              options={status}
                              defaultValue={isEdit && t 
                                ? status.find((s: any) => {
                                    const currentStatus = t.status === 'Active' || t.is_active === true || t.is_active === 1 ? 'Active' : 'Inactive';
                                    return s.value === currentStatus;
                                  }) || status[0]
                                : undefined}
                              value={selectedStatus}
                              key={isEdit && t ? `status-${t.id}-${selectedStatus}` : 'status-add'}
                              onChange={(value: string | null) => {
                                setSelectedStatus(value || 'Active');
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-12 col-xl-12">
                          <div className="mb-3">
                            <label className="form-label">Notes</label>
                            <textarea
                              name="other_info"
                              className="form-control"
                              placeholder="Other Information"
                              rows={4}
                              defaultValue={isEdit && t ? (t.other_info ?? "") : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Personal Information */}
                </>

                <>
                  {/* Payroll */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-user-shield fs-16" />
                        </span>
                        <h4 className="text-dark">Payroll</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">EPF No</label>
                            <input
                              name="epf_no"
                              type="text"
                              className="form-control"
                              value={epfNo}
                              onChange={(e) => setEpfNo(e.target.value)}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Basic Salary</label>
                            <input
                              name="salary"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.salary != null ? String(t.salary) : "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Contract Type</label>
                            <CommonSelect
                              className="select"
                              options={Contract}
                              defaultValue={
                                isEdit && t
                                  ? (Contract as any).find(
                                      (c: any) => c.value === (teacherData?.contract_type || t.contract_type || '')
                                    ) || Contract[0]
                                  : undefined
                              }
                              value={selectedContractType}
                              onChange={(value: string | null) => {
                                setSelectedContractType(value);
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Work Shift</label>
                            <CommonSelect
                              className="select"
                              options={Shift}
                              defaultValue={
                                isEdit && t
                                  ? (Shift as any).find(
                                      (s: any) => s.value === (teacherData?.shift || t.shift || '')
                                    ) || Shift[0]
                                  : undefined
                              }
                              value={selectedShift}
                              onChange={(value: string | null) => {
                                setSelectedShift(value);
                              }}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Work Location</label>
                            <input
                              name="work_location"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.work_location ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Date of Leaving
                            </label>
                            <div className="input-icon position-relative">
                              <DatePicker
                                className="form-control datetimepicker"
                                format={{ format: "DD-MM-YYYY", type: "mask" }}
                                value={leavingDate}
                                onChange={(d) => setLeavingDate(d)}
                                placeholder="Optional"
                              />
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Designation</label>
                            {designationsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2" />
                                Loading…
                              </div>
                            ) : designationsError ? (
                              <div className="form-control text-danger">{designationsError}</div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={(designations || [])
                                  .filter((d: any) => d.originalData?.id != null)
                                  .map((d: any) => ({
                                    value: String(d.originalData.id),
                                    label: d.designation ?? "",
                                  }))}
                                value={selectedDesignationId}
                                onChange={(value) => setSelectedDesignationId(value)}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Department</label>
                            {departmentsLoading ? (
                              <div className="form-control">
                                <i className="ti ti-loader ti-spin me-2" />
                                Loading…
                              </div>
                            ) : departmentsError ? (
                              <div className="form-control text-danger">{departmentsError}</div>
                            ) : (
                              <CommonSelect
                                className="select"
                                options={(departments || [])
                                  .filter((d: any) => d.originalData?.id != null)
                                  .map((d: any) => ({
                                    value: String(d.originalData.id),
                                    label: d.department ?? "",
                                  }))}
                                value={selectedDepartmentId}
                                onChange={(value) => setSelectedDepartmentId(value)}
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Payroll */}
                  {/* Bank Details */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-map fs-16" />
                        </span>
                        <h4 className="text-dark">Bank Account Detail</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Account Name</label>
                            <input
                              name="account_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.account_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Account Number</label>
                            <input
                              name="account_number"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.account_number ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Bank Name</label>
                            <input
                              name="bank_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.bank_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">IFSC Code</label>
                            <input
                              name="ifsc"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.ifsc ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Branch Name</label>
                            <input
                              name="branch"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.branch ?? "") : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Bank Details */}
                </>

                {/* Transport Information */}
                <div className="card">
                  <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                        <i className="ti ti-bus-stop fs-16" />
                      </span>
                      <h4 className="text-dark">Transport Information</h4>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                      />
                    </div>
                  </div>
                  <div className="card-body pb-1">
                    <div className="row">
                      <div className="col-lg-4 col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Route</label>
                          {routesLoading ? (
                            <div className="form-control">
                              <i className="ti ti-loader ti-spin me-2" />
                              Loading routes...
                            </div>
                          ) : routesError ? (
                            <div className="form-control text-danger">
                              <i className="ti ti-alert-circle me-2" />
                              Error: {routesError}
                            </div>
                          ) : (
                            <CommonSelect
                              className="select"
                              options={(transportRoutes || []).map((r: any) => ({
                                value: String((r.originalData?.id ?? r.id) ?? ''),
                                label: r.routes ?? r.originalData?.route_name ?? 'N/A',
                              }))}
                              value={selectedRouteId}
                              onChange={(value) => {
                                setSelectedRouteId(value);
                                setSelectedVehicleId(null);
                              }}
                            />
                          )}
                        </div>
                      </div>
                      <div className="col-lg-4 col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Vehicle Number</label>
                          {vehiclesLoading ? (
                            <div className="form-control">
                              <i className="ti ti-loader ti-spin me-2" />
                              Loading vehicles...
                            </div>
                          ) : vehiclesError ? (
                            <div className="form-control text-danger">
                              <i className="ti ti-alert-circle me-2" />
                              Error: {vehiclesError}
                            </div>
                          ) : (
                            <CommonSelect
                              className="select"
                              options={(vehicles || [])
                                .filter((v: any) => selectedRouteId ? String(v.originalData?.route_id) === selectedRouteId : true)
                                .map((v: any) => ({
                                  value: String(v.originalData?.vehicle_id ?? ''),
                                  label: v.vehicle ?? v.originalData?.vehicle_number ?? 'N/A',
                                }))}
                              value={selectedVehicleId}
                              onChange={(value) => setSelectedVehicleId(value)}
                            />
                          )}
                        </div>
                      </div>
                      <div className="col-lg-4 col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Pickup Point</label>
                          {pickupLoading ? (
                            <div className="form-control">
                              <i className="ti ti-loader ti-spin me-2" />
                              Loading pickup points...
                            </div>
                          ) : pickupError ? (
                            <div className="form-control text-danger">
                              <i className="ti ti-alert-circle me-2" />
                              Error: {pickupError}
                            </div>
                          ) : (
                            <CommonSelect
                              className="select"
                              options={(pickupPoints || []).map((p: any) => ({
                                value: String((p.originalData?.id ?? p.id) ?? ''),
                                label: p.pickupPoint ?? p.originalData?.pickup_point_name ?? 'N/A',
                              }))}
                              value={selectedPickupPointId}
                              onChange={(value) => setSelectedPickupPointId(value)}
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Transport Information */}
                {/* Hostel Information */}
                <div className="card">
                  <div className="card-header bg-light d-flex align-items-center justify-content-between">
                    <div className="d-flex align-items-center">
                      <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                        <i className="ti ti-building-fortress fs-16" />
                      </span>
                      <h4 className="text-dark">Hostel Information</h4>
                    </div>
                    <div className="form-check form-switch">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                      />
                    </div>
                  </div>
                  <div className="card-body pb-1">
                    <div className="row">
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Hostel</label>
                          <CommonSelect
                            className="select"
                            options={(hostels || []).map((h: any) => ({
                              value: String((h.originalData as { id?: number })?.id ?? ""),
                              label: (h.hostelName as string) || "N/A",
                            }))}
                            defaultValue={undefined}
                          />
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="mb-3">
                          <label className="form-label">Room No</label>
                          <CommonSelect
                            className="select"
                            options={(hostelRooms || []).map((r: any) => ({
                              value: String((r.originalData as { id?: number })?.id ?? ""),
                              label: (r.roomNo as string) || "N/A",
                            }))}
                            defaultValue={undefined}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {/* /Hostel Information */}
                <>
                  {/* Social Media Links */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-building fs-16" />
                        </span>
                        <h4 className="text-dark">Social Media Links</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row rows-cols-xxl-5">
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Facebook</label>
                            <input
                              name="facebook"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.facebook ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Twitter</label>
                            <input
                              name="twitter"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.twitter ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Linked In</label>
                            <input
                              name="linkedin"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.linkedin ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Youtube</label>
                            <input
                              name="youtube"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.youtube ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Instagram</label>
                            <input
                              name="instagram"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.instagram ?? "") : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Social Media Links */}
                  {/* Documents */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-file fs-16" />
                        </span>
                        <h4 className="text-dark">Documents</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-6" data-validation-field="resume">
                          <div className="mb-2">
                            <div className="mb-3">
                              <label className="form-label">Upload Resume</label>
                              <p className="text-muted small mb-0">
                                Max file size 4MB. PDF only.
                              </p>
                            </div>
                            <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                              <div className="btn btn-primary drag-upload-btn mb-0">
                                <i className="ti ti-file-upload me-1" />
                                {resumeFile || t?.resume ? "Change" : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf,.pdf"
                                  className="form-control image_sign"
                                  onChange={onPickResume}
                                />
                              </div>
                              {isEdit && teacherId && t?.resume && !resumeFile && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => openTeacherPdf("resume")}
                                >
                                  View
                                </button>
                              )}
                            </div>
                            <p className="mb-0 small text-break">
                              {resumeFile
                                ? resumeFile.name
                                : t?.resume
                                  ? teacherStoredDocBasename(t.resume)
                                  : "No file selected"}
                            </p>
                            {resumeFileError && (
                              <div className="field-hint-error">{resumeFileError}</div>
                            )}
                          </div>
                        </div>
                        <div className="col-lg-6" data-validation-field="joining_letter">
                          <div className="mb-2">
                            <div className="mb-3">
                              <label className="form-label">Upload Joining Letter</label>
                              <p className="text-muted small mb-0">
                                Max file size 4MB. PDF only.
                              </p>
                            </div>
                            <div className="d-flex align-items-center flex-wrap gap-2 mb-2">
                              <div className="btn btn-primary drag-upload-btn mb-0">
                                <i className="ti ti-file-upload me-1" />
                                {joiningLetterFile || t?.joining_letter ? "Change" : "Upload PDF"}
                                <input
                                  type="file"
                                  accept="application/pdf,.pdf"
                                  className="form-control image_sign"
                                  onChange={onPickJoiningLetter}
                                />
                              </div>
                              {isEdit && teacherId && t?.joining_letter && !joiningLetterFile && (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => openTeacherPdf("joining_letter")}
                                >
                                  View
                                </button>
                              )}
                            </div>
                            <p className="mb-0 small text-break">
                              {joiningLetterFile
                                ? joiningLetterFile.name
                                : t?.joining_letter
                                  ? teacherStoredDocBasename(t.joining_letter)
                                  : "No file selected"}
                            </p>
                            {joiningLetterFileError && (
                              <div className="field-hint-error">{joiningLetterFileError}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Documents */}
                  {/* Password — create: sets login password; edit: not supported via this API */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-file fs-16" />
                        </span>
                        <h4 className="text-dark">Password</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      {!isEdit ? (
                        <>
                          <p className="text-muted small">
                            Optional. If left blank, the teacher can log in using their phone number as the initial password. Otherwise set a password and confirm it below.
                          </p>
                          <div className="row">
                            <div className="col-md-6" data-validation-field="new_password">
                              <div className="mb-3">
                                <label className="form-label">Password</label>
                                <input
                                  name="new_password"
                                  type="password"
                                  className={inputClass("new_password", newPassword)}
                                  autoComplete="new-password"
                                  value={newPassword}
                                  onChange={(e) => {
                                    setNewPassword(e.target.value);
                                    setFormBanner(null);
                                  }}
                                  onBlur={() => touchField("new_password")}
                                />
                                {showFieldError("new_password") && mergedErrors.new_password && (
                                  <div className="field-hint-error">{mergedErrors.new_password}</div>
                                )}
                              </div>
                            </div>
                            <div className="col-md-6" data-validation-field="confirm_password">
                              <div className="mb-3">
                                <label className="form-label">Confirm password</label>
                                <input
                                  name="confirm_password"
                                  type="password"
                                  className={inputClass("confirm_password", confirmPassword)}
                                  autoComplete="new-password"
                                  value={confirmPassword}
                                  onChange={(e) => {
                                    setConfirmPassword(e.target.value);
                                    setFormBanner(null);
                                  }}
                                  onBlur={() => touchField("confirm_password")}
                                />
                                {showFieldError("confirm_password") && mergedErrors.confirm_password && (
                                  <div className="field-hint-error">{mergedErrors.confirm_password}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        </>
                      ) : (
                        <p className="text-muted small mb-0">
                          Password cannot be changed from this screen. Use the user account / security settings elsewhere if your school supports it.
                        </p>
                      )}
                    </div>
                  </div>
                  {/* /Password */}
                </>

                <div className="text-end">
                  <button 
                    type="button" 
                    className="btn btn-light me-3"
                    disabled={isUpdating || isCreating}
                    onClick={() => navigate(routes.teacherList)}
                  >
                    Cancel
                  </button>
                  {isEdit ? (
                    <button 
                      type="button" 
                      className="btn btn-primary"
                      onClick={async (e) => {
                        e.preventDefault();
                        setFormBanner(null);
                        if (!teacherId || !formRef.current) return;
                        const submitErrs = collectSubmitErrors();
                        if (Object.keys(submitErrs).length > 0) {
                          setSubmitAttempted(true);
                          Object.keys(submitErrs).forEach((k) => touchField(k));
                          setFormBanner({
                            title: "Failed to save teacher",
                            message: "Please fix highlighted errors below.",
                          });
                          scrollToFirstError(submitErrs);
                          return;
                        }
                        const form = formRef.current;
                        const get = (name: string) => (form.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value?.trim() || null;
                        const getNum = (name: string) => { const v = get(name); return v ? parseInt(v, 10) : undefined; };
                        setIsUpdating(true);
                        try {
                          const bgRow = (bloodGroups || []).find(
                            (bg: any) => String(bg.id) === selectedBloodGroupId
                          );
                          const updateData: Record<string, any> = {
                            status: selectedStatus,
                            is_active: selectedStatus === 'Active',
                            first_name: firstName || teacherData?.first_name,
                            last_name: lastName || teacherData?.last_name,
                            phone: phone || teacherData?.phone,
                            email: email || teacherData?.email,
                            address: get('address') || teacherData?.address,
                            father_name: fatherName,
                            mother_name: motherName,
                            account_name: get('account_name') || teacherData?.account_name,
                            account_number: get('account_number') || teacherData?.account_number,
                            qualification: qualification || teacherData?.qualification,
                            experience_years: getNum('experience_years') ?? teacherData?.experience_years,
                            previous_school_name: get('previous_school_name') || teacherData?.previous_school_name,
                            previous_school_address: get('previous_school_address') || teacherData?.previous_school_address,
                            previous_school_phone: prevSchoolPhone,
                            bank_name: get('bank_name') || teacherData?.bank_name,
                            branch: get('branch') || teacherData?.branch,
                            ifsc: get('ifsc') || teacherData?.ifsc,
                            current_address: get('address') || teacherData?.current_address || teacherData?.address,
                            permanent_address: get('permanent_address') || teacherData?.permanent_address,
                            pan_number: panNumber,
                            id_number: idNumber,
                            epf_no: epfNo,
                            facebook: get('facebook') || teacherData?.facebook,
                            twitter: get('twitter') || teacherData?.twitter,
                            linkedin: get('linkedin') || teacherData?.linkedin,
                            youtube: get('youtube') || teacherData?.youtube,
                            instagram: get('instagram') || teacherData?.instagram,
                            other_info: get('other_info') || teacherData?.other_info,
                            languages_known: owner?.length ? owner : (teacherData?.languages_known ? (Array.isArray(teacherData.languages_known) ? teacherData.languages_known : [teacherData.languages_known]) : undefined),
                            class_id: selectedClassId ? parseInt(selectedClassId, 10) : teacherData?.class_id,
                            subject_id: selectedSubjectId ? parseInt(selectedSubjectId, 10) : teacherData?.subject_id,
                            gender: selectedGender || teacherData?.gender,
                            marital_status: selectedMaritalStatus,
                            designation_id: selectedDesignationId ? parseInt(selectedDesignationId, 10) : undefined,
                            department_id: selectedDepartmentId ? parseInt(selectedDepartmentId, 10) : undefined,
                            blood_group_id: selectedBloodGroupId ? parseInt(selectedBloodGroupId, 10) : undefined,
                            blood_group: bgRow?.blood_group ?? teacherData?.blood_group,
                            salary: getNum('salary') ?? teacherData?.salary,
                            contract_type: selectedContractType || teacherData?.contract_type,
                            shift: selectedShift || teacherData?.shift,
                            work_location: get('work_location') || teacherData?.work_location,
                            date_of_birth: dobDate
                              ? dobDate.format('YYYY-MM-DD')
                              : (teacherData?.date_of_birth
                                ? dayjs(teacherData.date_of_birth).format('YYYY-MM-DD')
                                : undefined),
                            joining_date: joiningDate
                              ? joiningDate.format('YYYY-MM-DD')
                              : (teacherData?.joining_date
                                ? dayjs(teacherData.joining_date).format('YYYY-MM-DD')
                                : undefined),
                          };
                          Object.keys(updateData).forEach(k => { if (updateData[k] === undefined) delete updateData[k]; });
                          const response = await apiService.updateTeacher(teacherId, updateData);
                          if (response && response.status === 'SUCCESS') {
                            const rFile = resumeFileRef.current;
                            const jFile = joiningLetterFileRef.current;
                            let proceedToList = true;
                            if (rFile || jFile) {
                              try {
                                const fd = new FormData();
                                if (rFile) fd.append('resume', rFile);
                                if (jFile) fd.append('joining_letter', jFile);
                                await apiService.uploadTeacherDocuments(teacherId, fd);
                              } catch (docErr) {
                                console.error(docErr);
                                setFormBanner({
                                  title: "Documents not uploaded",
                                  message: parseTeacherApiErrorMessage(
                                    docErr,
                                    "Teacher was saved but documents could not be uploaded. Try uploading PDFs again from Edit."
                                  ),
                                });
                                proceedToList = false;
                              }
                            }
                            if (proceedToList) {
                              navigate(routes.teacherList, { state: { refresh: true } });
                            }
                          } else {
                            setFormBanner({
                              title: "Failed to save teacher",
                              message: response?.message || "Failed to update teacher",
                            });
                          }
                        } catch (error: any) {
                          console.error('Error updating teacher:', error);
                            setFormBanner({
                              title: "Failed to save teacher",
                              message: parseTeacherApiErrorMessage(error, "Failed to update teacher. Please try again."),
                            });
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      disabled={isUpdating || hasBlockingErrors || checkingUnique}
                    >
                      {isUpdating ? 'Updating...' : 'Save Changes'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={isCreating || hasBlockingErrors || checkingUnique}
                      onClick={async (e) => {
                        e.preventDefault();
                        setFormBanner(null);
                        if (!formRef.current) return;
                        const submitErrs = collectSubmitErrors();
                        if (Object.keys(submitErrs).length > 0) {
                          setSubmitAttempted(true);
                          Object.keys(submitErrs).forEach((k) => touchField(k));
                          setFormBanner({
                            title: "Failed to save teacher",
                            message: "Please fix highlighted errors below.",
                          });
                          scrollToFirstError(submitErrs);
                          return;
                        }
                        const form = formRef.current;
                        const get = (name: string) =>
                          (form.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value?.trim() || null;
                        const getNum = (name: string) => {
                          const v = get(name);
                          return v ? parseInt(v, 10) : undefined;
                        };
                        const phoneDigits = phone.replace(/\D/g, "");
                        const pw = newPassword;
                        const bgRow = (bloodGroups || []).find(
                          (bg: any) => String(bg.id) === selectedBloodGroupId
                        );
                        setIsCreating(true);
                        try {
                          const payload: Record<string, any> = {
                            first_name: firstName.trim(),
                            last_name: lastName.trim(),
                            email: email.trim(),
                            phone: phoneDigits,
                            password: pw || undefined,
                            status: selectedStatus,
                            is_active: selectedStatus === "Active",
                            gender: selectedGender || undefined,
                            marital_status: selectedMaritalStatus || undefined,
                            designation_id: selectedDesignationId
                              ? parseInt(selectedDesignationId, 10)
                              : undefined,
                            department_id: selectedDepartmentId
                              ? parseInt(selectedDepartmentId, 10)
                              : undefined,
                            blood_group_id: selectedBloodGroupId
                              ? parseInt(selectedBloodGroupId, 10)
                              : undefined,
                            blood_group: bgRow?.blood_group,
                            father_name: fatherName || undefined,
                            mother_name: motherName || undefined,
                            address: get("address") || undefined,
                            qualification: qualification.trim() || undefined,
                            experience_years: getNum("experience_years"),
                            previous_school_name: get("previous_school_name") || undefined,
                            previous_school_address: get("previous_school_address") || undefined,
                            previous_school_phone: prevSchoolPhone || undefined,
                            current_address: get("address") || undefined,
                            permanent_address: get("permanent_address") || undefined,
                            pan_number: panNumber || undefined,
                            id_number: idNumber || undefined,
                            epf_no: epfNo || undefined,
                            bank_name: get("bank_name") || undefined,
                            branch: get("branch") || undefined,
                            ifsc: get("ifsc") || undefined,
                            contract_type: selectedContractType || undefined,
                            shift: selectedShift || undefined,
                            work_location: get("work_location") || undefined,
                            salary: getNum("salary"),
                            facebook: get("facebook") || undefined,
                            twitter: get("twitter") || undefined,
                            linkedin: get("linkedin") || undefined,
                            youtube: get("youtube") || undefined,
                            instagram: get("instagram") || undefined,
                            other_info: get("other_info") || undefined,
                            account_name: get("account_name") || undefined,
                            account_number: get("account_number") || undefined,
                            languages_known: owner?.length ? owner : ["English"],
                            employee_code: get("employee_code") || undefined,
                            date_of_birth: dobDate ? dobDate.format("YYYY-MM-DD") : undefined,
                            joining_date: joiningDate ? joiningDate.format("YYYY-MM-DD") : undefined,
                            emergency_contact_name: get("emergency_contact_name") || undefined,
                            emergency_contact_phone: get("emergency_contact_phone") || undefined,
                          };
                          Object.keys(payload).forEach((k) => {
                            if (payload[k] === undefined)
                              delete payload[k];
                          });
                          const response = await apiService.createTeacher(payload);
                          if (response && response.status === "SUCCESS") {
                            const newId = extractCreatedTeacherId(response);
                            const rFile = resumeFileRef.current;
                            const jFile = joiningLetterFileRef.current;
                            let proceedToList = true;
                            if (rFile || jFile) {
                              if (newId == null) {
                                setFormBanner({
                                  title: "Teacher created",
                                  message:
                                    "The teacher was created but the app could not read the new teacher ID, so PDFs were not uploaded. Open Edit for this teacher and upload the documents again.",
                                });
                                proceedToList = false;
                              } else {
                                try {
                                  const fd = new FormData();
                                  if (rFile) fd.append("resume", rFile);
                                  if (jFile) fd.append("joining_letter", jFile);
                                  await apiService.uploadTeacherDocuments(newId, fd);
                                } catch (docErr) {
                                  console.error(docErr);
                                  setFormBanner({
                                    title: "Documents not uploaded",
                                    message: parseTeacherApiErrorMessage(
                                      docErr,
                                      "Teacher was created but documents could not be uploaded. Edit the teacher to add PDFs."
                                    ),
                                  });
                                  proceedToList = false;
                                }
                              }
                            }
                            if (proceedToList) {
                              navigate(routes.teacherList, { state: { refresh: true } });
                            }
                          } else {
                            setFormBanner({
                              title: "Failed to save teacher",
                              message: response?.message || "Failed to create teacher",
                            });
                          }
                        } catch (error: any) {
                          console.error("Error creating teacher:", error);
                          setFormBanner({
                            title: "Failed to save teacher",
                            message: parseTeacherApiErrorMessage(
                              error,
                              "Failed to create teacher. Please try again."
                            ),
                          });
                        } finally {
                          setIsCreating(false);
                        }
                      }}
                    >
                      {isCreating ? "Saving…" : "Add Teacher"}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default TeacherForm;





