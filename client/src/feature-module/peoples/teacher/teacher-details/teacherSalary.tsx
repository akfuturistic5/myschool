
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { all_routes } from "../../../router/all_routes";
import Table from "../../../../core/common/dataTable/index";
import type { TableData } from "../../../../core/data/interface";
import TeacherSidebar from "./teacherSidebar";
import TeacherBreadcrumb from "./teacherBreadcrumb";
import TeacherModal from "../teacherModal";
import { salarydata } from "../../../../core/data/json/salary";
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
  const data = salarydata;
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (text: string) => (
        <Link to="#" className="link-primary">
          {text}
        </Link>
      ),
      sorter: (a: TableData, b: TableData) => a.id.length - b.id.length,
    },
    {
      title: "Salary For",
      dataIndex: "Salary_For",
      sorter: (a: any, b: any) => a.Salary_For.length - b.Salary_For.length,
    },
    {
      title: "Date",
      dataIndex: "date",
      sorter: (a: TableData, b: TableData) =>
        parseFloat(a.date) - parseFloat(b.date),
    },
    {
      title: "Payment Method",
      dataIndex: "Payment_Method",
      sorter: (a: any, b: any) =>
        a.Payment_Method.length - b.Payment_Method.length,
    },
    {
      title: "Net Salary",
      dataIndex: "Net_Salary",
      sorter: (a: any, b: any) => a.Net_Salary.length - b.Net_Salary.length,
    },
    {
      title: " ",
      dataIndex: "Net_Salary",
      render: () => (
        <>
          <Link to="#" className="btn btn-light add-fee">
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
                      <Link to={routes.teacherDetails} className="nav-link ">
                        <i className="ti ti-school me-2" />
                        Teacher Details
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.teachersRoutine} className="nav-link ">
                        <i className="ti ti-table-options me-2" />
                        Routine
                      </Link>
                    </li>
                    <li>
                      <Link to={routes.teacherLeaves} className="nav-link">
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
                      <Link to={routes.teacherLibrary} className="nav-link">
                        <i className="ti ti-bookmark-edit me-2" />
                        Library
                      </Link>
                    </li>
                  </ul>
                  {/* /List */}
                  <div className="students-leaves-tab">
                    <div className="row">
                      <div className="col-md-6 col-xxl-3 d-flex">
                        <div className="d-flex align-items-center justify-content-between rounded border p-3 mb-3 flex-fill bg-white">
                          <div className="ms-2">
                            <p className="mb-1">Total Net Salary</p>
                            <h5>$5,55,410</h5>
                          </div>
                          <span className="avatar avatar-lg bg-secondary-transparent rounded flex-shrink-0 text-secondary">
                            <i className="ti ti-user-dollar fs-24" />
                          </span>
                        </div>
                      </div>
                      <div className="col-md-6 col-xxl-3 d-flex">
                        <div className="d-flex align-items-center justify-content-between rounded border p-3 mb-3 flex-fill bg-white">
                          <div className="ms-2">
                            <p className="mb-1">Total Gross Salary</p>
                            <h5>$5,58,380</h5>
                          </div>
                          <span className="avatar avatar-lg bg-success-transparent rounded flex-shrink-0 text-success">
                            <i className="ti ti-moneybag fs-24" />
                          </span>
                        </div>
                      </div>
                      <div className="col-md-6 col-xxl-3 d-flex">
                        <div className="d-flex align-items-center justify-content-between rounded border p-3 mb-3 flex-fill bg-white">
                          <div className="ms-2">
                            <p className="mb-1">Total Deduction</p>
                            <h5>$2,500</h5>
                          </div>
                          <span className="avatar avatar-lg bg-warning-transparent rounded flex-shrink-0 text-warning">
                            <i className="ti ti-arrow-big-down-lines fs-24" />
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
                          dataSource={data}
                          columns={columns}
                          Selection={true}
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
