import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import Table from "../../../../core/common/dataTable/index";
import { staffpayroll } from "../../../../core/data/json/staff-payroll";
import type { TableData } from "../../../../core/data/interface";
import { all_routes } from "../../../router/all_routes";
import { selectUser } from "../../../../core/data/redux/authSlice";
import { canManageStaffDirectory } from "../staffDirectoryPermissions";
import { useStaffProfileLoader } from "../useStaffProfileLoader";
import { StaffProfileSidebar } from "../StaffProfileSidebar";
import { StaffProfilePageHeader } from "../StaffProfilePageHeader";

const StaffPayRoll = () => {
  const routes = all_routes;
  const user = useSelector(selectUser);
  const canManageDirectory = canManageStaffDirectory(user);
  const { staffId, staff, loading, error, detailSearch, navState } =
    useStaffProfileLoader();

  const data = staffpayroll;
  const columns = [
    {
      title: "ID",
      dataIndex: "id",
      render: (record: any) => (
        <>
          <Link to="#" className="link-primary">
            {record.id}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => a.id.length - b.id.length,
    },
    {
      title: "Salary For",
      dataIndex: "salaryFor",
      sorter: (a: TableData, b: TableData) =>
        a.salaryFor.length - b.salaryFor.length,
    },
    {
      title: "Date",
      dataIndex: "date",
      sorter: (a: TableData, b: TableData) => a.date.length - b.date.length,
    },
    {
      title: "Payment Method",
      dataIndex: "paymentMethod",
      sorter: (a: TableData, b: TableData) =>
        a.paymentMethod.length - b.paymentMethod.length,
    },
    {
      title: "Net Salary",
      dataIndex: "netSalary",
      sorter: (a: TableData, b: TableData) =>
        a.netSalary.length - b.netSalary.length,
    },
    {
      title: "",
      dataIndex: "view",
      render: (text: string) => (
        <>
          <Link to="#" className="btn btn-light add-fee">
            {text}
          </Link>
        </>
      ),
      sorter: (a: TableData, b: TableData) => a.view.length - b.view.length,
    },
  ];

  if (staffId == null) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="p-5 text-muted text-center">Redirecting…</div>
        </div>
      </div>
    );
  }

  if (loading || (!staff && !error)) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="d-flex justify-content-center align-items-center p-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
            <span className="ms-2">Loading staff…</span>
          </div>
        </div>
      </div>
    );
  }

  if (error || !staff) {
    return (
      <div className="page-wrapper">
        <div className="content">
          <div className="alert alert-danger">{error || "Staff not found."}</div>
          <Link to={routes.staff} className="btn btn-primary">
            Back to staff list
          </Link>
        </div>
      </div>
    );
  }

  const salaryOnRecord =
    staff.salary != null && staff.salary !== ""
      ? Number(staff.salary).toLocaleString(undefined, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        })
      : "—";

  return (
    <div>
      <div className="page-wrapper">
        <div className="content">
          <div className="row">
            <StaffProfilePageHeader
              routes={routes}
              canShowEdit={canManageDirectory}
              editTo={{ pathname: routes.editStaff, search: detailSearch }}
              editState={navState}
            />
            <div className="col-xxl-3 col-lg-4 theiaStickySidebar">
              <div className="stickybar">
                <StaffProfileSidebar staff={staff} />
              </div>
            </div>
            <div className="col-xxl-9 col-lg-8">
              <div className="row">
                <div className="col-md-12">
                  <ul className="nav nav-tabs nav-tabs-bottom mb-4">
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffDetails,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-info-square-rounded me-2" />
                        Basic Details
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffPayroll,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link active"
                      >
                        <i className="ti ti-file-dollar me-2" />
                        Payroll
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffLeave,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Leaves
                      </Link>
                    </li>
                    <li>
                      <Link
                        to={{
                          pathname: routes.staffsAttendance,
                          search: detailSearch,
                        }}
                        state={navState}
                        className="nav-link"
                      >
                        <i className="ti ti-calendar-due me-2" />
                        Attendance
                      </Link>
                    </li>
                  </ul>
                </div>
              </div>
              <div className="students-leaves-tab">
                <div className="row">
                  <div className="col-md-12 col-xxl-6 d-flex">
                    <div className="d-flex align-items-center justify-content-between rounded border p-3 mb-3 flex-fill">
                      <div className="ms-2">
                        <p className="mb-1 text-muted">Salary on staff record</p>
                        <h5 className="mb-0">{salaryOnRecord}</h5>
                      </div>
                      <span className="avatar avatar-lg bg-secondary-transparent rounded me-2 flex-shrink-0 text-secondary">
                        <i className="ti ti-user-dollar fs-24" />
                      </span>
                    </div>
                  </div>
                </div>
                <div className="card">
                  <div className="card-header d-flex align-items-center justify-content-between flex-wrap pb-0">
                    <h4 className="mb-3">Payroll</h4>
                    <span className="small text-muted mb-3">
                      Detailed payroll history is not connected to live data yet.
                    </span>
                  </div>
                  <div className="card-body p-0 py-3">
                    <Table
                      columns={columns}
                      dataSource={data}
                      Selection={false}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffPayRoll;





