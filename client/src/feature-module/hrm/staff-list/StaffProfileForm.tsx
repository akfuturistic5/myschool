import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import CommonSelect from "../../../core/common/commonSelect";
import type { Option } from "../../../core/common/commonSelect";
import { apiService } from "../../../core/services/apiService";
import { all_routes } from "../../router/all_routes";
import { staffDirectoryFriendlyError } from "./staffDirectoryErrors";

const genderOptions: Option[] = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

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

export default function StaffProfileForm({ mode, initialStaff }: StaffProfileFormProps) {
  const routes = all_routes;
  const navigate = useNavigate();
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [departmentOptions, setDepartmentOptions] = useState<Option[]>([]);
  const [designationOptions, setDesignationOptions] = useState<Option[]>([]);
  const [bloodOptions, setBloodOptions] = useState<Option[]>([]);

  const staffId = initialStaff?.id != null ? Number(initialStaff.id) : null;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [gender, setGender] = useState<string | null>(null);
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [designationId, setDesignationId] = useState<string | null>(null);
  const [bloodGroupId, setBloodGroupId] = useState<string | null>(null);
  const [dob, setDob] = useState<Dayjs | null>(null);
  const [joiningDate, setJoiningDate] = useState<Dayjs | null>(null);
  const [qualification, setQualification] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [salary, setSalary] = useState("");
  const [address, setAddress] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState<Dayjs | null>(null);

  const isDriverEdit = useMemo(() => {
    if (!designationId) return false;
    const opt = designationOptions.find((o) => o.value === designationId);
    const lab = (opt?.label || "").trim().toLowerCase();
    if (lab === "driver" || lab === "drivers") return true;
    const d = String(
      initialStaff?.designation ?? (initialStaff as { designation_name?: string })?.designation_name ?? ""
    )
      .trim()
      .toLowerCase();
    return d === "driver" || d === "drivers";
  }, [designationId, designationOptions, initialStaff]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingMeta(true);
        const [deptRes, desigRes, bloodRes] = await Promise.all([
          apiService.getDepartments(),
          apiService.getDesignations(),
          apiService.getBloodGroups(),
        ]);
        if (cancelled) return;
        const dRows = (deptRes as any)?.data ?? [];
        const gRows = (desigRes as any)?.data ?? [];
        const bRows = (bloodRes as any)?.data ?? [];
        setDepartmentOptions(
          dRows.map((r: any) => ({
            value: String(r.id),
            label: r.department_name || r.name || `Dept ${r.id}`,
          }))
        );
        setDesignationOptions(
          gRows.map((r: any) => ({
            value: String(r.id),
            label: r.designation_name || r.name || `Role ${r.id}`,
          }))
        );
        setBloodOptions(
          bRows.map((r: any) => ({
            value: String(r.id),
            label: r.blood_group || String(r.id),
          }))
        );
      } catch {
        if (!cancelled) setError("Failed to load departments, designations, or blood groups.");
      } finally {
        if (!cancelled) setLoadingMeta(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialStaff || mode !== "edit") return;
    const s = initialStaff;
    setFirstName(String(s.first_name ?? ""));
    setLastName(String(s.last_name ?? ""));
    setEmail(String(s.email ?? ""));
    setPhone(String(s.phone ?? ""));
    setEmployeeCode(String(s.employee_code ?? ""));
    setGender(s.gender != null && s.gender !== "" ? String(s.gender) : null);
    setDepartmentId(s.department_id != null ? String(s.department_id) : null);
    setDesignationId(s.designation_id != null ? String(s.designation_id) : null);
    setBloodGroupId(s.blood_group_id != null ? String(s.blood_group_id) : null);
    setDob(parseApiDate(s.date_of_birth));
    setJoiningDate(parseApiDate(s.joining_date));
    setQualification(String(s.qualification ?? ""));
    setExperienceYears(
      s.experience_years != null && s.experience_years !== ""
        ? String(s.experience_years)
        : ""
    );
    setSalary(s.salary != null && s.salary !== "" ? String(s.salary) : "");
    setAddress(String(s.address ?? ""));
    setEmergencyName(String(s.emergency_contact_name ?? ""));
    setEmergencyPhone(String(s.emergency_contact_phone ?? ""));
    const act = s.is_active;
    setIsActive(!(act === false || act === "f" || act === 0));
    setLicenseNumber(String(s.driver_license_number ?? ""));
    setLicenseExpiry(parseApiDate(s.driver_license_expiry));
  }, [initialStaff, mode]);

  const supportStaffDepartmentId = useMemo(() => {
    const row = departmentOptions.find(
      (o) => (o.label || "").trim().toLowerCase() === "support staff"
    );
    return row?.value ?? null;
  }, [departmentOptions]);

  useEffect(() => {
    if (isDriverEdit && supportStaffDepartmentId) {
      setDepartmentId(supportStaffDepartmentId);
    }
  }, [isDriverEdit, supportStaffDepartmentId]);

  const title = mode === "create" ? "Add Staff" : "Edit Staff";

  const payloadBase = useMemo(() => {
    const o: Record<string, unknown> = {
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
      ...(isDriverEdit
        ? {
            license_number: licenseNumber.trim() || null,
            license_expiry: toYmd(licenseExpiry),
          }
        : {}),
    };
    if (employeeCode.trim()) o.employee_code = employeeCode.trim();
    return o;
  }, [
    firstName,
    lastName,
    email,
    phone,
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
    isDriverEdit,
    licenseNumber,
    licenseExpiry,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!firstName.trim() || !lastName.trim()) {
        setError("First name and last name are required.");
        return;
      }
      if (!email.trim() || !phone.trim()) {
        setError("Email and phone are required.");
        return;
      }
      if (isDriverEdit && !licenseNumber.trim()) {
        setError("Driving licence number is required for driver designation.");
        return;
      }
      if (mode === "create") {
        if (password && password !== confirmPassword) {
          setError("Password and confirmation do not match.");
          return;
        }
      } else {
        if (password || confirmPassword) {
          if (password !== confirmPassword) {
            setError("Password and confirmation do not match.");
            return;
          }
        }
      }

      setSubmitting(true);
      try {
        if (mode === "create") {
          const body: Record<string, unknown> = {
            ...payloadBase,
          };
          if (password.trim()) body.password = password.trim();
          const res = (await apiService.createStaff(body)) as any;
          if (res?.status === "SUCCESS") {
            navigate(routes.staff, { replace: false });
          } else {
            setError(res?.message || "Failed to create staff.");
          }
        } else if (staffId != null) {
          const body: Record<string, unknown> = { ...payloadBase };
          if (password.trim()) body.password = password.trim();
          const res = (await apiService.updateStaff(staffId, body)) as any;
          if (res?.status === "SUCCESS") {
            navigate(routes.staff, { replace: false });
          } else {
            setError(res?.message || "Failed to update staff.");
          }
        }
      } catch (err: unknown) {
        setError(staffDirectoryFriendlyError(err));
      } finally {
        setSubmitting(false);
      }
    },
    [
      confirmPassword,
      email,
      firstName,
      lastName,
      mode,
      navigate,
      password,
      payloadBase,
      phone,
      routes.staff,
      staffId,
      isDriverEdit,
      licenseNumber,
    ]
  );

  return (
    <form onSubmit={handleSubmit}>
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
          {loadingMeta && (
            <p className="text-muted small">Loading reference data…</p>
          )}
          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}
          <div className="row row-cols-xxl-5 row-cols-md-6">
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">First Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Last Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Employee code</label>
                <input
                  type="text"
                  className="form-control"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                  placeholder="Auto if left blank"
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Department</label>
                <CommonSelect
                  className="select"
                  options={departmentOptions}
                  value={departmentId}
                  onChange={(v) => setDepartmentId(v)}
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Designation</label>
                <CommonSelect
                  className="select"
                  options={designationOptions}
                  value={designationId}
                  onChange={(v) => setDesignationId(v)}
                />
              </div>
            </div>
            {isDriverEdit && (
              <>
                <div className="col-xxl col-xl-3 col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Driving licence number *</label>
                    <input
                      type="text"
                      className="form-control"
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="col-xxl col-xl-3 col-md-6">
                  <div className="mb-3">
                    <label className="form-label">Licence expiry</label>
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
                <label className="form-label">Gender</label>
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
                <label className="form-label">Primary phone *</label>
                <input
                  type="text"
                  className="form-control"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Email *</label>
                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <p className="fs-12 text-muted mb-0">
                  Used for sign-in; updating it also updates the linked user account email.
                </p>
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Blood group</label>
                <CommonSelect
                  className="select"
                  options={bloodOptions}
                  value={bloodGroupId}
                  onChange={(v) => setBloodGroupId(v)}
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Date of birth</label>
                <DatePicker
                  className="form-control w-100"
                  value={dob}
                  onChange={(d) => setDob(d)}
                  format="DD-MM-YYYY"
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Date of joining</label>
                <DatePicker
                  className="form-control w-100"
                  value={joiningDate}
                  onChange={(d) => setJoiningDate(d)}
                  format="DD-MM-YYYY"
                />
              </div>
            </div>
            <div className="col-xxl col-xl-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Qualification</label>
                <input
                  type="text"
                  className="form-control"
                  value={qualification}
                  onChange={(e) => setQualification(e.target.value)}
                />
              </div>
            </div>
            <div className="col-xxl col-xl-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Experience (years)</label>
                <input
                  type="number"
                  min={0}
                  className="form-control"
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                />
              </div>
            </div>
            <div className="col-xxl col-xl-4 col-md-6">
              <div className="mb-3">
                <label className="form-label">Salary</label>
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
            <div className="col-xxl col-xl-6 col-md-6">
              <div className="mb-3">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-control"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Emergency contact name</label>
                <input
                  type="text"
                  className="form-control"
                  value={emergencyName}
                  onChange={(e) => setEmergencyName(e.target.value)}
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3">
                <label className="form-label">Emergency contact phone</label>
                <input
                  type="text"
                  className="form-control"
                  value={emergencyPhone}
                  onChange={(e) => setEmergencyPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="col-xxl col-xl-3 col-md-6">
              <div className="mb-3 form-check mt-4">
                <input
                  id="staff-active"
                  type="checkbox"
                  className="form-check-input"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="staff-active">
                  Active
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header bg-light">
          <div className="d-flex align-items-center">
            <span className="bg-white avatar avatar-sm me-2 text-gray-7 flex-shrink-0">
              <i className="ti ti-file fs-16" />
            </span>
            <h4 className="text-dark mb-0">Password</h4>
          </div>
        </div>
        <div className="card-body pb-1">
          <div className="row">
            <div className="col-md-6">
              <div className="mb-3">
                <label className="form-label">
                  {mode === "create" ? "Password (optional)" : "New password (optional)"}
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
              If omitted, the initial password is derived from the phone number (digits) or a random secure value.
            </p>
          )}
        </div>
      </div>

      <div className="text-end mb-4">
        <Link to={routes.staff} className="btn btn-light me-3">
          Cancel
        </Link>
        <button type="submit" className="btn btn-primary" disabled={submitting || loadingMeta}>
          {submitting ? "Saving…" : mode === "create" ? "Add Staff" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
