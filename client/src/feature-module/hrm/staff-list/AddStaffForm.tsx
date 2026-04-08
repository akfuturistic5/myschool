import { useCallback, useEffect, useMemo, useState, type ReactElement } from "react";
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
import { useHostels } from "../../../core/hooks/useHostels";
import { useHostelRooms } from "../../../core/hooks/useHostelRooms";
import { useTransportRoutes } from "../../../core/hooks/useTransportRoutes";
import { useTransportPickupPoints } from "../../../core/hooks/useTransportPickupPoints";
import { useTransportVehicles } from "../../../core/hooks/useTransportVehicles";
import { staffDirectoryFriendlyError } from "./staffDirectoryErrors";

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
  const { data: transportRoutes, loading: routesLoading, error: routesError } = useTransportRoutes();
  const { data: pickupPoints, loading: pickupLoading, error: pickupError } = useTransportPickupPoints();
  const { data: vehicles, loading: vehiclesLoading, error: vehiclesError } = useTransportVehicles();
  const { hostels } = useHostels();
  const { hostelRooms } = useHostelRooms();

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

  const [medicalLeaves, setMedicalLeaves] = useState("");
  const [casualLeaves, setCasualLeaves] = useState("");
  const [maternityLeaves, setMaternityLeaves] = useState("");
  const [sickLeaves, setSickLeaves] = useState("");

  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [branchName, setBranchName] = useState("");

  const [transportOn, setTransportOn] = useState(false);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [vehicleId, setVehicleId] = useState<string | null>(null);
  const [pickupId, setPickupId] = useState<string | null>(null);

  const [hostelOn, setHostelOn] = useState(false);
  const [hostelId, setHostelId] = useState<string | null>(null);
  const [hostelRoomId, setHostelRoomId] = useState<string | null>(null);

  const [facebook, setFacebook] = useState("");
  const [twitter, setTwitter] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [instagram, setInstagram] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deptOptions = useMemo(
    () =>
      (departments || [])
        .filter((d: { originalData?: { id?: number } }) => d.originalData?.id != null)
        .map((d: { originalData: { id: number }; department?: string }) => ({
          value: String(d.originalData.id),
          label: d.department ?? "",
        })),
    [departments]
  );

  const desigOptions = useMemo(
    () =>
      (designations || [])
        .filter((d: { originalData?: { id?: number } }) => d.originalData?.id != null)
        .map((d: { originalData: { id: number }; designation?: string }) => ({
          value: String(d.originalData.id),
          label: d.designation ?? "",
        })),
    [designations]
  );

  const bloodOptions = useMemo(
    () =>
      (bloodGroups || []).map((bg: { id?: number; blood_group?: string }) => ({
        value: String(bg.id ?? ""),
        label: bg.blood_group ?? "",
      })),
    [bloodGroups]
  );

  const routeOptions = useMemo(
    () =>
      (transportRoutes || []).map((r: { originalData?: { id?: number; route_name?: string }; routes?: string; id?: string | number }) => ({
        value: String(r.originalData?.id ?? r.id ?? ""),
        label: r.routes ?? r.originalData?.route_name ?? "N/A",
      })),
    [transportRoutes]
  );

  const vehicleOptions = useMemo(
    () =>
      (vehicles || []).map((v: { originalData?: { id?: number; vehicle_number?: string }; vehicleNo?: string; id?: string | number }) => ({
        value: String(v.originalData?.id ?? v.id ?? ""),
        label: v.vehicleNo ?? v.originalData?.vehicle_number ?? "N/A",
      })),
    [vehicles]
  );

  const pickupOptions = useMemo(
    () =>
      (pickupPoints || []).map((p: { originalData?: { id?: number }; pickupPoint?: string; id?: string | number }) => ({
        value: String(p.originalData?.id ?? p.id ?? ""),
        label: p.pickupPoint ?? "N/A",
      })),
    [pickupPoints]
  );

  const hostelOptions = useMemo(
    () =>
      (hostels || []).map((h: { originalData?: { id?: number }; hostelName?: string }) => ({
        value: String((h.originalData as { id?: number })?.id ?? ""),
        label: (h.hostelName as string) || "N/A",
      })),
    [hostels]
  );

  const hostelRoomOptions = useMemo(
    () =>
      (hostelRooms || []).map((r: { originalData?: { id?: number }; roomNo?: string }) => ({
        value: String((r.originalData as { id?: number })?.id ?? ""),
        label: (r.roomNo as string) || "N/A",
      })),
    [hostelRooms]
  );

  const metaBusy = departmentsLoading || designationsLoading || bloodGroupsLoading;

  const supportStaffDepartmentId = useMemo(() => {
    const row = (departments || []).find(
      (d: { department?: string; originalData?: { id?: number } }) =>
        String(d.department ?? "").trim().toLowerCase() === "support staff"
    );
    return row?.originalData?.id != null ? String(row.originalData.id) : null;
  }, [departments]);

  const isDriverSelected = useMemo(() => {
    if (!designationId) return false;
    const row = (designations || []).find(
      (d: { originalData?: { id?: number }; designation?: string }) =>
        String(d.originalData?.id) === designationId
    );
    const name = String(row?.designation ?? (row as { originalData?: { designation_name?: string } })?.originalData?.designation_name ?? "")
      .trim()
      .toLowerCase();
    return name === "driver" || name === "drivers";
  }, [designationId, designations]);

  useEffect(() => {
    if (isDriverSelected && supportStaffDepartmentId) {
      setDepartmentId(supportStaffDepartmentId);
    }
  }, [isDriverSelected, supportStaffDepartmentId]);

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
        address: address.trim() || null,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        is_active: isActive,
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
        const res = (await apiService.createStaff(payload)) as { status?: string; message?: string };
        if (res?.status === "SUCCESS") {
          navigate(routes.staff, { replace: false });
        } else {
          setError(res?.message || "Failed to create staff.");
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
                  <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
                    <i className="ti ti-photo-plus fs-16" />
                  </div>
                  <div className="profile-upload">
                    <p className="form-label mb-2">
                      Profile photo <span className="text-muted small fw-normal">(optional)</span>
                    </p>
                    <div className="profile-uploader d-flex align-items-center">
                      <div className="drag-upload-btn mb-3">
                        Upload
                        <input type="file" className="form-control image-sign" accept="image/jpeg,image/png,image/svg+xml" disabled />
                      </div>
                      <span className="btn btn-primary mb-3 disabled">Remove</span>
                    </div>
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
                    <CommonSelect className="select" options={deptOptions} value={departmentId} onChange={(v) => setDepartmentId(v)} />
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
                    <CommonSelect className="select" options={desigOptions} value={designationId} onChange={(v) => setDesignationId(v)} />
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

      {/* Leaves */}
      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-users fs-16" />
            </span>
            <h4 className="text-dark mb-0 d-inline-flex align-items-center flex-wrap gap-1">
              Leaves
              <SectionOptional />
            </h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="row">
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Medical leaves</label>
                <input className="form-control" value={medicalLeaves} onChange={(e) => setMedicalLeaves(e.target.value)} />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Casual leaves</label>
                <input className="form-control" value={casualLeaves} onChange={(e) => setCasualLeaves(e.target.value)} />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  Maternity leaves
                  <Opt />
                </label>
                <input className="form-control" value={maternityLeaves} onChange={(e) => setMaternityLeaves(e.target.value)} />
              </div>
            </div>
            <div className="col-lg-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Sick leaves</label>
                <input className="form-control" value={sickLeaves} onChange={(e) => setSickLeaves(e.target.value)} />
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

      {/* Transport */}
      <div className="card">
        <div className="card-header bg-light d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-bus-stop fs-16" />
            </span>
            <h4 className="text-dark mb-0 d-inline-flex align-items-center flex-wrap gap-1">
              Transport information
              <SectionOptional />
            </h4>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={transportOn}
              onChange={(e) => setTransportOn(e.target.checked)}
              title="Optional"
              aria-label="Transport section optional toggle"
            />
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="row">
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Route</label>
                {loadOrError(
                  routesLoading,
                  routesError,
                  <CommonSelect className="select" options={routeOptions} value={routeId} onChange={(v) => setRouteId(v)} />
                )}
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Vehicle number</label>
                {loadOrError(
                  vehiclesLoading,
                  vehiclesError,
                  <CommonSelect className="select" options={vehicleOptions} value={vehicleId} onChange={(v) => setVehicleId(v)} />
                )}
              </div>
            </div>
            <div className="col-lg-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Pickup point</label>
                {loadOrError(
                  pickupLoading,
                  pickupError,
                  <CommonSelect className="select" options={pickupOptions} value={pickupId} onChange={(v) => setPickupId(v)} />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hostel */}
      <div className="card">
        <div className="card-header bg-light d-flex align-items-center justify-content-between">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-building-fortress fs-16" />
            </span>
            <h4 className="text-dark mb-0 d-inline-flex align-items-center flex-wrap gap-1">
              Hostel information
              <SectionOptional />
            </h4>
          </div>
          <div className="form-check form-switch">
            <input
              className="form-check-input"
              type="checkbox"
              role="switch"
              checked={hostelOn}
              onChange={(e) => setHostelOn(e.target.checked)}
              title="Optional"
              aria-label="Hostel section optional toggle"
            />
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">Hostel</label>
                <CommonSelect className="select" options={hostelOptions} value={hostelId} onChange={(v) => setHostelId(v)} />
              </div>
            </div>
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">Room no.</label>
                <CommonSelect className="select" options={hostelRoomOptions} value={hostelRoomId} onChange={(v) => setHostelRoomId(v)} />
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
              <i className="ti ti-file fs-16" />
            </span>
            <h4 className="text-dark mb-0">Documents</h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <p className="fs-12 text-muted">Optional — upload not enabled for staff on this screen yet.</p>
          <div className="row">
            <div className="col-lg-6">
              <div className="mb-2">
                <label className="form-label">
                  Upload resume
                  <Opt />
                </label>
                <p className="fs-12">PDF up to 4MB when upload is enabled.</p>
                <input type="file" className="form-control" accept="application/pdf" disabled />
              </div>
            </div>
            <div className="col-lg-6">
              <div className="mb-2">
                <label className="form-label">
                  Upload joining letter
                  <Opt />
                </label>
                <p className="fs-12">PDF up to 4MB when upload is enabled.</p>
                <input type="file" className="form-control" accept="application/pdf" disabled />
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
