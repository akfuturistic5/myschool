import { useEffect, useState, useRef, type ChangeEvent } from "react";
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
import { useClasses } from "../../../../core/hooks/useClasses";
import { useSubjects } from "../../../../core/hooks/useSubjects";
import { useBloodGroups } from "../../../../core/hooks/useBloodGroups";
import { useHostels } from "../../../../core/hooks/useHostels";
import { useHostelRooms } from "../../../../core/hooks/useHostelRooms";
import { useTransportRoutes } from "../../../../core/hooks/useTransportRoutes";
import { useTransportPickupPoints } from "../../../../core/hooks/useTransportPickupPoints";
import { useTransportVehicles } from "../../../../core/hooks/useTransportVehicles";
import { useDepartments } from "../../../../core/hooks/useDepartments";
import { useDesignations } from "../../../../core/hooks/useDesignations";

interface TeacherLocationState {
  teacherId?: number;
  teacher?: any;
  returnTo?: string;
}

const CLIENT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const isValidClientEmail = (s: string) => {
  const t = s.trim();
  return t.length > 0 && t.length <= 100 && CLIENT_EMAIL_RE.test(t);
};

const isValidClientPhone = (s: string) => {
  const d = s.replace(/\D/g, "");
  return d.length >= 7 && d.length <= 15;
};

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

const TeacherForm = () => {
  const routes = all_routes;
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as TeacherLocationState | null;
  const teacherId = state?.teacherId ?? state?.teacher?.id;
  const formRef = useRef<HTMLFormElement>(null);

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
  const handleTagsChange = (newTags: string[]) => {
    setOwner(newTags);
  };

  const [dobDate, setDobDate] = useState<dayjs.Dayjs | null>(null);
  const [joiningDate, setJoiningDate] = useState<dayjs.Dayjs | null>(null);
  const [leavingDate, setLeavingDate] = useState<dayjs.Dayjs | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<string>('Active');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [joiningLetterFile, setJoiningLetterFile] = useState<File | null>(null);
  /** Same files as state; refs avoid rare stale values on save click after long forms. */
  const resumeFileRef = useRef<File | null>(null);
  const joiningLetterFileRef = useRef<File | null>(null);

  // Lookup data from API (real data for dropdowns)
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { classes, loading: classesLoading, error: classesError } = useClasses(academicYearId);
  const { subjects, loading: subjectsLoading, error: subjectsError } = useSubjects();
  const { bloodGroups, loading: bloodGroupsLoading, error: bloodGroupsError } = useBloodGroups();
  const { hostels } = useHostels();
  const { hostelRooms } = useHostelRooms();
  const { data: transportRoutes, loading: routesLoading, error: routesError } = useTransportRoutes();
  const { data: pickupPoints, loading: pickupLoading, error: pickupError } = useTransportPickupPoints();
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError } = useTransportVehicles();
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
      setSelectedStatus("Active");
      setOwner(["English"]);
      setDobDate(null);
      setJoiningDate(null);
      setLeavingDate(null);
      setResumeFile(null);
      setJoiningLetterFile(null);
      resumeFileRef.current = null;
      joiningLetterFileRef.current = null;
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
        const tags = typeof teacherData.languages_known === "string"
          ? teacherData.languages_known.split(",").map((s: string) => s.trim()).filter(Boolean)
          : [];
        setOwner(tags.length ? tags : ["English"]);
      } else {
        setOwner(["English"]);
      }
      const currentStatus = teacherData.status === 'Active' || teacherData.is_active === true || teacherData.is_active === 1 
        ? 'Active' 
        : 'Inactive';
      setSelectedStatus(currentStatus);
      setSelectedClassId(teacherData.class_id ? String(teacherData.class_id) : null);
      setSelectedSubjectId(teacherData.subject_id ? String(teacherData.subject_id) : null);
      setSelectedGender(teacherData.gender ?? null);
      setSelectedMaritalStatus(teacherData.marital_status ?? null);
      setSelectedBloodGroupId(
        teacherData.blood_group_id != null ? String(teacherData.blood_group_id) : null
      );
      setSelectedDesignationId(
        teacherData.designation_id != null ? String(teacherData.designation_id) : null
      );
      setSelectedDepartmentId(
        teacherData.department_id != null ? String(teacherData.department_id) : null
      );
      setSelectedContractType(teacherData.contract_type ?? null);
      setSelectedShift(teacherData.shift ?? null);
    }
  }, [teacherData, isEdit]);

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
      alert(parseTeacherApiErrorMessage(e, "Could not open document."));
    }
  };

  const onPickResume = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      alert("File must be 4MB or smaller.");
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && f.type !== "application/pdf") {
      alert("Only PDF files are allowed.");
      return;
    }
    setResumeFile(f);
    resumeFileRef.current = f;
  };

  const onPickJoiningLetter = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > 4 * 1024 * 1024) {
      alert("File must be 4MB or smaller.");
      return;
    }
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && f.type !== "application/pdf") {
      alert("Only PDF files are allowed.");
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
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">First Name</label>
                            <input
                              name="first_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.first_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Last Name</label>
                            <input
                              name="last_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.last_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
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
                                }}
                              />
                            )}
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
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
                                }}
                              />
                            )}
                          </div>
                        </div>
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
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Primary Contact Number
                            </label>
                            <input
                              name="phone"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.phone ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Email Address</label>
                            <input
                              name="email"
                              type="email"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.email ?? "") : undefined}
                            />
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
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Date of Joining
                            </label>
                            <div className="input-icon position-relative">
                              <DatePicker
                                className="form-control datetimepicker"
                                format={{ format: "DD-MM-YYYY", type: "mask" }}
                                value={joiningDate}
                                onChange={(d) => setJoiningDate(d)}
                                placeholder="Select date"
                              />
                              <span className="input-icon-addon">
                                <i className="ti ti-calendar" />
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Father’s Name</label>
                            <input
                              name="father_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.father_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Mother’s Name</label>
                            <input
                              name="mother_name"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.mother_name ?? "") : undefined}
                            />
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
                        <div className="col-xxl col-xl-3 col-md-6">
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
                              }}
                            />
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
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Qualification</label>
                            <input
                              name="qualification"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.qualification ?? "") : undefined}
                            />
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
                        <div className="col-xxl col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Previous School Phone No
                            </label>
                            <input
                              name="previous_school_phone"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.previous_school_phone ?? "") : undefined}
                            />
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
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              PAN Number
                            </label>
                            <input
                              name="pan_number"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.pan_number ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-xxl-3 col-xl-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              ID Number
                            </label>
                            <input
                              name="id_number"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.id_number ?? "") : undefined}
                            />
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
                              className="form-control"
                              placeholder="Other Information"
                              rows={4}
                              defaultValue={
                                isEdit
                                  ? "Depending on the specific needs of your organization or system, additional information may be collected or tracked. Its important to ensure that any data collected complies with privacy regulations and policies to protect students sensitive information"
                                  : undefined
                              }
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
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.epf_no ?? "") : undefined}
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
                  {/* Leaves */}
                  <div className="card">
                    <div className="card-header bg-light">
                      <div className="d-flex align-items-center">
                        <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
                          <i className="ti ti-users fs-16" />
                        </span>
                        <h4 className="text-dark">Leaves</h4>
                      </div>
                    </div>
                    <div className="card-body pb-1">
                      <div className="row">
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Medical Leaves</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit ? "01" : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Casual Leaves</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit ? "02" : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">
                              Maternity Leaves
                            </label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit ? "20" : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-3 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Sick Leaves</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit ? "02" : undefined}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* /Leaves */}
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
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.emergency_contact_name ?? "") : undefined}
                            />
                          </div>
                        </div>
                        <div className="col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Account Number</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.emergency_contact_phone ?? "") : undefined}
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
                              defaultValue={undefined}
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
                              options={(vehicles || []).map((v: any) => ({
                                value: String((v.originalData?.id ?? v.id) ?? ''),
                                label: v.vehicleNumber ?? v.originalData?.vehicle_number ?? 'N/A',
                              }))}
                              defaultValue={undefined}
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
                              defaultValue={undefined}
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
                            <label className="form-label">Instagram</label>
                            <input
                              type="text"
                              className="form-control"
                              defaultValue={
                                isEdit ? "www.instagram.com" : undefined
                              }
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
                              type="text"
                              className="form-control"
                              defaultValue={
                                isEdit ? "www.youtube.com" : undefined
                              }
                            />
                          </div>
                        </div>
                        <div className="col-xxl col-xl-3 col-lg-4 col-md-6">
                          <div className="mb-3">
                            <label className="form-label">Twitter URL</label>
                            <input
                              name="twitter"
                              type="text"
                              className="form-control"
                              defaultValue={isEdit && t ? (t.twitter ?? "") : undefined}
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
                        <div className="col-lg-6">
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
                          </div>
                        </div>
                        <div className="col-lg-6">
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
                            <div className="col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Password</label>
                                <input name="new_password" type="password" className="form-control" autoComplete="new-password" />
                              </div>
                            </div>
                            <div className="col-md-6">
                              <div className="mb-3">
                                <label className="form-label">Confirm password</label>
                                <input name="confirm_password" type="password" className="form-control" autoComplete="new-password" />
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
                        if (!teacherId || !formRef.current) return;
                        const form = formRef.current;
                        const get = (name: string) => (form.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value?.trim() || null;
                        const getNum = (name: string) => { const v = get(name); return v ? parseInt(v, 10) : undefined; };
                        const emUpd = get("email");
                        const phUpd = get("phone");
                        if (emUpd && !isValidClientEmail(emUpd)) {
                          alert("Please enter a valid email address.");
                          return;
                        }
                        if (phUpd && !isValidClientPhone(phUpd)) {
                          alert("Phone must contain 7–15 digits.");
                          return;
                        }
                        setIsUpdating(true);
                        try {
                          const bgRow = (bloodGroups || []).find(
                            (bg: any) => String(bg.id) === selectedBloodGroupId
                          );
                          const updateData: Record<string, any> = {
                            status: selectedStatus,
                            is_active: selectedStatus === 'Active',
                            first_name: get('first_name') || teacherData?.first_name,
                            last_name: get('last_name') || teacherData?.last_name,
                            phone: get('phone') || teacherData?.phone,
                            email: get('email') || teacherData?.email,
                            address: get('address') || teacherData?.address,
                            father_name: get('father_name') || teacherData?.father_name,
                            mother_name: get('mother_name') || teacherData?.mother_name,
                            qualification: get('qualification') || teacherData?.qualification,
                            experience_years: getNum('experience_years') ?? teacherData?.experience_years,
                            previous_school_name: get('previous_school_name') || teacherData?.previous_school_name,
                            previous_school_address: get('previous_school_address') || teacherData?.previous_school_address,
                            previous_school_phone: get('previous_school_phone') || teacherData?.previous_school_phone,
                            bank_name: get('bank_name') || teacherData?.bank_name,
                            branch: get('branch') || teacherData?.branch,
                            ifsc: get('ifsc') || teacherData?.ifsc,
                            current_address: get('address') || teacherData?.current_address || teacherData?.address,
                            permanent_address: get('permanent_address') || teacherData?.permanent_address,
                            pan_number: get('pan_number') || teacherData?.pan_number,
                            id_number: get('id_number') || teacherData?.id_number,
                            facebook: get('facebook') || teacherData?.facebook,
                            twitter: get('twitter') || teacherData?.twitter,
                            linkedin: get('linkedin') || teacherData?.linkedin,
                            languages_known: owner?.length ? owner : (teacherData?.languages_known ? (Array.isArray(teacherData.languages_known) ? teacherData.languages_known : [teacherData.languages_known]) : undefined),
                            class_id: selectedClassId ? parseInt(selectedClassId, 10) : teacherData?.class_id,
                            subject_id: selectedSubjectId ? parseInt(selectedSubjectId, 10) : teacherData?.subject_id,
                            gender: selectedGender || teacherData?.gender,
                            marital_status: selectedMaritalStatus || teacherData?.marital_status,
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
                          Object.keys(updateData).forEach(k => { if (updateData[k] === undefined || updateData[k] === null) delete updateData[k]; });
                          const response = await apiService.updateTeacher(teacherId, updateData);
                          if (response && response.status === 'SUCCESS') {
                            const rFile = resumeFileRef.current;
                            const jFile = joiningLetterFileRef.current;
                            if (rFile || jFile) {
                              try {
                                const fd = new FormData();
                                if (rFile) fd.append('resume', rFile);
                                if (jFile) fd.append('joining_letter', jFile);
                                await apiService.uploadTeacherDocuments(teacherId, fd);
                              } catch (docErr) {
                                console.error(docErr);
                                alert(
                                  parseTeacherApiErrorMessage(
                                    docErr,
                                    'Teacher was saved but documents could not be uploaded. Try uploading PDFs again from Edit.'
                                  )
                                );
                              }
                            }
                            navigate(routes.teacherList, { state: { refresh: true } });
                          } else {
                            alert(response?.message || 'Failed to update teacher');
                          }
                        } catch (error: any) {
                          console.error('Error updating teacher:', error);
                          alert(parseTeacherApiErrorMessage(error, "Failed to update teacher. Please try again."));
                        } finally {
                          setIsUpdating(false);
                        }
                      }}
                      disabled={isUpdating}
                    >
                      {isUpdating ? 'Updating...' : 'Save Changes'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary"
                      disabled={isCreating}
                      onClick={async (e) => {
                        e.preventDefault();
                        if (!formRef.current) return;
                        const form = formRef.current;
                        const get = (name: string) =>
                          (form.querySelector(`[name="${name}"]`) as HTMLInputElement)?.value?.trim() || null;
                        const getNum = (name: string) => {
                          const v = get(name);
                          return v ? parseInt(v, 10) : undefined;
                        };
                        const fn = get("first_name");
                        const ln = get("last_name");
                        const em = get("email");
                        const ph = get("phone");
                        if (!fn || !ln) {
                          alert("First name and last name are required.");
                          return;
                        }
                        if (!em) {
                          alert("Email is required.");
                          return;
                        }
                        if (!ph) {
                          alert("Phone is required.");
                          return;
                        }
                        if (!isValidClientEmail(em)) {
                          alert("Please enter a valid email address.");
                          return;
                        }
                        if (!isValidClientPhone(ph)) {
                          alert("Phone must contain 7–15 digits.");
                          return;
                        }
                        if (!selectedClassId || !selectedSubjectId) {
                          alert("Please select class and subject.");
                          return;
                        }
                        const pw = get("new_password");
                        const pwc = get("confirm_password");
                        if (pw || pwc) {
                          if (pw !== pwc) {
                            alert("Password and confirm password do not match.");
                            return;
                          }
                          if (pw.length < 6) {
                            alert("Password must be at least 6 characters.");
                            return;
                          }
                        }
                        const bgRow = (bloodGroups || []).find(
                          (bg: any) => String(bg.id) === selectedBloodGroupId
                        );
                        setIsCreating(true);
                        try {
                          const payload: Record<string, any> = {
                            first_name: fn,
                            last_name: ln,
                            email: em,
                            phone: ph,
                            password: pw || undefined,
                            class_id: parseInt(selectedClassId, 10),
                            subject_id: parseInt(selectedSubjectId, 10),
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
                            father_name: get("father_name") || undefined,
                            mother_name: get("mother_name") || undefined,
                            address: get("address") || undefined,
                            qualification: get("qualification") || undefined,
                            experience_years: getNum("experience_years"),
                            previous_school_name: get("previous_school_name") || undefined,
                            previous_school_address: get("previous_school_address") || undefined,
                            previous_school_phone: get("previous_school_phone") || undefined,
                            current_address: get("address") || undefined,
                            permanent_address: get("permanent_address") || undefined,
                            pan_number: get("pan_number") || undefined,
                            id_number: get("id_number") || undefined,
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
                            languages_known: owner?.length ? owner : ["English"],
                            employee_code: get("employee_code") || undefined,
                            date_of_birth: dobDate ? dobDate.format("YYYY-MM-DD") : undefined,
                            joining_date: joiningDate ? joiningDate.format("YYYY-MM-DD") : undefined,
                            emergency_contact_name: get("emergency_contact_name") || undefined,
                            emergency_contact_phone: get("emergency_contact_phone") || undefined,
                          };
                          Object.keys(payload).forEach((k) => {
                            if (payload[k] === undefined || payload[k] === null || payload[k] === "")
                              delete payload[k];
                          });
                          const response = await apiService.createTeacher(payload);
                          if (response && response.status === "SUCCESS") {
                            const newId = extractCreatedTeacherId(response);
                            const rFile = resumeFileRef.current;
                            const jFile = joiningLetterFileRef.current;
                            if (rFile || jFile) {
                              if (newId == null) {
                                alert(
                                  "Teacher was created but the app could not read the new teacher ID, so PDFs were not uploaded. Open Edit for this teacher and upload the documents again."
                                );
                              } else {
                                try {
                                  const fd = new FormData();
                                  if (rFile) fd.append("resume", rFile);
                                  if (jFile) fd.append("joining_letter", jFile);
                                  await apiService.uploadTeacherDocuments(newId, fd);
                                } catch (docErr) {
                                  console.error(docErr);
                                  alert(
                                    parseTeacherApiErrorMessage(
                                      docErr,
                                      "Teacher was created but documents could not be uploaded. Edit the teacher to add PDFs."
                                    )
                                  );
                                }
                              }
                            }
                            navigate(routes.teacherList, { state: { refresh: true } });
                          } else {
                            alert(response?.message || "Failed to create teacher");
                          }
                        } catch (error: any) {
                          console.error("Error creating teacher:", error);
                          alert(parseTeacherApiErrorMessage(error, "Failed to create teacher. Please try again."));
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
