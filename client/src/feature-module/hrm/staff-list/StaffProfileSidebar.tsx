import ImageWithBasePath from "../../../core/common/imageWithBasePath";

type StaffRecord = Record<string, unknown>;

function formatShortDate(raw: string | undefined): string {
  if (!raw) return "—";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function StaffProfileSidebar({ staff }: { staff: StaffRecord }) {
  const name =
    `${staff.first_name ?? ""} ${staff.last_name ?? ""}`.trim() || "Staff";
  const img =
    (staff.photo_url as string) || "assets/img/profiles/avatar-27.jpg";
  const code = String(staff.employee_code ?? staff.id ?? "");
  const dept = String(staff.department_name ?? staff.department ?? "—");
  const desig = String(staff.designation_name ?? staff.designation ?? "—");
  const joinText = formatShortDate(staff.joining_date as string | undefined);
  const dobText = formatShortDate(staff.date_of_birth as string | undefined);
  const blood = String(staff.blood_group_label ?? "").trim() || "—";
  const active =
    staff.is_active === true ||
    staff.is_active === "t" ||
    staff.is_active === 1;

  const genderRaw = staff.gender != null ? String(staff.gender) : "";
  const gender =
    genderRaw.length > 0
      ? genderRaw.charAt(0).toUpperCase() + genderRaw.slice(1)
      : "—";

  return (
    <>
      <div className="card border-white">
        <div className="card-header">
          <div className="d-flex align-items-center row-gap-3">
            <div className="d-flex align-items-center justify-content-center avatar avatar-xxl border border-dashed me-2 flex-shrink-0 text-dark frames">
              <ImageWithBasePath
                src={img}
                className="img-fluid rounded-circle"
                alt=""
              />
            </div>
            <div>
              <span
                className={`badge d-inline-flex align-items-center mb-1 ${
                  active ? "badge-soft-success" : "badge-soft-danger"
                }`}
              >
                <i className="ti ti-circle-filled fs-5 me-1" />
                {active ? "Active" : "Inactive"}
              </span>
              <h5 className="mb-1">{name}</h5>
              <p className="text-primary m-0">{code}</p>
              <p className="p-0 mb-0">Joined: {joinText}</p>
            </div>
          </div>
        </div>
        <div className="card-body">
          <h5 className="mb-3">Basic Information</h5>
          <dl className="row mb-0">
            <dt className="col-6 fw-medium text-dark mb-3">Staff ID</dt>
            <dd className="col-6 mb-3">{String(staff.id ?? "—")}</dd>
            <dt className="col-6 fw-medium text-dark mb-3">Gender</dt>
            <dd className="col-6 mb-3">{gender}</dd>
            <dt className="col-6 fw-medium text-dark mb-3">Designation</dt>
            <dd className="col-6 mb-3">{desig}</dd>
            <dt className="col-6 fw-medium text-dark mb-3">Department</dt>
            <dd className="col-6 mb-3">{dept}</dd>
            <dt className="col-6 fw-medium text-dark mb-3">Date Of Birth</dt>
            <dd className="col-6 mb-3">{dobText}</dd>
            <dt className="col-6 fw-medium text-dark mb-3">Blood Group</dt>
            <dd className="col-6 mb-3">{blood}</dd>
            <dt className="col-6 fw-medium text-dark mb-0">Qualification</dt>
            <dd className="col-6 text-dark mb-0">
              {staff.qualification ? String(staff.qualification) : "—"}
            </dd>
          </dl>
        </div>
      </div>
      <div className="card border-white mb-0">
        <div className="card-body">
          <h5 className="mb-3">Primary Contact</h5>
          <div className="d-flex align-items-center mb-3">
            <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
              <i className="ti ti-phone" />
            </span>
            <div>
              <span className="mb-1 fw-medium text-dark d-block">Phone</span>
              <p className="mb-0">{String(staff.phone ?? "—")}</p>
            </div>
          </div>
          <div className="d-flex align-items-center">
            <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
              <i className="ti ti-mail" />
            </span>
            <div>
              <span className="mb-1 fw-medium text-dark d-block">Email</span>
              <p className="mb-0">{String(staff.email ?? "—")}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
