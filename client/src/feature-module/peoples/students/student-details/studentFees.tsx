
import { Link, useLocation } from "react-router-dom";
import { all_routes } from "../../../router/all_routes";
import StudentModals from "../studentModals";
import StudentSidebar from "./studentSidebar";
import StudentBreadcrumb from "./studentBreadcrumb";
import { useAcademicYears } from "../../../../core/hooks/useAcademicYears";
import { useStudentFees } from "../../../../core/hooks/useStudentFees";
import { useLinkedStudentContext } from "../../../../core/hooks/useLinkedStudentContext";
import { useState, useEffect, useCallback } from "react";
import { apiService } from "../../../../core/services/apiService";
import { generateFeeReceipt } from "../../../../core/utils/pdfReceiptGenerator";
import dayjs from "dayjs";

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

  const [history, setHistory] = useState<any[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchHistory = useCallback(async () => {
    const sId = studentId ?? student?.id;
    const yId = (currentAcademicYear as any)?.id;
    if (!sId || !yId) return;

    setHistoryLoading(true);
    try {
      const res = await apiService.getPaymentHistoryDetailed(sId, yId);
      if (res.status === "SUCCESS") {
        setHistory(res.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch payment history", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [studentId, student?.id, currentAcademicYear]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const feeData = ((data as unknown) as any[]) || [];

  // Group history by transaction_id (receipt number)
  const groupedHistory = history.reduce((acc: any, curr: any) => {
    const rid = curr.transaction_id || 'N/A';
    if (!acc[rid]) {
      acc[rid] = {
        receipt_no: rid,
        date: curr.payment_date,
        payment_mode: curr.payment_mode,
        remarks: curr.remarks,
        items: [],
        total_paid: 0,
        fine_paid: 0,
        raw_rows: []
      };
    }
    acc[rid].items.push({
      fee_type: curr.installment_name || curr.fee_type_name || curr.fee_type || 'Fee Payment',
      amount: parseFloat(curr.amount_paid)
    });
    acc[rid].total_paid += parseFloat(curr.amount_paid);
    acc[rid].fine_paid += parseFloat(curr.fine_paid || 0);
    acc[rid].raw_rows.push(curr);
    return acc;
  }, {});

  const historyEntries = Object.values(groupedHistory).sort((a: any, b: any) => 
    new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const handlePrintReceipt = async (entry: any) => {
    try {
      const schoolRes = await apiService.getSchoolProfile();
      const schoolInfo = schoolRes?.data || {
        name: "School Management System",
        address: "N/A",
        phone: "N/A",
        email: "N/A"
      };

      await generateFeeReceipt({
        school: {
          name: schoolInfo.school_name || schoolInfo.name || "School Management System",
          address: schoolInfo.address || "N/A",
          phone: schoolInfo.phone || schoolInfo.mobile || "N/A",
          email: schoolInfo.email || "N/A",
          logo_url: schoolInfo.logo_url
        },
        student: {
          name: [student.first_name, student.last_name].filter(Boolean).join(' '),
          admission_number: student.admission_number || "N/A",
          roll_number: student.roll_number,
          class_name: student.class_name || "N/A",
          section_name: student.section_name || "N/A"
        },
        academic_year: (currentAcademicYear as any)?.year_name || "N/A",
        payment: {
          receipt_no: entry.receipt_no,
          date: entry.date,
          payment_mode: entry.payment_mode,
          remarks: entry.remarks,
          items: entry.items,
          total_paid: entry.total_paid,
          fine_paid: entry.fine_paid
        }
      });
    } catch (err) {
      console.error("Failed to print receipt", err);
    }
  };

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
                    <li>
                      <Link
                        to={effectiveStudentId ? `${routes.studentLibrary}?studentId=${effectiveStudentId}` : routes.studentLibrary}
                        className="nav-link"
                        state={student ? { studentId: student.id, student } : undefined}
                      >
                        <i className="ti ti-books me-2" />
                        Library
                      </Link>
                    </li>
                  </ul>
                  {/* /List */}
                  <div className="card">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                      <div className="d-flex align-items-center mb-3">
                        <h4 className="mb-0 me-3">Fees</h4>

                      </div>
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
                    </div>
                  </div>

                  {/* Payment History */}
                  <div className="card mt-4">
                    <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                      <div className="d-flex align-items-center mb-3">
                        <h4 className="mb-0 me-3">Payment History</h4>
                      </div>
                    </div>
                    <div className="card-body p-0 py-3">
                      {historyLoading && (
                        <div className="d-flex justify-content-center align-items-center p-4">
                          <div className="spinner-border text-primary" role="status" />
                          <span className="ms-2">Loading history...</span>
                        </div>
                      )}
                      {!historyLoading && (
                        <div className="custom-datatable-filter table-responsive">
                          <table className="table datatable">
                            <thead className="thead-light">
                              <tr>
                                <th>Receipt No</th>
                                <th>Date</th>
                                <th>Mode</th>
                                <th>Amount Paid</th>
                                <th>Fine</th>
                                <th>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historyEntries.length > 0 ? (
                                historyEntries.map((entry: any) => (
                                  <tr key={entry.receipt_no}>
                                    <td className="fw-bold text-primary">{entry.receipt_no}</td>
                                    <td>{dayjs(entry.date).format("DD-MM-YYYY")}</td>
                                    <td>{entry.payment_mode}</td>
                                    <td className="fw-bold">{(entry.total_paid).toLocaleString()}</td>
                                    <td>{(entry.fine_paid).toLocaleString()}</td>
                                    <td>
                                      <button 
                                        className="btn btn-outline-primary btn-sm d-inline-flex align-items-center"
                                        onClick={() => handlePrintReceipt(entry)}
                                      >
                                        <i className="ti ti-printer me-1" />
                                        Print Receipt
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={6} className="text-center text-muted py-4">
                                    No payment transactions found.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* /Payment History */}
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

