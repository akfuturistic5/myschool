
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { all_routes } from "../../../router/all_routes";

import ImageWithBasePath from "../../../../core/common/imageWithBasePath";
import TeacherModal from "../teacherModal";
import TeacherSidebar from "./teacherSidebar";
import TeacherBreadcrumb from "./teacherBreadcrumb";
import { apiService } from "../../../../core/services/apiService";

interface TeacherDetailsLocationState {
  teacherId?: number;
  teacher?: any;
}

const TeacherLibrary = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as TeacherDetailsLocationState | null;
  const teacherId = state?.teacherId ?? state?.teacher?.id;
  const [teacher, setTeacher] = useState<any>(state?.teacher ?? null);
  const [loading, setLoading] = useState(!!teacherId);
  const [issues, setIssues] = useState<any[]>([]);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesError, setIssuesError] = useState<string | null>(null);

  const staffId = teacher?.staff_id != null ? Number(teacher.staff_id) : null;

  const loadIssues = useCallback(async () => {
    if (!staffId) {
      setIssues([]);
      return;
    }
    setIssuesLoading(true);
    setIssuesError(null);
    try {
      const res = await apiService.getLibraryIssues({ staff_id: staffId });
      const list = (res as any)?.data || [];
      setIssues(list);
    } catch (e: any) {
      setIssuesError(e?.message || "Could not load library issues");
      setIssues([]);
    } finally {
      setIssuesLoading(false);
    }
  }, [staffId]);

  useEffect(() => {
    loadIssues();
  }, [loadIssues]);

  // Always fetch full teacher by ID when teacherId is available to ensure we have complete data
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

  return (
    <>
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            {/* Page Header */}
            <TeacherBreadcrumb />
            {/* /Page Header */}
          </div>
          <div className="row">
            {/* Teacher Information */}
            {loading ? (
              <div className="col-xxl-3 col-xl-4">
                <div className="d-flex justify-content-center align-items-center p-5">
                  <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                  </div>
                </div>
              </div>
            ) : (
              <TeacherSidebar teacher={teacher} />
            )}
            {/* /Teacher Information */}
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  {/* List */}
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={routes.teacherDetails}
                        className="nav-link "
                        state={{ teacherId: teacher?.id, teacher }}
                      >
                        <i className="ti ti-school me-2" />
                        Teacher Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.teachersRoutine}
                        className="nav-link "
                        state={{ teacherId: teacher?.id, teacher }}
                      >
                        <i className="ti ti-table-options me-2" />
                        Routine
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.teacherLeaves}
                        className="nav-link"
                        state={{ teacherId: teacher?.id, teacher }}
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.teacherSalary}
                        className="nav-link"
                        state={{ teacherId: teacher?.id, teacher }}
                      >
                        <i className="ti ti-report-money me-2" />
                        Salary
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.teacherLibrary}
                        className="nav-link active"
                        state={{ teacherId: teacher?.id, teacher }}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Library
                      </Link>
                    </li>
                  </ul>
                  {/* /List */}
                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between">
                      <h5>Library</h5>
                      <div className="dropdown">
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
                    <div className="card-body pb-1">
                      {!staffId && !loading && (
                        <p className="text-muted">Staff profile is not linked; library issues cannot be loaded.</p>
                      )}
                      {issuesError && <div className="alert alert-warning">{issuesError}</div>}
                      {issuesLoading ? (
                        <p className="text-muted">Loading…</p>
                      ) : issues.length === 0 && staffId ? (
                        <p className="text-muted mb-0">No library issues on record.</p>
                      ) : (
                        <div className="row">
                          {issues.map((row: any) => (
                            <div key={row.id} className="col-xxl-4 col-md-6 d-flex">
                              <div className="card mb-3 flex-fill">
                                <div className="card-body pb-1">
                                  <span className="avatar avatar-xl mb-3">
                                    <ImageWithBasePath
                                      src="assets/img/books/book-01.jpg"
                                      className="img-fluid rounded"
                                      alt="img"
                                    />
                                  </span>
                                  <h6 className="mb-3">{row.booksIssued || row.book_title || "Book"}</h6>
                                  <div className="row">
                                    <div className="col-sm-6">
                                      <div className="mb-3">
                                        <span className="fs-12 mb-1">Book taken on </span>
                                        <p className="text-dark">{row.dateofIssue || "—"}</p>
                                      </div>
                                    </div>
                                    <div className="col-sm-6">
                                      <div className="mb-3">
                                        <span className="fs-12 mb-1">Due date</span>
                                        <p className="text-dark">{row.dueDate || "—"}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <span className="badge bg-light text-dark">{row.status}</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
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

export default TeacherLibrary;

