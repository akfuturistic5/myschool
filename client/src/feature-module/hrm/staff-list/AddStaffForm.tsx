import { useCallback, useEffect, useMemo, useState, useRef, type ReactElement, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import CommonSelect from "../../../core/common/commonSelect";
import type { Option } from "../../../core/common/commonSelect";
import { Contract, Marital, Shift } from "../../../core/common/selectoption/selectoption";
import { apiService } from "../../../core/services/apiService";
import { all_routes } from "../../router/all_routes";
import TagInput from "../../../core/common/Taginput";
import { useBloodGroups } from "../../../core/hooks/useBloodGroups";
import { useDepartments } from "../../../core/hooks/useDepartments";
import { useDesignations } from "../../../core/hooks/useDesignations";
import { useStaffRoleOptions } from "../../../core/hooks/useStaffRoleOptions";

import { staffDirectoryFriendlyError } from "./staffDirectoryErrors";
import {
  buildDepartmentSelectOptions,
  buildDesignationSelectOptions,
  resolveDesignationAfterDepartmentChange,
} from "../../../core/utils/departmentDesignationUtils";

const genderOptions: Option[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

/** Visible required marker (server: first_name, last_name, email, phone) */
function Req() {
  return (
    <span className="text-danger" title="Required">
      {" "}
      *
    </span>
  );
}

/** Optional fields (everything else for create) */
function Opt() {
  return <span className="text-muted fw-normal small ms-1">(optional)</span>;
}

/** Whole card/section is optional (payroll, leaves, bank, transport, hostel, password, etc.) */
function SectionOptional() {
  return (
    <span className="badge bg-light text-secondary border fw-normal ms-2 align-middle">Optional</span>
  );
}

function toYmd(d: Dayjs | null): string | null {
  if (!d || !d.isValid()) return null;
  return d.format("YYYY-MM-DD");
}

/**
 * Full "Add Staff" layout (same sections as the original template) with:
 * - Dynamic dropdowns from the same APIs/hooks as Add Teacher (departments, designations, blood groups, transport, hostels).
 * - Submit persists only fields supported by `POST /staff` / `staff` table (same contract as StaffProfileForm).
 * - Extra sections (bank, transport IDs, leaves, etc.) are UI-only until backend models exist for generic staff — see banner copy.
 */
export default function AddStaffForm() {
  const routes = all_routes;
  const navigate = useNavigate();

  const { departments, loading: departmentsLoading, error: departmentsError } = useDepartments();
  const { designations, loading: designationsLoading, error: designationsError } = useDesignations();
  const { bloodGroups, loading: bloodGroupsLoading, error: bloodGroupsError } = useBloodGroups();
  const {
    roleOptions,
    administrativeRoleId,
    driverRoleId,
    loading: rolesLoading,
    error: rolesError,
  } = useStaffRoleOptions();

  const [owner, setOwner] = useState<string[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [designationId, setDesignationId] = useState<string | null>(null);
  const [roleId, setRoleId] = useState<string | null>(null);
  const [bloodGroupId, setBloodGroupId] = useState<string | null>(null);
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null);
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [dob, setDob] = useState<Dayjs | null>(null);
  const [joiningDate, setJoiningDate] = useState<Dayjs | null>(null);
  const [qualification, setQualification] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [noteField, setNoteField] = useState("");
  const [address, setAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  /** Shown when designation is Driver (synced with server `drivers` + Support Staff department). */
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState<Dayjs | null>(null);

  const [epfNo, setEpfNo] = useState("");
  const [salary, setSalary] = useState("");
  const [contractType, setContractType] = useState<string | null>(null);
  const [shift, setShift] = useState<string | null>(null);
  const [workLocation, setWorkLocation] = useState("");


  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [branchName, setBranchName] = useState("");

  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [joiningLetterFile, setJoiningLetterFile] = useState<File | null>(null);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [joiningLetterError, setJoiningLetterError] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const resumeRef = useRef<File | null>(null);
  const letterRef = useRef<File | null>(null);
  const photoRef = useRef<File | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deptOptions = useMemo(
    () => buildDepartmentSelectOptions((departments as any[]) || []),
    [departments]
  );

  const desigOptions = useMemo(
    () => buildDesignationSelectOptions((designations as any[]) || [], departmentId),
    [designations, departmentId]
  );

  const handleDepartmentChange = useCallback(
    (value: string | null) => {
      setDepartmentId(value);
      setDesignationId((prev) =>
        resolveDesignationAfterDepartmentChange(prev, (designations as any[]) || [], value)
      );
    },
    [designations]
  );

  const bloodOptions = useMemo(
    () =>
      ((bloodGroups as any[]) || []).map((bg) => ({
        value: String(bg.id ?? ""),
        label: bg.blood_group_name || bg.blood_group || "",
      })),
    [bloodGroups]
  );


  const metaBusy =
    departmentsLoading || designationsLoading || bloodGroupsLoading || rolesLoading;

  const supportStaffDepartmentId = useMemo(() => {
    const row = ((departments as any[]) || []).find(
      (d) => String(d.department ?? "").trim().toLowerCase() === "support staff"
    );
    return row?.originalData?.id != null ? String(row.originalData.id) : null;
  }, [departments]);

  const isDriverSelected = useMemo(() => {
    if (!designationId) return false;
    const row = ((designations as any[]) || []).find(
      (d) => String(d.originalData?.id) === designationId
    );
    const name = String(row?.designation ?? row?.originalData?.designation_name ?? "")
      .trim()
      .toLowerCase();
    return name === "driver" || name === "drivers";
  }, [designationId, designations]);

  const onPickResume = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setResumeError(null);
    if (f.size > 4 * 1024 * 1024) {
      setResumeError("File must be 4MB or smaller.");
      return;
    }
    if (f.type !== "application/pdf") {
      setResumeError("Only PDF files are allowed.");
      return;
    }
    setResumeFile(f);
    resumeRef.current = f;
  };

  const onPickJoiningLetter = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setJoiningLetterError(null);
    if (f.size > 4 * 1024 * 1024) {
      setJoiningLetterError("File must be 4MB or smaller.");
      return;
    }
    if (f.type !== "application/pdf") {
      setJoiningLetterError("Only PDF files are allowed.");
      return;
    }
    setJoiningLetterFile(f);
    letterRef.current = f;
  };

  const onPickPhoto = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setPhotoError(null);
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview(null);
      photoRef.current = null;
      return;
    }
    if (!file.type.startsWith("image/")) {
      setPhotoError("Please select an image file.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setPhotoError("Image size must be under 2MB.");
      return;
    }
    setPhotoFile(file);
    photoRef.current = file;
    setPhotoPreview(URL.createObjectURL(file));
  };

  const onRemovePhoto = () => {
    setPhotoFile(null);
    photoRef.current = null;
    setPhotoPreview(null);
  };

  useEffect(() => {
    if (isDriverSelected && supportStaffDepartmentId) {
      setDepartmentId(supportStaffDepartmentId);
      setDesignationId((prev) =>
        resolveDesignationAfterDepartmentChange(
          prev,
          (designations as any[]) || [],
          supportStaffDepartmentId
        )
      );
    }
  }, [isDriverSelected, supportStaffDepartmentId, designations]);

  useEffect(() => {
    if (isDriverSelected && driverRoleId) {
      setRoleId(driverRoleId);
      return;
    }
    if (administrativeRoleId) setRoleId(administrativeRoleId);
  }, [isDriverSelected, driverRoleId, administrativeRoleId]);

  const getMissingPersonalFields = useCallback((): string[] => {
    const m: string[] = [];
    if (!firstName.trim()) m.push("First name");
    if (!lastName.trim()) m.push("Last name");
    if (!employeeCode.trim()) m.push("Employee code");
    if (!departmentId) m.push("Department");
    if (!designationId) m.push("Designation");
    if (!roleId) m.push("Role");
    if (!gender) m.push("Gender");
    if (!phone.trim()) m.push("Primary phone");
    if (!email.trim()) m.push("Email");
    if (!bloodGroupId || String(bloodGroupId).trim() === "") m.push("Blood group");
    if (!maritalStatus) m.push("Marital status");
    if (!fatherName.trim()) m.push("Father's name");
    if (!motherName.trim()) m.push("Mother's name");
    if (!dob || !dob.isValid()) m.push("Date of birth");
    if (!joiningDate || !joiningDate.isValid()) m.push("Date of joining");
    const langs = owner.map((t) => t.trim()).filter(Boolean);
    if (langs.length === 0) m.push("Languages known");
    if (!qualification.trim()) m.push("Qualification");
    const exp = experienceYears.trim();
    if (exp === "" || Number.isNaN(parseInt(exp, 10)) || parseInt(exp, 10) < 0) {
      m.push("Experience (years)");
    }
    if (!noteField.trim()) m.push("Note");
    if (!address.trim()) m.push("Address");
    if (!permanentAddress.trim()) m.push("Permanent address");
    if (!emergencyName.trim()) m.push("Emergency contact name");
    if (!emergencyPhone.trim()) m.push("Emergency contact phone");
    if (isDriverSelected && !licenseNumber.trim()) m.push("Driving licence number");
    return m;
  }, [
    firstName,
    lastName,
    employeeCode,
    departmentId,
    designationId,
    roleId,
    gender,
    phone,
    email,
    bloodGroupId,
    maritalStatus,
    fatherName,
    motherName,
    dob,
    joiningDate,
    owner,
    qualification,
    experienceYears,
    noteField,
    address,
    permanentAddress,
    emergencyName,
    emergencyPhone,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (metaBusy) {
        window.alert("Please wait — still loading departments, designations, or blood groups.");
        return;
      }
      const missingPersonal = getMissingPersonalFields();
      if (missingPersonal.length > 0) {
        window.alert(
          `Please fill all required fields in Personal Information (profile photo is optional).\n\nMissing:\n• ${missingPersonal.join("\n• ")}`
        );
        return;
      }
      if (password && password !== confirmPassword) {
        setError("Password and confirmation do not match.");
        return;
      }

      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        gender: gender || null,
        date_of_birth: toYmd(dob),
        joining_date: toYmd(joiningDate),
        blood_group_id: bloodGroupId ? Number(bloodGroupId) : null,
        designation_id: designationId ? Number(designationId) : null,
        department_id: departmentId ? Number(departmentId) : null,
        role_id: roleId ? Number(roleId) : null,
        qualification: qualification.trim() || null,
        experience_years: (() => {
          if (!experienceYears.trim()) return null;
          const n = parseInt(experienceYears, 10);
          return Number.isNaN(n) ? null : n;
        })(),
        salary: (() => {
          if (!salary.trim()) return null;
          const n = parseFloat(salary);
          return Number.isNaN(n) ? null : n;
        })(),
        // Address (users table)
        current_address: address.trim() || null,
        permanent_address: permanentAddress.trim() || null,
        // Emergency contact (staff table)
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        // Additional staff fields
        marital_status: maritalStatus || null,
        father_name: fatherName.trim() || null,
        mother_name: motherName.trim() || null,
        languages_known: owner.filter(Boolean),
        other_info: noteField.trim() || null,
        is_active: isActive,
        // Payroll / bank
        epf_no: epfNo.trim() || null,
        pan_number: null,
        bank_name: bankName.trim() || null,
        account_name: bankAccountName.trim() || null,
        account_number: bankAccountNumber.trim() || null,
        branch: branchName.trim() || null,
        ifsc: ifsc.trim() || null,
        contract_type: contractType || null,
        shift: shift || null,
        work_location: workLocation.trim() || null,
        // Social media (users table)
        facebook: facebook.trim() || null,
        twitter: twitter.trim() || null,
        linkedin: linkedin.trim() || null,
        instagram: instagram.trim() || null,
        ...(isDriverSelected
          ? {
              license_number: licenseNumber.trim(),
              license_expiry: toYmd(licenseExpiry),
            }
          : {}),
      };
      payload.employee_code = employeeCode.trim();
      if (password.trim()) payload.password = password.trim();


      setSubmitting(true);
      try {
        const response = (await apiService.createStaff(payload)) as { status?: string; message?: string; data?: { id: number } };
        if (response?.status === "SUCCESS") {
          const staffId = response.data?.id;
          const rFile = resumeRef.current;
          const jFile = letterRef.current;

          if (staffId) {
            if (rFile || jFile) {
              try {
                const fd = new FormData();
                if (rFile) fd.append("resume", rFile);
                if (jFile) fd.append("joining_letter", jFile);
                await apiService.uploadStaffDocuments(staffId, fd);
              } catch (docErr) {
                console.error("Doc upload error:", docErr);
              }
            }
            if (photoRef.current) {
              try {
                await apiService.uploadStaffPhoto(staffId, photoRef.current);
              } catch (photoErr) {
                console.error("Photo upload error:", photoErr);
              }
            }
          }
          navigate(routes.staff, { replace: false });
        } else {
          setError(response?.message || "Failed to create staff.");
        }
      } catch (err: unknown) {
        setError(staffDirectoryFriendlyError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [
      metaBusy,
      getMissingPersonalFields,
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword,
      gender,
      dob,
      joiningDate,
      bloodGroupId,
      designationId,
      departmentId,
      roleId,
      qualification,
      experienceYears,
      salary,
      address,
      emergencyName,
      emergencyPhone,
      isActive,
      employeeCode,
      navigate,
      routes.staff,
      isDriverSelected,
      licenseNumber,
      licenseExpiry,
    ]
  );

  const loadOrError = (loading: boolean, err: string | null, node: ReactElement) => {
    if (loading) {
      return (
        <div className="form-control">
          <i className="ti ti-loader ti-spin me-2" />
          Loading…
        </div>
      );
    }
    if (err) {
      return <div className="form-control text-danger">{err}</div>;
    }
    return node;
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {/* Personal Information */}
      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-info-square-rounded fs-16" />
            </span>
            <h4 className="text-dark mb-0">Personal Information</h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="add-section">
            <div className="row">
              <div className="col-md-12">
                <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                  <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Profile Preview" className="img-fluid w-100 h-100 object-fit-cover" />
                    ) : (
                      <i className="ti ti-photo-plus fs-16" />
                    )}
                  </div>
                  <div className="profile-upload">
                    <p className="form-label mb-2">
                      Profile photo <span className="text-muted small fw-normal">(optional)</span>
                    </p>
                    <div className="profile-uploader d-flex align-items-center">
                      <div className="drag-upload-btn mb-3">
                        Upload
                        <input type="file" className="form-control image-sign" accept="image/*" onChange={onPickPhoto} />
                      </div>
                      <button type="button" className={`btn btn-primary mb-3 ${!photoFile ? "disabled" : ""}`} onClick={onRemovePhoto}>
                        Remove
                      </button>
                    </div>
                    {photoError && <div className="text-danger fs-12 mb-2">{photoError}</div>}
                  </div>
                </div>
              </div>
            </div>
            {metaBusy && <p className="text-muted small">Loading reference data…</p>}
            <div className="row row-cols-xxl-5 row-cols-md-6">
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label" htmlFor="staff-add-first-name">
                    First name
                    <Req />
                  </label>
                  <input
                    id="staff-add-first-name"
                    className="form-control"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    autoComplete="given-name"
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label" htmlFor="staff-add-last-name">
                    Last name
                    <Req />
                  </label>
                  <input
                    id="staff-add-last-name"
                    className="form-control"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    autoComplete="family-name"
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label" htmlFor="staff-add-employee-code">
                    Employee code
                    <Req />
                  </label>
                  <input
                    id="staff-add-employee-code"
                    className="form-control"
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Department
                    <Req />
                  </label>
                  {loadOrError(
                    departmentsLoading,
                    departmentsError,
                    <CommonSelect
                      className="select"
                      options={deptOptions}
                      value={departmentId}
                      onChange={handleDepartmentChange}
                    />
                  )}
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Designation
                    <Req />
                  </label>
                  {loadOrError(
                    designationsLoading,
                    designationsError,
                    <CommonSelect
                      className="select"
                      options={desigOptions}
                      value={designationId}
                      onChange={(v) => setDesignationId(v)}
                      isDisabled={!departmentId || metaBusy}
                      placeholder={departmentId ? "Select" : "Select department first"}
                      noOptionsMessage={() =>
                        departmentId ? "No designations for this department" : "Select department first"
                      }
                    />
                  )}
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Role
                    <Req />
                  </label>
                  {loadOrError(
                    rolesLoading,
                    rolesError,
                    <CommonSelect
                      className="select"
                      options={roleOptions}
                      value={roleId}
                      onChange={(v) => setRoleId(v)}
                    />
                  )}
                </div>
              </div>
              {isDriverSelected && (
                <>
                  <div className="col-xxl col-xl-3 col-md-6">
                    <div className="mb-3">
                      <label className="form-label" htmlFor="staff-add-license">
                        Driving licence number
                        <Req />
                      </label>
                      <input
                        id="staff-add-license"
                        className="form-control"
                        value={licenseNumber}
                        onChange={(e) => setLicenseNumber(e.target.value)}
                        required={isDriverSelected}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  <div className="col-xxl col-xl-3 col-md-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Licence expiry
                        <Opt />
                      </label>
                      <DatePicker
                        className="form-control w-100"
                        value={licenseExpiry}
                        onChange={(d) => setLicenseExpiry(d)}
                        format="DD-MM-YYYY"
                      />
                    </div>
                  </div>
                </>
              )}
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Gender
                    <Req />
                  </label>
                  <CommonSelect className="select" options={genderOptions} value={gender} onChange={(v) => setGender(v)} />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label" htmlFor="staff-add-phone">
                    Primary phone
                    <Req />
                  </label>
                  <input
                    id="staff-add-phone"
                    className="form-control"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    inputMode="tel"
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label" htmlFor="staff-add-email">
                    Email
                    <Req />
                  </label>
                  <input
                    id="staff-add-email"
                    type="email"
                    className="form-control"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Blood group
                    <Req />
                  </label>
                  {loadOrError(
                    bloodGroupsLoading,
                    bloodGroupsError,
                    <CommonSelect className="select" options={bloodOptions} value={bloodGroupId} onChange={(v) => setBloodGroupId(v)} />
                  )}
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Marital status
                    <Req />
                  </label>
                  <CommonSelect className="select" options={Marital} value={maritalStatus} onChange={(v) => setMaritalStatus(v)} />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Father&apos;s name
                    <Req />
                  </label>
                  <input className="form-control" value={fatherName} onChange={(e) => setFatherName(e.target.value)} required />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Mother&apos;s name
                    <Req />
                  </label>
                  <input className="form-control" value={motherName} onChange={(e) => setMotherName(e.target.value)} required />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Date of birth
                    <Req />
                  </label>
                  <div className="input-icon position-relative">
                    <DatePicker
                      className="form-control datetimepicker w-100"
                      format={{ format: "DD-MM-YYYY", type: "mask" }}
                      placeholder="Select Date"
                      value={dob}
                      onChange={(d) => setDob(d ?? null)}
                    />
                    <span className="input-icon-addon">
                      <i className="ti ti-calendar" />
                    </span>
                  </div>
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Date of joining
                    <Req />
                  </label>
                  <div className="input-icon position-relative">
                    <DatePicker
                      className="form-control datetimepicker w-100"
                      format={{ format: "DD-MM-YYYY", type: "mask" }}
                      placeholder="Select Date"
                      value={joiningDate}
                      onChange={(d) => setJoiningDate(d ?? null)}
                    />
                    <span className="input-icon-addon">
                      <i className="ti ti-calendar" />
                    </span>
                  </div>
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Languages known
                    <Req />
                  </label>
                  <TagInput initialTags={owner} onTagsChange={(t) => setOwner(t)} />
                </div>
              </div>
              <div className="col-xxl-4 col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Qualification
                    <Req />
                  </label>
                  <input className="form-control" value={qualification} onChange={(e) => setQualification(e.target.value)} required />
                </div>
              </div>
              <div className="col-xxl-4 col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Experience (years)
                    <Req />
                  </label>
                  <input
                    type="number"
                    min={0}
                    className="form-control"
                    value={experienceYears}
                    onChange={(e) => setExperienceYears(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="col-xxl-4 col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Note
                    <Req />
                  </label>
                  <input className="form-control" value={noteField} onChange={(e) => setNoteField(e.target.value)} required />
                </div>
              </div>
              <div className="col-xxl-6 col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Address
                    <Req />
                  </label>
                  <input className="form-control" value={address} onChange={(e) => setAddress(e.target.value)} required />
                </div>
              </div>
              <div className="col-xxl-6 col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Permanent address
                    <Req />
                  </label>
                  <input className="form-control" value={permanentAddress} onChange={(e) => setPermanentAddress(e.target.value)} required />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Emergency contact name
                    <Req />
                  </label>
                  <input className="form-control" value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} required />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Emergency contact phone
                    <Req />
                  </label>
                  <input className="form-control" value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} required />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3 form-check mt-4">
                  <input
                    id="staff-add-active"
                    type="checkbox"
                    className="form-check-input"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <label className="form-check-label" htmlFor="staff-add-active">
                    Active
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payroll */}
      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-user-shield fs-16" />
            </span>
            <h4 className="text-dark mb-0 d-inline-flex align-items-center flex-wrap gap-1">
              Payroll
              <SectionOptional />
            </h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="row">
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">EPF No</label>
                <input className="form-control" value={epfNo} onChange={(e) => setEpfNo(e.target.value)} />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Basic salary</label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  className="form-control"
                  value={salary}
                  onChange={(e) => setSalary(e.target.value)}
                />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Contract type</label>
                <CommonSelect className="select" options={Contract} value={contractType} onChange={(v) => setContractType(v)} />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Work shift</label>
                <CommonSelect className="select" options={Shift} value={shift} onChange={(v) => setShift(v)} />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Work location</label>
                <input className="form-control" value={workLocation} onChange={(e) => setWorkLocation(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Bank */}
      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-users fs-16" />
            </span>
            <h4 className="text-dark mb-0 d-inline-flex align-items-center flex-wrap gap-1">
              Bank account detail
              <SectionOptional />
            </h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="row">
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Account name</label>
                <input className="form-control" value={bankAccountName} onChange={(e) => setBankAccountName(e.target.value)} />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Account number</label>
                <input className="form-control" value={bankAccountNumber} onChange={(e) => setBankAccountNumber(e.target.value)} />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Bank name</label>
                <input className="form-control" value={bankName} onChange={(e) => setBankName(e.target.value)} />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">IFSC code</label>
                <input className="form-control" value={ifsc} onChange={(e) => setIfsc(e.target.value)} />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Branch name</label>
                <input className="form-control" value={branchName} onChange={(e) => setBranchName(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>



      {/* Social */}
      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-building fs-16" />
            </span>
            <h4 className="text-dark mb-0">Social Media Links</h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <p className="fs-12 text-muted">All optional — not stored on generic staff.</p>
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  Facebook URL
                  <Opt />
                </label>
                <input className="form-control" value={facebook} onChange={(e) => setFacebook(e.target.value)} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  Twitter URL
                  <Opt />
                </label>
                <input className="form-control" value={twitter} onChange={(e) => setTwitter(e.target.value)} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  LinkedIn URL
                  <Opt />
                </label>
                <input className="form-control" value={linkedin} onChange={(e) => setLinkedin(e.target.value)} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  Instagram URL
                  <Opt />
                </label>
                <input className="form-control" value={instagram} onChange={(e) => setInstagram(e.target.value)} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Documents */}
      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-file-text fs-16" />
            </span>
            <h4 className="text-dark mb-0 d-inline-flex align-items-center flex-wrap gap-1">
              Documents
              <SectionOptional />
            </h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="row">
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  Resume
                  <Opt />
                </label>
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="file"
                    className={`form-control ${resumeError ? "is-invalid" : ""}`}
                    accept=".pdf"
                    onChange={onPickResume}
                  />
                  {resumeFile && (
                    <span className="badge bg-success-transparent text-success">
                      Selected
                    </span>
                  )}
                </div>
                {resumeError && <div className="text-danger fs-12">{resumeError}</div>}
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  Joining Letter
                  <Opt />
                </label>
                <div className="d-flex align-items-center gap-2">
                  <input
                    type="file"
                    className={`form-control ${joiningLetterError ? "is-invalid" : ""}`}
                    accept=".pdf"
                    onChange={onPickJoiningLetter}
                  />
                  {joiningLetterFile && (
                    <span className="badge bg-success-transparent text-success">
                      Selected
                    </span>
                  )}
                </div>
                {joiningLetterError && (
                  <div className="text-danger fs-12">{joiningLetterError}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-file fs-16" />
            </span>
            <h4 className="text-dark mb-0 d-inline-flex align-items-center flex-wrap gap-1">
              Password
              <SectionOptional />
            </h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <p className="fs-12 text-muted mb-2">Skip this section to let the system set the initial login password.</p>
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label" htmlFor="staff-add-password">
                  Password
                </label>
                <input
                  id="staff-add-password"
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label" htmlFor="staff-add-password-confirm">
                  Confirm password
                </label>
                <input
                  id="staff-add-password-confirm"
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-end mb-4">
        <Link to={routes.staff} className="btn btn-light me-3">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Saving…" : "Add Staff"}
        </button>
      </div>
    </form>
  );
}

