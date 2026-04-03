import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import { useCurrentUser } from "../../../core/hooks/useCurrentUser";
import { useEvents } from "../../../core/hooks/useEvents";
import { useDashboardClassRoutine, useDashboardNoticeBoard } from "../../../core/hooks/useDashboardData";
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";

const AdministrativeDashboard = () => {
  const routes = all_routes;
  const { user: currentUser } = useCurrentUser();
  const { upcomingEvents, loading: eventsLoading } = useEvents({ forDashboard: true, limit: 5 });
  const { routine: classRoutine, loading: routineLoading } = useDashboardClassRoutine({ limit: 5 });
  const { notices: dashboardNotices, loading: noticesLoading } = useDashboardNoticeBoard({ limit: 5 });
  const { leaveApplications, loading: leavesLoading } = useLeaveApplications({
    limit: 5,
    canUseAdminList: true,
  });

  const quickLinks = [
    { label: "Students", to: routes.studentGrid, icon: "ti ti-school" },
    { label: "Collect Fees", to: routes.collectFees, icon: "ti ti-report-money" },
    { label: "Staff", to: routes.staff, icon: "ti ti-users-group" },
    { label: "Reports", to: routes.attendanceReport, icon: "ti ti-chart-infographic" },
  ];

  const routineRows = Array.isArray(classRoutine) ? classRoutine : [];
  const eventRows = Array.isArray(upcomingEvents) ? upcomingEvents : [];
  const noticeRows = Array.isArray(dashboardNotices) ? dashboardNotices : [];
  const leaveRows = Array.isArray(leaveApplications) ? leaveApplications : [];

  return (
    <div className="page-wrapper">
      <div className="content">
        <div className="row">
          <div className="col-12">
            <div className="card bg-dark position-relative overflow-hidden">
              <div className="card-body">
                <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
                  <div>
                    <h2 className="text-white mb-2">
                      Welcome Back, {currentUser?.display_name || currentUser?.displayName || currentUser?.username || "Administrative"}
                    </h2>
                    <p className="text-light mb-0">
                      Daily operations, records, fees, reports and communication tools are available here.
                    </p>
                  </div>
                  <div className="d-flex flex-wrap gap-2">
                    {quickLinks.map((item) => (
                      <Link key={item.label} to={item.to} className="btn btn-primary">
                        <i className={`${item.icon} me-1`} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="col-xl-6 d-flex">
            <div className="card flex-fill">
              <div className="card-header">
                <h5 className="card-title">Upcoming Events</h5>
              </div>
              <div className="card-body">
                {eventsLoading ? (
                  <p className="text-muted mb-0">Loading events...</p>
                ) : eventRows.length === 0 ? (
                  <p className="text-muted mb-0">No upcoming events found.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {eventRows.map((event: any) => (
                      <li key={event.id} className="list-group-item px-0">
                        <div className="fw-semibold">{event.title || "Untitled event"}</div>
                        <small className="text-muted">
                          {event.start_date ? new Date(event.start_date).toLocaleDateString() : "Date not set"}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-6 d-flex">
            <div className="card flex-fill">
              <div className="card-header">
                <h5 className="card-title">Leave Requests</h5>
              </div>
              <div className="card-body">
                {leavesLoading ? (
                  <p className="text-muted mb-0">Loading leave requests...</p>
                ) : leaveRows.length === 0 ? (
                  <p className="text-muted mb-0">No leave requests found.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {leaveRows.map((leave: any) => (
                      <li key={leave.id} className="list-group-item px-0">
                        <div className="fw-semibold">{leave.name || "Unknown user"}</div>
                        <small className="text-muted">
                          {leave.leaveType || "Leave"} • {leave.status || "Pending"}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-6 d-flex">
            <div className="card flex-fill">
              <div className="card-header">
                <h5 className="card-title">Class Routine</h5>
              </div>
              <div className="card-body">
                {routineLoading ? (
                  <p className="text-muted mb-0">Loading class routine...</p>
                ) : routineRows.length === 0 ? (
                  <p className="text-muted mb-0">No class routine entries available.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {routineRows.map((row: any) => (
                      <li key={row.id} className="list-group-item px-0">
                        <div className="fw-semibold">
                          {row.class_name || row.className || "Class"} {row.section_name || row.sectionName ? `- ${row.section_name || row.sectionName}` : ""}
                        </div>
                        <small className="text-muted">
                          {row.subject_name || row.subjectName || "Subject"} • {row.day_of_week || row.day || row.weekday || "Schedule"}
                        </small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-6 d-flex">
            <div className="card flex-fill">
              <div className="card-header">
                <h5 className="card-title">Notice Board</h5>
              </div>
              <div className="card-body">
                {noticesLoading ? (
                  <p className="text-muted mb-0">Loading notices...</p>
                ) : noticeRows.length === 0 ? (
                  <p className="text-muted mb-0">No notices available.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {noticeRows.map((notice: any) => (
                      <li key={notice.id} className="list-group-item px-0">
                        <div className="fw-semibold">{notice.title || "Notice"}</div>
                        <small className="text-muted">{notice.description || notice.message || "No description available."}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeDashboard;
