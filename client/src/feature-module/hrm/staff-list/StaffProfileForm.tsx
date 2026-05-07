import { useCallback, useEffect, useMemo, useState, useRef, type ReactElement, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import CommonSelect from "../../../core/common/commonSelect";
import type { Option } from "../../../core/common/commonSelect";
import { Contract, Marital, Shift } from "../../../core/common/selectoption/selectoption";
import { apiService } from "../../../core/services/apiService";
import { all_routes } from "../../router/all_routes";
import TagInput from "../../../core/common/Taginput";
import { useBloodGroups } from "../../../core/hooks/useBloodGroups";
import { useDepartments } from "../../../core/hooks/useDepartments";
import { useDesignations } from "../../../core/hooks/useDesignations";
import { staffDirectoryFriendlyError } from "./staffDirectoryErrors";

const genderOptions: Option[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

/** Visible required marker */
function Req() {
  return (
    <span className="text-danger" title="Required">
      {" "}
      *
    </span>
  );
}

/** Optional fields */
function Opt() {
  return <span className="text-muted fw-normal small ms-1">(optional)</span>;
}

/** Whole card/section is optional */
function SectionOptional() {
  return (
    <span className="badge bg-light text-secondary border fw-normal ms-2 align-middle">
      Optional
    </span>
  );
}

type Mode = "create" | "edit";

export interface StaffProfileFormProps {
  mode: Mode;
  /** Raw API staff row when editing */
  initialStaff?: Record<string, unknown> | null;
}

function toYmd(d: Dayjs | null): string | null {
  if (!d || !d.isValid()) return null;
  return d.format("YYYY-MM-DD");
}

function parseApiDate(raw: unknown): Dayjs | null {
  if (raw == null || raw === "") return null;
  const d = dayjs(String(raw).slice(0, 10));
  return d.isValid() ? d : null;
}

export default function StaffProfileForm({
  mode,
  initialStaff,
}: StaffProfileFormProps) {
  const routes = all_routes;
  const navigate = useNavigate();

  const {
    departments,
    loading: departmentsLoading,
    error: departmentsError,
  } = useDepartments();
  const {
    designations,
    loading: designationsLoading,
    error: designationsError,
  } = useDesignations();
  const {
    bloodGroups,
    loading: bloodGroupsLoading,
    error: bloodGroupsError,
  } = useBloodGroups();

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
  const [bloodGroupId, setBloodGroupId] = useState<string | null>(null);
  const [maritalStatus, setMaritalStatus] = useState<string | null>(null);
  const [fatherName, setFatherName] = useState("");
  const [motherName, setMotherName] = useState("");
  const [dob, setDob] = useState<Dayjs | null>(null);
  const [joiningDate, setJoiningDate] = useState<Dayjs | null>(null);
  const [owner, setOwner] = useState<string[]>([]); // Languages
  const [qualification, setQualification] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [noteField, setNoteField] = useState(""); // other_info
  const [address, setAddress] = useState(""); // current_address
  const [permanentAddress, setPermanentAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [isActive, setIsActive] = useState(true);

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
  const [youtube, setYoutube] = useState("");

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

  const staffId = initialStaff?.id != null ? Number(initialStaff.id) : null;

  const deptOptions = useMemo(
    () =>
      ((departments as any[]) || [])
        .filter((d) => d.originalData?.id != null)
        .map((d) => ({
          value: String(d.originalData.id),
          label: d.department ?? "",
        })),
    [departments]
  );

  const desigOptions = useMemo(
    () =>
      ((designations as any[]) || [])
        .filter((d) => d.originalData?.id != null)
        .map((d) => ({
          value: String(d.originalData.id),
          label: d.designation ?? "",
        })),
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
    departmentsLoading || designationsLoading || bloodGroupsLoading;

  const supportStaffDepartmentId = useMemo(() => {
    const row = ((departments as any[]) || []).find(
      (d) =>
        String(d.department ?? "")
          .trim()
          .toLowerCase() === "support staff"
    );
    return row?.originalData?.id != null ? String(row.originalData.id) : null;
  }, [departments]);

  const openStaffPdf = async (docType: "resume" | "joining-letter") => {
    if (!staffId) return;
    try {
      const blob = await apiService.fetchStaffDocumentBlob(staffId, docType);
      const u = URL.createObjectURL(blob);
      window.open(u, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(u), 120_000);
    } catch (e: any) {
      setError(staffDirectoryFriendlyError(e));
    }
  };

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

  const isDriverSelected = useMemo(() => {
    if (!designationId) return false;
    const row = ((designations as any[]) || []).find(
      (d) => String(d.originalData?.id) === designationId
    );
    const name = String(
      row?.designation ?? row?.originalData?.designation_name ?? ""
    )
      .trim()
      .toLowerCase();
    return name === "driver" || name === "drivers";
  }, [designationId, designations]);

  useEffect(() => {
    if (isDriverSelected && supportStaffDepartmentId) {
      setDepartmentId(supportStaffDepartmentId);
    }
  }, [isDriverSelected, supportStaffDepartmentId]);

  useEffect(() => {
    if (!initialStaff || mode !== "edit") return;
    const s = initialStaff;
    setFirstName(String(s.first_name ?? ""));
    setLastName(String(s.last_name ?? ""));
    setEmployeeCode(String(s.employee_code ?? ""));
    setEmail(String(s.email ?? ""));
    setPhone(String(s.phone ?? ""));
    setGender(s.gender != null && s.gender !== "" ? String(s.gender) : null);
    setDepartmentId(s.department_id != null ? String(s.department_id) : null);
    setDesignationId(s.designation_id != null ? String(s.designation_id) : null);
    setBloodGroupId(s.blood_group_id != null ? String(s.blood_group_id) : null);
    setMaritalStatus(
      s.marital_status != null ? String(s.marital_status) : null
    );
    setFatherName(String(s.father_name ?? ""));
    setMotherName(String(s.mother_name ?? ""));
    setDob(parseApiDate(s.date_of_birth));
    setJoiningDate(parseApiDate(s.joining_date));
    setQualification(String(s.qualification ?? ""));
    setExperienceYears(
      s.experience_years != null && s.experience_years !== ""
        ? String(s.experience_years)
        : ""
    );
    setNoteField(String(s.other_info ?? ""));
    setAddress(String(s.current_address ?? s.address ?? ""));
    setPermanentAddress(String(s.permanent_address ?? ""));
    setEmergencyName(String(s.emergency_contact_name ?? ""));
    setEmergencyPhone(String(s.emergency_contact_phone ?? ""));
    const act = s.is_active;
    setIsActive(!(act === false || act === "f" || act === 0 || act === "Inactive"));
    setLicenseNumber(String(s.driver_license_number ?? s.license_number ?? ""));
    setLicenseExpiry(parseApiDate(s.driver_license_expiry ?? s.license_expiry));

    setEpfNo(String(s.epf_no ?? ""));
    setSalary(s.salary != null && s.salary !== "" ? String(s.salary) : "");
    setContractType(s.contract_type != null ? String(s.contract_type) : null);
    setShift(s.shift != null ? String(s.shift) : null);
    setWorkLocation(String(s.work_location ?? ""));

    setBankAccountName(String(s.account_name ?? ""));
    setBankAccountNumber(String(s.account_number ?? s.account_no ?? ""));
    setBankName(String(s.bank_name ?? ""));
    setIfsc(String(s.ifsc ?? s.ifsc_code ?? ""));
    setBranchName(String(s.branch ?? ""));

    setFacebook(String(s.facebook ?? ""));
    setTwitter(String(s.twitter ?? ""));
    setLinkedin(String(s.linkedin ?? ""));
    setInstagram(String(s.instagram ?? ""));
    setYoutube(String(s.youtube ?? ""));

    if (Array.isArray(s.languages_known)) {
      setOwner(s.languages_known.map(String));
    } else if (typeof s.languages_known === "string") {
      setOwner(
        s.languages_known
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean)
      );
    }

    if (typeof s.photo_url === "string" && s.photo_url.trim() && staffId) {
      const filename = s.photo_url.split("/").pop();
      if (filename) {
        apiService
          .fetchStaffPhotoBlob(staffId, filename)
          .then((blob) => {
            setPhotoPreview(URL.createObjectURL(blob));
          })
          .catch((err) => {
            console.error("Failed to fetch staff photo:", err);
          });
      }
    }
  }, [initialStaff, mode, staffId]);

  const getMissingPersonalFields = useCallback((): string[] => {
    const m: string[] = [];
    if (!firstName.trim()) m.push("First name");
    if (!lastName.trim()) m.push("Last name");
    if (!employeeCode.trim()) m.push("Employee code");
    if (!departmentId) m.push("Department");
    if (!designationId) m.push("Designation");
    if (!gender) m.push("Gender");
    if (!phone.trim()) m.push("Primary phone");
    if (!email.trim()) m.push("Email");
    if (!bloodGroupId || String(bloodGroupId).trim() === "")
      m.push("Blood group");
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
    if (isDriverSelected && !licenseNumber.trim())
      m.push("Driving licence number");
    return m;
  }, [
    firstName,
    lastName,
    employeeCode,
    departmentId,
    designationId,
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
    isDriverSelected,
    licenseNumber,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (metaBusy) {
        window.alert(
          "Please wait — still loading departments, designations, or blood groups."
        );
        return;
      }
      const missingPersonal = getMissingPersonalFields();
      if (missingPersonal.length > 0) {
        window.alert(
          `Please fill all required fields in Personal Information (profile photo is optional).\n\nMissing:\n• ${missingPersonal.join(
            "\n• "
          )}`
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
        current_address: address.trim() || null,
        permanent_address: permanentAddress.trim() || null,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        marital_status: maritalStatus || null,
        father_name: fatherName.trim() || null,
        mother_name: motherName.trim() || null,
        languages_known: owner.filter(Boolean),
        other_info: noteField.trim() || null,
        is_active: isActive,
        epf_no: epfNo.trim() || null,
        bank_name: bankName.trim() || null,
        account_name: bankAccountName.trim() || null,
        account_number: bankAccountNumber.trim() || null,
        branch: branchName.trim() || null,
        ifsc: ifsc.trim() || null,
        contract_type: contractType || null,
        shift: shift || null,
        work_location: workLocation.trim() || null,
        facebook: facebook.trim() || null,
        twitter: twitter.trim() || null,
        linkedin: linkedin.trim() || null,
        instagram: instagram.trim() || null,
        youtube: youtube.trim() || null,
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
        let sid = staffId;
        if (mode === "create") {
          const res = (await apiService.createStaff(payload)) as any;
          if (res?.status === "SUCCESS") {
            sid = res.data?.id ?? null;
          } else {
            setError(res?.message || "Failed to create staff.");
            setSubmitting(false);
            return;
          }
        } else if (staffId != null) {
          const res = (await apiService.updateStaff(staffId, payload)) as any;
          if (res?.status !== "SUCCESS") {
            setError(res?.message || "Failed to update staff.");
            setSubmitting(false);
            return;
          }
        }

        const rFile = resumeRef.current;
        const jFile = letterRef.current;

        if (sid) {
          if (rFile || jFile) {
            try {
              const fd = new FormData();
              if (rFile) fd.append("resume", rFile);
              if (jFile) fd.append("joining_letter", jFile);
              await apiService.uploadStaffDocuments(sid, fd);
            } catch (docErr: any) {
              console.error("Doc upload failed:", docErr);
            }
          }
          if (photoRef.current) {
            try {
              await apiService.uploadStaffPhoto(sid, photoRef.current);
            } catch (photoErr: any) {
              console.error("Photo upload failed:", photoErr);
            }
          }
        }

        navigate(routes.staff, { replace: false });
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
      mode,
      staffId,
      permanentAddress,
      maritalStatus,
      fatherName,
      motherName,
      owner,
      noteField,
      epfNo,
      bankName,
      bankAccountName,
      bankAccountNumber,
      branchName,
      ifsc,
      contractType,
      shift,
      workLocation,
      facebook,
      twitter,
      linkedin,
      instagram,
      youtube,
    ]
  );

  const loadOrError = (
    loading: boolean,
    err: string | null,
    node: ReactElement
  ) => {
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

  const title = mode === "create" ? "Add Staff" : "Edit Staff";

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
            <h4 className="text-dark mb-0">{title}</h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="add-section">
            <div className="row">
              <div className="col-md-12">
                <div className="d-flex align-items-center flex-wrap row-gap-3 mb-3">
                  <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames overflow-hidden">
                    {photoPreview ? (
                      <img
                        src={photoPreview}
                        alt="Profile Preview"
                        className="img-fluid w-100 h-100 object-fit-cover"
                      />
                    ) : (
                      <i className="ti ti-photo-plus fs-16" />
                    )}
                  </div>
                  <div className="profile-upload">
                    <p className="form-label mb-2">
                      Profile photo <Opt />
                    </p>
                    <div className="profile-uploader d-flex align-items-center">
                      <div className="drag-upload-btn mb-3">
                        Upload
                        <input
                          type="file"
                          className="form-control image-sign"
                          accept="image/*"
                          onChange={onPickPhoto}
                        />
                      </div>
                      <button
                        type="button"
                        className={`btn btn-primary mb-3 ${
                          !photoFile && !photoPreview ? "disabled" : ""
                        }`}
                        onClick={onRemovePhoto}
                      >
                        Remove
                      </button>
                    </div>
                    {photoError && (
                      <div className="text-danger fs-12 mb-2">{photoError}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
            {metaBusy && (
              <p className="text-muted small">Loading reference data…</p>
            )}
            <div className="row row-cols-xxl-5 row-cols-md-6">
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    First name
                    <Req />
                  </label>
                  <input
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
                  <label className="form-label">
                    Last name
                    <Req />
                  </label>
                  <input
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
                  <label className="form-label">
                    Employee code
                    <Req />
                  </label>
                  <input
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
                      onChange={(v) => setDepartmentId(v)}
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
                    />
                  )}
                </div>
              </div>
              {isDriverSelected && (
                <>
                  <div className="col-xxl col-xl-3 col-md-6">
                    <div className="mb-3">
                      <label className="form-label">
                        Driving licence number
                        <Req />
                      </label>
                      <input
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
                  <CommonSelect
                    className="select"
                    options={genderOptions}
                    value={gender}
                    onChange={(v) => setGender(v)}
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Primary phone
                    <Req />
                  </label>
                  <input
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
                  <label className="form-label">
                    Email
                    <Req />
                  </label>
                  <input
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
                    <CommonSelect
                      className="select"
                      options={bloodOptions}
                      value={bloodGroupId}
                      onChange={(v) => setBloodGroupId(v)}
                    />
                  )}
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Marital status
                    <Req />
                  </label>
                  <CommonSelect
                    className="select"
                    options={Marital}
                    value={maritalStatus}
                    onChange={(v) => setMaritalStatus(v)}
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Father&apos;s name
                    <Req />
                  </label>
                  <input
                    className="form-control"
                    value={fatherName}
                    onChange={(e) => setFatherName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Mother&apos;s name
                    <Req />
                  </label>
                  <input
                    className="form-control"
                    value={motherName}
                    onChange={(e) => setMotherName(e.target.value)}
                    required
                  />
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
                  <TagInput
                    initialTags={owner}
                    onTagsChange={(t) => setOwner(t)}
                  />
                </div>
              </div>
              <div className="col-xxl-4 col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Qualification
                    <Req />
                  </label>
                  <input
                    className="form-control"
                    value={qualification}
                    onChange={(e) => setQualification(e.target.value)}
                    required
                  />
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
                  <input
                    className="form-control"
                    value={noteField}
                    onChange={(e) => setNoteField(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="col-xxl-6 col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Address
                    <Req />
                  </label>
                  <input
                    className="form-control"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="col-xxl-6 col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Permanent address
                    <Req />
                  </label>
                  <input
                    className="form-control"
                    value={permanentAddress}
                    onChange={(e) => setPermanentAddress(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Emergency contact name
                    <Req />
                  </label>
                  <input
                    className="form-control"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3">
                  <label className="form-label">
                    Emergency contact phone
                    <Req />
                  </label>
                  <input
                    className="form-control"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="col-xxl col-xl-3 col-md-6">
                <div className="mb-3 form-check mt-4">
                  <input
                    id="staff-profile-active"
                    type="checkbox"
                    className="form-check-input"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                  />
                  <label
                    className="form-check-label"
                    htmlFor="staff-profile-active"
                  >
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
                <input
                  className="form-control"
                  value={epfNo}
                  onChange={(e) => setEpfNo(e.target.value)}
                />
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
                <CommonSelect
                  className="select"
                  options={Contract}
                  value={contractType}
                  onChange={(v) => setContractType(v)}
                />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Work shift</label>
                <CommonSelect
                  className="select"
                  options={Shift}
                  value={shift}
                  onChange={(v) => setShift(v)}
                />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Work location</label>
                <input
                  className="form-control"
                  value={workLocation}
                  onChange={(e) => setWorkLocation(e.target.value)}
                />
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
                <input
                  className="form-control"
                  value={bankAccountName}
                  onChange={(e) => setBankAccountName(e.target.value)}
                />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Account number</label>
                <input
                  className="form-control"
                  value={bankAccountNumber}
                  onChange={(e) => setBankAccountNumber(e.target.value)}
                />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Bank name</label>
                <input
                  className="form-control"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">IFSC code</label>
                <input
                  className="form-control"
                  value={ifsc}
                  onChange={(e) => setIfsc(e.target.value)}
                />
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Branch name</label>
                <input
                  className="form-control"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                />
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
          <div className="row">
            <div className="col-md-4">
              <div className="mb-3">
                <label className="form-label">
                  Facebook URL
                  <Opt />
                </label>
                <input
                  className="form-control"
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="mb-3">
                <label className="form-label">
                  Twitter URL
                  <Opt />
                </label>
                <input
                  className="form-control"
                  value={twitter}
                  onChange={(e) => setTwitter(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="mb-3">
                <label className="form-label">
                  LinkedIn URL
                  <Opt />
                </label>
                <input
                  className="form-control"
                  value={linkedin}
                  onChange={(e) => setLinkedin(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="mb-3">
                <label className="form-label">
                  Instagram URL
                  <Opt />
                </label>
                <input
                  className="form-control"
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                />
              </div>
            </div>
            <div className="col-md-4">
              <div className="mb-3">
                <label className="form-label">
                  YouTube URL
                  <Opt />
                </label>
                <input
                  className="form-control"
                  value={youtube}
                  onChange={(e) => setYoutube(e.target.value)}
                />
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
                  {mode === "edit" && !!initialStaff?.resume && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => openStaffPdf("resume")}
                    >
                      View
                    </button>
                  )}
                  {resumeFile && (
                    <span className="badge bg-success-transparent text-success">
                      Selected
                    </span>
                  )}
                </div>
                {resumeError && (
                  <div className="text-danger fs-12">{resumeError}</div>
                )}
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
                  {mode === "edit" && !!initialStaff?.joining_letter && (
                    <button
                      type="button"
                      className="btn btn-sm btn-outline-primary"
                      onClick={() => openStaffPdf("joining-letter")}
                    >
                      View
                    </button>
                  )}
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
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  {mode === "create"
                    ? "Password (optional)"
                    : "New password (optional)"}
                </label>
                <input
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
                <label className="form-label">Confirm password</label>
                <input
                  type="password"
                  className="form-control"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>
          </div>
          {mode === "create" && (
            <p className="fs-12 text-muted mb-0">
              If omitted, the initial password is derived from the phone number
              (digits) or a random secure value.
            </p>
          )}
        </div>
      </div>

      <div className="text-end mb-4">
        <Link to={routes.staff} className="btn btn-light me-3">
          Cancel
        </Link>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={submitting || metaBusy}
        >
          {submitting
            ? "Saving…"
            : mode === "create"
            ? "Add Staff"
            : "Save changes"}
        </button>
      </div>
    </form>
  );
}

