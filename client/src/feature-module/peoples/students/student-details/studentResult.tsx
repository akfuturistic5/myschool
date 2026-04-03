import { Link, useLocation } from "react-router-dom";
import { useMemo } from "react";
import { all_routes } from "../../../router/all_routes";
import StudentModals from "../studentModals";
import StudentSidebar from "./studentSidebar";
import StudentBreadcrumb from "./studentBreadcrumb";
import { useStudentExamResults } from "../../../../core/hooks/useStudentExamResults";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";

interface StudentDetailsLocationState {
  studentId?: number;
  student?: any;
}

const StudentResult = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as StudentDetailsLocationState | null;
  const { studentId, student, loading } = useLinkedStudentContext({
    locationState: state,
  });

  const { data: examResultsData, loading: examLoading, error: examError } = useStudentExamResults(studentId ?? null);

  const exams = useMemo(() => {
    const list = Array.isArray(examResultsData?.exams) ? examResultsData.exams : [];
    return list.filter((exam: any) => Array.isArray(exam.subjects) && exam.subjects.length > 0);
  }, [examResultsData]);

  const overallSummary = useMemo(() => {
    if (exams.length === 0) {
      return { totalExams: 0, passCount: 0, averagePercentage: null as number | null };
    }
    const passCount = exams.filter((exam: any) => String(exam.summary?.overallResult || "").toLowerCase() === "pass").length;
    const percentages = exams
      .map((exam: any) => Number(exam.summary?.percentage))
      .filter((value: number) => Number.isFinite(value));
    const averagePercentage = percentages.length
      ? Number((percentages.reduce((sum, value) => sum + value, 0) / percentages.length).toFixed(2))
      : null;
    return { totalExams: exams.length, passCount, averagePercentage };
  }, [exams]);

  const showLoading = loading;
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
                        className="nav-link active"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Exam &amp; Results
                      </Link>
                    </li>
                  </ul>

                  <div className="row g-3 mb-3">
                    <div className="col-md-4 d-flex">
                      <div className="card flex-fill mb-0">
                        <div className="card-body">
                          <p className="text-muted mb-1">Total Exams</p>
                          <h4 className="mb-0">{overallSummary.totalExams}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 d-flex">
                      <div className="card flex-fill mb-0">
                        <div className="card-body">
                          <p className="text-muted mb-1">Passed Exams</p>
                          <h4 className="mb-0">{overallSummary.passCount}</h4>
                        </div>
                      </div>
                    </div>
                    <div className="col-md-4 d-flex">
                      <div className="card flex-fill mb-0">
                        <div className="card-body">
                          <p className="text-muted mb-1">Average Percentage</p>
                          <h4 className="mb-0">
                            {overallSummary.averagePercentage != null ? `${overallSummary.averagePercentage}%` : "N/A"}
                          </h4>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <h4 className="mb-0">Exam &amp; Results</h4>
                    </div>
                    <div className="card-body">
                      {examError && (
                        <div className="alert alert-warning d-flex align-items-center mb-3" role="alert">
                          <i className="ti ti-alert-circle me-2 fs-18" />
                          <span>{examError}</span>
                        </div>
                      )}

                      {examLoading && (
                        <div className="d-flex justify-content-center align-items-center p-4">
                          <div className="spinner-border text-primary" role="status" />
                          <span className="ms-2">Loading exam results...</span>
                        </div>
                      )}

                      {!examLoading && exams.length === 0 && (
                        <div className="alert alert-info d-flex align-items-center mb-0" role="alert">
                          <i className="ti ti-info-circle me-2 fs-18" />
                          <span>No exam results are available yet.</span>
                        </div>
                      )}

                      {!examLoading && exams.length > 0 && (
                        <div className="accordion accordions-items-seperate" id="student-exam-results">
                          {exams.map((exam: any, index: number) => {
                            const collapseId = `student-exam-${exam.examId ?? index}`;
                            const summary = exam.summary || {};
                            const isPass = String(summary.overallResult || "").toLowerCase() === "pass";
                            return (
                              <div className="accordion-item" key={collapseId}>
                                <h2 className="accordion-header">
                                  <button
                                    className={`accordion-button ${index === 0 ? "" : "collapsed"}`}
                                    type="button"
                                    data-bs-toggle="collapse"
                                    data-bs-target={`#${collapseId}`}
                                    aria-expanded={index === 0}
                                    aria-controls={collapseId}
                                  >
                                    <span className={`avatar avatar-sm ${isPass ? "bg-success" : "bg-danger"} me-2`}>
                                      <i className={`ti ${isPass ? "ti-checks" : "ti-x"}`} />
                                    </span>
                                    <span className="me-3">{exam.examLabel || exam.examName || `Exam ${index + 1}`}</span>
                                    <span className="text-muted small">
                                      {exam.examDate
                                        ? new Date(exam.examDate).toLocaleDateString("en-GB", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                          })
                                        : "Date not available"}
                                    </span>
                                  </button>
                                </h2>
                                <div
                                  id={collapseId}
                                  className={`accordion-collapse collapse ${index === 0 ? "show" : ""}`}
                                  data-bs-parent="#student-exam-results"
                                >
                                  <div className="accordion-body">
                                    <div className="table-responsive">
                                      <table className="table">
                                        <thead className="thead-light">
                                          <tr>
                                            <th>Subject</th>
                                            <th>Max Marks</th>
                                            <th>Min Marks</th>
                                            <th>Marks Obtained</th>
                                            <th className="text-end">Result</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {exam.subjects.map((subject: any, subjectIndex: number) => {
                                            const subjectPass = String(subject.result || "").toLowerCase() === "pass";
                                            return (
                                              <tr key={`${collapseId}-subject-${subject.subjectId ?? subjectIndex}`}>
                                                <td>{subject.subjectName || "Subject"}</td>
                                                <td>{subject.maxMarks ?? "N/A"}</td>
                                                <td>{subject.minMarks ?? "N/A"}</td>
                                                <td>{subject.marksObtained ?? "N/A"}</td>
                                                <td className="text-end">
                                                  <span
                                                    className={`badge ${subjectPass ? "badge-soft-success" : "badge-soft-danger"} d-inline-flex align-items-center`}
                                                  >
                                                    <i className="ti ti-circle-filled fs-5 me-1" />
                                                    {subject.result || "N/A"}
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          })}
                                          <tr>
                                            <td className="bg-dark text-white">Subjects : {exam.subjects.length}</td>
                                            <td className="bg-dark text-white">Total : {summary.totalMax ?? "N/A"}</td>
                                            <td className="bg-dark text-white">Passing : {summary.totalMin ?? "N/A"}</td>
                                            <td className="bg-dark text-white">Obtained : {summary.totalObtained ?? "N/A"}</td>
                                            <td className="bg-dark text-white text-end">
                                              <div className="d-flex align-items-center justify-content-end gap-2">
                                                <span>{summary.percentage != null ? `${summary.percentage}%` : "N/A"}</span>
                                                <span className={isPass ? "text-success" : "text-danger"}>
                                                  {summary.overallResult || "N/A"}
                                                </span>
                                              </div>
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
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
      <StudentModals />
    </>
  );
};

export default StudentResult;
