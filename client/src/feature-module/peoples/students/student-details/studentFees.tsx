
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
  const effectiveStudentId =
    (typeof studentId === "number" && Number.isFinite(studentId) && studentId > 0
      ? studentId
      : Number(student?.id) > 0
        ? Number(student.id)
        : null);

  const { academicYears } = useAcademicYears();
  const academicYearsArray = Array.isArray(academicYears) ? academicYears : [];
  const currentAcademicYear =
    academicYearsArray.find((year: any) => year?.is_current) ??
    academicYearsArray[0] ??
    null;
  
  const { data, loading: feeLoading, refetch: refetchFees } = useStudentFees(
    studentId ?? student?.id ?? null,
    (currentAcademicYear as any)?.id ?? null
  );

  const feeData = (data as any[]) || [];

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
            <StudentBreadcrumb studentId={student?.id} />
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
                        to={student?.id ? `${routes.studentDetail}/${student.id}` : routes.studentDetail}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-school me-2" />
                        Student Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentTimeTable}?studentId=${effectiveStudentId}` : routes.studentTimeTable}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-table-options me-2" />
                        Time Table
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentLeaves}?studentId=${effectiveStudentId}` : routes.studentLeaves}
                        className="nav-link "
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leave &amp; Attendance
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentFees}?studentId=${effectiveStudentId}` : routes.studentFees}
                        className="nav-link active"
                      >
                        <i className="ti ti-report-money me-2" />
                        Fees
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentResult}?studentId=${effectiveStudentId}` : routes.studentResult}
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
                        {(currentAcademicYear as any)?.year_name ? `Academic Year: ${(currentAcademicYear as any).year_name}` : "Academic Year not available"}
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
                                <th>Fees Type</th>
                                <th>Amount</th>
                                <th>Paid</th>
                                <th>Balance</th>
                                <th>Discount</th>
                                <th>Fine</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                               {feeData && feeData.length > 0 ? (
                                  <>
                                    {feeData.map((row: any) => (
                                      <tr key={row.fees_assign_details_id}>
                                        <td>{row.fee_group || "-"}</td>
                                        <td>{row.fee_type || "-"}</td>
                                        <td>{parseFloat(row.total_amount || 0).toLocaleString()}</td>
                                        <td>{parseFloat(row.paid_amount || 0).toLocaleString()}</td>
                                        <td>{parseFloat(row.pending_amount || 0).toLocaleString()}</td>
                                        <td>{parseFloat(row.discount_amount || 0).toLocaleString()}</td>
                                        <td>{parseFloat(row.fine_amount || 0).toLocaleString()}</td>
                                        <td>
                                          <span
                                            className={`badge d-inline-flex align-items-center ${
                                              parseFloat(row.pending_amount) <= 0
                                                ? "badge-soft-success"
                                                : parseFloat(row.paid_amount) > 0 ? "badge-soft-warning" : "badge-soft-danger"
                                            }`}
                                          >
                                            <i className="ti ti-circle-filled fs-5 me-1" />
                                            {parseFloat(row.pending_amount) <= 0 ? "Paid" : parseFloat(row.paid_amount) > 0 ? "Partial" : "Unpaid"}
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                    <tr className="table-dark">
                                      <td colSpan={2} className="text-end fw-bold">Totals:</td>
                                      <td className="fw-bold">{feeData.reduce((sum: number, r: any) => sum + (parseFloat(r?.total_amount) || 0), 0).toLocaleString()}</td>
                                      <td className="fw-bold text-success">{feeData.reduce((sum: number, r: any) => sum + (parseFloat(r?.paid_amount) || 0), 0).toLocaleString()}</td>
                                      <td className="fw-bold text-danger">{feeData.reduce((sum: number, r: any) => sum + (parseFloat(r?.pending_amount) || 0), 0).toLocaleString()}</td>
                                      <td className="fw-bold">{feeData.reduce((sum: number, r: any) => sum + (parseFloat(r?.discount_amount) || 0), 0).toLocaleString()}</td>
                                      <td className="fw-bold">{feeData.reduce((sum: number, r: any) => sum + (parseFloat(r?.fine_amount) || 0), 0).toLocaleString()}</td>
                                      <td></td>
                                    </tr>
                                  </>
                                ) : (
                                  <tr>
                                    <td colSpan={8} className="text-center text-muted py-4">
                                      No fee assignments found for the current academic year.
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
        feeData={feeData}
        onFeeCollected={refetchFees}
      />
    </>
  );
};

export default StudentFees;
