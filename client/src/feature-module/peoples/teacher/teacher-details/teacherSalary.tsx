
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { all_routes } from "../../../router/all_routes";
import Table from "../../../../core/common/dataTable/index";
import TeacherSidebar from "./teacherSidebar";
import TeacherBreadcrumb from "./teacherBreadcrumb";
import TeacherModal from "../teacherModal";
import { apiService } from "../../../../core/services/apiService";

interface TeacherDetailsLocationState {
  teacherId?: number;
  teacher?: any;
}

const TeacherSalary = () => {
  const routes = all_routes;
  const location = useLocation();
  const state = location.state as TeacherDetailsLocationState | null;
  const teacherId = state?.teacherId ?? state?.teacher?.id;
  const [teacher, setTeacher] = useState<any>(state?.teacher ?? null);
  const [loading, setLoading] = useState(!!teacherId);
  const [payslips, setPayslips] = useState<any[]>([]);
  const [payslipsLoading, setPayslipsLoading] = useState(false);

  // Always fetch full teacher by ID when teacherId is available to ensure we have complete data
  useEffect(() => {
    if (teacherId) {
      setLoading(true);
      apiService
        .getTeacherById(teacherId)
        .then((res: any) => {
          if (res?.data) setTeacher(res.data);
        })
        .catch(() => { })
        .finally(() => setLoading(false));
    }
  }, [teacherId]);

  // Fetch real payslip list for this teacher
  useEffect(() => {
    if (teacherId) {
      setPayslipsLoading(true);
      apiService
        .getPayrollList({ staff_id: teacherId })
        .then((res: any) => {
          if (res && res.status === "SUCCESS" && Array.isArray(res.data)) {
            setPayslips(res.data);
          } else if (Array.isArray(res)) {
            setPayslips(res);
          }
        })
        .catch((err) => {
          console.error("Error fetching payslips:", err);
        })
        .finally(() => setPayslipsLoading(false));
    }
  }, [teacherId]);

  // Helper to parse daterange start date
  const parseDaterangeStart = (range: any) => {
    if (!range) return null;
    if (typeof range === "string") {
      const match = range.match(/\d{4}-\d{2}-\d{2}/);
      return match ? new Date(match[0]) : null;
    }
    if (Array.isArray(range)) {
      return range[0] ? new Date(range[0]) : null;
    }
    if (typeof range === "object" && range.lower) {
      return new Date(range.lower);
    }
    return null;
  };

  const getSalaryFor = (date: Date | null) => {
    if (!date || Number.isNaN(date.getTime())) return "—";
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[date.getMonth()]} - ${date.getFullYear()}`;
  };

  const getFormattedDate = (dateStr: string | null) => {
    const d = dateStr ? new Date(dateStr) : new Date();
    if (Number.isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, '0');
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatCurrency = (amount: number) => {
    if (amount == null) return "—";
    const num = Number(amount);
    if (Number.isNaN(num)) return "—";
    return "₹" + num.toLocaleString("en-IN");
  };

  const tableData = payslips.map((p: any) => {
    const startDate = parseDaterangeStart(p.salary_period);
    const netSalaryNum = parseFloat(p.net_amount ?? p.net_salary ?? 0);
    const grossSalaryNum = parseFloat(p.gross_amount ?? 0);
    const deductionNum = grossSalaryNum - netSalaryNum;

    return {
      key: String(p.id),
      id: String(p.id),
      employee_code: p.employee_code || String(p.id),
      Salary_For: getSalaryFor(startDate),
      date: getFormattedDate(p.created_at || p.payment_date),
      Payment_Method: p.payment_method || "Bank Transfer",
      Net_Salary: formatCurrency(netSalaryNum),
      net_salary_num: netSalaryNum,
      gross_salary_num: grossSalaryNum,
      deduction_num: deductionNum,
    };
  });

  const basicSalary = parseFloat(teacher?.salary ?? 0);
  const components = Array.isArray(teacher?.salary_components) ? teacher.salary_components : [];
  
  let totalAllowance = 0;
  let totalDeduction = 0;

  components.forEach((comp: any) => {
    const name = String(comp.component_name || "").toLowerCase();
    const amt = parseFloat(comp.amount ?? 0);
    if (comp.type === "allowance") {
      if (name !== "basic salary") {
        totalAllowance += amt;
      }
    } else if (comp.type === "deduction") {
      totalDeduction += amt;
    }
  });

  const grossSalary = basicSalary + totalAllowance;
  const netSalary = grossSalary - totalDeduction;

  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: string, record: any) => (
        <Link to={routes.invoice.replace(":id", record.id)} className="link-primary">
          {record.employee_code || text}
        </Link>
      ),
      sorter: (a: any, b: any) => a.id.localeCompare(b.id),
    },
    {
      title: "Salary For",
      dataIndex: "Salary_For",
      sorter: (a: any, b: any) => a.Salary_For.localeCompare(b.Salary_For),
    },
    {
      title: "Date",
      dataIndex: "date",
      sorter: (a: any, b: any) => a.date.localeCompare(b.date),
    },
    {
      title: "Payment Method",
      dataIndex: "Payment_Method",
      sorter: (a: any, b: any) =>
        a.Payment_Method.localeCompare(b.Payment_Method),
    },
    {
      title: "Net Salary",
      dataIndex: "Net_Salary",
      sorter: (a: any, b: any) => a.net_salary_num - b.net_salary_num,
    },
    {
      title: " ",
      dataIndex: "id",
      render: (id: any) => (
        <>
          <Link to={routes.invoice.replace(":id", id)} className="btn btn-light add-fee">
            View Payslip
          </Link>
        </>
      ),
    },
  ];

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
                        className="nav-link active"
                      >
                        <i className="ti ti-report-money me-2" />
                        Salary
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={routes.teacherLibrary}
                        className="nav-link"
                        state={{ teacherId: teacher?.id, teacher }}
                      >
                        <i className="ti ti-bookmark-edit me-2" />
                        Library
                      </Link>
                    </li>
                  </ul>
                  {/* /List */}
                  <div className="students-leaves-tab">
                    <div className="row">
                      <div className="col-md-6 col-xxl-4 d-flex">
                        <div className="d-flex align-items-center justify-content-between rounded border p-3 mb-3 flex-fill bg-white">
                          <div className="ms-2">
                            <p className="mb-1 text-muted">Net Salary</p>
                            <h4 className="mb-1 text-primary fw-semibold">{formatCurrency(netSalary)}</h4>
                            <span className="small text-muted">Estimated take-home / month</span>
                          </div>
                          <span className="avatar avatar-lg bg-secondary-transparent rounded flex-shrink-0 text-secondary">
                            <i className="ti ti-user-dollar fs-24" />
                          </span>
                        </div>
                      </div>
                      <div className="col-md-6 col-xxl-4 d-flex">
                        <div className="d-flex align-items-center justify-content-between rounded border p-3 mb-3 flex-fill bg-white">
                          <div className="ms-2">
                            <p className="mb-1 text-muted">Gross Salary</p>
                            <h4 className="mb-1 text-success fw-semibold">{formatCurrency(grossSalary)}</h4>
                            <span className="small text-muted">Basic: {formatCurrency(basicSalary)}</span>
                          </div>
                          <span className="avatar avatar-lg bg-success-transparent rounded flex-shrink-0 text-success">
                            <i className="ti ti-moneybag fs-24" />
                          </span>
                        </div>
                      </div>
                      <div className="col-md-6 col-xxl-4 d-flex">
                        <div className="d-flex align-items-center justify-content-between rounded border p-3 mb-3 flex-fill bg-white">
                          <div className="ms-2">
                            <p className="mb-1 text-muted">Allowance &amp; Deduction</p>
                            <h4 className="mb-1 text-warning fw-semibold">+{formatCurrency(totalAllowance)} / -{formatCurrency(totalDeduction)}</h4>
                            <span className="small text-muted">Structured monthly adjustments</span>
                          </div>
                          <span className="avatar avatar-lg bg-warning-transparent rounded flex-shrink-0 text-warning">
                            <i className="ti ti-scale fs-24" />
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="card">
                      <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                        <h4 className="mb-3">Salary</h4>
                      </div>
                      <div className="card-body p-0 py-3">
                        {/* Payroll List */}
                        <Table
                          dataSource={tableData}
                          columns={columns}
                          Selection={true}
                          loading={payslipsLoading}
                        />
                        {/* /Payroll List */}
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

export default TeacherSalary;

