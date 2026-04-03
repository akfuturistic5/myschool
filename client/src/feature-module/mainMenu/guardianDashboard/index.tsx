import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { all_routes } from "../../router/all_routes";
import ImageWithBasePath from "../../../core/common/imageWithBasePath";
import ReactApexChart from "react-apexcharts";
import { useGuardians } from "../../../core/hooks/useGuardians";
import { useGuardianWardLeaves } from "../../../core/hooks/useGuardianWardLeaves";
import { useStudentFees } from "../../../core/hooks/useStudentFees";
import { useEvents } from "../../../core/hooks/useEvents";
import { EventsCard } from "../shared/EventsCard";

const GuardianDashboard = () => {
  const routes = all_routes;
  const { guardians, loading: guardianLoading, error: guardianError } = useGuardians();
  const { leaveApplications: wardLeaves, loading: leaveLoading } = useGuardianWardLeaves({ limit: 20 });
  const { upcomingEvents, completedEvents, loading: eventsLoading } = useEvents({ forDashboard: true, limit: 5 });

  const wards = guardians ?? [];
  const firstWard = wards[0];
  const activeWard = firstWard ?? null;
  const { data: feeData } = useStudentFees(activeWard?.student_id ?? null);

  const displayGuardian = activeWard ?? firstWard;
  const guardianName = displayGuardian
    ? [displayGuardian.name].filter(Boolean).join(" ") || "Guardian Profile"
    : "Guardian Profile";

  const medicalCount = useMemo(() => {
    return wardLeaves.filter((l: { leaveType?: string }) => String(l.leaveType || "").toLowerCase().includes("medical")).length;
  }, [wardLeaves]);

  const casualCount = useMemo(() => {
    return wardLeaves.filter((l: { leaveType?: string }) => String(l.leaveType || "").toLowerCase().includes("casual")).length;
  }, [wardLeaves]);

  const [statistic_chart] = useState({
    chart: { type: "line" as const, height: 345 },
    series: [
      { name: "Avg. Exam Score", data: [] as number[] },
      { name: "Avg. Attendance", data: [] as number[] },
    ],
    xaxis: {
      categories: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    },
    tooltip: {
      y: { formatter: (val: number) => `${val}%` },
      shared: true,
      intersect: false,
      custom: ({ series, dataPointIndex, w }: { series: number[][]; dataPointIndex: number; w: { globals: { labels: string[] } } }) =>
        `<div class="apexcharts-tooltip">${w.globals.labels[dataPointIndex]}<br>Exam Score: <span style="color: #1E90FF;">${series[0]?.[dataPointIndex] ?? 0}%</span><br>Attendance: <span style="color: #00BFFF;">${series[1]?.[dataPointIndex] ?? 0}%</span></div>`,
    },
    dataLabels: { enabled: false },
    grid: { yaxis: { lines: { show: true } }, padding: { left: -8 } },
    yaxis: { labels: { offsetX: -15 } },
    markers: { size: 0, colors: ["#1E90FF", "#00BFFF"], strokeColors: "#fff", strokeWidth: 1, hover: { size: 7 } },
    colors: ["#3D5EE1", "#6FCCD8"],
    legend: { position: "top" as const, horizontalAlign: "left" as const },
  });

  const hasChartData = (statistic_chart.series[0]?.data?.length ?? 0) > 0;

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="d-md-flex d-block align-items-center justify-content-between mb-3">
            <div className="my-auto mb-2">
              <h3 className="page-title mb-1">Guardian Dashboard</h3>
              <nav>
                <ol className="breadcrumb mb-0">
                  <li className="breadcrumb-item">
                    <Link to={routes.guardianDashboard}>Dashboard</Link>
                  </li>
                  <li className="breadcrumb-item active" aria-current="page">
                    Guardian Dashboard
                  </li>
                </ol>
              </nav>
            </div>
          </div>

          {guardianLoading && (
            <div className="d-flex justify-content-center align-items-center p-5">
              <div className="spinner-border text-primary" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <span className="ms-2">Loading guardian profile...</span>
            </div>
          )}

          {guardianError && (
            <div className="alert alert-warning mb-3" role="alert">
              <i className="ti ti-alert-circle me-2" />
              {guardianError}
            </div>
          )}

          {!guardianLoading && !guardianError && (
            <>
              <div className="row">
                <div className="col-xxl-5 col-xl-12 d-flex">
                  <div className="card bg-dark position-relative flex-fill">
                    <div className="card-body">
                      <div className="d-flex align-items-center row-gap-3">
                        <div className="avatar avatar-xxl rounded flex-shrink-0 me-3">
                          <ImageWithBasePath
                            src="assets/img/parents/parent-01.jpg"
                            alt="Guardian"
                          />
                        </div>
                        <div className="d-block">
                          <span className="badge bg-transparent-primary text-primary mb-1">
                            {displayGuardian?.id ? `#G${displayGuardian.id}` : "#G—"}
                          </span>
                          <h4 className="text-truncate text-white mb-1">{guardianName}</h4>
                          <div className="d-flex align-items-center flex-wrap row-gap-2 class-info">
                            {(activeWard ?? firstWard) ? (
                              <span>Ward : {(activeWard ?? firstWard).Child || "—"}</span>
                            ) : (
                              <span>No ward linked</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="student-card-bg">
                        <ImageWithBasePath src="assets/img/bg/circle-shape.png" alt="Bg" />
                        <ImageWithBasePath src="assets/img/bg/shape-02.png" alt="Bg" />
                        <ImageWithBasePath src="assets/img/bg/shape-04.png" alt="Bg" />
                        <ImageWithBasePath src="assets/img/bg/blue-polygon.png" alt="Bg" />
                      </div>
                    </div>
                  </div>
                </div>
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
                          state={activeWard?.student_id != null ? { studentId: activeWard.student_id } : undefined}
                          className="badge rounded-circle arrow d-flex align-items-center justify-content-center"
                        >
                          <i className="ti ti-chevron-right fs-14" />
                        </Link>
                      </div>
                      <div className="d-flex bg-white border rounded flex-wrap justify-content-between align-items-center p-3 row-gap-2 mb-2 animate-card">
                        <div className="d-flex align-items-center">
                          <span className="avatar avatar-sm bg-light-500 me-2 rounded">
                            <i className="ti ti-message-up text-dark fs-16" />
                          </span>
                          <h6>Raise a Request</h6>
                        </div>
                        <Link to={routes.approveRequest} className="badge rounded-circle arrow d-flex align-items-center justify-content-center">
                          <i className="ti ti-chevron-right fs-14" />
                        </Link>
                      </div>
                      {(activeWard?.student_id ?? firstWard?.student_id) && (
                        <div className="d-flex bg-white border rounded flex-wrap justify-content-between align-items-center p-3 row-gap-2 mb-4 animate-card">
                          <div className="d-flex align-items-center">
                            <span className="avatar avatar-sm bg-light-500 me-2 rounded">
                              <i className="ti ti-report-money text-dark fs-16" />
                            </span>
                            <h6>View Ward Fees</h6>
                          </div>
                          <Link
                            to={routes.studentFees}
                            state={{ studentId: activeWard?.student_id ?? firstWard?.student_id }}
                            className="badge rounded-circle arrow d-flex align-items-center justify-content-center"
                          >
                            <i className="ti ti-chevron-right fs-14" />
                          </Link>
                        </div>
                      )}
                    </div>
                    <div className="col-xl-4 col-md-6">
                      <div className="card bg-success-transparent border-3 border-white text-center p-3">
                        <span className="avatar avatar-sm rounded bg-success mx-auto mb-3">
                          <i className="ti ti-calendar-share fs-15" />
                        </span>
                        <h6 className="mb-2">Medical Leaves</h6>
                        <div className="d-flex align-items-center justify-content-between text-default">
                          <p className="border-end mb-0">Used : {medicalCount}</p>
                          <p>—</p>
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
                          <p className="border-end mb-0">Used : {casualCount}</p>
                          <p>—</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="row">
                <div className="col-xxl-4 col-xl-6 d-flex">
                  <EventsCard
                    upcomingEvents={upcomingEvents}
                    completedEvents={completedEvents}
                    loading={eventsLoading}
                    limit={5}
                  />
                </div>
                <div className="col-xxl-8 col-xl-6 d-flex">
                  <div className="card flex-fill">
                    <div className="card-header d-flex align-items-center justify-content-between">
                      <h4 className="card-title">Statistics</h4>
                    </div>
                    <div className="card-body pb-0">
                      {hasChartData ? (
                        <ReactApexChart
                          options={statistic_chart}
                          series={statistic_chart.series}
                          type="line"
                          height={345}
                        />
                      ) : (
                        <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>No performance data available. Exam scores and attendance trends will appear here once data is available.</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="row">
                {(activeWard?.student_id ?? firstWard?.student_id) && (
                  <div className="col-xxl-4 col-xl-6 d-flex">
                    <div className="card flex-fill">
                      <div className="card-header d-flex align-items-center justify-content-between">
                        <h4 className="card-title">Ward Fees</h4>
                        <Link
                          to={routes.studentFees}
                          state={{ studentId: activeWard?.student_id ?? firstWard?.student_id }}
                          className="fw-medium"
                        >
                          View Fees
                        </Link>
                      </div>
                      <div className="card-body py-1">
                        {feeData ? (
                          <div>
                            <p className="mb-2"><strong>Total Due:</strong> ${(feeData.totalDue ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                            <p className="mb-2"><strong>Total Paid:</strong> ${(feeData.totalPaid ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                            <p className="mb-0">
                              <strong>Outstanding:</strong>{" "}
                              <span className={feeData.totalOutstanding > 0 ? "text-danger" : "text-success"}>
                                ${(feeData.totalOutstanding ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </span>
                            </p>
                            {feeData.totalOutstanding > 0 && (
                              <div className="alert alert-warning mt-2 mb-0 py-2" role="alert">
                                <i className="ti ti-alert-circle me-2" /> Outstanding amount due.
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                            <i className="ti ti-info-circle me-2 fs-18" />
                            <span>No fees data available.</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <div className="col-xxl-4 col-xl-6 d-flex">
                  <div className="card flex-fill">
                    <div className="card-header d-flex align-items-center justify-content-between">
                      <h4 className="card-title">Leave Status</h4>
                      <Link to={routes.studentLeaves} state={activeWard?.student_id != null ? { studentId: activeWard.student_id } : undefined} className="fw-medium">
                        View All
                      </Link>
                    </div>
                    <div className="card-body">
                      {leaveLoading && (
                        <div className="text-center py-3">
                          <div className="spinner-border spinner-border-sm text-primary" role="status" />
                        </div>
                      )}
                      {!leaveLoading && wardLeaves.length === 0 && (
                        <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>No leave applications for your wards.</span>
                        </div>
                      )}
                      {!leaveLoading && wardLeaves.length > 0 && wardLeaves.slice(0, 4).map((item: { key?: string; leaveType?: string; leaveRange?: string; statusBadgeClass?: string; status?: string }) => (
                        <div key={item.key} className="bg-light-300 d-sm-flex align-items-center justify-content-between p-3 mb-3">
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
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default GuardianDashboard;
