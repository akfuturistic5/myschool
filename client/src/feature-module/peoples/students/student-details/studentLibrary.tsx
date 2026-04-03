import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { all_routes } from "../../../router/all_routes";
import StudentModals from "../studentModals";
import StudentSidebar from "./studentSidebar";
import StudentBreadcrumb from "./studentBreadcrumb";
import { apiService } from "../../../../core/services/apiService";
import { useCurrentStudent } from "../../../../core/hooks/useCurrentStudent";
import { useSelector } from "react-redux";
import { selectUser } from "../../../../core/data/redux/authSlice";

interface StudentDetailsLocationState {
  studentId?: number;
  student?: any;
}

const StudentLibrary = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as StudentDetailsLocationState | null;
  const currentUser = useSelector(selectUser);
  const { student: currentStudent, loading: currentStudentLoading } = useCurrentStudent();
  const role = (currentUser?.role || "").toString().toLowerCase();
  const isStudentRole = role === "student";

  const studentId = state?.studentId ?? state?.student?.id ?? (isStudentRole && currentStudent ? currentStudent.id : null);
  const [student, setStudent] = useState<any>(state?.student ?? (isStudentRole ? currentStudent : null));
  const [loading, setLoading] = useState(
    (!!studentId && !state?.student && !(isStudentRole && currentStudent)) ||
    (isStudentRole && !studentId && currentStudentLoading)
  );

  useEffect(() => {
    if (!studentId) {
      if (state?.student) setStudent(state.student);
      else if (isStudentRole && currentStudent) setStudent(currentStudent);
      return;
    }
    if (state?.student && state.student.id === studentId) {
      setStudent(state.student);
      setLoading(false);
      return;
    }
    if (isStudentRole && currentStudent?.id === studentId) {
      setStudent(currentStudent);
      setLoading(false);
      return;
    }
    setLoading(true);
    apiService
      .getStudentById(studentId)
      .then((res: any) => {
        if (res?.data) setStudent(res.data);
        else setStudent(null);
      })
      .catch(() => {
        setStudent(null);
      })
      .finally(() => setLoading(false));
  }, [studentId, state?.student, isStudentRole, currentStudent]);

  const showLoading = loading || (isStudentRole && !student && !state?.student && currentStudentLoading);

  if (showLoading) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading student...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <StudentBreadcrumb />
          </div>
          <div className="row">
            <StudentSidebar student={student} />
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={routes.studentDetail}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-school me-2" />
                        Student Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentTimeTable}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-table-options me-2" />
                        Time Table
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentLeaves}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentFees}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-report-money me-2" />
                        Fees
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.studentResult}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Exam &amp; Results
                      </Link>
                    </li>
                  </ul>

                  <div className="card">
                    <div className="card-header">
                      <h4 className="mb-0">Library</h4>
                    </div>
                    <div className="card-body">
                      <div className="alert alert-info d-flex align-items-start mb-3" role="alert">
                        <i className="ti ti-info-circle me-2 fs-18 mt-1" />
                        <div>
                          <p className="mb-1">Library records are not available in the current student API.</p>
                          <p className="mb-0">Fake book entries have been removed so this page does not show dummy data.</p>
                        </div>
                      </div>

                      <div className="border rounded p-3 bg-light">
                        <div className="row g-3">
                          <div className="col-md-4">
                            <p className="text-muted mb-1">Student</p>
                            <h6 className="mb-0">
                              {student ? [student.first_name, student.last_name].filter(Boolean).join(" ") || "N/A" : "N/A"}
                            </h6>
                          </div>
                          <div className="col-md-4">
                            <p className="text-muted mb-1">Admission No</p>
                            <h6 className="mb-0">{student?.admission_number ?? "N/A"}</h6>
                          </div>
                          <div className="col-md-4">
                            <p className="text-muted mb-1">Class &amp; Section</p>
                            <h6 className="mb-0">
                              {student?.class_name && student?.section_name
                                ? `${student.class_name}, ${student.section_name}`
                                : student?.class_name || student?.section_name || "N/A"}
                            </h6>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 d-flex flex-wrap gap-2">
                        <Link
                          to={routes.studentDashboard}
                          className="btn btn-primary"
                          state={student ? { studentId: student.id, student } : undefined}
                        >
                          Back to Dashboard
                        </Link>
                        <Link
                          to={routes.noticeBoard}
                          className="btn btn-light"
                        >
                          View Notices
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <StudentModals />
    </>
  );
};

export default StudentLibrary;
