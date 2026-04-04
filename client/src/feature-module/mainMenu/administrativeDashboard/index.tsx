import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { all_routes } from "../../router/all_routes";
import { useCurrentUser } from "../../../core/hooks/useCurrentUser";
import { selectSelectedAcademicYearId } from "../../../core/data/redux/academicYearSlice";
import { useDashboardStats } from "../../../core/hooks/useDashboardStats";
import {
  useDashboardClassRoutine,
  useDashboardFeeStats,
  useDashboardFinanceSummary,
  useDashboardMergedUpcomingEvents,
  useDashboardNoticeBoard,
  useDashboardStudentActivity,
} from "../../../core/hooks/useDashboardData";
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";

const AdministrativeDashboard = () => {
  const routes = all_routes;
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { user: currentUser } = useCurrentUser();
  const { stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useDashboardStats({ academicYearId });
  const { upcomingEvents, loading: eventsLoading, error: eventsError, refetch: refetchEvents } = useDashboardMergedUpcomingEvents({ limit: 8 });
  const { routine: classRoutine, loading: routineLoading, error: routineError, refetch: refetchRoutine } = useDashboardClassRoutine({ limit: 5, academicYearId });
  const { notices: dashboardNotices, loading: noticesLoading, error: noticesError, refetch: refetchNotices } = useDashboardNoticeBoard({ limit: 5 });
  const { activityItems, loading: activityLoading, error: activityError, } = useDashboardStudentActivity({ limit: 5, academicYearId });
  const { feeStats } = useDashboardFeeStats({ academicYearId });
  const { financeSummary } = useDashboardFinanceSummary({ academicYearId });
  const { leaveApplications, loading: leavesLoading, error: leavesError, refetch: refetchLeaves } = useLeaveApplications({
    limit: 5,
    studentOnly: true,
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
  const activityRows = Array.isArray(activityItems) ? activityItems : [];

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

          <div className="col-xl-3 col-sm-6 d-flex">
            <div className="card flex-fill">
              <div className="card-body">
                <h6 className="text-muted mb-1">Students</h6>
                <h3 className="mb-0">{statsLoading ? "..." : stats.students.total}</h3>
                <small className="text-muted">Active: {stats.students.active} | Inactive: {stats.students.inactive}</small>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6 d-flex">
            <div className="card flex-fill">
              <div className="card-body">
                <h6 className="text-muted mb-1">Teachers</h6>
                <h3 className="mb-0">{statsLoading ? "..." : stats.teachers.total}</h3>
                <small className="text-muted">Active: {stats.teachers.active} | Inactive: {stats.teachers.inactive}</small>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6 d-flex">
            <div className="card flex-fill">
              <div className="card-body">
                <h6 className="text-muted mb-1">Staff</h6>
                <h3 className="mb-0">{statsLoading ? "..." : stats.staff.total}</h3>
                <small className="text-muted">Active: {stats.staff.active} | Inactive: {stats.staff.inactive}</small>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6 d-flex">
            <div className="card flex-fill">
              <div className="card-body">
                <h6 className="text-muted mb-1">Subjects</h6>
                <h3 className="mb-0">{statsLoading ? "..." : stats.subjects.total}</h3>
                <small className="text-muted">Active: {stats.subjects.active} | Inactive: {stats.subjects.inactive}</small>
              </div>
            </div>
          </div>

          {statsError && (
            <div className="col-12">
              <div className="alert alert-danger d-flex justify-content-between align-items-center">
                <span>Failed to load dashboard stats.</span>
                <button type="button" className="btn btn-sm btn-danger" onClick={refetchStats}>
                  Retry
                </button>
              </div>
            </div>
          )}

          <div className="col-xl-6 d-flex">
            <div className="card flex-fill">
              <div className="card-header">
                <h5 className="card-title">Upcoming Events</h5>
              </div>
              <div className="card-body">
                {eventsError && (
                  <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
                    <span className="small mb-0">Could not load events.</span>
                    <button type="button" className="btn btn-sm btn-danger" onClick={refetchEvents}>
                      Retry
                    </button>
                  </div>
                )}
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
                <h5 className="card-title">My leave</h5>
              </div>
              <div className="card-body">
                {leavesError && (
                  <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
                    <span className="small mb-0">Could not load your leave applications.</span>
                    <button type="button" className="btn btn-sm btn-danger" onClick={refetchLeaves}>
                      Retry
                    </button>
                  </div>
                )}
                {leavesLoading ? (
                  <p className="text-muted mb-0">Loading your leave...</p>
                ) : leaveRows.length === 0 ? (
                  <p className="text-muted mb-0">No leave applications on file for your account. Apply from HRM → Leaves if your user is linked to staff.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {leaveRows.map((leave: any) => (
                      <li key={leave.id} className="list-group-item px-0">
                        <div className="fw-semibold">{leave.leaveType || "Leave"}</div>
                        <small className="text-muted">
                          Status: {leave.status || "Pending"}
                          {leave.leaveRange ? ` • ${leave.leaveRange}` : ""}
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
                {routineError && (
                  <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
                    <span className="small mb-0">Could not load class routine.</span>
                    <button type="button" className="btn btn-sm btn-danger" onClick={refetchRoutine}>
                      Retry
                    </button>
                  </div>
                )}
                {routineLoading ? (
                  <p className="text-muted mb-0">Loading class routine...</p>
                ) : routineRows.length === 0 ? (
                  <p className="text-muted mb-0">No class routine entries available.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {routineRows.map((row: any) => (
                      <li key={row.id} className="list-group-item px-0">
                        <div className="fw-semibold">
                          {row.className || "Class"} {row.sectionName ? `- ${row.sectionName}` : ""}
                        </div>
                        <small className="text-muted">
                          {row.subjectName || "Subject"} • {row.day || "Schedule"}
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
                {noticesError && (
                  <div className="alert alert-danger py-2 d-flex justify-content-between align-items-center">
                    <span className="small mb-0">Could not load notices.</span>
                    <button type="button" className="btn btn-sm btn-danger" onClick={refetchNotices}>
                      Retry
                    </button>
                  </div>
                )}
                {noticesLoading ? (
                  <p className="text-muted mb-0">Loading notices...</p>
                ) : noticeRows.length === 0 ? (
                  <p className="text-muted mb-0">No notices available.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {noticeRows.map((notice: any) => (
                      <li key={notice.id} className="list-group-item px-0">
                        <div className="fw-semibold">{notice.title || "Notice"}</div>
                        <small className="text-muted">{notice.content || notice.description || notice.message || "No description available."}</small>
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
                <h5 className="card-title">Student Activity</h5>
              </div>
              <div className="card-body">
                {activityError && <p className="text-danger mb-2">Could not load activity feed.</p>}
                {activityLoading ? (
                  <p className="text-muted mb-0">Loading activity...</p>
                ) : activityRows.length === 0 ? (
                  <p className="text-muted mb-0">No recent activity found.</p>
                ) : (
                  <ul className="list-group list-group-flush">
                    {activityRows.map((item: any) => (
                      <li key={item.id} className="list-group-item px-0">
                        <div className="fw-semibold">{item.title || "Activity"}</div>
                        <small className="text-muted">{item.subtitle || "Update"}{item.date ? ` • ${new Date(item.date).toLocaleDateString()}` : ""}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          <div className="col-xl-3 col-sm-6 d-flex">
            <div className="card flex-fill">
              <div className="card-body">
                <h6 className="text-muted mb-1">Fees Collected</h6>
                <h4 className="mb-0">{Number(feeStats.totalFeesCollected || 0).toLocaleString()}</h4>
                <small className="text-muted">Outstanding: {Number(feeStats.totalOutstanding || 0).toLocaleString()}</small>
              </div>
            </div>
          </div>
          <div className="col-xl-3 col-sm-6 d-flex">
            <div className="card flex-fill">
              <div className="card-body">
                <h6 className="text-muted mb-1">Finance Net</h6>
                <h4 className="mb-0">{Number(financeSummary.netPosition || 0).toLocaleString()}</h4>
                <small className="text-muted">Earnings: {Number(financeSummary.totalEarnings || 0).toLocaleString()}</small>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdministrativeDashboard;
