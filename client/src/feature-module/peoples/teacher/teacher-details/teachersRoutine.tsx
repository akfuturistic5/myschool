import TeacherModal from "../teacherModal";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { all_routes } from "../../../router/all_routes";
import TeacherSidebar from "./teacherSidebar";
import TeacherBreadcrumb from "./teacherBreadcrumb";
import { apiService } from "../../../../core/services/apiService";
import { selectSelectedAcademicYearId } from "../../../../core/data/redux/academicYearSlice";
import { useCurrentTeacher } from "../../../../core/hooks/useCurrentTeacher";

interface TeacherDetailsLocationState {
  teacherId?: number;
  teacher?: any;
}

interface RoutineItem {
  id: number;
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  subjectId: number;
  subjectName: string;
  timeSlotId: number;
  slotName: string;
  dayOfWeek: string;
  roomNumber: string;
  startTime: string;
  endTime: string;
  duration: string;
  isBreak: boolean;
  academicYearId: number;
}

interface BreakItem {
  slotName: string;
  startTime: string;
  endTime: string;
  duration: string;
}

const TeachersRoutine = () => {
  const routes = all_routes;
  const navigate = useNavigate();
  const location = useLocation();
  const academicYearId = useSelector(selectSelectedAcademicYearId);
  const { teacher: currentTeacher, loading: currentTeacherLoading } = useCurrentTeacher();
  const state = location.state as TeacherDetailsLocationState | null;
  const teacherId = state?.teacherId ?? state?.teacher?.id ?? currentTeacher?.id;
  const [teacher, setTeacher] = useState<any>(state?.teacher ?? null);
  const [loading, setLoading] = useState(Boolean(state?.teacherId ?? state?.teacher?.id));
  const [routine, setRoutine] = useState<RoutineItem[]>([]);
  const [breaks, setBreaks] = useState<BreakItem[]>([]);
  const [routineLoading, setRoutineLoading] = useState(false);

  // Redirect to Teacher List if no teacherId is provided (e.g., clicked from sidebar)
  // MUST be before any early returns to follow Rules of Hooks
  useEffect(() => {
    if (!teacherId && !loading && !currentTeacherLoading) {
      navigate(routes.teacherList, { replace: true });
    }
  }, [teacherId, loading, currentTeacherLoading, navigate, routes.teacherList]);

  useEffect(() => {
    if (!state?.teacher && currentTeacher) {
      setTeacher(currentTeacher);
      setLoading(false);
    }
  }, [state?.teacher, currentTeacher]);

  // Always fetch full teacher by ID when teacherId is available to ensure we have complete data
  // This works whether coming from grid (partial teacher) or list (full teacher)
  useEffect(() => {
    if (teacherId) {
      setLoading(true);
      apiService
        .getTeacherById(teacherId)
        .then((res: any) => {
          if (res?.data) setTeacher(res.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [teacherId]);

  // Fetch teacher routine
  useEffect(() => {
    if (teacherId) {
      setRoutineLoading(true);
      apiService
        .getTeacherRoutine(teacherId, { academicYearId })
        .then((res: any) => {
          if (res?.data) {
            setRoutine(res.data.routine || []);
            setBreaks(res.data.breaks || []);
          } else {
            setRoutine([]);
            setBreaks([]);
          }
        })
        .catch((err) => {
          console.error('Error fetching teacher routine:', err);
          console.error('Error details:', err.response?.data || err.message);
          setRoutine([]);
          setBreaks([]);
        })
        .finally(() => setRoutineLoading(false));
    }
  }, [teacherId, academicYearId]);

  // Helper function to format time
  const formatTime = (time: string | null | undefined): string => {
    if (!time) return '';
    // If already formatted, return as is
    if (typeof time === 'string' && (time.includes('AM') || time.includes('PM'))) {
      return time;
    }
    // Try to parse and format time
    try {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minutes || '00'} ${ampm}`;
    } catch {
      return time;
    }
  };

  // Group routine by day
  const groupRoutineByDay = () => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const grouped: { [key: string]: RoutineItem[] } = {};
    
    days.forEach(day => {
      grouped[day] = [];
    });

    routine.forEach(item => {
      const day = item.dayOfWeek || 'Monday';
      if (grouped[day]) {
        grouped[day].push(item);
      }
    });

    // Sort each day's routine by start time
    days.forEach(day => {
      grouped[day].sort((a, b) => {
        const timeA = a.startTime || '';
        const timeB = b.startTime || '';
        return timeA.localeCompare(timeB);
      });
    });

    return grouped;
  };

  const routineByDay = groupRoutineByDay();
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  if (loading) {
    return (
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            <div className="row">
              <TeacherBreadcrumb />
              <div className="col-12">
                <div className="d-flex justify-content-center align-items-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <span className="ms-2">Loading teacher...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* /Page Wrapper */}
        <TeacherModal />
      </>
    );
  }

  if (!teacher && !teacherId) {
    return (
      <>
        {/* Page Wrapper */}
        <div className="page-wrapper">
          <div className="content">
            <div className="row">
              <TeacherBreadcrumb />
              <div className="col-12">
                <div className="d-flex justify-content-center align-items-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                  <span className="ms-2">Redirecting to Teacher List...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* /Page Wrapper */}
        <TeacherModal />
      </>
    );
  }

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            {/* Page Header */}
            <TeacherBreadcrumb />
            {/* /Page Header */}
            {/* Teacher Information */}
            <TeacherSidebar teacher={teacher} />
            {/* /Teacher Information */}
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  {/* List */}
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link to={routes.teacherDetails} className="nav-link ">
                        <i className="ti ti-school me-2" />
                        Teacher Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.teachersRoutine}
                        className="nav-link active"
                      >
                        <i className="ti ti-table-options me-2" />
                        Routine
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.teacherLeaves} className="nav-link ">
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.teacherSalary} className="nav-link">
                        <i className="ti ti-report-money me-2" />
                        Salary
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.teacherLibrary} className="nav-link">
                        <i className="ti ti-bookmark-edit me-2" />
                        Library
                      </Link>
                    </li>
                  </ul>
                  {/* /List */}
                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                      <h4 className="mb-3">Time Table</h4>
                      <div className="d-flex align-items-center flex-wrap">
                        <div className="dropdown mb-3">
                          <Link
                            to="#"
                            className="btn btn-outline-light border-white bg-white dropdown-toggle shadow-md"
                            data-bs-toggle="dropdown"
                          >
                            <i className="ti ti-calendar-due me-2" />
                            This Year
                          </Link>
                          <ul className="dropdown-menu p-3">
                            <li>
                              <Link to="#" className="dropdown-item rounded-1">
                                This Year
                              </Link>
                            </li>
                            <li>
                              <Link to="#" className="dropdown-item rounded-1">
                                This Month
                              </Link>
                            </li>
                            <li>
                              <Link to="#" className="dropdown-item rounded-1">
                                This Week
                              </Link>
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="card-body">
                      {routineLoading ? (
                        <div className="d-flex justify-content-center align-items-center p-5">
                          <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading routine...</span>
                          </div>
                          <span className="ms-2">Loading routine...</span>
                        </div>
                      ) : routine.length === 0 ? (
                        <div className="text-center p-5">
                          <p className="text-muted">No routine data available for this teacher.</p>
                        </div>
                      ) : (
                        <div className="d-flex flex-nowrap overflow-auto">
                          {days.map((day) => (
                            <div key={day} className="d-flex flex-column me-4 flex-fill">
                              <div className="mb-3">
                                <h6>{day}</h6>
                              </div>
                              {routineByDay[day] && routineByDay[day].length > 0 ? (
                                routineByDay[day].map((item) => (
                                  <div key={item.id} className="rounded p-3 mb-4 border">
                                    <div className="pb-3 border-bottom">
                                      <span className="text-danger badge bg-transparent-danger text-nowrap">
                                        Room No: {item.roomNumber || 'N/A'}
                                      </span>
                                    </div>
                                    <span className="text-dark d-block py-2">
                                      Class : {item.className || 'N/A'}, {item.sectionName || 'N/A'}
                                    </span>
                                    <span className="text-dark d-block pb-2">
                                      Subject : {item.subjectName || 'N/A'}
                                    </span>
                                    <p className="text-dark">
                                      <i className="ti ti-clock me-1" />
                                      {formatTime(item.startTime)} - {formatTime(item.endTime)}
                                    </p>
                                  </div>
                                ))
                              ) : (
                                <div className="rounded p-3 mb-4 border">
                                  <p className="text-muted text-center">No classes scheduled</p>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="card-footer border-0 pb-0">
                      <div className="row">
                        {breaks.length > 0 ? (
                          breaks.map((breakItem, index) => {
                            const breakType = breakItem.slotName?.toLowerCase() || '';
                            let bgClass = 'bg-transparent-primary';
                            let badgeClass = 'bg-primary';
                            let label = breakItem.slotName || 'Break';

                            if (breakType.includes('lunch')) {
                              bgClass = 'bg-transparent-warning';
                              badgeClass = 'bg-warning';
                              label = 'Lunch';
                            } else if (breakType.includes('evening') || breakType.includes('afternoon')) {
                              bgClass = 'bg-transparent-info';
                              badgeClass = 'bg-info';
                              label = 'Evening Break';
                            } else if (breakType.includes('morning')) {
                              bgClass = 'bg-transparent-primary';
                              badgeClass = 'bg-primary';
                              label = 'Morning Break';
                            }

                            return (
                              <div key={index} className="col-lg-4 col-xxl-4 col-xl-4 d-flex">
                                <div className="card flex-fill">
                                  <div className={`card-body ${bgClass}`}>
                                    <span className={`${badgeClass} badge badge-sm mb-2`}>
                                      {label}
                                    </span>
                                    <p className="text-dark">
                                      <i className="ti ti-clock me-1" />
                                      {formatTime(breakItem.startTime)} to {formatTime(breakItem.endTime)}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <>
                            <div className="col-lg-4 col-xxl-4 col-xl-4 d-flex">
                              <div className="card flex-fill">
                                <div className="card-body bg-transparent-primary">
                                  <span className="bg-primary badge badge-sm mb-2">
                                    Morning Break
                                  </span>
                                  <p className="text-dark">
                                    <i className="ti ti-clock me-1" />
                                    No break time set
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="col-lg-4 col-xxl-3 d-flex">
                              <div className="card flex-fill">
                                <div className="card-body bg-transparent-warning">
                                  <span className="bg-warning badge badge-sm mb-2">
                                    Lunch
                                  </span>
                                  <p className="text-dark">
                                    <i className="ti ti-clock me-1" />
                                    No lunch time set
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="col-lg-4 col-xxl-3 d-flex">
                              <div className="card flex-fill">
                                <div className="card-body bg-transparent-info">
                                  <span className="bg-info badge badge-sm mb-2">
                                    Evening Break
                                  </span>
                                  <p className="text-dark">
                                    <i className="ti ti-clock me-1" />
                                    No break time set
                                  </p>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
      <TeacherModal />
    </>
  );
};

export default TeachersRoutine;
