import { Link } from 'react-router-dom';
import { useId } from 'react';

export type ProfileAllocationDetails = {
  route_name?: string | null;
  pickup_point_name?: string | null;
  vehicle_number?: string | null;
  route_id?: number | null;
  pickup_point_id?: number | null;
  vehicle_id?: number | null;
  transport_assigned_fee_id?: number | null;
  transport_fee_plan_name?: string | null;
  transport_assigned_fee_amount?: number | string | null;
  transport_is_free?: boolean | null;
  hostel_name?: string | null;
  floor?: string | null;
  hostel_room_number?: string | null;
  hostel_bed_number?: string | null;
  hostel_assigned_date?: string | null;
  hostel_academic_year_name?: string | null;
};

const isPlaceholderValue = (value: unknown) => {
  if (value == null) return true;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return true;
  return (
    normalized === 'n/a' ||
    normalized === 'na' ||
    normalized === 'not applicable' ||
    normalized === 'not available' ||
    normalized === 'none' ||
    normalized === '-' ||
    normalized === '--'
  );
};

const display = (value: unknown) => {
  if (isPlaceholderValue(value)) return 'N/A';
  return String(value).trim();
};

const formatDate = (raw: unknown) => {
  if (isPlaceholderValue(raw)) return null;
  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const hasTransportAllocation = (p: ProfileAllocationDetails) =>
  !isPlaceholderValue(p.route_name) ||
  !isPlaceholderValue(p.pickup_point_name) ||
  !isPlaceholderValue(p.vehicle_number) ||
  p.route_id != null ||
  p.pickup_point_id != null ||
  p.vehicle_id != null ||
  p.transport_assigned_fee_id != null;

const hasHostelAllocation = (p: ProfileAllocationDetails) =>
  !isPlaceholderValue(p.hostel_name) ||
  !isPlaceholderValue(p.floor) ||
  !isPlaceholderValue(p.hostel_room_number) ||
  !isPlaceholderValue(p.hostel_bed_number);

/** Accept API snake_case or occasional camelCase keys from list/detail payloads. */
export function normalizeProfileAllocationDetails(
  raw: ProfileAllocationDetails | Record<string, unknown> | null | undefined
): ProfileAllocationDetails {
  const r = (raw ?? {}) as Record<string, unknown>;
  const pick = (snake: string, camel: string) =>
    (r[snake] ?? r[camel]) as ProfileAllocationDetails[keyof ProfileAllocationDetails];

  return {
    route_name: pick('route_name', 'routeName') as string | null,
    pickup_point_name: pick('pickup_point_name', 'pickupPointName') as string | null,
    vehicle_number: pick('vehicle_number', 'vehicleNumber') as string | null,
    route_id: pick('route_id', 'routeId') as number | null,
    pickup_point_id: pick('pickup_point_id', 'pickupPointId') as number | null,
    vehicle_id: pick('vehicle_id', 'vehicleId') as number | null,
    transport_assigned_fee_id: pick('transport_assigned_fee_id', 'transportAssignedFeeId') as number | null,
    transport_fee_plan_name: pick('transport_fee_plan_name', 'transportFeePlanName') as string | null,
    transport_assigned_fee_amount: pick(
      'transport_assigned_fee_amount',
      'transportAssignedFeeAmount'
    ) as number | string | null,
    transport_is_free: pick('transport_is_free', 'transportIsFree') as boolean | null,
    hostel_name: pick('hostel_name', 'hostelName') as string | null,
    floor: pick('floor', 'floor') as string | null,
    hostel_room_number: pick('hostel_room_number', 'hostelRoomNumber') as string | null,
    hostel_bed_number: pick('hostel_bed_number', 'hostelBedNumber') as string | null,
    hostel_assigned_date: pick('hostel_assigned_date', 'hostelAssignedDate') as string | null,
    hostel_academic_year_name: pick(
      'hostel_academic_year_name',
      'hostelAcademicYearName'
    ) as string | null,
  };
}

type ProfileTransportHostelTabsProps = {
  profile: ProfileAllocationDetails | Record<string, unknown>;
  /** Hide fee plan / amount (e.g. teacher-facing student profile). */
  hideTransportFees?: boolean;
  className?: string;
};

export function ProfileTransportHostelTabs({
  profile,
  hideTransportFees = false,
  className = '',
}: ProfileTransportHostelTabsProps) {
  const details = normalizeProfileAllocationDetails(profile);
  const uid = useId().replace(/:/g, '');
  const hostelTabId = `hostel-${uid}`;
  const transportTabId = `transport-${uid}`;

  const assignedDate = formatDate(details.hostel_assigned_date);

  return (
    <div className={`card border-white mb-0 ${className}`.trim()}>
      <div className="card-body pb-1">
        <ul className="nav nav-tabs nav-tabs-bottom mb-3">
          <li className="nav-item">
            <Link className="nav-link active" to={`#${hostelTabId}`} data-bs-toggle="tab">
              Hostel
            </Link>
          </li>
          <li className="nav-item">
            <Link className="nav-link" to={`#${transportTabId}`} data-bs-toggle="tab">
              Transportation
            </Link>
          </li>
        </ul>
        <div className="tab-content">
          <div className="tab-pane fade show active" id={hostelTabId}>
            {hasHostelAllocation(details) ? (
              <>
                <div className="d-flex align-items-center mb-3">
                  <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                    <i className="ti ti-building fs-16" />
                  </span>
                  <div>
                    <span className="fs-12 mb-1">Hostel</span>
                    <p className="text-dark mb-0">{display(details.hostel_name)}</p>
                  </div>
                </div>
                <div className="row">
                  <div className="col-sm-6">
                    <div className="mb-3">
                      <span className="fs-12 mb-1">Floor</span>
                      <p className="text-dark mb-0">{display(details.floor)}</p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="mb-3">
                      <span className="fs-12 mb-1">Room</span>
                      <p className="text-dark mb-0">{display(details.hostel_room_number)}</p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="mb-3">
                      <span className="fs-12 mb-1">Bed</span>
                      <p className="text-dark mb-0">{display(details.hostel_bed_number)}</p>
                    </div>
                  </div>
                  {assignedDate && (
                    <div className="col-sm-6">
                      <div className="mb-3">
                        <span className="fs-12 mb-1">Assigned on</span>
                        <p className="text-dark mb-0">{assignedDate}</p>
                      </div>
                    </div>
                  )}
                  {!isPlaceholderValue(details.hostel_academic_year_name) && (
                    <div className="col-sm-6">
                      <div className="mb-3">
                        <span className="fs-12 mb-1">Academic year</span>
                        <p className="text-dark mb-0">{display(details.hostel_academic_year_name)}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted mb-0">Hostel is not allocated yet.</p>
            )}
          </div>
          <div className="tab-pane fade" id={transportTabId}>
            {hasTransportAllocation(details) ? (
              <>
                <div className="d-flex align-items-center mb-3">
                  <span className="avatar avatar-md bg-light-300 rounded me-2 flex-shrink-0 text-default">
                    <i className="ti ti-bus fs-16" />
                  </span>
                  <div>
                    <span className="fs-12 mb-1">Pickup point</span>
                    <p className="text-dark mb-0">{display(details.pickup_point_name)}</p>
                  </div>
                </div>
                <div className="row">
                  <div className="col-sm-6">
                    <div className="mb-3">
                      <span className="fs-12 mb-1">Route</span>
                      <p className="text-dark mb-0">{display(details.route_name)}</p>
                    </div>
                  </div>
                  <div className="col-sm-6">
                    <div className="mb-3">
                      <span className="fs-12 mb-1">Bus / vehicle</span>
                      <p className="text-dark mb-0">{display(details.vehicle_number)}</p>
                    </div>
                  </div>
                  {!hideTransportFees && (
                    <>
                      <div className="col-sm-6">
                        <div className="mb-3">
                          <span className="fs-12 mb-1">Plan</span>
                          <p className="text-dark mb-0">
                            {details.transport_is_free
                              ? 'Free allocation'
                              : display(details.transport_fee_plan_name)}
                          </p>
                        </div>
                      </div>
                      <div className="col-sm-6">
                        <div className="mb-3">
                          <span className="fs-12 mb-1">Assigned amount</span>
                          <p className="text-dark mb-0">
                            {details.transport_is_free
                              ? '₹0'
                              : details.transport_assigned_fee_amount != null
                                ? `₹${Number(details.transport_assigned_fee_amount).toLocaleString('en-IN')}`
                                : 'N/A'}
                          </p>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="text-muted mb-0">Transportation is not allocated yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
