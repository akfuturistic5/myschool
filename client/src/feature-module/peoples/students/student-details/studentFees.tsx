
import { Link, useLocation } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import StudentModals from "../studentModals";
import StudentSidebar from "./studentSidebar";
import StudentBreadcrumb from "./studentBreadcrumb";
import { useAcademicYears } from "../../../../core/hooks/useAcademicYears";
import { useStudentFees } from "../../../../core/hooks/useStudentFees";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";

interface StudentDetailsLocationState {
  studentId?: number;
  student?: any;
}

const StudentFees = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as StudentDetailsLocationState | null;
  const { studentId, student, loading } = useLinkedStudentContext({
    locationState: state,
  });

  const { academicYears } = useAcademicYears();
  const { data: feeData, loading: feeLoading, refetch: refetchFees } = useStudentFees(studentId ?? student?.id ?? null);
  const currentAcademicYear =
    (academicYears || []).find((year: { is_current?: boolean }) => year?.is_current) ??
    (academicYears || [])[0] ??
    null;
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
      {/* Page Wrapper */}
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            {/* Page Header */}
            <StudentBreadcrumb />
            {/* /Page Header */}
          </div>
          <div className="row">
            {/* Student Information */}
            <StudentSidebar student={student} />
            {/* /Student Information */}
            <div className="col-xxl-9 col-xl-8">
              <div className="row">
                <div className="col-md-12">
                  {/* List */}
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
                        className="nav-link "
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.studentFees} className="nav-link active">
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
                  {/* /List */}
                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                      <h4 className="mb-3">Fees</h4>
                      <span className="badge badge-soft-primary mb-3">
                        {currentAcademicYear?.year_name ? `Academic Year: ${currentAcademicYear.year_name}` : "Academic Year not available"}
                      </span>
                    </div>
                    <div className="card-body p-0 py-3">
                      {feeLoading && (
                        <div className="d-flex justify-content-center align-items-center p-4">
                          <div className="spinner-border text-primary" role="status" />
                          <span className="ms-2">Loading fees...</span>
                        </div>
                      )}
                      {!feeLoading && (
                        <div className="custom-datatable-filter table-responsive">
                          <table className="table datatable">
                            <thead className="thead-light">
                              <tr>
                                <th>Fees Group</th>
                                <th>Fees Code</th>
                                <th>Due Date</th>
                                <th>Amount $</th>
                                <th>Status</th>
                                <th>Ref ID</th>
                                <th>Mode</th>
                                <th>Date Paid</th>
                                <th>Discount ($)</th>
                                <th>Fine ($)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {feeData?.structures && feeData.structures.length > 0 && (feeData.totalPaid ?? 0) > 0 ? (
                                <>
                                  {feeData.structures.map((row: any) => (
                                    <tr key={row.feeStructureId}>
                                      <td>
                                        <p className="text-primary fees-group">
                                          {row.className || "-"}
                                          <span className="d-block">({row.feeName})</span>
                                        </p>
                                      </td>
                                      <td>{row.feeType || "-"}</td>
                                      <td>
                                        {row.dueDate
                                          ? new Date(row.dueDate).toLocaleDateString("en-GB", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                            })
                                          : "-"}
                                      </td>
                                      <td>{row.dueAmount?.toFixed(2) ?? 0}</td>
                                      <td>
                                        <span
                                          className={`badge d-inline-flex align-items-center ${
                                            row.status === "Paid"
                                              ? "badge-soft-success"
                                              : "badge-soft-danger"
                                          }`}
                                        >
                                          <i className="ti ti-circle-filled fs-5 me-1" />
                                          {row.status === "Paid" ? "Paid" : "Partial"}
                                        </span>
                                      </td>
                                      <td>{row.lastReceiptNumber ? `#${row.lastReceiptNumber}` : "-"}</td>
                                      <td>{row.lastPaymentMethod || "-"}</td>
                                      <td>
                                        {row.lastPaymentDate
                                          ? new Date(row.lastPaymentDate).toLocaleDateString("en-GB", {
                                              day: "2-digit",
                                              month: "short",
                                              year: "numeric",
                                            })
                                          : "-"}
                                      </td>
                                      <td>{row.discountAmount != null ? Number(row.discountAmount).toFixed(2) : "-"}</td>
                                      <td>{row.fineAmount != null ? Number(row.fineAmount).toFixed(2) : "-"}</td>
                                    </tr>
                                  ))}
                                  <tr>
                                    <td className="bg-dark">-</td>
                                    <td className="bg-dark" />
                                    <td className="bg-dark" />
                                    <td className="bg-dark text-white">
                                      {feeData.totalPaid?.toFixed(2) ?? 0}
                                    </td>
                                    <td className="bg-dark" />
                                    <td className="bg-dark" />
                                    <td className="bg-dark" />
                                    <td className="bg-dark" />
                                    <td className="bg-dark text-white">-</td>
                                    <td className="bg-dark text-white">-</td>
                                  </tr>
                                </>
                              ) : (
                                <tr>
                                  <td colSpan={10} className="text-center text-muted py-4">
                                    {feeData?.structures && feeData.structures.length > 0
                                      ? "No fee payments yet. Fee records will appear here once payments are made."
                                      : "No fee data available. Fees will appear here when assigned."}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {/* /Fees List */}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* /Page Wrapper */}
      <StudentModals
        studentId={student?.id}
        student={student}
        feeData={feeData ?? null}
        onFeeCollected={refetchFees}
      />
    </>
  );
};

export default StudentFees;
