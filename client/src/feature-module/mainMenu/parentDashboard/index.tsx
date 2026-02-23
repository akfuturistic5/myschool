import { useState, useMemo, useEffect } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import { useParents } from "../../../core/hooks/useParents";
import { useLeaveApplications } from "../../../core/hooks/useLeaveApplications";
import { useStudentFees } from "../../../core/hooks/useStudentFees";
import { useCalendarEvents } from "../../../core/hooks/useCalendarEvents";

const ParentDashboard = () => {
  const routes = all_routes;
  const { parents, loading: parentLoading, error: parentError } = useParents({ forCurrentUser: true });
  const { events: calendarEvents } = useCalendarEvents();

  const children = useMemo(() => parents || [], [parents]);
  const firstParent = children[0];
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const activeStudent = activeStudentId
    ? children.find((c: { student_id?: number }) => String(c.student_id) === activeStudentId)
    : firstParent;
  const selectedChild = activeStudent || firstParent;

  const { leaveApplications: myLeaves, loading: leaveLoading, error: leaveError } = useLeaveApplications({
    parentChildren: true,
    limit: 20,
    studentId: null,
  });
  const { data: feeData } = useStudentFees(selectedChild?.student_id ?? null);

  // Leave counts by type (from real leave data)
  const leaveCounts = useMemo(() => {
    const t = (s: string) => String(s || "").toLowerCase();
    const medical = myLeaves.filter((l: { leaveType?: string }) => {
      const lt = t(l.leaveType);
      return lt.includes("medical") || lt.includes("sick");
    });
    const casual = myLeaves.filter((l: { leaveType?: string }) => {
      const lt = t(l.leaveType);
      return lt.includes("casual") || lt.includes("casual leave");
    });
    return { medical: medical.length, casual: casual.length, total: myLeaves.length };
  }, [myLeaves]);

  useEffect(() => {
    if (children.length > 0 && !activeStudentId) {
      setActiveStudentId(String(children[0].student_id));
    }
  }, [children, activeStudentId]);
  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          {/* Page Header */}
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Parent Dashboard</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.parentDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Parent Dashboard
                  </li>
                </ol>
              </nav>
            </div>
            {children.length > 1 && (
              <div className="dash-select-student d-flex align-items-center mb-2">
                <h6 className="mb-0">Select Student</h6>
                <div className="student-active d-flex align-items-center ms-2">
                  {children.map((child: { student_id?: number; Child?: string; ChildImage?: string }) => (
                    <Link
                      key={child.student_id}
                      to="#"
                      onClick={() => setActiveStudentId(String(child.student_id))}
                      className={`avatar avatar-lg p-1 me-2 ${activeStudentId === String(child.student_id) && "active"}`}
                    >
                      <ImageWithBasePath
                        src={child.ChildImage || "assets/img/students/student-01.jpg"}
                        alt={child.Child || "Child"}
                      />
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* /Page Header */}
          <div className="row">
            {/* Profile */}
            <div className="col-xxl-5 col-xl-12 d-flex">
              <div className="card bg-dark position-relative flex-fill">
                <div className="card-body">
                  {parentLoading && (
                    <div className="d-flex align-items-center justify-content-center p-4">
                      <div className="spinner-border text-light" role="status" />
                    </div>
                  )}
                  {parentError && (
                    <div className="alert alert-warning mb-0" role="alert">
                      <i className="ti ti-alert-circle me-2" />
                      {parentError}
                    </div>
                  )}
                  {!parentLoading && !parentError && firstParent && (
                    <div className="d-flex align-items-center row-gap-3">
                      <div className="avatar avatar-xxl rounded flex-shrink-0 me-3">
                        <ImageWithBasePath
                          src={firstParent.ParentImage || "assets/img/parents/parent-01.jpg"}
                          alt="Parent"
                        />
                      </div>
                      <div className="d-block">
                        <span className="badge bg-transparent-primary text-primary mb-1">
                          {firstParent.id ? `#P${firstParent.id}` : "#P—"}
                        </span>
                        <h4 className="text-truncate text-white mb-1">
                          {firstParent.name || "—"}
                        </h4>
                        <div className="d-flex align-items-center flex-wrap row-gap-2 class-info">
                          <span>{firstParent.Addedon || "—"}</span>
                          <span>Child : {selectedChild?.Child || firstParent.Child || "—"}</span>
                        </div>
                        {selectedChild?.student_id && (
                          <Link
                            to={routes.studentDetail}
                            state={{ studentId: selectedChild.student_id, returnTo: routes.parentDashboard }}
                            className="btn btn-primary btn-sm mt-2"
                          >
                            View Child Profile
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                  {!parentLoading && !parentError && !firstParent && (
                    <div className="alert alert-info mb-0" role="alert">
                      Parent profile not found. Please contact admin.
                    </div>
                  )}
                  <div className="student-card-bg">
                    <ImageWithBasePath
                      src="assets/img/bg/circle-shape.png"
                      alt="Bg"
                    />
                    <ImageWithBasePath
                      src="assets/img/bg/shape-02.png"
                      alt="Bg"
                    />
                    <ImageWithBasePath
                      src="assets/img/bg/shape-04.png"
                      alt="Bg"
                    />
                    <ImageWithBasePath
                      src="assets/img/bg/blue-polygon.png"
                      alt="Bg"
                    />
                  </div>
                </div>
              </div>
            </div>
            {/* /Profile */}
            {/* Leave */}
            <div className="col-xxl-7 d-flex">
              <div className="row flex-fill">
                <div className="col-xl-4 d-flex flex-column">
                  <div className="d-flex bg-white border rounded flex-wrap justify-content-between align-items-center p-3 row-gap-2 mb-2 animate-card">
                    <div className="d-flex align-items-center">
                      <span className="avatar avatar-sm bg-light-500 me-2 rounded">
                        <i className="ti ti-calendar-event text-dark fs-16" />
                      </span>
                      <h6>Apply Leave</h6>
                    </div>
                    <Link
                      to={routes.studentLeaves}
                      state={
                        selectedChild?.student_id
                          ? { studentId: selectedChild.student_id, returnTo: routes.parentDashboard }
                          : undefined
                      }
                      className="badge rounded-circle arrow d-flex align-items-center justify-content-center"
                    >
                      <i className="ti ti-chevron-right fs-14" />
                    </Link>
                  </div>
                  {selectedChild?.student_id && (
                    <div className="d-flex bg-white border rounded flex-wrap justify-content-between align-items-center p-3 row-gap-2 mb-2 animate-card">
                      <div className="d-flex align-items-center">
                        <span className="avatar avatar-sm bg-light-500 me-2 rounded">
                          <i className="ti ti-report-money text-dark fs-16" />
                        </span>
                        <h6>View Child Fees</h6>
                      </div>
                      <Link
                        to={routes.studentFees}
                        state={{ studentId: selectedChild.student_id }}
                        className="badge rounded-circle arrow d-flex align-items-center justify-content-center"
                      >
                        <i className="ti ti-chevron-right fs-14" />
                      </Link>
                    </div>
                  )}
                  <div className="d-flex bg-white border rounded flex-wrap justify-content-between align-items-center p-3 row-gap-2 mb-4 animate-card">
                    <div className="d-flex align-items-center">
                      <span className="avatar avatar-sm bg-light-500 me-2 rounded">
                        <i className="ti ti-message-up text-dark fs-16" />
                      </span>
                      <h6>Raise a Request</h6>
                    </div>
                    <Link
                      to={routes.approveRequest}
                      className="badge rounded-circle arrow d-flex align-items-center justify-content-center"
                    >
                      <i className="ti ti-chevron-right fs-14" />
                    </Link>
                  </div>
                </div>
                <div className="col-xl-4 col-md-6">
                  <div className="card bg-success-transparent border-3 border-white text-center p-3">
                    <span className="avatar avatar-sm rounded bg-success mx-auto mb-3">
                      <i className="ti ti-calendar-share fs-15" />
                    </span>
                    <h6 className="mb-2">Medical Leaves</h6>
                    <div className="d-flex align-items-center justify-content-between text-default">
                      <p className="border-end mb-0">Used : {leaveCounts.medical}</p>
                      <p className="mb-0">—</p>
                    </div>
                  </div>
                </div>
                <div className="col-xl-4 col-md-6">
                  <div className="card bg-primary-transparent border-3 border-white text-center p-3">
                    <span className="avatar avatar-sm rounded bg-primary mx-auto mb-3">
                      <i className="ti ti-hexagonal-prism-plus fs-15" />
                    </span>
                    <h6 className="mb-2">Casual Leaves</h6>
                    <div className="d-flex align-items-center justify-content-between text-default">
                      <p className="border-end mb-0">Used : {leaveCounts.casual}</p>
                      <p className="mb-0">—</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* /Leave */}
          </div>
          <div className="row">
            {/* Events List */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header  d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Events List</h4>
                  <Link to={routes.events} className="fw-medium">
                    View All
                  </Link>
                </div>
                <div className="card-body p-0">
                  {!calendarEvents?.length ? (
                    <div className="p-4">
                      <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                        <i className="ti ti-info-circle me-2 fs-18" />
                        <span>No events. Events will appear here once available.</span>
                      </div>
                    </div>
                  ) : (
                    <ul className="list-group list-group-flush">
                      {calendarEvents.slice(0, 5).map((evt: { id?: number; title?: string; start_date?: string; end_date?: string; is_all_day?: boolean }) => (
                        <li key={evt.id} className="list-group-item p-3">
                          <div className="d-flex align-items-center justify-content-between">
                            <div className="d-flex align-items-center">
                              <span className="avatar avatar-lg flex-shrink-0 me-2 bg-primary-transparent rounded">
                                <i className="ti ti-calendar-event fs-20 text-primary" />
                              </span>
                              <div className="overflow-hidden">
                                <h6 className="mb-1">
                                  <Link to={routes.events}>{evt.title || "Event"}</Link>
                                </h6>
                                <p className="mb-0">
                                  <i className="ti ti-calendar me-1" />
                                  {evt.start_date ? new Date(evt.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                                </p>
                              </div>
                            </div>
                            <span className={`badge d-inline-flex align-items-center ${evt.is_all_day ? "badge-soft-danger" : "badge-soft-skyblue"}`}>
                              <i className="ti ti-circle-filled fs-5 me-1" />
                              {evt.is_all_day ? "Full Day" : "Half Day"}
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            {/* /Events List */}
            {/* Statistics */}
            <div className="col-xxl-8 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Statistics</h4>
                  <div className="dropdown">
                    <Link
                      to="#"
                      className="bg-white dropdown-toggle"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-calendar me-2" />
                      This Month
                    </Link>
                    <ul className="dropdown-menu mt-2 p-3">
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          This Month
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          This Year
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          Last Week
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body pb-0">
                  <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                    <i className="ti ti-info-circle me-2 fs-18" />
                    <span>Statistics (exam score &amp; attendance) will appear here once data is available.</span>
                  </div>
                </div>
              </div>
            </div>
            {/* /Statistics */}
          </div>
          <div className="row">
            {/* Leave Status */}
            <div className="col-xxl-4 col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Leave Status</h4>
                  <div className="d-flex align-items-center gap-2">
                    {selectedChild?.student_id && (
                      <Link
                        to={routes.studentLeaves}
                        state={{ studentId: selectedChild.student_id, returnTo: routes.parentDashboard }}
                        className="fw-medium"
                      >
                        View All
                      </Link>
                    )}
                    <div className="dropdown">
                    <Link
                      to="#"
                      className="bg-white dropdown-toggle"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-calendar me-2" />
                      This Month
                    </Link>
                    <ul className="dropdown-menu mt-2 p-3">
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          This Month
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          This Year
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          Last Week
                        </Link>
                      </li>
                    </ul>
                  </div>
                  </div>
                </div>
                <div className="card-body">
                  {leaveError && (
                    <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
                      <i className="ti ti-alert-circle me-2 fs-18" />
                      <span>{leaveError}</span>
                    </div>
                  )}
                  {leaveLoading && (
                    <div className="text-center py-3">
                      <div className="spinner-border spinner-border-sm text-primary" role="status" />
                    </div>
                  )}
                  {!leaveLoading && !leaveError && myLeaves.length === 0 && (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No leave applications.</span>
                    </div>
                  )}
                  {!leaveLoading && myLeaves.length > 0 && myLeaves.map((item: { key?: string; leaveType?: string; leaveRange?: string; statusBadgeClass?: string; status?: string }, idx: number) => (
                    <div key={item.key} className={`bg-light-300 d-sm-flex align-items-center justify-content-between p-3 ${idx < myLeaves.length - 1 ? "mb-3" : "mb-0"}`}>
                      <div className="d-flex align-items-center mb-2 mb-sm-0">
                        <div className="avatar avatar-lg bg-info-transparent flex-shrink-0 me-2">
                          <i className="ti ti-calendar-off" />
                        </div>
                        <div>
                          <h6 className="mb-1">{item.leaveType || "Leave"}</h6>
                          <p className="mb-0">Date : {item.leaveRange || "—"}</p>
                        </div>
                      </div>
                      <span className={`badge ${item.statusBadgeClass || "bg-skyblue"} d-inline-flex align-items-center`}>
                        <i className="ti ti-circle-filled fs-5 me-1" />
                        {item.status || "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* /Leave Status */}
            {/* Home Works */}
            <div className="col-xxl-4  col-xl-6 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-titile">Home Works</h4>
                  <div className="dropdown">
                    <Link
                      to="#"
                      className="bg-white dropdown-toggle"
                      data-bs-toggle="dropdown"
                    >
                      <i className="ti ti-book-2 me-2" />
                      All Subject
                    </Link>
                    <ul className="dropdown-menu mt-2 p-3">
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          Physics
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          Chemistry
                        </Link>
                      </li>
                      <li>
                        <Link to="#" className="dropdown-item rounded-1">
                          Maths
                        </Link>
                      </li>
                    </ul>
                  </div>
                </div>
                <div className="card-body py-1">
                  <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                    <i className="ti ti-info-circle me-2 fs-18" />
                    <span>No homework assigned. Homework will appear here once assigned.</span>
                  </div>
                </div>
              </div>
            </div>
            {/* /Home Works */}
            {/* Fees Reminder */}
            <div className="col-xxl-4 col-xl-12 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between">
                  <h4 className="card-titile">Child Fees</h4>
                  {selectedChild?.student_id && (
                    <Link
                      to={routes.studentFees}
                      state={{ studentId: selectedChild.student_id }}
                      className="link-primary fw-medium"
                    >
                      View Fees
                    </Link>
                  )}
                </div>
                <div className="card-body py-1">
                  {selectedChild?.student_id ? (
                    feeData ? (
                      <div>
                        <p className="mb-2">
                          <strong>Total Due:</strong> ${(feeData.totalDue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="mb-2">
                          <strong>Total Paid:</strong> ${(feeData.totalPaid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </p>
                        <p className="mb-0">
                          <strong>Outstanding:</strong>{" "}
                          <span className={feeData.totalOutstanding > 0 ? "text-danger" : "text-success"}>
                            ${(feeData.totalOutstanding ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </p>
                        {feeData.totalOutstanding > 0 && (
                          <div className="alert alert-warning mt-2 mb-0 py-2" role="alert">
                            <i className="ti ti-alert-circle me-2" />
                            Please pay outstanding amount for {selectedChild?.Child || "your child"}.
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                        <i className="ti ti-info-circle me-2 fs-18" />
                        <span>Loading fee data...</span>
                      </div>
                    )
                  ) : (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>Select a child to view fee details.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* Fees Reminder */}
          </div>
          <div className="row">
            {/* Exam Result */}
            <div className="col-xxl-8 col-xl-7 d-flex">
              <div className="card flex-fill">
                <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                  <h4 className="card-title mb-3">Exam Result</h4>
                  <div className="d-flex align-items-center">
                    <div className="dropdown me-3 mb-3">
                      <Link
                        to="#"
                        className="bg-white dropdown-toggle"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-2" />
                        All Classes
                      </Link>
                      <ul className="dropdown-menu mt-2 p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            I
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            II
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            III
                          </Link>
                        </li>
                      </ul>
                    </div>
                    <div className="dropdown mb-3">
                      <Link
                        to="#"
                        className="bg-white dropdown-toggle"
                        data-bs-toggle="dropdown"
                      >
                        <i className="ti ti-calendar me-2" />
                        All Exams
                      </Link>
                      <ul className="dropdown-menu mt-2 p-3">
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            Quartely
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            Practical
                          </Link>
                        </li>
                        <li>
                          <Link to="#" className="dropdown-item rounded-1">
                            1st Term
                          </Link>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
                <div className="card-body px-0">
                  <div className="alert alert-info d-flex align-items-center mx-3 mb-0" role="alert">
                    <i className="ti ti-info-circle me-2 fs-18" />
                    <span>No exam results available. Results will appear here after exams.</span>
                  </div>
                </div>
              </div>
            </div>
            {/* /Exam Result */}
            {/* Notice Board */}
            <div className="col-xxl-4 col-xl-5 d-flex">
              <div className="card flex-fill">
                <div className="card-header  d-flex align-items-center justify-content-between">
                  <h4 className="card-title">Notice Board</h4>
                  <Link to={routes.noticeBoard} className="fw-medium">
                    View All
                  </Link>
                </div>
                <div className="card-body">
                  {!calendarEvents?.length ? (
                    <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                      <i className="ti ti-info-circle me-2 fs-18" />
                      <span>No notices or events available.</span>
                    </div>
                  ) : (
                    <div className="notice-widget">
                      {calendarEvents.slice(0, 6).map((evt: { id?: number; title?: string; start_date?: string }) => (
                        <div key={evt.id} className="d-flex align-items-center justify-content-between mb-4">
                          <div className="d-flex align-items-center overflow-hidden me-2">
                            <span className="bg-primary-transparent avatar avatar-md me-2 rounded-circle flex-shrink-0">
                              <i className="ti ti-calendar fs-16" />
                            </span>
                            <div className="overflow-hidden">
                              <h6 className="text-truncate mb-1">{evt.title || "Notice"}</h6>
                              <p className="mb-0">
                                <i className="ti ti-calendar me-2" />
                                Added on : {evt.start_date ? new Date(evt.start_date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                              </p>
                            </div>
                          </div>
                          <Link to={routes.noticeBoard}>
                            <i className="ti ti-chevron-right fs-16" />
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            {/* /Notice Board */}
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
    </>
  );
};

export default ParentDashboard;
